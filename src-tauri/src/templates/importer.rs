//! Import of untrusted LaTeX archives and folders (Overleaf exports, publisher
//! template ZIPs, custom journal templates).
//!
//! Extraction rules: every entry name goes through `security::sanitize_relative`
//! (no absolute paths, `..`, drive letters or NUL); symlinks and special files
//! are skipped; entry count, per-file size, total size and compression ratio are
//! capped. Nothing in an imported package is executed — the analysis only
//! reads files and asks `kpsewhich` which packages are installed.

use crate::compiler::detect;
use crate::compiler::proc::{hidden_command, run_capture};
use crate::error::{AppError, AppResult};
use crate::security::sanitize_relative;
use serde::Serialize;
use std::collections::BTreeSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub struct Limits {
    pub max_entries: usize,
    pub max_file: u64,
    pub max_total: u64,
    pub max_ratio: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Limits { max_entries: 5000, max_file: 200 * 1024 * 1024, max_total: 500 * 1024 * 1024, max_ratio: 200 }
    }
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExtractReport {
    pub files: usize,
    pub bytes: u64,
    pub skipped: Vec<String>,
}

/// Safely extract `zip_path` into `dest` (which must be empty or not exist).
pub fn safe_extract(zip_path: &Path, dest: &Path, lim: &Limits) -> AppResult<ExtractReport> {
    let f = fs::File::open(zip_path)?;
    let mut za = zip::ZipArchive::new(f)?;
    if za.len() > lim.max_entries {
        return Err(AppError::Security(format!("archive has {} entries (limit {})", za.len(), lim.max_entries)));
    }
    // Pre-check declared sizes before writing anything.
    let mut declared: u64 = 0;
    for i in 0..za.len() {
        let e = za.by_index_raw(i)?;
        declared = declared.saturating_add(e.size());
        if e.size() > lim.max_file {
            return Err(AppError::Security(format!("{} is larger than the {} MB per-file limit", e.name(), lim.max_file / 1_048_576)));
        }
        if e.compressed_size() > 0 && e.size() / e.compressed_size().max(1) > lim.max_ratio && e.size() > 1_048_576 {
            return Err(AppError::Security(format!("{} has a suspicious compression ratio (possible zip bomb)", e.name())));
        }
    }
    if declared > lim.max_total {
        return Err(AppError::Security(format!("archive expands to {} MB (limit {} MB)", declared / 1_048_576, lim.max_total / 1_048_576)));
    }
    fs::create_dir_all(dest)?;
    let mut rep = ExtractReport::default();
    for i in 0..za.len() {
        let mut e = za.by_index(i)?;
        let name = e.name().to_string();
        if name.starts_with("__MACOSX/") || name.ends_with(".DS_Store") {
            rep.skipped.push(format!("{name} (macOS metadata)"));
            continue;
        }
        let rel = match sanitize_relative(&name) {
            Ok(r) => r,
            Err(_) => return Err(AppError::Security(format!("unsafe path in archive: {name:?}"))),
        };
        if let Some(mode) = e.unix_mode() {
            let kind = mode & 0o170000;
            if kind == 0o120000 {
                rep.skipped.push(format!("{name} (symbolic link)"));
                continue;
            }
            if kind != 0 && kind != 0o100000 && kind != 0o040000 {
                rep.skipped.push(format!("{name} (special file)"));
                continue;
            }
        }
        let out = dest.join(&rel);
        if e.is_dir() {
            fs::create_dir_all(&out)?;
            continue;
        }
        if let Some(p) = out.parent() {
            fs::create_dir_all(p)?;
        }
        // Enforce real (not declared) sizes while streaming.
        let mut buf = Vec::new();
        (&mut e).take(lim.max_file + 1).read_to_end(&mut buf)?;
        if buf.len() as u64 > lim.max_file {
            return Err(AppError::Security(format!("{name} exceeds the per-file limit")));
        }
        rep.bytes += buf.len() as u64;
        if rep.bytes > lim.max_total {
            return Err(AppError::Security("archive exceeds the total size limit".into()));
        }
        fs::write(&out, buf)?;
        rep.files += 1;
    }
    Ok(rep)
}

/// If everything sits inside a single top-level folder, return that folder.
pub fn content_root(dir: &Path) -> PathBuf {
    let entries: Vec<_> = fs::read_dir(dir).map(|r| r.filter_map(|e| e.ok()).collect()).unwrap_or_default();
    if entries.len() == 1 && entries[0].path().is_dir() {
        return content_root(&entries[0].path());
    }
    dir.to_path_buf()
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageStatus {
    pub name: String,
    pub provided_by_template: bool,
    pub installed: Option<bool>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemplateReport {
    pub main_file: Option<String>,
    pub tex_files: Vec<String>,
    pub classes: Vec<String>,
    pub styles: Vec<String>,
    pub bib_styles: Vec<String>,
    pub biblatex_styles: Vec<String>,
    pub bib_files: Vec<String>,
    pub images: Vec<String>,
    pub instructions: Vec<String>,
    pub document_class: Option<String>,
    pub bib_tool: String,
    pub engine: String,
    pub packages: Vec<PackageStatus>,
    pub warnings: Vec<String>,
    pub file_count: usize,
}

fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root).unwrap_or(p).to_string_lossy().replace('\\', "/")
}

