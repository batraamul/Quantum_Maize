//! Project and file management.
//!
//! A Quantum Maze project is an ordinary folder of LaTeX sources plus a small
//! hidden `.qmaze/` directory holding metadata (`project.json`), the last
//! successful build, version snapshots, crash-recovery buffers and a trash
//! folder. Users can keep editing the folder with any other tool.

use crate::error::{AppError, AppResult};
use crate::security::{resolve_in_root, to_relative, validate_name};
use crate::templates::{self, StarterTemplate};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const META_DIR: &str = ".qmaze";
pub const META_FILE: &str = "project.json";
pub const PROJECT_FORMAT_VERSION: u32 = 1;
const MAX_TEXT_FILE: u64 = 20 * 1024 * 1024; // 20 MiB guard for editor buffers
const MAX_BINARY_FILE: u64 = 64 * 1024 * 1024;
const SNAPSHOTS_PER_FILE: usize = 30;
const SNAPSHOT_MIN_INTERVAL_SECS: i64 = 300;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub format_version: u32,
    pub id: String,
    pub name: String,
    pub main_file: String,
    /// pdflatex | xelatex | lualatex
    pub engine: String,
    /// auto | bibtex | biber
    #[serde(default = "default_bib_tool")]
    pub bib_tool: String,
    /// User-approved shell escape for THIS project only (default false).
    #[serde(default)]
    pub shell_escape: bool,
    pub created_at: String,
    #[serde(default)]
    pub created_with: String,
    /// latex | presentation | story
    #[serde(default = "default_kind")]
    pub kind: String,
    /// Journal registry id this project was created for (if any).
    #[serde(default)]
    pub journal_id: Option<String>,
}

fn default_kind() -> String {
    "latex".into()
}

fn default_bib_tool() -> String {
    "auto".into()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root: String,
    pub meta: ProjectMeta,
    /// True when this folder had no Quantum Maze metadata and it was just created.
    pub newly_registered: bool,
    pub has_recovery: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Option<Vec<FileNode>>,
    pub size: u64,
}

pub fn meta_path(root: &Path) -> PathBuf {
    root.join(META_DIR).join(META_FILE)
}

pub fn read_meta(root: &Path) -> AppResult<ProjectMeta> {
    let raw = fs::read_to_string(meta_path(root))?;
    let meta: ProjectMeta = serde_json::from_str(&raw)?;
    if meta.format_version > PROJECT_FORMAT_VERSION {
        return Err(AppError::Invalid(format!(
            "this project was created by a newer Quantum Maze (format {}); please upgrade",
            meta.format_version
        )));
    }
    Ok(meta)
}

pub fn write_meta(root: &Path, meta: &ProjectMeta) -> AppResult<()> {
    fs::create_dir_all(root.join(META_DIR))?;
    atomic_write(&meta_path(root), serde_json::to_string_pretty(meta)?.as_bytes())
}

/// Write via a temporary sibling file + rename so a crash never leaves a
/// half-written source file.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::Invalid("path has no parent".into()))?;
    fs::create_dir_all(parent)?;
    let tmp = parent.join(format!(
        ".{}.pf-tmp-{}",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id()
    ));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        // Windows cannot rename over a file that another process has open.
        let _ = fs::remove_file(&tmp);
        return Err(e.into());
    }
    Ok(())
}

pub fn create_project(
    parent_dir: &Path,
    name: &str,
    template: StarterTemplate,
    engine: &str,
) -> AppResult<ProjectInfo> {
    let opts = templates::StarterOptions::default();
    let files = templates::files(template, name, &opts);
    let main = if template == StarterTemplate::Story { "story.json" } else { "main.tex" };
    create_project_with(parent_dir, name, files, main, engine, template.kind(), None)
}

