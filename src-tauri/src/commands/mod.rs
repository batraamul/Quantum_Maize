//! Tauri IPC commands — the only surface the web UI can call.
//!
//! File commands take a project `root` plus a project-relative path. The root
//! must be one the user explicitly opened/created in this session
//! (`AppState::open_roots`), and every relative path is resolved with
//! traversal/symlink protection.

use crate::compiler::{self, detect, synctex, CompileManager, CompileRequest, CompileResult, OutputLine};
use crate::database::{Database, HistoryEntry, RecentProject};
use crate::error::{AppError, AppResult};
use crate::filesystem::{self, FileNode, ProjectInfo, ProjectMeta, Snapshot};
use crate::security::resolve_in_root;
use crate::settings::Settings;
use crate::templates::{self, importer, registry, StarterOptions, StarterTemplate};
use crate::{converter, online, presentation, story, submission};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub db: Database,
    pub compiler: CompileManager,
    pub open_roots: Mutex<HashSet<PathBuf>>,
    pub data_dir: PathBuf,
    pub story: story::PreviewState,
}

impl AppState {
    fn root(&self, root: &str) -> AppResult<PathBuf> {
        let p = PathBuf::from(root).canonicalize().map_err(|_| AppError::NotFound(root.into()))?;
        if self.open_roots.lock().unwrap().contains(&p) {
            Ok(p)
        } else {
            Err(AppError::Security("this folder has not been opened as a project".into()))
        }
    }
    fn register(&self, info: &ProjectInfo) -> AppResult<()> {
        self.open_roots.lock().unwrap().insert(PathBuf::from(&info.root));
        self.db.upsert_project(&info.meta.id, &info.meta.name, &info.root, &info.meta.main_file, &info.meta.engine, &info.meta.created_at)
    }
}

type S<'a> = State<'a, Arc<AppState>>;

// ---- settings & environment ------------------------------------------------

#[tauri::command]
pub fn get_settings(state: S) -> AppResult<Settings> {
    Settings::load(&state.db)
}

#[tauri::command]
pub fn save_settings(state: S, settings: Settings) -> AppResult<Settings> {
    let s = settings.sanitized();
    s.save(&state.db)?;
    Ok(s)
}

#[tauri::command]
pub async fn detect_tex(state: S<'_>, custom_bin_dir: Option<String>) -> AppResult<detect::TexInstallation> {
    let custom = match custom_bin_dir {
        Some(c) => Some(c),
        None => Settings::load(&state.db)?.tex_bin_dir,
    };
    tauri::async_runtime::spawn_blocking(move || detect::detect(custom.as_deref()))
        .await
        .map_err(|e| AppError::Other(e.to_string()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    os: String,
    arch: String,
    data_dir: String,
    schema_version: i64,
}

#[tauri::command]
pub fn app_info(state: S) -> AppResult<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").into(),
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        data_dir: state.data_dir.to_string_lossy().into_owned(),
        schema_version: state.db.schema_version()?,
    })
}

/// Forward webview console errors/warnings to the backend's stderr so they
/// appear in terminal / system logs (the webview console is not visible in
/// release builds).
#[tauri::command]
pub fn log_frontend(level: String, message: String) {
    let msg: String = message.chars().take(4000).collect();
    eprintln!("[frontend:{}] {}", level.chars().take(8).collect::<String>(), msg);
}

// ---- projects ----------------------------------------------------------------

#[tauri::command]
pub fn recent_projects(state: S) -> AppResult<Vec<RecentProject>> {
    state.db.recent_projects(15)
}

#[tauri::command]
pub fn forget_recent(state: S, path: String) -> AppResult<()> {
    state.db.forget_project(&path)
}

fn options_from(settings: &Settings, o: Option<StarterOptions>) -> StarterOptions {
    let mut o = o.unwrap_or_default();
    if o.author.trim().is_empty() { o.author = settings.owner_name.clone(); }
    if o.rank.trim().is_empty() { o.rank = settings.owner_rank.clone(); }
    if o.organization.trim().is_empty() { o.organization = settings.owner_organization.clone(); }
    if o.email.trim().is_empty() { o.email = settings.owner_email.clone(); }
    o
}

