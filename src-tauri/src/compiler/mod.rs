//! Compilation manager.
//!
//! * Prefers latexmk; falls back to running the engine + BibTeX/Biber passes
//!   directly when latexmk is missing or unusable (e.g. MiKTeX without Perl).
//! * Arguments are always arrays; no shell is involved.
//! * Shell escape is explicitly disabled unless the project owner approved it.
//! * latexmk runs with `-norc`, so a `latexmkrc` (Perl code!) shipped inside an
//!   imported project can never execute.
//! * Output goes to `<project>/output/`; the last *successful* PDF (+ SyncTeX
//!   data) is copied to `.qmaze/build/` so a failed build never replaces
//!   the preview with a broken document.

pub mod detect;
pub mod log_parser;
pub mod proc;
pub mod synctex;

use crate::error::{AppError, AppResult};
use crate::security::resolve_in_root;
use log_parser::{Diagnostic, Severity};
use proc::{hidden_command, run_streaming, Outcome};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

pub const OUTPUT_DIR: &str = "output";
pub const BUILD_DIR: &str = ".qmaze/build";
const MAX_RAW_OUTPUT: usize = 400_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileRequest {
    pub root: String,
    pub main_file: String,
    pub engine: String,
    pub bib_tool: String,
    pub use_latexmk: bool,
    pub shell_escape: bool,
    pub timeout_secs: u64,
    pub tex_bin_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub success: bool,
    pub cancelled: bool,
    pub timed_out: bool,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
    pub tool: String,
    pub engine: String,
    /// Absolute path of the last successful PDF (may be from an earlier build).
    pub pdf_path: Option<String>,
    /// True when `pdf_path` was produced by THIS build.
    pub pdf_updated: bool,
    pub diagnostics: Vec<Diagnostic>,
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
    pub log_file: Option<String>,
    pub raw_output: String,
    pub started_at: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputLine {
    pub root: String,
    pub line: String,
    pub stderr: bool,
}

#[derive(Default)]
pub struct CompileManager {
    running: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl CompileManager {
    pub fn cancel(&self, root: &str) -> bool {
        if let Some(flag) = self.running.lock().unwrap().get(root) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn is_running(&self, root: &str) -> bool {
        self.running.lock().unwrap().contains_key(root)
    }

    pub fn compile(&self, req: &CompileRequest, emit: impl FnMut(OutputLine)) -> AppResult<CompileResult> {
        let flag = Arc::new(AtomicBool::new(false));
        {
            let mut r = self.running.lock().unwrap();
            if r.contains_key(&req.root) {
                return Err(AppError::Compiler("a compilation is already running for this project".into()));
            }
            r.insert(req.root.clone(), flag.clone());
        }
        let res = run_compile(req, &flag, emit);
        self.running.lock().unwrap().remove(&req.root);
        res
    }
}

pub fn engine_flag(engine: &str) -> AppResult<&'static str> {
    Ok(match engine {
        "pdflatex" => "-pdf",
        "xelatex" => "-pdfxe",
        "lualatex" => "-pdflua",
        _ => return Err(AppError::Invalid(format!("unsupported engine {engine}"))),
    })
}

/// Arguments for latexmk. Public for testing.
pub fn latexmk_args(engine: &str, main_rel: &str, shell_escape: bool) -> AppResult<Vec<String>> {
    Ok(vec![
        "-norc".into(),
        engine_flag(engine)?.into(),
        "-interaction=nonstopmode".into(),
        "-file-line-error".into(),
        "-synctex=1".into(),
        format!("-outdir={OUTPUT_DIR}"),
        format!("-latexoption={}", if shell_escape { "-shell-escape" } else { "-no-shell-escape" }),
        main_rel.into(),
    ])
}

pub fn engine_args(main_rel: &str, shell_escape: bool) -> Vec<String> {
    vec![
        "-interaction=nonstopmode".into(),
        "-file-line-error".into(),
        "-synctex=1".into(),
        format!("-output-directory={OUTPUT_DIR}"),
        if shell_escape { "-shell-escape".into() } else { "-no-shell-escape".into() },
        main_rel.into(),
    ]
}

fn mirror_dirs(root: &Path, out: &Path) -> AppResult<()> {
    // \include{sections/x} writes sections/x.aux inside the output dir; the
    // engines do not create that subfolder themselves.
    fs::create_dir_all(out)?;
    for e in walkdir::WalkDir::new(root)
        .min_depth(1)
        .max_depth(6)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            !(e.depth() == 1 && n == OUTPUT_DIR) && !n.starts_with('.') && n != "node_modules"
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        if let Ok(rel) = e.path().strip_prefix(root) {
            fs::create_dir_all(out.join(rel))?;
        }
    }
    Ok(())
}

fn mtime(p: &Path) -> Option<SystemTime> {
    fs::metadata(p).and_then(|m| m.modified()).ok()
}

fn configure_env(cmd: &mut std::process::Command, bin_dir: Option<&Path>) {
    // Unwrapped log lines make parsing reliable.
    cmd.env("max_print_line", "10000")
        .env("error_line", "254")
        .env("half_error_line", "238")
        // Paranoid output: TeX may only write inside the working tree.
        .env("openout_any", "p");
    if let Some(dir) = bin_dir {
        let mut paths = vec![dir.to_path_buf()];
        if let Some(p) = std::env::var_os("PATH") {
            paths.extend(std::env::split_paths(&p));
        }
        if let Ok(joined) = std::env::join_paths(paths) {
            cmd.env("PATH", joined);
        }
    }
}

fn run_compile(req: &CompileRequest, cancel: &Arc<AtomicBool>, mut emit: impl FnMut(OutputLine)) -> AppResult<CompileResult> {
    let started = Instant::now();
    let started_at = chrono::Utc::now().to_rfc3339();
    let start_time = SystemTime::now();
    let root = PathBuf::from(&req.root).canonicalize()?;
    let main_abs = resolve_in_root(&root, &req.main_file)?;
    if !main_abs.is_file() {
        return Err(AppError::NotFound(format!("main file {}", req.main_file)));
    }
    let main_rel = req.main_file.replace('\\', "/");
    let stem = main_abs.file_stem().unwrap().to_string_lossy().into_owned();
    let out_dir = root.join(OUTPUT_DIR);
    mirror_dirs(&root, &out_dir)?;
    let deadline = started + Duration::from_secs(req.timeout_secs.clamp(10, 3600));
    let custom = req.tex_bin_dir.as_deref();

    let engine_path = detect::find_tool(&req.engine, custom).ok_or_else(|| {
        AppError::Compiler(format!("{} was not found. Install a TeX distribution or set the TeX binaries folder in Settings → Compiler.", req.engine))
    })?;
    let bin_dir = engine_path.parent().map(Path::to_path_buf);

    let mut raw = String::new();
    let push_raw = |s: &str, raw: &mut String| {
        if raw.len() < MAX_RAW_OUTPUT {
            raw.push_str(s);
            raw.push('\n');
        }
    };
    let root_s = req.root.clone();
    let mut sink = |line: &str, err: bool, raw: &mut String| {
        push_raw(line, raw);
        emit(OutputLine { root: root_s.clone(), line: line.to_string(), stderr: err });
    };

    let latexmk = if req.use_latexmk { detect::find_tool("latexmk", custom) } else { None };
    let mut tool = String::new();
    let mut outcome = Outcome::Exited(Some(0));

    // Engines write <jobname>.* directly into the output directory, even when
    // the main file lives in a subfolder.
    let pdf_out = out_dir.join(format!("{stem}.pdf"));
    let log_path = out_dir.join(format!("{stem}.log"));

    let mut latexmk_ok = false;
    if let Some(lm) = latexmk {
        tool = "latexmk".into();
        let mut cmd = hidden_command(&lm);
        cmd.current_dir(&root).args(latexmk_args(&req.engine, &main_rel, req.shell_escape)?);
        configure_env(&mut cmd, bin_dir.as_deref());
        sink(&format!("$ latexmk {}", latexmk_args(&req.engine, &main_rel, req.shell_escape)?.join(" ")), false, &mut raw);
        match run_streaming(cmd, cancel, deadline, |l, e| sink(l, e, &mut raw)) {
            Ok(o) => {
                // latexmk exits 0 on success, 12 on LaTeX errors. Other codes
                // (e.g. Perl missing on Windows) mean latexmk itself is broken.
                latexmk_ok = !matches!(o, Outcome::Exited(Some(c)) if c != 0 && c != 12 && !log_path.exists());
                outcome = o;
            }
            Err(e) => sink(&format!("latexmk could not be started: {e}; falling back to direct engine runs"), true, &mut raw),
        }
    }

    if !latexmk_ok && !matches!(outcome, Outcome::Cancelled | Outcome::TimedOut) {
        tool = "direct".into();
        outcome = run_direct(req, &root, &engine_path, &main_rel, &stem, &out_dir, bin_dir.as_deref(), cancel, deadline, &mut |l, e| sink(l, e, &mut raw))?;
    }

    // ---- analyse results ---------------------------------------------------
    let (cancelled, timed_out, exit_code) = match outcome {
        Outcome::Exited(c) => (false, false, c),
        Outcome::Cancelled => (true, false, None),
        Outcome::TimedOut => (false, true, None),
    };
    // latexmk exits 0 without rerunning anything when all targets are already
    // up to date; the existing log/PDF then describe the current sources.
    let up_to_date = tool == "latexmk" && exit_code == Some(0);
    let fresh = |p: &Path| mtime(p).is_some_and(|t| t >= start_time - Duration::from_secs(2));
    let current = |p: &Path| p.exists() && (fresh(p) || up_to_date);
    let mut diagnostics = Vec::new();
    if current(&log_path) {
        let bytes = fs::read(&log_path)?;
        diagnostics.extend(log_parser::parse_latex_log(&String::from_utf8_lossy(&bytes), &root));
    }
    let blg = out_dir.join(format!("{stem}.blg"));
    if current(&blg) {
        diagnostics.extend(log_parser::parse_blg(&String::from_utf8_lossy(&fs::read(&blg)?), &root));
    }
    refine_locations(&mut diagnostics, &root);
    if timed_out {
        diagnostics.insert(0, system_diag(format!("Compilation exceeded the {} s time limit and was stopped. Increase it in Settings → Compiler if your document is very large.", req.timeout_secs)));
    }
    if exit_code.is_some_and(|c| c != 0) && !diagnostics.iter().any(|d| d.severity == Severity::Error) && !cancelled {
        diagnostics.push(system_diag(format!("{} exited with code {}. See the Compilation Output tab for details.", tool, exit_code.unwrap())));
    }

    let errors = diagnostics.iter().filter(|d| d.severity == Severity::Error).count();
    let warnings = diagnostics.iter().filter(|d| d.severity == Severity::Warning).count();
    let infos = diagnostics.len() - errors - warnings;
    let success = !cancelled && !timed_out && errors == 0 && current(&pdf_out) && exit_code == Some(0);

    let build_dir = root.join(BUILD_DIR);
    let last_pdf = build_dir.join(format!("{stem}.pdf"));
    if success {
        fs::create_dir_all(&build_dir)?;
        // Copy to temp then rename so a reader never sees a partial file.
        let tmp = build_dir.join(format!("{stem}.pdf.tmp"));
        fs::copy(&pdf_out, &tmp)?;
        fs::rename(&tmp, &last_pdf)?;
        let syn = pdf_out.with_extension("synctex.gz");
        let syn_dst = build_dir.join(format!("{stem}.synctex.gz"));
        if syn.exists() {
            fs::copy(&syn, &syn_dst)?;
        } else {
            let _ = fs::remove_file(&syn_dst);
        }
    }

    let message = if cancelled {
        "Compilation cancelled".to_string()
    } else if timed_out {
        "Compilation timed out".to_string()
    } else if success {
        format!("Compiled successfully in {:.1} s", started.elapsed().as_secs_f64())
    } else if errors > 0 {
        format!("Compilation failed with {errors} error{}", if errors == 1 { "" } else { "s" })
    } else {
        "Compilation failed".to_string()
    };

    Ok(CompileResult {
        success,
        cancelled,
        timed_out,
        exit_code,
        duration_ms: started.elapsed().as_millis(),
        tool,
        engine: req.engine.clone(),
        pdf_path: last_pdf.exists().then(|| last_pdf.to_string_lossy().into_owned()),
        pdf_updated: success,
        diagnostics,
        error_count: errors,
        warning_count: warnings,
        info_count: infos,
        log_file: log_path.exists().then(|| log_path.to_string_lossy().into_owned()),
        raw_output: raw,
        started_at,
        message,
    })
}

/// TeX reports a missing `\usepackage`/`\input` file at the line where it
/// stopped *reading*, which is often the following line (look-ahead for an
/// optional argument). Point the diagnostic at the line that names the file.
pub fn refine_locations(diags: &mut [Diagnostic], root: &Path) {
    let re = regex::Regex::new(r"File `([^']+)' not found").unwrap();
    for d in diags.iter_mut().filter(|d| d.category == "missing-file") {
        let (Some(file), Some(cap)) = (d.file.clone(), re.captures(&d.message)) else { continue };
        let missing = &cap[1];
        let stem = Path::new(missing).file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let Ok(src) = fs::read_to_string(root.join(&file)) else { continue };
        let reported = d.line.unwrap_or(u32::MAX) as usize;
        let hit = src
            .lines()
            .enumerate()
            .filter(|(i, l)| *i < reported && (l.contains(missing) || l.contains(&stem)) && !l.trim_start().starts_with('%'))
            .last();
        if let Some((i, _)) = hit {
            d.line = Some(i as u32 + 1);
        }
    }
}

fn system_diag(message: String) -> Diagnostic {
    Diagnostic {
        severity: Severity::Error,
        category: "system".into(),
        file: None,
        external_file: None,
        line: None,
        suggestion: None,
        message,
        context: None,
        source: "quantum-maze".into(),
    }
}

#[allow(clippy::too_many_arguments)]
fn run_direct(
    req: &CompileRequest,
    root: &Path,
    engine: &Path,
    main_rel: &str,
    stem: &str,
    out_dir: &Path,
    bin_dir: Option<&Path>,
    cancel: &Arc<AtomicBool>,
    deadline: Instant,
    sink: &mut dyn FnMut(&str, bool),
) -> AppResult<Outcome> {
    let custom = req.tex_bin_dir.as_deref();
    let run_engine = |sink: &mut dyn FnMut(&str, bool)| -> AppResult<Outcome> {
        let args = engine_args(main_rel, req.shell_escape);
        sink(&format!("$ {} {}", req.engine, args.join(" ")), false);
        let mut cmd = hidden_command(engine);
        cmd.current_dir(root).args(&args);
        configure_env(&mut cmd, bin_dir);
        Ok(run_streaming(cmd, cancel, deadline, |l, e| sink(l, e))?)
    };
    let mut o = run_engine(sink)?;
    if !matches!(o, Outcome::Exited(_)) {
        return Ok(o);
    }
    let aux = out_dir.join(format!("{stem}.aux"));
    let bcf = out_dir.join(format!("{stem}.bcf"));
    let aux_text = fs::read_to_string(&aux).unwrap_or_default();
    let wants_biber = req.bib_tool == "biber" || (req.bib_tool == "auto" && bcf.exists());
    let wants_bibtex = !wants_biber && (req.bib_tool == "bibtex" || aux_text.contains("\\bibdata"));
    let mut ran_bib = false;
    if wants_biber || wants_bibtex {
        let name = if wants_biber { "biber" } else { "bibtex" };
        match detect::find_tool(name, custom) {
            Some(bib) => {
                let mut cmd = hidden_command(&bib);
                cmd.current_dir(root);
                let args: Vec<String> = if wants_biber {
                    vec![format!("--input-directory={OUTPUT_DIR}"), format!("--output-directory={OUTPUT_DIR}"), stem.to_string()]
                } else {
                    vec![format!("{OUTPUT_DIR}/{stem}")]
                };
                cmd.args(&args);
                configure_env(&mut cmd, bin_dir);
                sink(&format!("$ {name} {}", args.join(" ")), false);
                let b = run_streaming(cmd, cancel, deadline, |l, e| sink(l, e))?;
                if !matches!(b, Outcome::Exited(_)) {
                    return Ok(b);
                }
                ran_bib = true;
            }
            None => sink(&format!("{name} is required for the bibliography but was not found"), true),
        }
    }
    // Rerun until cross-references settle (max 4 engine passes in total).
    let log = out_dir.join(format!("{stem}.log"));
    for pass in 0..3 {
        let text = fs::read_to_string(&log).unwrap_or_default();
        let needs = ran_bib && pass == 0
            || text.contains("Rerun to get")
            || text.contains("Label(s) may have changed")
            || text.contains("Please rerun LaTeX")
            || text.contains("rerunfilecheck Warning");
        if !needs {
            break;
        }
        o = run_engine(sink)?;
        if !matches!(o, Outcome::Exited(_)) {
            return Ok(o);
        }
    }
    Ok(o)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_are_arrays_and_shell_escape_off_by_default() {
        let a = latexmk_args("xelatex", "main.tex", false).unwrap();
        assert!(a.contains(&"-norc".to_string()));
        assert!(a.contains(&"-pdfxe".to_string()));
        assert!(a.contains(&"-latexoption=-no-shell-escape".to_string()));
        assert_eq!(a.last().unwrap(), "main.tex");
        assert!(engine_args("main.tex", false).contains(&"-no-shell-escape".to_string()));
        assert!(engine_args("main.tex", true).contains(&"-shell-escape".to_string()));
        assert!(latexmk_args("rm -rf", "main.tex", false).is_err());
    }
}
