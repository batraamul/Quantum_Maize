//! Interactive stories: preview server and export.
//!
//! The story HTML is generated in the frontend (one renderer for preview and
//! export). Asset references are emitted as `{{qm-asset:<project path>}}`
//! tokens. For preview the page is served from the `qmstory://` origin —
//! separate from the app, with its own Content-Security-Policy, inside a
//! sandboxed iframe — and tokens become `asset/<path>` URLs served from the
//! project. For export, tokens become embedded data URIs (single file) or
//! copied files (web folder).

pub mod library;

use crate::error::{AppError, AppResult};
use crate::security::resolve_in_root;
use base64::Engine;
use once_cell::sync::Lazy;
use regex::Regex;
use std::borrow::Cow;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const SCHEME: &str = "qmstory";
static TOKEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\{\{qm-asset:([^}]{1,500})\}\}").unwrap());

#[derive(Default)]
pub struct PreviewState {
    current: Mutex<Option<(PathBuf, String)>>,
}

impl PreviewState {
    pub fn set(&self, root: PathBuf, html: String) {
        *self.current.lock().unwrap() = Some((root, html));
    }
}

pub fn mime(path: &str) -> &'static str {
    match Path::new(path).extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mp3") => "audio/mpeg",
        Some("json") => "application/json",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

pub const ASSET_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mp3"];

fn pct_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn pct_encode_path(p: &str) -> String {
    p.bytes()
        .map(|c| match c {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => (c as char).to_string(),
            _ => format!("%{c:02X}"),
        })
        .collect()
}

// Story pages may only load their own assets; no network access.
// WebKit does not match custom schemes against 'self', so name them explicitly.
const PREVIEW_CSP: &str = "default-src 'none'; img-src 'self' qmstory: http://qmstory.localhost data: blob:; media-src 'self' qmstory: http://qmstory.localhost data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";

pub fn handle(state: &PreviewState, path: &str) -> tauri::http::Response<Cow<'static, [u8]>> {
    let resp = |status: u16, ctype: &str, body: Vec<u8>| {
        tauri::http::Response::builder()
            .status(status)
            .header("Content-Type", ctype)
            .header("Content-Security-Policy", PREVIEW_CSP)
            .header("Cache-Control", "no-store")
            .body(Cow::Owned(body))
            .unwrap()
    };
    let guard = state.current.lock().unwrap();
    let Some((root, html)) = guard.as_ref() else {
        return resp(404, "text/plain", b"no story loaded".to_vec());
    };
    let path = path.trim_start_matches('/');
    if path.is_empty() || path == "preview" || path.starts_with("preview") {
        let out = TOKEN.replace_all(html, |c: &regex::Captures| format!("asset/{}", pct_encode_path(&c[1])));
        return resp(200, "text/html; charset=utf-8", out.into_owned().into_bytes());
    }
    if let Some(rel) = path.strip_prefix("asset/") {
        let rel = pct_decode(rel.split('?').next().unwrap_or(""));
        return match resolve_in_root(root, &rel).and_then(|p| Ok(std::fs::read(p)?)) {
            Ok(b) => resp(200, mime(&rel), b),
            Err(_) => resp(404, "text/plain", b"not found".to_vec()),
        };
    }
    resp(404, "text/plain", b"not found".to_vec())
}

/// Export: `single` embeds every asset as a data URI; otherwise `dest` is a
/// folder receiving index.html plus an assets/ copy. Returns missing assets.
pub fn export(root: &Path, html: &str, dest: &Path, single: bool) -> AppResult<Vec<String>> {
    let mut missing = Vec::new();
    let mut copies: Vec<(PathBuf, String)> = Vec::new();
    let out = TOKEN.replace_all(html, |c: &regex::Captures| {
        let rel = c[1].to_string();
        match resolve_in_root(root, &rel) {
            Ok(p) if p.is_file() => {
                if single {
                    match std::fs::read(&p) {
                        Ok(b) => format!("data:{};base64,{}", mime(&rel), base64::engine::general_purpose::STANDARD.encode(b)),
                        Err(_) => {
                            missing.push(rel.clone());
                            String::new()
                        }
                    }
                } else {
                    copies.push((p, rel.clone()));
                    pct_encode_path(&rel)
                }
            }
            _ => {
                missing.push(rel.clone());
                String::new()
            }
        }
    });
    if single {
        std::fs::write(dest, out.as_bytes())?;
    } else {
        if dest.exists() && std::fs::read_dir(dest)?.next().is_some() && !dest.join("index.html").exists() {
            return Err(AppError::Invalid("choose an empty folder for the web export".into()));
        }
        std::fs::create_dir_all(dest)?;
        std::fs::write(dest.join("index.html"), out.as_bytes())?;
        for (src, rel) in copies {
            let target = dest.join(crate::security::sanitize_relative(&rel)?);
            if let Some(p) = target.parent() {
                std::fs::create_dir_all(p)?;
            }
            std::fs::copy(src, target)?;
        }
    }
    Ok(missing)
}

