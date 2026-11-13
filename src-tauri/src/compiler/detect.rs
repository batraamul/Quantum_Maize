//! TeX distribution detection.
//!
//! Searches (in order) a user-configured bin folder, PATH, then well-known
//! install locations for TeX Live, MacTeX/BasicTeX and MiKTeX. Nothing is ever
//! installed or added to the system PATH — the setup wizard only reports and
//! links to official installers.

use super::proc::{hidden_command, run_capture};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const TOOLS: &[&str] = &[
    "pdflatex", "xelatex", "lualatex", "latexmk", "bibtex", "biber", "makeindex",
    "makeglossaries", "synctex", "kpsewhich", "tlmgr", "mpm", "miktex", "pandoc", "perl",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInfo {
    pub name: String,
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TexInstallation {
    pub os: String,
    pub arch: String,
    pub distribution: Option<String>,
    pub tools: Vec<ToolInfo>,
    pub package_manager: Option<String>,
    /// At least one engine is usable.
    pub ready: bool,
    /// latexmk exists AND runs (it needs Perl, which MiKTeX may lack).
    pub latexmk_usable: bool,
    pub searched_dirs: Vec<String>,
    pub guidance: Vec<Guidance>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Guidance {
    pub title: String,
    pub detail: String,
    pub url: Option<String>,
}

fn exe(name: &str) -> String {
    if cfg!(windows) { format!("{name}.exe") } else { name.to_string() }
}

fn candidate_dirs(custom: Option<&str>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(c) = custom.filter(|c| !c.trim().is_empty()) {
        dirs.push(PathBuf::from(c));
    }
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    let glob_texlive = |base: &Path, arch_dirs: &[&str]| -> Vec<PathBuf> {
        let mut v = Vec::new();
        if let Ok(rd) = std::fs::read_dir(base) {
            let mut years: Vec<PathBuf> = rd.filter_map(|e| e.ok()).map(|e| e.path()).collect();
            years.sort();
            years.reverse(); // newest first
            for y in years {
                for a in arch_dirs {
                    v.push(y.join("bin").join(a));
                }
            }
        }
        v
    };
    if cfg!(target_os = "macos") {
        dirs.push("/Library/TeX/texbin".into());
        dirs.extend(glob_texlive(Path::new("/usr/local/texlive"), &["universal-darwin", "x86_64-darwin", "arm64-darwin"]));
        dirs.push("/opt/homebrew/bin".into());
        dirs.push("/usr/local/bin".into());
    } else if cfg!(windows) {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            dirs.push(Path::new(&local).join("Programs/MiKTeX/miktex/bin/x64"));
        }
        for pf in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(p) = std::env::var_os(pf) {
                dirs.push(Path::new(&p).join("MiKTeX/miktex/bin/x64"));
                dirs.push(Path::new(&p).join("MiKTeX/miktex/bin"));
            }
        }
        dirs.extend(glob_texlive(Path::new("C:/texlive"), &["windows", "win64", "win32"]));
    } else {
        dirs.extend(glob_texlive(Path::new("/usr/local/texlive"), &["x86_64-linux", "aarch64-linux", "x86_64-linuxmusl"]));
        dirs.push("/usr/bin".into());
        dirs.push("/usr/local/bin".into());
        if let Some(home) = std::env::var_os("HOME") {
            dirs.extend(glob_texlive(&Path::new(&home).join("texlive"), &["x86_64-linux", "aarch64-linux"]));
        }
    }
    let mut seen = std::collections::HashSet::new();
    dirs.retain(|d| seen.insert(d.clone()));
    dirs
}

/// Locate a tool. Returns the absolute path to the executable.
pub fn find_tool(name: &str, custom: Option<&str>) -> Option<PathBuf> {
    let file = exe(name);
    for d in candidate_dirs(custom) {
        let p = d.join(&file);
        if p.is_file() {
            return Some(p);
        }
        // MiKTeX/TeX Live on Windows sometimes ship .bat/.cmd wrappers is NOT
        // supported deliberately: batch files re-introduce shell parsing.
    }
    None
}

fn version_of(path: &Path, name: &str) -> Option<String> {
    let flag = match name {
        "latexmk" => "-v",
        "makeindex" => return Some("present".into()), // makeindex has no version flag
        "mpm" | "miktex" => "--version",
        "tlmgr" => "--version",
        _ => "--version",
    };
    let mut cmd = hidden_command(path);
    cmd.arg(flag);
    let out = run_capture(cmd, Duration::from_secs(8)).ok()?;
    let text = format!("{}{}", out.stdout, out.stderr);
    text.lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(|l| l.chars().take(140).collect())
}

pub fn detect(custom_bin: Option<&str>) -> TexInstallation {
    let searched = candidate_dirs(custom_bin)
        .iter()
        .map(|d| d.to_string_lossy().into_owned())
        .collect();
    let tools: Vec<ToolInfo> = TOOLS
        .iter()
        .map(|t| {
            let path = find_tool(t, custom_bin);
            let version = path.as_deref().and_then(|p| version_of(p, t));
            ToolInfo {
                name: t.to_string(),
                found: path.is_some(),
                path: path.map(|p| p.to_string_lossy().into_owned()),
                version,
            }
        })
        .collect();
    let get = |n: &str| tools.iter().find(|t| t.name == n);

    let engine_version = ["pdflatex", "xelatex", "lualatex"]
        .iter()
        .filter_map(|e| get(e).and_then(|t| t.version.clone()))
        .next()
        .unwrap_or_default();
    let pdflatex_path = get("pdflatex").and_then(|t| t.path.clone()).unwrap_or_default();
    let distribution = if engine_version.is_empty() {
        None
    } else if engine_version.contains("MiKTeX") {
        Some("MiKTeX".to_string())
    } else if cfg!(target_os = "macos") {
        let year = extract_texlive_year(&engine_version);
        let basic = std::fs::read_dir("/usr/local/texlive")
            .map(|rd| rd.filter_map(|e| e.ok()).any(|e| e.file_name().to_string_lossy().contains("basic")))
            .unwrap_or(false);
        Some(format!("{} (TeX Live {})", if basic { "BasicTeX" } else { "MacTeX" }, year))
    } else if engine_version.contains("TeX Live") {
        Some(format!("TeX Live {}", extract_texlive_year(&engine_version)))
    } else {
        Some("Unknown TeX distribution".into())
    };
    let _ = pdflatex_path;

    let package_manager = if get("tlmgr").is_some_and(|t| t.found) {
        Some("tlmgr".into())
    } else if get("mpm").is_some_and(|t| t.found) || get("miktex").is_some_and(|t| t.found) {
        Some("MiKTeX Console / mpm".into())
    } else {
        None
    };
    let ready = ["pdflatex", "xelatex", "lualatex"].iter().any(|e| get(e).is_some_and(|t| t.found));
    let latexmk_usable = get("latexmk").is_some_and(|t| t.found && t.version.as_deref().is_some_and(|v| v.to_lowercase().contains("latexmk")));

    let mut guidance = Vec::new();
    if !ready {
        guidance.push(install_guidance());
    }
    if ready && !latexmk_usable {
        guidance.push(Guidance {
            title: "latexmk not available".into(),
            detail: if cfg!(windows) {
                "latexmk is optional. Quantum Maze will run the engine and BibTeX/Biber passes itself. To use latexmk on MiKTeX, install the latexmk package and a Perl distribution (e.g. Strawberry Perl).".into()
            } else {
                "latexmk is optional. Quantum Maze will run the engine and BibTeX/Biber passes itself. Install latexmk with your TeX distribution's package manager for smarter rebuilds.".into()
            },
            url: Some("https://ctan.org/pkg/latexmk".into()),
        });
    }
    if ready && !get("biber").is_some_and(|t| t.found) {
        guidance.push(Guidance {
            title: "Biber not found".into(),
            detail: "Projects using biblatex with backend=biber will not compile their bibliography. BibTeX projects are unaffected.".into(),
            url: Some("https://ctan.org/pkg/biber".into()),
        });
    }
    if ready && !get("synctex").is_some_and(|t| t.found) {
        guidance.push(Guidance {
            title: "SyncTeX tool not found".into(),
            detail: "Source ↔ PDF navigation will be unavailable. It ships with TeX Live and MiKTeX; check your installation.".into(),
            url: None,
        });
    }

    TexInstallation {
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        distribution,
        tools,
        package_manager,
        ready,
        latexmk_usable,
        searched_dirs: searched,
        guidance,
    }
}

fn extract_texlive_year(v: &str) -> String {
    regex::Regex::new(r"TeX Live (\d{4})")
        .ok()
        .and_then(|r| r.captures(v))
        .map(|c| c[1].to_string())
        .unwrap_or_else(|| "?".into())
}

fn install_guidance() -> Guidance {
    match std::env::consts::OS {
        "windows" => Guidance {
            title: "Install a TeX distribution".into(),
            detail: "Recommended: MiKTeX (installs missing packages on demand) or TeX Live for Windows (complete, larger). Run the installer, then click Rescan. Quantum Maze will not install system software for you.".into(),
            url: Some("https://miktex.org/download".into()),
        },
        "macos" => Guidance {
            title: "Install MacTeX".into(),
            detail: "MacTeX is the complete TeX Live distribution for macOS (Apple Silicon and Intel). BasicTeX is a smaller alternative that needs extra packages via tlmgr. Alternatively: `brew install --cask mactex-no-gui`. Click Rescan when done.".into(),
            url: Some("https://tug.org/mactex/".into()),
        },
        _ => Guidance {
            title: "Install TeX Live".into(),
            detail: "Ubuntu/Debian: `sudo apt install texlive-latex-extra texlive-xetex texlive-luatex texlive-bibtex-extra biber latexmk`. Fedora: `sudo dnf install texlive-scheme-medium latexmk biber`. Or use the upstream TeX Live installer for the newest release. Click Rescan when done.".into(),
            url: Some("https://tug.org/texlive/".into()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn year_extraction() {
        assert_eq!(extract_texlive_year("pdfTeX 3.14 (TeX Live 2023/Debian)"), "2023");
        assert_eq!(extract_texlive_year("MiKTeX-pdfTeX 4.10"), "?");
    }
    #[test]
    fn custom_dir_searched_first() {
        let d = tempfile::tempdir().unwrap();
        let dirs = candidate_dirs(Some(d.path().to_str().unwrap()));
        assert_eq!(dirs[0], d.path());
    }
}