/// Create a project folder from an explicit file list.
pub fn create_project_with(
    parent_dir: &Path,
    name: &str,
    files: Vec<(String, Vec<u8>)>,
    main_file: &str,
    engine: &str,
    kind: &str,
    journal_id: Option<String>,
) -> AppResult<ProjectInfo> {
    validate_name(name)?;
    validate_engine(engine)?;
    if !parent_dir.is_dir() {
        return Err(AppError::NotFound(format!("folder {}", parent_dir.display())));
    }
    let root = parent_dir.join(name);
    if root.exists() && fs::read_dir(&root)?.next().is_some() {
        return Err(AppError::Invalid(format!(
            "{} already exists and is not empty — choose another name or open it instead",
            root.display()
        )));
    }
    fs::create_dir_all(&root)?;
    for (rel, bytes) in files {
        let p = resolve_in_root(&root, &rel)?;
        atomic_write(&p, &bytes)?;
    }
    if kind != "story" {
        fs::create_dir_all(root.join("output"))?;
    }
    let mut meta = new_meta(&root, main_file, engine, kind, journal_id);
    meta.name = name.to_string();
    write_meta(&root, &meta)?;
    Ok(ProjectInfo {
        root: root.canonicalize()?.to_string_lossy().into_owned(),
        meta,
        newly_registered: true,
        has_recovery: false,
    })
}

/// Open a Quantum Maze project, or register an existing LaTeX folder as one
/// (only `.qmaze/` is added; user files are not touched).
pub fn open_project(root: &Path) -> AppResult<ProjectInfo> {
    if !root.is_dir() {
        return Err(AppError::NotFound(format!("folder {}", root.display())));
    }
    let root = root.canonicalize()?;
    // Projects created before the rename used `.paperforge/`.
    let legacy = root.join(".paperforge");
    if legacy.join(META_FILE).exists() && !root.join(META_DIR).exists() {
        fs::rename(&legacy, root.join(META_DIR))?;
    }
    let (meta, newly) = if meta_path(&root).exists() {
        (read_meta(&root)?, false)
    } else {
        if root.join("story.json").is_file() {
            let meta = new_meta(&root, "story.json", "pdflatex", "story", None);
            write_meta(&root, &meta)?;
            return Ok(ProjectInfo { root: root.to_string_lossy().into_owned(), meta, newly_registered: true, has_recovery: false });
        }
        let main = detect_main_file(&root).ok_or_else(|| {
            AppError::Invalid(
                "no LaTeX document found in this folder (expected a .tex file containing \\documentclass)".into(),
            )
        })?;
        let engine = detect_engine_hint(&root.join(&main));
        let kind = if is_beamer(&root.join(&main)) { "presentation" } else { "latex" };
        let meta = new_meta(&root, &main, &engine, kind, None);
        write_meta(&root, &meta)?;
        (meta, true)
    };
    let has_recovery = root.join(META_DIR).join("recovery.json").exists();
    Ok(ProjectInfo {
        root: root.to_string_lossy().into_owned(),
        meta,
        newly_registered: newly,
        has_recovery,
    })
}

pub fn new_meta(root: &Path, main: &str, engine: &str, kind: &str, journal: Option<String>) -> ProjectMeta {
    ProjectMeta {
        format_version: PROJECT_FORMAT_VERSION,
        id: uuid::Uuid::new_v4().to_string(),
        name: root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "Untitled".into()),
        main_file: main.to_string(),
        engine: engine.to_string(),
        bib_tool: "auto".into(),
        shell_escape: false,
        created_at: chrono::Utc::now().to_rfc3339(),
        created_with: format!("Quantum Maze {}", env!("CARGO_PKG_VERSION")),
        kind: kind.to_string(),
        journal_id: journal,
    }
}

pub fn is_beamer(main: &Path) -> bool {
    fs::read_to_string(main)
        .map(|s| regex::Regex::new(r"\\documentclass(\[[^\]]*\])?\{beamer\}").unwrap().is_match(&s))
        .unwrap_or(false)
}

pub fn validate_engine(engine: &str) -> AppResult<()> {
    match engine {
        "pdflatex" | "xelatex" | "lualatex" => Ok(()),
        _ => Err(AppError::Invalid(format!("unsupported engine: {engine}"))),
    }
}

/// Find the root document: prefer main.tex, then any top-level .tex with
/// both \documentclass and \begin{document}, then any nested one.
pub fn detect_main_file(root: &Path) -> Option<String> {
    let is_root_doc = |p: &Path| {
        fs::read_to_string(p)
            .map(|s| s.contains("\\documentclass") && s.contains("\\begin{document}"))
            .unwrap_or(false)
    };
    if is_root_doc(&root.join("main.tex")) {
        return Some("main.tex".into());
    }
    let mut candidates: Vec<(usize, String)> = walkdir::WalkDir::new(root)
        .max_depth(3)
        .into_iter()
        .filter_entry(|e| !is_ignored_dir(e.file_name().to_string_lossy().as_ref()))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && e.path().extension().is_some_and(|x| x == "tex"))
        .filter(|e| is_root_doc(e.path()))
        .filter_map(|e| to_relative(root, e.path()).map(|r| (e.depth(), r)))
        .collect();
    candidates.sort();
    candidates.into_iter().next().map(|(_, r)| r)
}