/// Copy a user-chosen media file into the project's assets/ folder.
pub fn import_asset(root: &Path, src: &Path) -> AppResult<String> {
    import_into(root, src, "assets", ASSET_EXTS)
}

/// Image formats LaTeX engines can include directly.
pub const FIGURE_EXTS: &[&str] = &["png", "jpg", "jpeg", "pdf", "eps"];

/// Copies a user-chosen file into `<root>/<folder>/` under a sanitised, non-clashing name
/// (never overwrites) and returns the project-relative path.
pub fn import_into(root: &Path, src: &Path, folder: &str, exts: &[&str]) -> AppResult<String> {
    let name = src.file_name().ok_or_else(|| AppError::Invalid("no file name".into()))?.to_string_lossy().to_string();
    let ext = Path::new(&name).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !exts.contains(&ext.as_str()) {
        return Err(AppError::Invalid(format!("unsupported file type .{ext} (use {})", exts.join(", "))));
    }
    if !src.is_file() {
        return Err(AppError::NotFound(src.display().to_string()));
    }
    let safe: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || "._-".contains(c) { c } else { '-' }).collect();
    std::fs::create_dir_all(root.join(folder))?;
    let stem = Path::new(&safe).file_stem().unwrap().to_string_lossy().to_string();
    let mut rel = format!("{folder}/{stem}.{ext}");
    let mut i = 2;
    while root.join(&rel).exists() {
        rel = format!("{folder}/{stem}-{i}.{ext}");
        i += 1;
    }
    std::fs::copy(src, root.join(&rel))?;
    Ok(rel)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn import_into_sanitises_and_never_overwrites() {
        let d = tempfile::tempdir().unwrap();
        let src = d.path().join("My plot (v2).PNG");
        std::fs::write(&src, b"x").unwrap();
        let root = d.path().join("proj");
        std::fs::create_dir(&root).unwrap();
        assert_eq!(import_into(&root, &src, "figures", FIGURE_EXTS).unwrap(), "figures/My-plot--v2-.png");
        assert_eq!(import_into(&root, &src, "figures", FIGURE_EXTS).unwrap(), "figures/My-plot--v2--2.png");
        let bad = d.path().join("run.sh");
        std::fs::write(&bad, b"x").unwrap();
        assert!(import_into(&root, &bad, "figures", FIGURE_EXTS).is_err());
    }

    #[test]
    fn preview_serves_page_and_contained_assets() {
        let d = tempfile::tempdir().unwrap();
        std::fs::create_dir(d.path().join("assets")).unwrap();
        std::fs::write(d.path().join("assets/a b.png"), b"PNG").unwrap();
        let st = PreviewState::default();
        st.set(d.path().canonicalize().unwrap(), r#"<img src="{{qm-asset:assets/a b.png}}">"#.into());
        let r = handle(&st, "/preview");
        assert_eq!(r.status(), 200);
        assert!(String::from_utf8_lossy(r.body()).contains(r#"src="asset/assets/a%20b.png""#));
        assert!(r.headers().get("Content-Security-Policy").unwrap().to_str().unwrap().contains("default-src 'none'"));
        assert_eq!(handle(&st, "/asset/assets/a%20b.png").body().as_ref(), b"PNG");
        assert_eq!(handle(&st, "/asset/..%2F..%2Fetc%2Fpasswd").status(), 404);
        assert_eq!(handle(&st, "/asset/../../etc/passwd").status(), 404);
    }

    #[test]
    fn export_single_and_folder() {
        let d = tempfile::tempdir().unwrap();
        std::fs::create_dir(d.path().join("assets")).unwrap();
        std::fs::write(d.path().join("assets/x.gif"), b"GIF89a").unwrap();
        let html = r#"<img src="{{qm-asset:assets/x.gif}}"><img src="{{qm-asset:assets/missing.png}}">"#;
        let single = d.path().join("s.html");
        let miss = export(d.path(), html, &single, true).unwrap();
        assert_eq!(miss, vec!["assets/missing.png"]);
        assert!(std::fs::read_to_string(&single).unwrap().contains("data:image/gif;base64,R0lGODlh"));
        let folder = d.path().join("web");
        export(d.path(), html, &folder, false).unwrap();
        assert!(folder.join("assets/x.gif").exists());
        assert!(std::fs::read_to_string(folder.join("index.html")).unwrap().contains(r#"src="assets/x.gif""#));
    }
}
