//! Parser for TeX engine logs (`.log`) and BibTeX/Biber logs (`.blg`).
//!
//! Engines are run with `-file-line-error` and `max_print_line=10000` (no
//! line wrapping), so errors look like `./sections/intro.tex:12: message`.
//! For messages without a file prefix (warnings, `!` errors) the current file
//! is recovered by tracking the `(file … )` nesting TeX prints as it opens
//! and closes inputs.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub severity: Severity,
    pub category: String,
    /// Project-relative path (navigable) when the file is inside the project.
    pub file: Option<String>,
    /// Path of a file outside the project (e.g. a system .sty).
    pub external_file: Option<String>,
    pub line: Option<u32>,
    pub message: String,
    pub context: Option<String>,
    pub suggestion: Option<String>,
    pub source: String,
}

static FLE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(\.?.*?\.[A-Za-z0-9]{1,8}):(\d+): (.*)$").unwrap());
static LNUM: Lazy<Regex> = Lazy::new(|| Regex::new(r"^l\.(\d+)\s?(.*)$").unwrap());
static INPUT_LINE: Lazy<Regex> = Lazy::new(|| Regex::new(r"on input line (\d+)").unwrap());
static PKG_WARN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(Package|Class|Module) ([^\s]+) Warning: (.*)$").unwrap());
static BADBOX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(Over|Under)full \\[hv]box .*?(?:lines? (\d+)(?:--(\d+))?|detected at line (\d+)|$)").unwrap());
static BLG_LOC: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(.*?)---line (\d+) of file (.+)$").unwrap());
static BIBER_MSG: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(ERROR|WARN) - (.*)$").unwrap());
static BIBER_LINE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?:line|Line) (\d+)").unwrap());

struct Ctx<'a> {
    root: &'a Path,
}

impl Ctx<'_> {
    fn locate(&self, raw: &str) -> (Option<String>, Option<String>) {
        let cleaned = raw.trim().trim_matches('"');
        let rel = cleaned.strip_prefix("./").unwrap_or(cleaned);
        let p = Path::new(rel);
        if p.is_absolute() {
            if let Ok(root) = self.root.canonicalize() {
                let pc = p.canonicalize().unwrap_or_else(|_| p.to_path_buf());
                if let Ok(r) = pc.strip_prefix(&root) {
                    return (Some(r.to_string_lossy().replace('\\', "/")), None);
                }
            }
            return (None, Some(cleaned.to_string()));
        }
        if self.root.join(rel).exists() || rel.ends_with(".tex") || rel.ends_with(".bib") {
            (Some(rel.replace('\\', "/")), None)
        } else {
            (None, Some(cleaned.to_string()))
        }
    }
}

fn looks_like_path(tok: &str) -> bool {
    if tok.len() < 3 {
        return false;
    }
    let first = tok.chars().next().unwrap();
    let has_ext = Path::new(tok).extension().is_some_and(|e| {
        let e = e.to_string_lossy();
        !e.is_empty() && e.len() <= 12 && e.chars().all(|c| c.is_ascii_alphanumeric())
    });
    (first == '.' || first == '/' || first == '\\' || first.is_ascii_alphabetic() || tok.as_bytes().get(1) == Some(&b':'))
        && (has_ext || tok.contains('/'))
}

/// Update the open-file stack from the parentheses on one log line.
fn track_files(line: &str, stack: &mut Vec<Option<String>>) {
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        match chars[i] {
            '(' => {
                let start = i + 1;
                let mut j = start;
                while j < chars.len() && !chars[j].is_whitespace() && chars[j] != '(' && chars[j] != ')' && chars[j] != '[' {
                    j += 1;
                }
                let tok: String = chars[start..j].iter().collect();
                if looks_like_path(&tok) {
                    stack.push(Some(tok));
                } else {
                    stack.push(None);
                }
                i = j;
                continue;
            }
            ')' => {
                stack.pop();
            }
            _ => {}
        }
        i += 1;
    }
}

fn current_file(stack: &[Option<String>]) -> Option<&str> {
    stack.iter().rev().find_map(|s| s.as_deref())
}

