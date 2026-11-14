//! Notebooks: each notebook is one JSON file (`*.qmnote.json`) in a folder the user
//! chose (stored in settings). Images are embedded in the JSON, so a notebook is a
//! single portable file.
//!
//! Safety: file names are validated (no path separators), every save keeps the previous
//! version in `.qm-backup/`, and deleting moves the file to `.qm-trash/`.

use crate::error::{AppError, AppResult};
use crate::filesystem::atomic_write;
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const EXT: &str = ".qmnote.json";
const MAX_BYTES: u64 = 300 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookInfo {
    pub file: String,
    pub title: String,
    pub subject: String,
    pub cover: String,
    pub color: String,
    pub pages: usize,
    pub updated: String,
    pub size: u64,
}

fn valid_name(file: &str) -> AppResult<()> {
    let stem = file.strip_suffix(EXT).unwrap_or("");
    let ok = !stem.is_empty()
        && file.len() <= 140
        && !file.starts_with('.')
        && file.chars().all(|c| c.is_ascii_alphanumeric() || "-_ .".contains(c))
        && !file.contains("..");
    if ok { Ok(()) } else { Err(AppError::Invalid(format!("invalid notebook file name: {file}"))) }
}

fn dir_ok(dir: &Path) -> AppResult<()> {
    if dir.is_dir() { Ok(()) } else { Err(AppError::NotFound(format!("notebooks folder {}", dir.display()))) }
}

fn target(dir: &Path, file: &str) -> AppResult<PathBuf> {
    valid_name(file)?;
    dir_ok(dir)?;
    Ok(dir.join(file))
}

pub fn list(dir: &Path) -> AppResult<Vec<NotebookInfo>> {
    dir_ok(dir)?;
    let mut out = Vec::new();
    for e in std::fs::read_dir(dir)?.filter_map(|e| e.ok()) {
        let file = e.file_name().to_string_lossy().to_string();
        if valid_name(&file).is_err() || !e.path().is_file() {
            continue;
        }
        let size = e.metadata().map(|m| m.len()).unwrap_or(0);
        let v: serde_json::Value = if size <= MAX_BYTES { std::fs::read(e.path()).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default() } else { Default::default() };
        let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").chars().take(200).collect::<String>();
        out.push(NotebookInfo {
            title: if s("title").is_empty() { file.trim_end_matches(EXT).to_string() } else { s("title") },
            subject: s("subject"),
            cover: v["cover"]["theme"].as_str().unwrap_or("").to_string(),
            color: v["cover"]["color"].as_str().unwrap_or("").to_string(),
            pages: v["pages"].as_array().map(|a| a.len()).unwrap_or(0),
            updated: s("updated"),
            size,
            file,
        });
    }
    out.sort_by(|a, b| b.updated.cmp(&a.updated).then(a.title.cmp(&b.title)));
    Ok(out)
}

pub fn read(dir: &Path, file: &str) -> AppResult<String> {
    let p = target(dir, file)?;
    if std::fs::metadata(&p)?.len() > MAX_BYTES {
        return Err(AppError::Invalid("notebook file is too large to open".into()));
    }
    Ok(std::fs::read_to_string(p)?)
}

/// Saves a notebook. With `create`, refuses to overwrite an existing file.
pub fn write(dir: &Path, file: &str, content: &str, create: bool) -> AppResult<()> {
    let p = target(dir, file)?;
    serde_json::from_str::<serde_json::Value>(content).map_err(|e| AppError::Invalid(format!("notebook is not valid JSON: {e}")))?;
    if p.exists() {
        if create {
            return Err(AppError::Invalid(format!("{file} already exists")));
        }
        // Keep the previous version: a bad save must never destroy the only copy.
        let bak = dir.join(".qm-backup");
        std::fs::create_dir_all(&bak)?;
        std::fs::copy(&p, bak.join(file))?;
    }
    atomic_write(&p, content.as_bytes())
}

/// Moves the notebook to `.qm-trash/` inside the notebooks folder (never deletes).
pub fn trash(dir: &Path, file: &str) -> AppResult<String> {
    let p = target(dir, file)?;
    let t = dir.join(".qm-trash");
    std::fs::create_dir_all(&t)?;
    let mut dest = t.join(file);
    let mut i = 2;
    while dest.exists() {
        dest = t.join(format!("{}-{i}{EXT}", file.trim_end_matches(EXT)));
        i += 1;
    }
    std::fs::rename(&p, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_restricted() {
        for bad in ["../x.qmnote.json", "a/b.qmnote.json", "a\\b.qmnote.json", ".hidden.qmnote.json", "x.json", ".qmnote.json", "a..b.qmnote.json"] {
            assert!(valid_name(bad).is_err(), "{bad}");
        }
        valid_name("Radar notes-a1b2c3.qmnote.json").unwrap();
    }

    #[test]
    fn save_keeps_backup_and_trash_keeps_file() {
        let d = tempfile::tempdir().unwrap();
        let f = "notes-abc123.qmnote.json";
        write(d.path(), f, r#"{"title":"Radar","subject":"EW","cover":{"theme":"radar"},"pages":[{},{}],"updated":"2026-11-14T10:00:00Z"}"#, true).unwrap();
        assert!(write(d.path(), f, "{}", true).is_err(), "create must not overwrite");
        assert!(write(d.path(), f, "not json", false).is_err());
        write(d.path(), f, r#"{"title":"Radar v2","pages":[]}"#, false).unwrap();
        assert!(std::fs::read_to_string(d.path().join(".qm-backup").join(f)).unwrap().contains("\"Radar\""));
        std::fs::write(d.path().join("other.txt"), "x").unwrap();
        let l = list(d.path()).unwrap();
        assert_eq!((l.len(), l[0].title.as_str(), l[0].pages), (1, "Radar v2", 0));
        assert!(read(d.path(), f).unwrap().contains("Radar v2"));
        let moved = trash(d.path(), f).unwrap();
        assert!(Path::new(&moved).is_file() && list(d.path()).unwrap().is_empty());
        assert!(read(d.path(), "../other.txt").is_err());
    }
}