fn detect_engine_hint(main: &Path) -> String {
    let src = fs::read_to_string(main).unwrap_or_default();
    if src.contains("fontspec") || src.contains("polyglossia") || src.contains("% !TEX program = xelatex") {
        if src.contains("% !TEX program = lualatex") { "lualatex".into() } else { "xelatex".into() }
    } else if src.contains("% !TEX program = lualatex") || src.contains("luacode") {
        "lualatex".into()
    } else {
        "pdflatex".into()
    }
}

fn is_ignored_dir(name: &str) -> bool {
    matches!(name, ".qmaze" | ".git" | "node_modules" | ".svn" | "__MACOSX")
}

pub fn file_kind(name: &str) -> &'static str {
    let ext = Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "tex" | "ltx" => "tex",
        "bib" => "bib",
        "cls" | "sty" | "bst" | "bbx" | "cbx" | "def" | "cfg" | "clo" => "style",
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "eps" | "webp" | "bmp" | "tif" | "tiff" => "image",
        "pdf" => "pdf",
        "md" | "txt" | "csv" | "tsv" | "json" | "yaml" | "yml" | "dat" | "py" | "m" | "r" | "lua" => "text",
        "aux" | "log" | "fls" | "fdb_latexmk" | "synctex" | "gz" | "bbl" | "blg" | "bcf" | "toc" | "lof" | "lot" | "out" | "run" | "xdv" => "build",
        _ => "other",
    }
}

pub fn list_tree(root: &Path) -> AppResult<Vec<FileNode>> {
    let root = root.canonicalize()?;
    walk(&root, &root, 0)
}

fn walk(root: &Path, dir: &Path, depth: usize) -> AppResult<Vec<FileNode>> {
    if depth > 12 {
        return Ok(vec![]);
    }
    let mut entries: Vec<_> = fs::read_dir(dir)?.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| {
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
        (!is_dir, e.file_name().to_string_lossy().to_lowercase())
    });
    let mut out = Vec::new();
    for e in entries {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.contains(".pf-tmp-") {
            continue;
        }
        let ft = match e.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if ft.is_symlink() {
            continue; // never follow links out of the project
        }
        let rel = to_relative(root, &e.path()).unwrap_or_else(|| name.clone());
        if ft.is_dir() {
            if is_ignored_dir(&name) {
                continue;
            }
            out.push(FileNode {
                children: Some(walk(root, &e.path(), depth + 1)?),
                kind: "folder".into(),
                name,
                path: rel,
                size: 0,
            });
        } else {
            out.push(FileNode {
                kind: file_kind(&name).into(),
                size: e.metadata().map(|m| m.len()).unwrap_or(0),
                name,
                path: rel,
                children: None,
            });
        }
    }
    Ok(out)
}

pub fn read_text(root: &Path, rel: &str) -> AppResult<String> {
    let p = resolve_in_root(root, rel)?;
    let len = fs::metadata(&p)?.len();
    if len > MAX_TEXT_FILE {
        return Err(AppError::Invalid(format!("{rel} is too large to edit ({len} bytes)")));
    }
    let bytes = fs::read(&p)?;
    String::from_utf8(bytes).map_err(|_| {
        AppError::Invalid(format!("{rel} is not UTF-8 text; convert it to UTF-8 to edit it in Quantum Maze"))
    })
}

pub fn read_binary(root: &Path, rel: &str) -> AppResult<Vec<u8>> {
    let p = resolve_in_root(root, rel)?;
    let len = fs::metadata(&p)?.len();
    if len > MAX_BINARY_FILE {
        return Err(AppError::Invalid(format!("{rel} is too large to preview")));
    }
    Ok(fs::read(p)?)
}