pub fn suggestion_for(msg: &str) -> Option<String> {
    let m = msg;
    let s = |x: &str| Some(x.to_string());
    if m.contains("Undefined control sequence") {
        return s("A command is misspelled or the package that defines it is not loaded. Check the command shown in the context, or add the matching \\usepackage{…}.");
    }
    if m.contains("Missing $ inserted") {
        return s("A math-only symbol (e.g. _ ^ \\alpha) was used in text mode. Wrap it in $…$, or escape literal characters (\\_ \\^{}).");
    }
    if let Some(c) = Regex::new(r"File `([^']+)' not found").ok().and_then(|r| r.captures(m)) {
        let f = &c[1];
        if f.ends_with(".sty") || f.ends_with(".cls") {
            return Some(format!("The package/class file {f} is not installed. Install it with your TeX distribution's package manager (TeX Live: tlmgr install <package>; MiKTeX: MiKTeX Console → Packages)."));
        }
        return Some(format!("{f} could not be found. Paths are relative to the main file's folder — check spelling, extension and location."));
    }
    if m.contains("Environment") && m.contains("undefined") {
        return s("This environment is not defined. Check its spelling or load the package that provides it (e.g. amsmath for align, algorithm2e for algorithm).");
    }
    if m.contains("Missing \\begin{document}") {
        return s("Text or a stray character appears in the preamble (before \\begin{document}). Move it into the document body.");
    }
    if m.contains("ended by \\end") {
        return s("Environments are mismatched: each \\begin{x} must be closed by \\end{x} in the reverse order they were opened.");
    }
    if m.contains("Too many }'s") || m.contains("Extra }") || m.contains("Extra alignment tab") {
        return s(if m.contains("alignment tab") { "A table row has more & separators than the column specification allows." } else { "Braces are unbalanced: there is a } without a matching {." });
    }
    if m.contains("Runaway argument") || m.contains("File ended while scanning") || m.contains("Paragraph ended before") {
        return s("An argument was not closed: look for a missing } or a blank line inside a command argument.");
    }
    if m.contains("Missing } inserted") || m.contains("Missing { inserted") {
        return s("Braces are unbalanced or a math construct is incomplete near this line.");
    }
    if m.contains("Citation") && m.contains("undefined") {
        return s("The citation key is not in your .bib file, or the bibliography has not been processed yet. Check the key spelling; Quantum Maze runs BibTeX/Biber automatically on compile.");
    }
    if m.contains("Reference") && m.contains("undefined") {
        return s("There is no \\label with this name, or another compile pass is needed. Check the label spelling.");
    }
    if m.contains("There were undefined references") {
        return s("Some \\ref or \\cite targets were not resolved — see the individual warnings.");
    }
    if m.starts_with("Overfull") {
        return s("Content is wider than the text area. Rephrase, allow hyphenation (\\-), resize the float, or wrap URLs with \\url{}.");
    }
    if m.contains("Missing character") {
        return s("The current font lacks this glyph. With XeLaTeX/LuaLaTeX choose a font containing it via fontspec; with pdfLaTeX use the appropriate input encoding or package.");
    }
    if m.contains("Repeated entry") {
        return s("Duplicate bibliography key: two entries share the same key. Rename or remove one.");
    }
    if m.contains("didn't find a database entry") {
        return s("A cited key does not exist in any .bib file used by the document.");
    }
    if m.contains("couldn't open database file") || m.contains("Cannot find") && m.contains(".bib") {
        return s("The .bib file named in \\bibliography{…}/\\addbibresource{…} was not found. Paths are relative to the main file.");
    }
    if m.contains("Option clash") {
        return s("A package was loaded twice with different options. Load it once, or use \\PassOptionsToPackage before \\documentclass.");
    }
    if m.contains("Emergency stop") || m.contains("Fatal error occurred") {
        return s("TeX stopped at a fatal error. Fix the first error listed above, then recompile.");
    }
    if m.contains("Missing number") || m.contains("Illegal unit") {
        return s("A length or number was expected (e.g. 0.5\\linewidth, 3pt) but something else was found.");
    }
    if m.contains("Can be used only in preamble") {
        return s("This command must appear before \\begin{document}.");
    }
    if m.contains("not in outer par mode") || m.contains("Float(s) lost") {
        return s("A float (figure/table) or \\marginpar is nested where floats are not allowed, e.g. inside another float or a box.");
    }
    if m.contains("I can't write on file") || m.contains("Not writing to") {
        return s("TeX was blocked from writing this file (Quantum Maze restricts writes to the project for safety). Avoid absolute or parent-directory output paths.");
    }
    if m.contains("shell escape") || m.contains("-shell-escape") || m.contains("write18") {
        return s("This document needs shell escape (e.g. minted, external tools). It is disabled by default for security; enable it per project in Project Settings only if you trust the source.");
    }
    None
}

