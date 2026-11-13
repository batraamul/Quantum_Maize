//! SyncTeX forward (source → PDF) and inverse (PDF → source) search using the
//! `synctex` command-line tool that ships with TeX Live and MiKTeX.

use super::proc::{hidden_command, run_capture};
use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::path::Path;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PdfLocation {
    pub page: u32,
    /// Left edge, PDF points from the page's left.
    pub h: f64,
    /// Baseline, PDF points from the page's top.
    pub v: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SourceLocation {
    pub file: String,
    pub line: u32,
    pub column: i32,
}

fn field<'a>(block: &'a str, key: &str) -> Option<&'a str> {
    block
        .lines()
        .find_map(|l| l.strip_prefix(key).and_then(|r| r.strip_prefix(':')))
        .map(str::trim)
}

pub fn parse_view(out: &str) -> Vec<PdfLocation> {
    out.split("Output:")
        .skip(1)
        .filter_map(|b| {
            Some(PdfLocation {
                page: field(b, "Page")?.parse().ok()?,
                h: field(b, "h")?.parse().ok()?,
                v: field(b, "v")?.parse().ok()?,
                width: field(b, "W")?.parse().unwrap_or(0.0),
                height: field(b, "H")?.parse().unwrap_or(0.0),
            })
        })
        .collect()
}

pub fn parse_edit(out: &str) -> Option<(String, u32, i32)> {
    let b = out.split("Output:").nth(1)?;
    Some((
        field(b, "Input")?.to_string(),
        field(b, "Line")?.parse().ok()?,
        field(b, "Column").and_then(|c| c.parse().ok()).unwrap_or(-1),
    ))
}

/// `pdf` is the PDF whose sibling `.synctex.gz` describes it; `source_abs` the
/// absolute source path.
pub fn forward(synctex: &Path, pdf: &Path, source_abs: &Path, line: u32, column: u32) -> AppResult<Vec<PdfLocation>> {
    let mut cmd = hidden_command(synctex);
    cmd.arg("view")
        .arg("-i")
        .arg(format!("{}:{}:{}", line, column, source_abs.display()))
        .arg("-o")
        .arg(pdf);
    let out = run_capture(cmd, Duration::from_secs(10))?;
    Ok(parse_view(&out.stdout))
}

pub fn inverse(synctex: &Path, pdf: &Path, page: u32, x: f64, y: f64, root: &Path) -> AppResult<SourceLocation> {
    let mut cmd = hidden_command(synctex);
    cmd.arg("edit").arg("-o").arg(format!("{}:{:.2}:{:.2}:{}", page, x, y, pdf.display()));
    let out = run_capture(cmd, Duration::from_secs(10))?;
    let (input, line, column) = parse_edit(&out.stdout)
        .ok_or_else(|| AppError::NotFound("no source location for that point".into()))?;
    // synctex reports e.g. /abs/root/./sections/intro.tex
    let p = std::path::PathBuf::from(input.replace("/./", "/"));
    let rel = crate::security::to_relative(root, &p)
        .ok_or_else(|| AppError::NotFound(format!("location is outside the project: {input}")))?;
    Ok(SourceLocation { file: rel, line, column })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parse_outputs() {
        let view = "This is SyncTeX command line utility, version 1.5\nSyncTeX result begin\nOutput:/x/main.pdf\nPage:2\nx:133.7\ny:200.1\nh:72.0\nv:210.5\nW:450.0\nH:9.5\nbefore:\noffset:0\nmiddle:\nafter:\nSyncTeX result end\n";
        let v = parse_view(view);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].page, 2);
        assert_eq!(v[0].v, 210.5);
        let edit = "SyncTeX result begin\nOutput:/x/main.pdf\nInput:/proj/./sections/a.tex\nLine:12\nColumn:-1\nOffset:0\nContext:\nSyncTeX result end\n";
        assert_eq!(parse_edit(edit), Some(("/proj/./sections/a.tex".into(), 12, -1)));
    }
}