#[tauri::command]
pub fn create_project(state: S, parent_dir: String, name: String, template: StarterTemplate, engine: String, options: Option<StarterOptions>) -> AppResult<ProjectInfo> {
    let settings = Settings::load(&state.db)?;
    let o = options_from(&settings, options);
    let files = templates::files(template, name.trim(), &o);
    let main = if template == StarterTemplate::Story { "story.json" } else { "main.tex" };
    let info = filesystem::create_project_with(Path::new(&parent_dir), name.trim(), files, main, &engine, template.kind(), None)?;
    state.register(&info)?;
    let mut s = Settings::load(&state.db)?;
    s.last_project_dir = Some(parent_dir);
    s.save(&state.db)?;
    Ok(info)
}

#[tauri::command]
pub fn open_project(state: S, path: String) -> AppResult<ProjectInfo> {
    let info = filesystem::open_project(Path::new(&path))?;
    state.register(&info)?;
    Ok(info)
}

#[tauri::command]
pub fn update_project_meta(state: S, root: String, meta: ProjectMeta) -> AppResult<ProjectMeta> {
    let r = state.root(&root)?;
    filesystem::validate_engine(&meta.engine)?;
    if !matches!(meta.bib_tool.as_str(), "auto" | "bibtex" | "biber") {
        return Err(AppError::Invalid("bibTool must be auto, bibtex or biber".into()));
    }
    let main = resolve_in_root(&r, &meta.main_file)?;
    if !main.is_file() {
        return Err(AppError::NotFound(format!("main file {}", meta.main_file)));
    }
    let existing = filesystem::read_meta(&r)?;
    let updated = ProjectMeta { id: existing.id, created_at: existing.created_at, format_version: existing.format_version, ..meta };
    filesystem::write_meta(&r, &updated)?;
    state.db.upsert_project(&updated.id, &updated.name, &r.to_string_lossy(), &updated.main_file, &updated.engine, &updated.created_at)?;
    Ok(updated)
}

// ---- files -------------------------------------------------------------------

#[tauri::command]
pub fn list_files(state: S, root: String) -> AppResult<Vec<FileNode>> {
    filesystem::list_tree(&state.root(&root)?)
}

#[tauri::command]
pub fn read_text_file(state: S, root: String, path: String) -> AppResult<String> {
    filesystem::read_text(&state.root(&root)?, &path)
}

#[tauri::command]
pub fn write_text_file(state: S, root: String, path: String, content: String) -> AppResult<()> {
    filesystem::write_text(&state.root(&root)?, &path, &content)
}

#[tauri::command]
pub fn read_binary_file(state: S, root: String, path: String) -> AppResult<tauri::ipc::Response> {
    Ok(tauri::ipc::Response::new(filesystem::read_binary(&state.root(&root)?, &path)?))
}

#[tauri::command]
pub fn create_file(state: S, root: String, path: String, content: Option<String>) -> AppResult<()> {
    filesystem::create_file(&state.root(&root)?, &path, content.as_deref().unwrap_or(""))
}

#[tauri::command]
pub fn create_folder(state: S, root: String, path: String) -> AppResult<()> {
    filesystem::create_folder(&state.root(&root)?, &path)
}

#[tauri::command]
pub fn rename_path(state: S, root: String, from: String, to: String) -> AppResult<()> {
    filesystem::rename(&state.root(&root)?, &from, &to)
}

#[tauri::command]
pub fn delete_path(state: S, root: String, path: String) -> AppResult<String> {
    filesystem::delete(&state.root(&root)?, &path)
}

#[tauri::command]
pub fn list_snapshots(state: S, root: String, path: String) -> AppResult<Vec<Snapshot>> {
    filesystem::list_snapshots(&state.root(&root)?, &path)
}

#[tauri::command]
pub fn read_snapshot(state: S, root: String, path: String, id: String) -> AppResult<String> {
    filesystem::read_snapshot(&state.root(&root)?, &path, &id)
}