/// Inspect a folder of LaTeX sources. Read-only.
pub fn analyze(root: &Path, tex_bin: Option<&str>) -> AppResult<TemplateReport> {
    let mut r = TemplateReport { bib_tool: "bibtex".into(), engine: "pdflatex".into(), ..Default::default() };
    let mut used: BTreeSet<String> = BTreeSet::new();
    let mut sources = String::new();
    for e in walkdir::WalkDir::new(root).max_depth(8).into_iter().filter_map(|e| e.ok()) {
        if !e.file_type().is_file() {
            continue;
        }
        r.file_count += 1;
        let p = e.path();
        let rp = rel(root, p);
        let ext = p.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
        match ext.as_str() {
            "tex" | "ltx" => {
                r.tex_files.push(rp.clone());
                if let Ok(t) = fs::read_to_string(p) {
                    sources.push_str(&t);
                    sources.push('\n');
                }
            }
            "cls" => r.classes.push(rp),
            "sty" => r.styles.push(rp),
            "bst" => r.bib_styles.push(rp),
            "bbx" | "cbx" => r.biblatex_styles.push(rp),
            "bib" => r.bib_files.push(rp),
            "png" | "jpg" | "jpeg" | "pdf" | "eps" | "svg" | "gif" => {
                if ext == "pdf" && (rp.to_lowercase().contains("instruction") || rp.to_lowercase().contains("guide")) {
                    r.instructions.push(rp)
                } else {
                    r.images.push(rp)
                }
            }
            _ => {
                let n = rp.to_lowercase();
                if n.ends_with("latexmkrc") || n == "makefile" || ext == "sh" || ext == "bat" || ext == "py" || ext == "pl" {
                    r.warnings.push(format!("{rp}: build script found — Quantum Maze will NOT run it."));
                }
            }
        }
    }
    r.tex_files.sort();
    // Main file: \documentclass + \begin{document}, shallowest path.
    let mut mains: Vec<(usize, String)> = r
        .tex_files
        .iter()
        .filter(|f| fs::read_to_string(root.join(f)).map(|s| s.contains("\\documentclass") && s.contains("\\begin{document}")).unwrap_or(false))
        .map(|f| (f.matches('/').count(), f.clone()))
        .collect();
    mains.sort();
    r.main_file = mains.first().map(|m| m.1.clone());
    if mains.len() > 1 {
        r.warnings.push(format!("{} files look like main documents; chose {}", mains.len(), r.main_file.clone().unwrap_or_default()));
    }
    let clean: String = sources.lines().map(|l| l.split('%').next().unwrap_or("")).collect::<Vec<_>>().join("\n");
    if let Some(c) = regex::Regex::new(r"\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}").unwrap().captures(&clean) {
        r.document_class = Some(c[1].trim().to_string());
    }
    let pkg_re = regex::Regex::new(r"\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}").unwrap();
    for c in pkg_re.captures_iter(&clean) {
        for p in c[1].split(',') {
            let p = p.trim();
            if !p.is_empty() {
                used.insert(p.to_string());
            }
        }
    }
    if clean.contains("biblatex") && (clean.contains("backend=biber") || !clean.contains("backend=bibtex")) && used.contains("biblatex") {
        r.bib_tool = "biber".into();
    }
    if used.contains("fontspec") || used.contains("polyglossia") || used.contains("unicode-math") {
        r.engine = "xelatex".into();
    }
    if used.contains("minted") || clean.contains("\\write18") || used.contains("pythontex") {
        r.warnings.push("The template uses shell escape (minted / \\write18). It stays disabled unless you enable it per project.".into());
    }
    if used.contains("epstopdf") || r.images.iter().any(|i| i.ends_with(".eps")) {
        r.warnings.push("EPS figures need conversion; pdfLaTeX converts them only when epstopdf is available.".into());
    }
    // Which packages are provided by the template vs installed in TeX.
    let local: BTreeSet<String> = r
        .styles
        .iter()
        .chain(r.classes.iter())
        .filter_map(|s| Path::new(s).file_stem().map(|x| x.to_string_lossy().into_owned()))
        .collect();
    let kpse = detect::find_tool("kpsewhich", tex_bin);
    let mut names: Vec<String> = used.into_iter().collect();
    if let Some(c) = &r.document_class {
        let base = Path::new(c).file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
        names.insert(0, format!("{base}.cls"));
    }
    for n in names {
        let (stem, file) = if n.ends_with(".cls") { (n.trim_end_matches(".cls").to_string(), n.clone()) } else { (n.clone(), format!("{n}.sty")) };
        let provided = local.contains(&stem);
        let installed = if provided {
            None
        } else {
            kpse.as_ref().map(|k| {
                let mut cmd = hidden_command(k);
                cmd.arg(&file);
                run_capture(cmd, Duration::from_secs(5)).map(|o| !o.stdout.trim().is_empty()).unwrap_or(false)
            })
        };
        r.packages.push(PackageStatus { name: file, provided_by_template: provided, installed });
    }
    let missing: Vec<_> = r.packages.iter().filter(|p| p.installed == Some(false)).map(|p| p.name.clone()).collect();
    if !missing.is_empty() {
        r.warnings.push(format!("Not installed in your TeX distribution: {}", missing.join(", ")));
    }
    if r.main_file.is_none() {
        r.warnings.push("No main document (\\documentclass + \\begin{document}) was found.".into());
    }
    Ok(r)
}