/// Parse an engine `.log` file.
pub fn parse_latex_log(log: &str, root: &Path) -> Vec<Diagnostic> {
    let ctx = Ctx { root };
    let lines: Vec<&str> = log.lines().collect();
    let mut stack: Vec<Option<String>> = Vec::new();
    let mut out: Vec<Diagnostic> = Vec::new();
    let mut i = 0usize;

    // Skip the banner up to the first file open; it contains no messages.
    while i < lines.len() {
        let l = lines[i];
        if FLE.is_match(l)
            || l.starts_with('!')
            || l.contains("Warning:")
            || BADBOX.is_match(l)
        {
            let (diag, consumed) = parse_message(&lines, i, &stack, &ctx);
            if let Some(d) = diag {
                out.push(d);
            }
            i += consumed.max(1);
            continue;
        }
        track_files(l, &mut stack);
        i += 1;
    }

    // Drop the generic "emergency stop" summaries when specific errors exist.
    let specific = out
        .iter()
        .filter(|d| d.severity == Severity::Error && d.category != "fatal")
        .count();
    if specific > 0 {
        out.retain(|d| d.category != "fatal");
    }
    dedupe(out)
}

fn parse_message(lines: &[&str], i: usize, stack: &[Option<String>], ctx: &Ctx) -> (Option<Diagnostic>, usize) {
    let l = lines[i];
    let mk = |severity, category: &str, file: Option<&str>, line: Option<u32>, message: String, context: Option<String>| {
        let (file, external_file) = file.map(|f| ctx.locate(f)).unwrap_or((None, None));
        Diagnostic {
            severity,
            category: category.into(),
            suggestion: suggestion_for(&message),
            file,
            external_file,
            line,
            message,
            context,
            source: "latex".into(),
        }
    };

    // ---- errors: file:line: message ---------------------------------------
    if let Some(c) = FLE.captures(l) {
        let file = c[1].to_string();
        let line: Option<u32> = c[2].parse().ok();
        let mut message = c[3].trim().to_string();
        let (context, consumed) = collect_context(lines, i + 1);
        let category = if message.contains("LaTeX Error") {
            message = message.replace("LaTeX Error: ", "");
            if message.contains("not found") { "missing-file" } else { "latex" }
        } else if message.contains("Package") && message.contains("Error") {
            "package"
        } else {
            "tex"
        };
        if message.contains("Emergency stop") {
            return (Some(mk(Severity::Error, "fatal", Some(&file), line, message, None)), 1 + consumed);
        }
        return (Some(mk(Severity::Error, category, Some(&file), line, message, context)), 1 + consumed);
    }

    // ---- errors: "! message" ---------------------------------------------
    if let Some(rest) = l.strip_prefix('!') {
        let mut message = rest.trim().to_string();
        let mut j = i + 1;
        // Multi-line error text continues until a blank line or "l.<n>".
        while j < lines.len() && j < i + 6 && !lines[j].trim().is_empty() && !LNUM.is_match(lines[j]) && !lines[j].starts_with("See the") && !lines[j].starts_with("Type  H") {
            if message.ends_with('.') || message.ends_with('!') {
                break;
            }
            message.push(' ');
            message.push_str(lines[j].trim());
            j += 1;
        }
        let (context, consumed) = collect_context(lines, i + 1);
        let line = context_line(lines, i + 1);
        let fatal = message.contains("Emergency stop") || message.contains("Fatal error occurred") || message.contains("job aborted");
        let category = if fatal {
            "fatal"
        } else if message.contains("not found") {
            "missing-file"
        } else if message.contains("LaTeX Error") {
            "latex"
        } else if message.contains("Package") {
            "package"
        } else {
            "tex"
        };
        message = message.replace("LaTeX Error: ", "");
        return (
            Some(mk(Severity::Error, category, current_file(stack), line, message, if fatal { None } else { context })),
            1 + consumed,
        );
    }

    // ---- LaTeX warnings ----------------------------------------------------
    if let Some(pos) = l.find("LaTeX Warning: ").or_else(|| l.find("LaTeX Font Warning: ")) {
        let is_font = l[pos..].starts_with("LaTeX Font");
        let start = if is_font { pos + "LaTeX Font Warning: ".len() } else { pos + "LaTeX Warning: ".len() };
        let mut message = l[start..].trim().to_string();
        let mut j = i + 1;
        while j < lines.len() && !lines[j].trim().is_empty() && j < i + 8 {
            let t = lines[j].trim();
            // continuation lines are indented or start with (Font)
            if lines[j].starts_with(' ') || t.starts_with("(Font)") {
                message.push(' ');
                message.push_str(t.trim_start_matches("(Font)").trim());
                j += 1;
            } else {
                break;
            }
        }
        let line = INPUT_LINE.captures(&message).and_then(|c| c[1].parse().ok());
        let (sev, cat) = if is_font {
            (Severity::Info, "font")
        } else if message.starts_with("Citation") || message.contains("undefined citations") {
            (Severity::Warning, "citation")
        } else if message.starts_with("Reference") || message.contains("undefined references") {
            (Severity::Warning, "reference")
        } else if message.contains("Label(s) may have changed") {
            (Severity::Info, "rerun")
        } else {
            (Severity::Warning, "latex")
        };
        let file = if line.is_some() { current_file(stack) } else { None };
        return (Some(mk(sev, cat, file, line, message, None)), j - i);
    }

    // ---- package / class warnings -----------------------------------------
    if let Some(c) = PKG_WARN.captures(l) {
        let pkg = c[2].to_string();
        let mut message = format!("{} {}: {}", &c[1], pkg, c[3].trim());
        let mut j = i + 1;
        let prefix = format!("({pkg})");
        while j < lines.len() && lines[j].trim_start().starts_with(&prefix) && j < i + 12 {
            message.push(' ');
            message.push_str(lines[j].trim_start()[prefix.len()..].trim());
            j += 1;
        }
        let line = INPUT_LINE.captures(&message).and_then(|c| c[1].parse().ok());
        let file = if line.is_some() { current_file(stack) } else { None };
        let cat = if message.contains("Citation") { "citation" } else { "package" };
        return (Some(mk(Severity::Warning, cat, file, line, message, None)), j - i);
    }
    if l.starts_with("Missing character:") {
        return (Some(mk(Severity::Warning, "font", None, None, l.trim().to_string(), None)), 1);
    }

    // ---- bad boxes -----------------------------------------------------------
    if let Some(c) = BADBOX.captures(l) {
        let line = c.get(2).or(c.get(4)).and_then(|m| m.as_str().parse().ok());
        let message = l.trim().to_string();
        // Skip the box dump that follows (it contains unbalanced parens).
        let mut j = i + 1;
        while j < lines.len() && !lines[j].trim().is_empty() && j < i + 30 {
            j += 1;
        }
        let file = current_file(stack);
        return (Some(mk(Severity::Info, "badbox", file, line, message, None)), j - i);
    }

    // A "Warning:" we don't specifically recognise (e.g. pdfTeX warning).
    if l.contains("Warning:") {
        return (Some(mk(Severity::Warning, "other", None, None, l.trim().to_string(), None)), 1);
    }
    (None, 1)
}