#[tauri::command]
pub fn write_recovery(state: S, root: String, data: String) -> AppResult<()> {
    filesystem::write_recovery(&state.root(&root)?, &data)
}

#[tauri::command]
pub fn read_recovery(state: S, root: String) -> AppResult<Option<String>> {
    filesystem::read_recovery(&state.root(&root)?)
}

#[tauri::command]
pub fn clear_recovery(state: S, root: String) -> AppResult<()> {
    filesystem::clear_recovery(&state.root(&root)?)
}

// ---- compilation -----------------------------------------------------------

#[tauri::command]
pub async fn compile(app: AppHandle, state: S<'_>, root: String) -> AppResult<CompileResult> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let settings = Settings::load(&state.db)?;
    let req = CompileRequest {
        root: r.to_string_lossy().into_owned(),
        main_file: meta.main_file.clone(),
        engine: meta.engine.clone(),
        bib_tool: meta.bib_tool.clone(),
        use_latexmk: settings.use_latexmk,
        shell_escape: meta.shell_escape,
        timeout_secs: settings.compile_timeout_secs,
        tex_bin_dir: settings.tex_bin_dir.clone(),
    };
    let st = state.inner().clone();
    let res = tauri::async_runtime::spawn_blocking(move || {
        st.compiler.compile(&req, |line: OutputLine| {
            let _ = app.emit("compile-output", line);
        })
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))??;
    state.db.record_compile(
        &meta.id,
        &res.started_at,
        res.duration_ms as i64,
        &res.engine,
        &res.tool,
        res.success,
        res.error_count as i64,
        res.warning_count as i64,
    )?;
    Ok(res)
}

#[tauri::command]
pub fn cancel_compile(state: S, root: String) -> AppResult<bool> {
    let r = state.root(&root)?;
    Ok(state.compiler.cancel(&r.to_string_lossy()))
}

#[tauri::command]
pub fn compile_history(state: S, root: String) -> AppResult<Vec<HistoryEntry>> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    state.db.compile_history(&meta.id, 50)
}

fn last_pdf(root: &Path, main_file: &str) -> PathBuf {
    let stem = Path::new(main_file).file_stem().unwrap_or_default().to_string_lossy().into_owned();
    root.join(compiler::BUILD_DIR).join(format!("{stem}.pdf"))
}

/// Bytes of the last successful PDF for the project's main file, if any.
#[tauri::command]
pub fn read_last_pdf(state: S, root: String) -> AppResult<tauri::ipc::Response> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let p = last_pdf(&r, &meta.main_file);
    if !p.exists() {
        return Err(AppError::NotFound("no successful build yet".into()));
    }
    Ok(tauri::ipc::Response::new(std::fs::read(p)?))
}

#[tauri::command]
pub fn clean_build(state: S, root: String) -> AppResult<usize> {
    let r = state.root(&root)?;
    let out = r.join(compiler::OUTPUT_DIR);
    let mut n = 0;
    if out.is_dir() {
        for e in walkdir::WalkDir::new(&out).min_depth(1).contents_first(true).into_iter().filter_map(|e| e.ok()) {
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_file() && filesystem::file_kind(&name) == "build" {
                std::fs::remove_file(e.path())?;
                n += 1;
            }
        }
    }
    Ok(n)
}