/// Save a text file. Before overwriting, a timestamped snapshot of the previous
/// contents is kept in `.qmaze/history/` (rate-limited, bounded).
pub fn write_text(root: &Path, rel: &str, content: &str) -> AppResult<()> {
    let p = resolve_in_root(root, rel)?;
    if p.exists() {
        let old = fs::read(&p)?;
        if old == content.as_bytes() {
            return Ok(());
        }
        snapshot(root, rel, &old).ok(); // snapshots are best-effort
    }
    atomic_write(&p, content.as_bytes())
}

fn history_dir(root: &Path, rel: &str) -> PathBuf {
    let flat = rel.replace(['/', '\\'], "__");
    root.join(META_DIR).join("history").join(flat)
}

fn snapshot(root: &Path, rel: &str, bytes: &[u8]) -> AppResult<()> {
    let dir = history_dir(root, rel);
    fs::create_dir_all(&dir)?;
    let mut existing: Vec<_> = fs::read_dir(&dir)?.filter_map(|e| e.ok()).map(|e| e.path()).collect();
    existing.sort();
    if let Some(last) = existing.last() {
        if let Ok(modified) = fs::metadata(last).and_then(|m| m.modified()) {
            let age = chrono::Utc::now() - chrono::DateTime::<chrono::Utc>::from(modified);
            if age.num_seconds() < SNAPSHOT_MIN_INTERVAL_SECS {
                return Ok(());
            }
        }
    }
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S");
    fs::write(dir.join(format!("{stamp}.snap")), bytes)?;
    existing.push(PathBuf::new());
    while existing.len() > SNAPSHOTS_PER_FILE {
        let victim = existing.remove(0);
        let _ = fs::remove_file(victim);
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub created: String,
    pub size: u64,
}

pub fn list_snapshots(root: &Path, rel: &str) -> AppResult<Vec<Snapshot>> {
    crate::security::sanitize_relative(rel)?;
    let dir = history_dir(root, rel);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut v: Vec<Snapshot> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .map(|e| Snapshot {
            id: e.file_name().to_string_lossy().into_owned(),
            created: e.file_name().to_string_lossy().trim_end_matches(".snap").to_string(),
            size: e.metadata().map(|m| m.len()).unwrap_or(0),
        })
        .collect();
    v.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(v)
}

pub fn read_snapshot(root: &Path, rel: &str, id: &str) -> AppResult<String> {
    crate::security::sanitize_relative(rel)?;
    validate_name(id)?;
    let p = history_dir(root, rel).join(id);
    Ok(String::from_utf8_lossy(&fs::read(p)?).into_owned())
}

pub fn create_file(root: &Path, rel: &str, content: &str) -> AppResult<()> {
    let p = resolve_in_root(root, rel)?;
    validate_name(&p.file_name().unwrap_or_default().to_string_lossy())?;
    if p.exists() {
        return Err(AppError::Invalid(format!("{rel} already exists")));
    }
    atomic_write(&p, content.as_bytes())
}

pub fn create_folder(root: &Path, rel: &str) -> AppResult<()> {
    let p = resolve_in_root(root, rel)?;
    validate_name(&p.file_name().unwrap_or_default().to_string_lossy())?;
    fs::create_dir_all(p)?;
    Ok(())
}

pub fn rename(root: &Path, from: &str, to: &str) -> AppResult<()> {
    let a = resolve_in_root(root, from)?;
    let b = resolve_in_root(root, to)?;
    validate_name(&b.file_name().unwrap_or_default().to_string_lossy())?;
    if !a.exists() {
        return Err(AppError::NotFound(from.into()));
    }
    if b.exists() {
        return Err(AppError::Invalid(format!("{to} already exists")));
    }
    if let Some(parent) = b.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(a, b)?;
    Ok(())
}

/// "Delete" moves the item into `.qmaze/trash/<timestamp>/` so it can be
/// recovered — the only copy of a manuscript is never destroyed outright.
pub fn delete(root: &Path, rel: &str) -> AppResult<String> {
    let p = resolve_in_root(root, rel)?;
    if !p.exists() {
        return Err(AppError::NotFound(rel.into()));
    }
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%3f").to_string();
    let dest = root.join(META_DIR).join("trash").join(&stamp).join(rel);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(&p, &dest)?;
    Ok(format!("{META_DIR}/trash/{stamp}/{rel}"))
}

// ---- crash recovery -------------------------------------------------------

pub fn write_recovery(root: &Path, json: &str) -> AppResult<()> {
    // Validate it is JSON so a malformed write can't break the next open.
    let _: serde_json::Value = serde_json::from_str(json)?;
    atomic_write(&root.join(META_DIR).join("recovery.json"), json.as_bytes())
}

pub fn read_recovery(root: &Path) -> AppResult<Option<String>> {
    let p = root.join(META_DIR).join("recovery.json");
    if p.exists() { Ok(Some(fs::read_to_string(p)?)) } else { Ok(None) }
}

pub fn clear_recovery(root: &Path) -> AppResult<()> {
    let p = root.join(META_DIR).join("recovery.json");
    if p.exists() {
        fs::remove_file(p)?;
    }
    Ok(())
}

// ---- export ----------------------------------------------------------------

/// Export project sources (no build artefacts or Quantum Maze internals) to ZIP.
/// Returns the list of archived paths (the manifest).
pub fn export_zip(root: &Path, dest: &Path) -> AppResult<Vec<String>> {
    let root = root.canonicalize()?;
    let file = fs::File::create(dest)?;
    let mut zw = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    let mut manifest = Vec::new();
    let dest_canon = dest.canonicalize().ok();
    for e in walkdir::WalkDir::new(&root)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            !(e.depth() == 1 && n == "output") && !is_ignored_dir(&n)
        })
        .filter_map(|e| e.ok())
    {
        if !e.file_type().is_file() {
            continue;
        }
        if Some(e.path().to_path_buf()) == dest_canon {
            continue;
        }
        let name = e.file_name().to_string_lossy();
        if file_kind(&name) == "build" || name.contains(".pf-tmp-") {
            continue;
        }
        let rel = to_relative(&root, e.path()).unwrap();
        zw.start_file(rel.clone(), opts)?;
        zw.write_all(&fs::read(e.path())?)?;
        manifest.push(rel);
    }
    zw.finish()?;
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_open_save_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let info = create_project(dir.path(), "My Paper", StarterTemplate::ResearchPaper, "pdflatex").unwrap();
        let root = PathBuf::from(&info.root);
        assert!(root.join("main.tex").exists());
        assert!(root.join("sections/introduction.tex").exists());
        assert!(root.join("references/references.bib").exists());
        write_text(&root, "sections/introduction.tex", "Hello").unwrap();
        let reopened = open_project(&root).unwrap();
        assert_eq!(reopened.meta, info.meta);
        assert!(!reopened.newly_registered);
        assert_eq!(read_text(&root, "sections/introduction.tex").unwrap(), "Hello");
        // snapshot of previous content kept
        assert_eq!(list_snapshots(&root, "sections/introduction.tex").unwrap().len(), 1);
        assert!(create_project(dir.path(), "My Paper", StarterTemplate::Blank, "pdflatex").is_err());
    }

    #[test]
    fn register_existing_folder() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("paper.tex"), "\\documentclass{article}\\usepackage{fontspec}\\begin{document}x\\end{document}").unwrap();
        let info = open_project(dir.path()).unwrap();
        assert!(info.newly_registered);
        assert_eq!(info.meta.main_file, "paper.tex");
        assert_eq!(info.meta.engine, "xelatex");
    }

    #[test]
    fn delete_moves_to_trash_and_rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let info = create_project(dir.path(), "p", StarterTemplate::Blank, "pdflatex").unwrap();
        let root = PathBuf::from(&info.root);
        let trashed = delete(&root, "main.tex").unwrap();
        assert!(!root.join("main.tex").exists());
        assert!(root.join(trashed).exists());
        assert!(read_text(&root, "../../etc/passwd").is_err());
        assert!(write_text(&root, "../evil.tex", "x").is_err());
    }

    #[test]
    fn zip_export_excludes_build_files() {
        let dir = tempfile::tempdir().unwrap();
        let info = create_project(dir.path(), "z", StarterTemplate::ResearchPaper, "pdflatex").unwrap();
        let root = PathBuf::from(&info.root);
        fs::write(root.join("main.aux"), "x").unwrap();
        fs::write(root.join("output/main.pdf"), "x").unwrap();
        let out = dir.path().join("z.zip");
        let manifest = export_zip(&root, &out).unwrap();
        assert!(manifest.contains(&"main.tex".to_string()));
        assert!(!manifest.iter().any(|m| m.ends_with(".aux") || m.starts_with("output") || m.starts_with(".qmaze")));
    }
}
