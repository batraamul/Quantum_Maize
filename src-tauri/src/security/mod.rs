//! Path and input safety helpers.
//!
//! All file operations requested by the frontend use *project-relative* paths.
//! `resolve_in_root` guarantees that the resolved path stays inside the project
//! root, rejecting absolute paths, `..` traversal, drive prefixes and symlink
//! escapes. Archive entry names (template and project importer) go through the same checks.

use crate::error::{AppError, AppResult};
use std::path::{Component, Path, PathBuf};

/// Validate a project-relative path lexically (no filesystem access).
/// Returns the normalised relative path using `/`-free components.
pub fn sanitize_relative(rel: &str) -> AppResult<PathBuf> {
    if rel.is_empty() {
        return Err(AppError::Invalid("empty path".into()));
    }
    if rel.contains('\0') {
        return Err(AppError::Security("path contains NUL byte".into()));
    }
    // Normalise Windows separators so "..\\x" is caught on every platform.
    let unified = rel.replace('\\', "/");
    let p = Path::new(&unified);
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Normal(seg) => {
                let s = seg.to_string_lossy();
                if s.contains(':') {
                    // Blocks "C:foo" drive-relative paths and NTFS alternate data streams.
                    return Err(AppError::Security(format!("illegal path segment: {s}")));
                }
                out.push(seg)
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(AppError::Security(format!("path traversal rejected: {rel}")))
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::Security(format!("absolute path rejected: {rel}")))
            }
        }
    }
    if out.as_os_str().is_empty() {
        return Err(AppError::Invalid("empty path".into()));
    }
    Ok(out)
}

/// Resolve a project-relative path against `root`, ensuring the result (after
/// resolving symlinks of the existing prefix) cannot escape `root`.
pub fn resolve_in_root(root: &Path, rel: &str) -> AppResult<PathBuf> {
    let clean = sanitize_relative(rel)?;
    let root_canon = root
        .canonicalize()
        .map_err(|e| AppError::NotFound(format!("project root {}: {e}", root.display())))?;
    let joined = root_canon.join(&clean);

    // Canonicalise the deepest existing ancestor to detect symlink escapes.
    let mut probe = joined.clone();
    let mut tail = Vec::new();
    while !probe.exists() {
        match (probe.file_name(), probe.parent()) {
            (Some(name), Some(parent)) => {
                tail.push(name.to_os_string());
                probe = parent.to_path_buf();
            }
            _ => break,
        }
    }
    let mut real = probe.canonicalize().unwrap_or(probe);
    for t in tail.into_iter().rev() {
        real.push(t);
    }
    if !real.starts_with(&root_canon) {
        return Err(AppError::Security(format!(
            "path resolves outside the project: {rel}"
        )));
    }
    Ok(real)
}

/// Convert an absolute path inside `root` to a forward-slash relative string.
pub fn to_relative(root: &Path, abs: &Path) -> Option<String> {
    let root = root.canonicalize().ok()?;
    let abs = abs.canonicalize().unwrap_or_else(|_| abs.to_path_buf());
    abs.strip_prefix(&root)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}

/// Validate a user-supplied file or folder *name* (single segment).
pub fn validate_name(name: &str) -> AppResult<()> {
    let bad = name.is_empty()
        || name == "."
        || name == ".."
        || name.len() > 200
        || name
            .chars()
            .any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0'));
    if bad {
        return Err(AppError::Invalid(format!("invalid name: {name:?}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_traversal_and_absolute() {
        assert!(sanitize_relative("../etc/passwd").is_err());
        assert!(sanitize_relative("a/../../b").is_err());
        assert!(sanitize_relative("..\\..\\windows").is_err());
        assert!(sanitize_relative("/etc/passwd").is_err());
        assert!(sanitize_relative("C:/Windows").is_err());
        assert!(sanitize_relative("C:foo").is_err());
        assert!(sanitize_relative("file.tex:stream").is_err());
        assert!(sanitize_relative("").is_err());
    }

    #[test]
    fn accepts_normal_paths() {
        assert_eq!(
            sanitize_relative("sections/./intro.tex").unwrap(),
            PathBuf::from("sections").join("intro.tex")
        );
    }

    #[test]
    fn resolve_stays_in_root() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("sections")).unwrap();
        let p = resolve_in_root(dir.path(), "sections/new.tex").unwrap();
        assert!(p.starts_with(dir.path().canonicalize().unwrap()));
        assert!(resolve_in_root(dir.path(), "../x").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("link")).unwrap();
        assert!(resolve_in_root(dir.path(), "link/secret.txt").is_err());
    }

    #[test]
    fn names() {
        assert!(validate_name("intro.tex").is_ok());
        assert!(validate_name("a/b").is_err());
        assert!(validate_name("..").is_err());
    }
}