#[tauri::command]
pub async fn synctex_forward(state: S<'_>, root: String, file: String, line: u32, column: u32) -> AppResult<Vec<synctex::PdfLocation>> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let settings = Settings::load(&state.db)?;
    let tool = detect::find_tool("synctex", settings.tex_bin_dir.as_deref())
        .ok_or_else(|| AppError::NotFound("synctex tool".into()))?;
    let src = resolve_in_root(&r, &file)?;
    let pdf = last_pdf(&r, &meta.main_file);
    tauri::async_runtime::spawn_blocking(move || synctex::forward(&tool, &pdf, &src, line, column))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn synctex_inverse(state: S<'_>, root: String, page: u32, x: f64, y: f64) -> AppResult<synctex::SourceLocation> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let settings = Settings::load(&state.db)?;
    let tool = detect::find_tool("synctex", settings.tex_bin_dir.as_deref())
        .ok_or_else(|| AppError::NotFound("synctex tool".into()))?;
    let pdf = last_pdf(&r, &meta.main_file);
    tauri::async_runtime::spawn_blocking(move || synctex::inverse(&tool, &pdf, page, x, y, &r))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

// ---- export ------------------------------------------------------------------

#[tauri::command]
pub fn export_pdf(state: S, root: String, dest: String) -> AppResult<()> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let p = last_pdf(&r, &meta.main_file);
    if !p.exists() {
        return Err(AppError::NotFound("no successful build to export — compile first".into()));
    }
    std::fs::copy(p, dest)?;
    Ok(())
}

// ---- journal library ---------------------------------------------------------

#[tauri::command]
pub fn list_journals(state: S) -> AppResult<Vec<registry::JournalEntry>> {
    registry::list(&state.db)
}

#[tauri::command]
pub fn set_journal_indexing(state: S, id: String, indexing: registry::Indexing) -> AppResult<()> {
    registry::get(&state.db, &id)?;
    state.db.set_indexing_note(&id, &serde_json::to_string(&indexing)?)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassStatus {
    name: String,
    installed: bool,
    path: Option<String>,
    version: Option<String>,
}

/// Is a document class installed in the user's TeX distribution? Reports the
/// \ProvidesClass date/version line so users can see what they have.
#[tauri::command]
pub async fn class_status(state: S<'_>, names: Vec<String>) -> AppResult<Vec<ClassStatus>> {
    let bin = Settings::load(&state.db)?.tex_bin_dir;
    tauri::async_runtime::spawn_blocking(move || {
        let kpse = detect::find_tool("kpsewhich", bin.as_deref());
        names
            .into_iter()
            .filter(|n| n.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'))
            .map(|n| {
                let path = kpse.as_ref().and_then(|k| {
                    let mut c = compiler::proc::hidden_command(k);
                    c.arg(format!("{n}.cls"));
                    compiler::proc::run_capture(c, std::time::Duration::from_secs(5)).ok().map(|o| o.stdout.trim().to_string()).filter(|s| !s.is_empty())
                });
                let version = path.as_ref().and_then(|p| std::fs::read_to_string(p).ok()).and_then(|src| {
                    let re = regex::Regex::new(r"\\ProvidesClass\s*\{[^}]*\}\s*\[([^\]]*)\]").unwrap();
                    re.captures(&src).map(|c| c[1].split_whitespace().collect::<Vec<_>>().join(" "))
                });
                ClassStatus { installed: path.is_some(), name: n, path, version }
            })
            .collect()
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))
}

#[tauri::command]
pub fn create_journal_project(state: S, parent_dir: String, name: String, journal_id: String) -> AppResult<ProjectInfo> {
    let j = registry::get(&state.db, &journal_id)?;
    let settings = Settings::load(&state.db)?;
    let o = options_from(&settings, None);
    let parent = Path::new(&parent_dir);
    let engine = if j.engine.is_empty() { "pdflatex".to_string() } else { j.engine.clone() };
    let info = match j.template_type.as_str() {
        "ctan-class" | "community-profile" => {
            let files = templates::journal_skeleton(&j, name.trim(), &o);
            filesystem::create_project_with(parent, name.trim(), files, "main.tex", &engine, "latex", Some(j.id.clone()))?
        }
        "custom" => {
            let src = PathBuf::from(j.template_path.clone().ok_or_else(|| AppError::NotFound("template files".into()))?);
            crate::security::validate_name(name.trim())?;
            let dest = parent.join(name.trim());
            if dest.exists() && std::fs::read_dir(&dest)?.next().is_some() {
                return Err(AppError::Invalid(format!("{} already exists and is not empty", dest.display())));
            }
            importer::copy_tree(&src, &dest)?;
            let mut meta = filesystem::new_meta(&dest, j.main_file.as_deref().unwrap_or("main.tex"), &engine, "latex", Some(j.id.clone()));
            meta.name = name.trim().to_string();
            meta.bib_tool = if j.bib_tool.is_empty() { "auto".into() } else { j.bib_tool.clone() };
            filesystem::write_meta(&dest, &meta)?;
            std::fs::create_dir_all(dest.join("output"))?;
            filesystem::open_project(&dest)?
        }
        _ => return Err(AppError::Invalid(format!("{} is distributed by the publisher: download its template ZIP and import it first.", j.name))),
    };
    state.register(&info)?;
    Ok(info)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Staged {
    staging_path: String,
    report: importer::TemplateReport,
    extract: Option<importer::ExtractReport>,
}

/// Extract (if ZIP) into a private staging folder and analyse. Nothing runs.
#[tauri::command]
pub async fn stage_import(state: S<'_>, source: String) -> AppResult<Staged> {
    let bin = Settings::load(&state.db)?.tex_bin_dir;
    let staging_root = state.data_dir.join("staging");
    tauri::async_runtime::spawn_blocking(move || {
        let src = PathBuf::from(&source);
        let (root, extract) = if src.is_dir() {
            (src.canonicalize()?, None)
        } else if src.extension().is_some_and(|e| e.eq_ignore_ascii_case("zip")) {
            let dir = staging_root.join(uuid::Uuid::new_v4().to_string());
            let rep = importer::safe_extract(&src, &dir, &importer::Limits::default());
            let rep = match rep {
                Ok(r) => r,
                Err(e) => {
                    let _ = std::fs::remove_dir_all(&dir);
                    return Err(e);
                }
            };
            (importer::content_root(&dir), Some(rep))
        } else {
            // Single class/style/tex file: stage it in its own folder.
            let dir = staging_root.join(uuid::Uuid::new_v4().to_string());
            std::fs::create_dir_all(&dir)?;
            let name = src.file_name().ok_or_else(|| AppError::Invalid("no file name".into()))?;
            std::fs::copy(&src, dir.join(name))?;
            (dir, None)
        };
        let report = importer::analyze(&root, bin.as_deref())?;
        Ok(Staged { staging_path: root.to_string_lossy().into_owned(), report, extract })
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomTemplateInput {
    staging_path: String,
    name: String,
    publisher: String,
    official: bool,
    main_file: String,
    engine: String,
    bib_tool: String,
    author_instructions_url: Option<String>,
    notes: String,
    layout: String,
    venue: String,
}

#[tauri::command]
pub fn install_custom_template(state: S, input: CustomTemplateInput) -> AppResult<registry::JournalEntry> {
    filesystem::validate_engine(&input.engine)?;
    if input.name.trim().is_empty() {
        return Err(AppError::Invalid("name is required".into()));
    }
    let src = PathBuf::from(&input.staging_path);
    crate::security::resolve_in_root(&src, &input.main_file)?;
    let id = format!("custom-{}", uuid::Uuid::new_v4());
    let dest = state.data_dir.join("templates").join(&id);
    importer::copy_tree(&src, &dest)?;
    let entry = registry::JournalEntry {
        id: id.clone(),
        name: input.name.trim().to_string(),
        publisher: if input.publisher.trim().is_empty() { "Custom".into() } else { input.publisher.trim().to_string() },
        venue: input.venue,
        layout: input.layout,
        template_type: "custom".into(),
        official: input.official,
        bib_tool: input.bib_tool,
        engine: input.engine,
        author_instructions_url: input.author_instructions_url.filter(|u| !u.trim().is_empty()),
        verification_note: if input.official { "Declared by the user as the publisher's official template.".into() } else { "Custom/community template imported by the user.".into() },
        notes: if input.notes.trim().is_empty() { vec![] } else { vec![input.notes] },
        indexing: registry::Indexing { status: "not-verified".into(), ..Default::default() },
        requirements: registry::Requirements { sections: vec!["abstract".into(), "introduction".into(), "conclusion".into(), "references".into()], ..Default::default() },
        origin: "custom".into(),
        template_path: Some(dest.to_string_lossy().into_owned()),
        main_file: Some(input.main_file),
        installed_at: Some(chrono::Utc::now().to_rfc3339()),
        ..Default::default()
    };
    state.db.upsert_journal(&id, "custom", &serde_json::to_string(&entry)?)?;
    if src.starts_with(state.data_dir.join("staging")) {
        let _ = std::fs::remove_dir_all(state.data_dir.join("staging"));
    }
    Ok(entry)
}

#[tauri::command]
pub fn delete_custom_template(state: S, id: String) -> AppResult<()> {
    let j = registry::get(&state.db, &id)?;
    if j.origin != "custom" {
        return Err(AppError::Invalid("only imported templates can be removed".into()));
    }
    state.db.delete_journal(&id, "custom")?;
    if let Some(p) = j.template_path {
        let p = PathBuf::from(p);
        if p.starts_with(state.data_dir.join("templates")) {
            let _ = std::fs::remove_dir_all(p);
        }
    }
    Ok(())
}

/// Create a project from an archive or folder staged by `stage_import`.
#[tauri::command]
pub fn create_project_from_staged(state: S, staging_path: String, parent_dir: String, name: String, main_file: String) -> AppResult<ProjectInfo> {
    crate::security::validate_name(name.trim())?;
    let src = PathBuf::from(&staging_path);
    let dest = Path::new(&parent_dir).join(name.trim());
    if dest.exists() && std::fs::read_dir(&dest)?.next().is_some() {
        return Err(AppError::Invalid(format!("{} already exists and is not empty", dest.display())));
    }
    importer::copy_tree(&src, &dest)?;
    let engine = {
        let r = importer::analyze(&dest, None)?;
        r.engine
    };
    let mut meta = filesystem::new_meta(&dest, &main_file, &engine, if filesystem::is_beamer(&dest.join(&main_file)) { "presentation" } else { "latex" }, None);
    meta.name = name.trim().to_string();
    filesystem::write_meta(&dest, &meta)?;
    if src.starts_with(state.data_dir.join("staging")) {
        let _ = std::fs::remove_dir_all(state.data_dir.join("staging"));
    }
    let info = filesystem::open_project(&dest)?;
    state.register(&info)?;
    Ok(info)
}

// ---- conversion -----------------------------------------------------------------

#[tauri::command]
pub async fn convert_docx_to_latex(state: S<'_>, docx: String, parent_dir: String, name: String) -> AppResult<(converter::ConversionReport, ProjectInfo)> {
    crate::security::validate_name(name.trim())?;
    let bin = Settings::load(&state.db)?.tex_bin_dir;
    let dest = Path::new(&parent_dir).join(name.trim());
    let d2 = dest.clone();
    let report = tauri::async_runtime::spawn_blocking(move || converter::docx_to_latex(Path::new(&docx), &d2, bin.as_deref()))
        .await
        .map_err(|e| AppError::Other(e.to_string()))??;
    let info = filesystem::open_project(&dest)?;
    state.register(&info)?;
    Ok((report, info))
}

#[tauri::command]
pub async fn convert_latex_to_docx(state: S<'_>, root: String, dest: String) -> AppResult<converter::ConversionReport> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let bin = Settings::load(&state.db)?.tex_bin_dir;
    tauri::async_runtime::spawn_blocking(move || converter::latex_to_docx(&r, &meta.main_file, Path::new(&dest), bin.as_deref()))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

// ---- submission & online ---------------------------------------------------------

#[tauri::command]
pub fn build_submission(state: S, root: String, dest: String) -> AppResult<Vec<submission::ManifestEntry>> {
    let r = state.root(&root)?;
    let meta = filesystem::read_meta(&r)?;
    let journal = meta.journal_id.as_ref().and_then(|id| registry::get(&state.db, id).ok()).map(|j| j.name);
    submission::build(&r, &meta.main_file, journal.as_deref(), Path::new(&dest))
}

#[tauri::command]
pub async fn doi_lookup(state: S<'_>, doi: String) -> AppResult<String> {
    if !Settings::load(&state.db)?.allow_online {
        return Err(AppError::Security("Online services are disabled. Enable them in Settings → Privacy to look up DOIs.".into()));
    }
    tauri::async_runtime::spawn_blocking(move || online::doi_bibtex(&doi)).await.map_err(|e| AppError::Other(e.to_string()))?
}

// ---- stories & presentations ------------------------------------------------------

#[tauri::command]
pub fn set_story_preview(state: S, root: String, html: String) -> AppResult<()> {
    let r = state.root(&root)?;
    state.story.set(r, html);
    Ok(())
}

#[tauri::command]
pub fn export_story(state: S, root: String, html: String, dest: String, single: bool) -> AppResult<Vec<String>> {
    story::export(&state.root(&root)?, &html, Path::new(&dest), single)
}

#[tauri::command]
pub fn import_story_asset(state: S, root: String, source: String) -> AppResult<String> {
    story::import_asset(&state.root(&root)?, Path::new(&source))
}

// ---- story templates -----------------------------------------------------------

fn story_tpl_dir(state: &AppState) -> PathBuf {
    state.data_dir.join("story-templates")
}

#[tauri::command]
pub fn list_story_templates(state: S) -> Vec<story::library::StoryTemplate> {
    story::library::list(&story_tpl_dir(&state))
}

#[tauri::command]
pub fn story_template_cover(state: S, id: String) -> AppResult<String> {
    story::library::cover(&id, &story_tpl_dir(&state))
}

#[tauri::command]
pub fn create_story_from_template(state: S, parent_dir: String, name: String, template_id: String) -> AppResult<ProjectInfo> {
    let settings = Settings::load(&state.db)?;
    let o = options_from(&settings, None);
    let mut files = story::library::files(&template_id, &story_tpl_dir(&state))?;
    // Stamp the author and date; titles and text are the template's and stay editable.
    let mut doc: serde_json::Value = serde_json::from_slice(&files[0].1).map_err(|e| AppError::Invalid(format!("template story.json: {e}")))?;
    let byline = [o.author.trim(), o.rank.trim(), o.organization.trim()].iter().filter(|x| !x.is_empty()).cloned().collect::<Vec<_>>().join(", ");
    if let Some(meta) = doc.get_mut("meta").and_then(|m| m.as_object_mut()) {
        meta.insert("author".into(), serde_json::Value::String(byline));
        meta.insert("date".into(), serde_json::Value::String(chrono::Local::now().format("%-d %B %Y").to_string()));
    }
    files[0].1 = serde_json::to_vec_pretty(&doc).unwrap();
    let info = filesystem::create_project_with(Path::new(&parent_dir), name.trim(), files, "story.json", "pdflatex", "story", None)?;
    state.register(&info)?;
    let mut s = Settings::load(&state.db)?;
    s.last_project_dir = Some(parent_dir);
    s.save(&state.db)?;
    Ok(info)
}

#[tauri::command]
pub fn save_story_template(state: S, root: String, title: String, description: String, category: String) -> AppResult<story::library::StoryTemplate> {
    story::library::save_from_project(&state.root(&root)?, &story_tpl_dir(&state), &title, &description, &category)
}

#[tauri::command]
pub fn delete_story_template(state: S, id: String) -> AppResult<()> {
    story::library::delete(&id, &story_tpl_dir(&state))
}

#[tauri::command]
pub fn export_story_template(state: S, id: String, dest: String) -> AppResult<()> {
    story::library::export_zip(&id, &story_tpl_dir(&state), Path::new(&dest))
}

#[tauri::command]
pub fn import_story_template(state: S, source: String) -> AppResult<story::library::StoryTemplate> {
    story::library::import_zip(Path::new(&source), &story_tpl_dir(&state), &state.data_dir.join("staging"))
}

/// Copies an image chosen by the user into the project's `figures/` folder.
#[tauri::command]
pub fn import_figure(state: S, root: String, source: String) -> AppResult<String> {
    story::import_into(&state.root(&root)?, Path::new(&source), "figures", story::FIGURE_EXTS)
}

#[tauri::command]
pub async fn export_pptx(deck: presentation::DeckSpec, dest: String) -> AppResult<usize> {
    tauri::async_runtime::spawn_blocking(move || presentation::write_pptx(&deck, Path::new(&dest)))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub fn export_zip(state: S, root: String, dest: String) -> AppResult<Vec<String>> {
    filesystem::export_zip(&state.root(&root)?, Path::new(&dest))
}