/// Copy a directory tree (no symlinks) — used to install/instantiate templates.
pub fn copy_tree(src: &Path, dst: &Path) -> AppResult<usize> {
    let mut n = 0;
    for e in walkdir::WalkDir::new(src).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        let rp = e.path().strip_prefix(src).unwrap();
        if rp.as_os_str().is_empty() {
            continue;
        }
        let rel_s = rp.to_string_lossy().replace('\\', "/");
        if rel_s.starts_with("__MACOSX") || rel_s.split('/').any(|s| s == ".qmaze" || s == ".paperforge" || s == ".git") {
            continue;
        }
        let out = dst.join(rp);
        if e.file_type().is_dir() {
            fs::create_dir_all(&out)?;
        } else if e.file_type().is_file() {
            if let Some(p) = out.parent() {
                fs::create_dir_all(p)?;
            }
            fs::copy(e.path(), &out)?;
            n += 1;
        }
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn make_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let f = fs::File::create(path).unwrap();
        let mut z = zip::ZipWriter::new(f);
        for (n, b) in entries {
            z.start_file(*n, zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(b).unwrap();
        }
        z.finish().unwrap();
    }

    #[test]
    fn rejects_traversal_and_absolute_entries() {
        let d = tempfile::tempdir().unwrap();
        for bad in ["../evil.tex", "a/../../evil.tex", "/etc/evil", "C:/evil.tex", "..\\evil.tex"] {
            let z = d.path().join("bad.zip");
            make_zip(&z, &[("ok.tex", b"x"), (bad, b"pwned")]);
            let out = d.path().join("out");
            let _ = fs::remove_dir_all(&out);
            let e = safe_extract(&z, &out, &Limits::default());
            assert!(e.is_err(), "{bad} accepted");
            assert!(!d.path().join("evil.tex").exists());
        }
    }

    #[test]
    fn enforces_size_and_count_limits() {
        let d = tempfile::tempdir().unwrap();
        let z = d.path().join("big.zip");
        let big = vec![b'a'; 3 * 1024 * 1024];
        make_zip(&z, &[("big.tex", &big)]);
        let lim = Limits { max_file: 1024 * 1024, ..Default::default() };
        assert!(safe_extract(&z, &d.path().join("o1"), &lim).is_err());
        // highly compressible file → ratio check
        let lim = Limits { max_ratio: 10, ..Default::default() };
        assert!(safe_extract(&z, &d.path().join("o2"), &lim).is_err());
        let many: Vec<(String, Vec<u8>)> = (0..30).map(|i| (format!("f{i}.tex"), vec![b'x'])).collect();
        let refs: Vec<(&str, &[u8])> = many.iter().map(|(a, b)| (a.as_str(), b.as_slice())).collect();
        make_zip(&z, &refs);
        assert!(safe_extract(&z, &d.path().join("o3"), &Limits { max_entries: 10, ..Default::default() }).is_err());
    }

    #[test]
    fn extracts_and_analyzes_template() {
        let d = tempfile::tempdir().unwrap();
        let z = d.path().join("tpl.zip");
        make_zip(&z, &[
            ("journal-template/myjournal.cls", b"\\ProvidesClass{myjournal}\\LoadClass{article}"),
            ("journal-template/template.tex", b"\\documentclass{myjournal}\n\\usepackage{graphicx,amsmath}\n\\usepackage{doesnotexist2026}\n\\begin{document}x\\cite{a}\\bibliography{refs}\\end{document}"),
            ("journal-template/refs.bib", b"@book{a, title={A}, year={2020}}"),
            ("journal-template/latexmkrc", b"system('evil')"),
            ("__MACOSX/._x", b""),
        ]);
        let out = d.path().join("x");
        let rep = safe_extract(&z, &out, &Limits::default()).unwrap();
        assert_eq!(rep.files, 4);
        let root = content_root(&out);
        assert!(root.ends_with("journal-template"));
        let a = analyze(&root, None).unwrap();
        assert_eq!(a.main_file.as_deref(), Some("template.tex"));
        assert_eq!(a.document_class.as_deref(), Some("myjournal"));
        assert!(a.packages.iter().any(|p| p.name == "myjournal.cls" && p.provided_by_template));
        assert!(a.warnings.iter().any(|w| w.contains("latexmkrc")));
        if detect::find_tool("kpsewhich", None).is_some() {
            assert!(a.packages.iter().any(|p| p.name == "graphicx.sty" && p.installed == Some(true)));
            assert!(a.packages.iter().any(|p| p.name == "doesnotexist2026.sty" && p.installed == Some(false)));
        }
    }
}