/// Collect the "l.<n> …" context that follows an error.
fn collect_context(lines: &[&str], from: usize) -> (Option<String>, usize) {
    let mut j = from;
    while j < lines.len() && j < from + 12 {
        if let Some(c) = LNUM.captures(lines[j]) {
            let mut ctx = format!("l.{} {}", &c[1], c[2].trim_end());
            if let Some(next) = lines.get(j + 1) {
                if !next.trim().is_empty() {
                    ctx.push_str(" ⟨here⟩ ");
                    ctx.push_str(next.trim());
                }
            }
            return (Some(ctx), j + 2 - from);
        }
        if lines[j].trim().is_empty() && j > from + 1 {
            break;
        }
        j += 1;
    }
    (None, 0)
}

fn context_line(lines: &[&str], from: usize) -> Option<u32> {
    lines
        .iter()
        .skip(from)
        .take(12)
        .find_map(|l| LNUM.captures(l).and_then(|c| c[1].parse().ok()))
}

/// Parse a BibTeX or Biber `.blg` file.
pub fn parse_blg(blg: &str, root: &Path) -> Vec<Diagnostic> {
    let ctx = Ctx { root };
    let is_biber = blg.contains("This is Biber") || blg.contains("INFO - This is Biber");
    let mut out = Vec::new();
    let lines: Vec<&str> = blg.lines().collect();
    for (idx, l) in lines.iter().enumerate() {
        if is_biber {
            if let Some(c) = BIBER_MSG.captures(l) {
                let sev = if &c[1] == "ERROR" { Severity::Error } else { Severity::Warning };
                let msg = c[2].trim().to_string();
                let line = BIBER_LINE.captures(&msg).and_then(|c| c[1].parse().ok());
                out.push(Diagnostic {
                    severity: sev,
                    category: "biber".into(),
                    suggestion: suggestion_for(&msg),
                    file: None,
                    external_file: None,
                    line,
                    message: msg,
                    context: None,
                    source: "biber".into(),
                });
            }
            continue;
        }
        if let Some(rest) = l.strip_prefix("Warning--") {
            let msg = rest.trim().to_string();
            out.push(Diagnostic {
                severity: Severity::Warning,
                category: if msg.contains("database entry") { "citation".into() } else { "bibtex".into() },
                suggestion: suggestion_for(&msg),
                file: None,
                external_file: None,
                line: None,
                message: msg,
                context: None,
                source: "bibtex".into(),
            });
        } else if let Some(c) = BLG_LOC.captures(l) {
            let mut msg = c[1].trim().to_string();
            if msg.is_empty() {
                msg = lines.get(idx.wrapping_sub(1)).map(|s| s.trim().to_string()).unwrap_or_default();
            }
            let (file, external_file) = ctx.locate(c[3].trim());
            out.push(Diagnostic {
                severity: Severity::Error,
                category: "bibtex".into(),
                suggestion: suggestion_for(&msg),
                file,
                external_file,
                line: c[2].parse().ok(),
                message: msg,
                context: lines.get(idx + 1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty() && s.starts_with(':')),
                source: "bibtex".into(),
            });
        } else if l.starts_with("I couldn't open") || l.starts_with("I found no") {
            let msg = l.trim().to_string();
            out.push(Diagnostic {
                severity: Severity::Error,
                category: "bibtex".into(),
                suggestion: suggestion_for(&msg),
                file: None,
                external_file: None,
                line: None,
                message: msg,
                context: None,
                source: "bibtex".into(),
            });
        }
    }
    dedupe(out)
}

fn dedupe(v: Vec<Diagnostic>) -> Vec<Diagnostic> {
    let mut seen = std::collections::HashSet::new();
    v.into_iter()
        .filter(|d| seen.insert((d.severity, d.file.clone(), d.line, d.message.clone(), d.context.clone())))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOG: &str = r"This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023/Debian) (preloaded format=pdflatex)
entering extended mode
(./main.tex
LaTeX2e <2023-11-01> patch level 1
(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls
Document Class: article 2023/05/17 v1.4n Standard LaTeX document class
(/usr/share/texlive/texmf-dist/tex/latex/base/size11.clo))
(./main.aux) (./sections/introduction.tex
./sections/introduction.tex:3: Undefined control sequence.
l.3 Research writing \foo
                         benefits from
LaTeX Warning: Citation `nokey' on page 1 undefined on input line 4.

) (./sections/results.tex
Overfull \hbox (12.3pt too wide) in paragraph at lines 7--9
[]\T1/cmr/m/n/10.95 (+20) Some (unbalanced text
 []

Package natbib Warning: Citation `x' on page 1 undefined on input line 12.

)
! Emergency stop.
<*> main.tex

LaTeX Warning: There were undefined references.

)";

    #[test]
    fn parses_errors_warnings_and_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("sections")).unwrap();
        std::fs::write(dir.path().join("sections/introduction.tex"), "x").unwrap();
        std::fs::write(dir.path().join("sections/results.tex"), "x").unwrap();
        let d = parse_latex_log(LOG, dir.path());
        let err = d.iter().find(|d| d.severity == Severity::Error).unwrap();
        assert_eq!(err.file.as_deref(), Some("sections/introduction.tex"));
        assert_eq!(err.line, Some(3));
        assert!(err.message.contains("Undefined control sequence"));
        assert!(err.context.as_deref().unwrap().contains("\\foo"));
        assert!(err.suggestion.is_some());
        // Emergency stop summary suppressed because a specific error exists.
        assert!(!d.iter().any(|d| d.category == "fatal"));

        let cite = d.iter().find(|d| d.category == "citation" && d.message.contains("nokey")).unwrap();
        assert_eq!(cite.file.as_deref(), Some("sections/introduction.tex"));
        assert_eq!(cite.line, Some(4));

        let bad = d.iter().find(|d| d.category == "badbox").unwrap();
        assert_eq!(bad.file.as_deref(), Some("sections/results.tex"));
        assert_eq!(bad.line, Some(7));

        // File stack must have survived the badbox dump with an unbalanced paren.
        let pkg = d.iter().find(|d| d.message.contains("natbib")).unwrap();
        assert_eq!(pkg.file.as_deref(), Some("sections/results.tex"));
        assert_eq!(pkg.line, Some(12));
    }

    #[test]
    fn missing_package_error() {
        let log = "(./main.tex\n./main.tex:2: LaTeX Error: File `nonexistentpkg.sty' not found.\n\nType X to quit or <RETURN> to proceed,\nor enter new name. (Default extension: sty)\n\nEnter file name: \n./main.tex:2: Emergency stop.\n<read *> \n\nl.2 \\usepackage{nonexistentpkg}\n";
        let d = parse_latex_log(log, Path::new("."));
        assert_eq!(d.len(), 1, "{d:#?}");
        assert_eq!(d[0].category, "missing-file");
        assert!(d[0].suggestion.as_deref().unwrap().contains("tlmgr"));
    }

    #[test]
    fn bibtex_blg() {
        let blg = "This is BibTeX, Version 0.99d\nWarning--I didn't find a database entry for \"smith2020\"\nRepeated entry---line 14 of file references/references.bib\n : @book{knuth1984texbook\n";
        let d = parse_blg(blg, Path::new("."));
        assert_eq!(d.len(), 2);
        let rep = d.iter().find(|x| x.severity == Severity::Error).unwrap();
        assert_eq!(rep.line, Some(14));
        assert_eq!(rep.file.as_deref(), Some("references/references.bib"));
        assert!(rep.suggestion.as_deref().unwrap().contains("Duplicate"));
    }

    #[test]
    fn biber_blg() {
        let blg = "[0] Config.pm:307> INFO - This is Biber 2.19\n[101] Biber.pm:131> ERROR - Cannot find 'refs.bib'!\n[102] Biber.pm:128> WARN - I didn't find a database entry for 'x' (section 0)\n";
        let d = parse_blg(blg, Path::new("."));
        assert_eq!(d.len(), 2);
        assert_eq!(d[0].severity, Severity::Error);
    }
}
