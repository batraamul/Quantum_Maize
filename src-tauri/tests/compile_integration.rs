//! End-to-end compilation tests against the locally installed TeX
//! distribution. Skipped (with a message) when no TeX engine is installed.

use qmaze_lib::compiler::{detect, log_parser::Severity, synctex, CompileManager, CompileRequest};
use qmaze_lib::filesystem::{self, create_project};
use qmaze_lib::templates::StarterTemplate;
use std::fs;
use std::path::{Path, PathBuf};

fn have(tool: &str) -> bool {
    let ok = detect::find_tool(tool, None).is_some();
    if !ok {
        eprintln!("SKIP: {tool} not installed");
    }
    ok
}

fn req(root: &Path, engine: &str, latexmk: bool) -> CompileRequest {
    CompileRequest {
        root: root.to_string_lossy().into_owned(),
        main_file: "main.tex".into(),
        engine: engine.into(),
        bib_tool: "auto".into(),
        use_latexmk: latexmk,
        shell_escape: false,
        timeout_secs: 120,
        tex_bin_dir: None,
    }
}

fn project(t: StarterTemplate) -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let info = create_project(dir.path(), "Test Paper", t, "pdflatex").unwrap();
    let root = PathBuf::from(info.root);
    (dir, root)
}

#[test]
fn test1_blank_project_compiles() {
    if !have("pdflatex") { return; }
    let (_d, root) = project(StarterTemplate::Blank);
    let m = CompileManager::default();
    let mut lines = 0;
    let r = m.compile(&req(&root, "pdflatex", true), |_| lines += 1).unwrap();
    assert!(r.success, "{}\n{:#?}", r.raw_output, r.diagnostics);
    assert!(lines > 0, "output must be streamed");
    let pdf = fs::read(r.pdf_path.unwrap()).unwrap();
    assert!(pdf.starts_with(b"%PDF"));
}

#[test]
fn recompiling_unchanged_project_is_success() {
    // Regression: latexmk reports "All targets are up-to-date" and must not be
    // treated as a failure just because the PDF was not rewritten.
    if !have("pdflatex") || !have("latexmk") { return; }
    let (_d, root) = project(StarterTemplate::ResearchPaper);
    let m = CompileManager::default();
    assert!(m.compile(&req(&root, "pdflatex", true), |_| {}).unwrap().success);
    std::thread::sleep(std::time::Duration::from_millis(2500));
    let again = m.compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(again.success, "{}\n{:#?}", again.raw_output, again.diagnostics);
    assert!(again.raw_output.contains("up-to-date"));
    assert!(again.pdf_path.is_some());
}

#[test]
fn test2_test7_multifile_with_bibtex_latexmk_and_direct() {
    if !have("pdflatex") || !have("bibtex") { return; }
    for latexmk in [true, false] {
        if latexmk && !have("latexmk") { continue; }
        let (_d, root) = project(StarterTemplate::ResearchPaper);
        let r = CompileManager::default().compile(&req(&root, "pdflatex", latexmk), |_| {}).unwrap();
        assert!(r.success, "latexmk={latexmk}\n{}\n{:#?}", r.raw_output, r.diagnostics);
        assert_eq!(r.tool, if latexmk { "latexmk" } else { "direct" });
        let bbl = fs::read_to_string(root.join("output/main.bbl")).unwrap();
        assert!(bbl.contains("lamport1994latex") && bbl.contains("knuth1984texbook"));
        assert!(!r.diagnostics.iter().any(|d| d.category == "citation" || d.category == "reference"),
            "unresolved refs/cites: {:#?}", r.diagnostics);
        // \input of files in sections/ plus a figure from figures/ all resolved
        let log = fs::read_to_string(root.join("output/main.log")).unwrap();
        assert!(log.contains("sections/results.tex") && log.contains("sample-figure.png"));
    }
}

#[test]
fn test11_error_is_located_and_pdf_still_produced() {
    if !have("pdflatex") { return; }
    let (_d, root) = project(StarterTemplate::ResearchPaper);
    let m = CompileManager::default();
    let ok = m.compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(ok.success);
    let good_pdf = fs::read(ok.pdf_path.clone().unwrap()).unwrap();

    let intro = root.join("sections/methodology.tex");
    let mut src = fs::read_to_string(&intro).unwrap();
    src = src.replace("where $\\alpha$", "where $\\alpah$");
    fs::write(&intro, src).unwrap();

    // Recoverable errors behave as on Overleaf: reported, but the PDF is still built
    // (with latexmk and with direct passes alike).
    for latexmk in [true, false] {
        let bad = m.compile(&req(&root, "pdflatex", latexmk), |_| {}).unwrap();
        assert!(!bad.success, "latexmk={latexmk}");
        assert!(bad.pdf_updated, "latexmk={latexmk}\n{}", bad.raw_output);
        assert!(bad.message.starts_with("Compiled with 1 error"), "{}", bad.message);
        let err = bad.diagnostics.iter().find(|d| d.severity == Severity::Error).expect("an error");
        assert_eq!(err.file.as_deref(), Some("sections/methodology.tex"), "{err:#?}");
        assert_eq!(err.line, Some(7), "{err:#?}"); // line 7: "where $\\alpah$ is ..."
        assert!(err.message.contains("Undefined control sequence"));
        assert!(err.context.as_deref().unwrap_or("").contains("alpah"));
        let new_pdf = fs::read(bad.pdf_path.unwrap()).unwrap();
        assert!(new_pdf.starts_with(b"%PDF") && new_pdf != good_pdf);
    }
    // Compiling again with nothing changed (latexmk skips the run) reports the same result.
    let again = m.compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(again.pdf_updated && again.error_count == 1, "{}\n{:#?}", again.raw_output, again.diagnostics);
    assert!(again.diagnostics.iter().any(|d| d.message.contains("Undefined control sequence")));

    // A build that writes no PDF at all keeps the previous preview.
    let before = fs::read(root.join(".qmaze/build/main.pdf")).unwrap();
    fs::write(root.join("main.tex"), "\\documentclass{article}\n\\begin{document}\\undefinedqm\\end{document}\n").unwrap();
    let fatal = m.compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(!fatal.success && !fatal.pdf_updated, "{}", fatal.raw_output);
    assert_eq!(fs::read(fatal.pdf_path.unwrap()).unwrap(), before);
}

#[test]
fn test13_shell_escape_and_latexmkrc_are_blocked() {
    if !have("pdflatex") || !have("latexmk") { return; }
    let (_d, root) = project(StarterTemplate::Blank);
    // A project-supplied latexmkrc is Perl code; it must never run.
    fs::write(root.join("latexmkrc"), "system('touch pwned_rc');\n").unwrap();
    fs::write(root.join(".latexmkrc"), "system('touch pwned_rc2');\n").unwrap();
    fs::write(root.join("main.tex"),
        "\\documentclass{article}\\begin{document}\\immediate\\write18{touch pwned_shell}hi\\end{document}").unwrap();
    let r = CompileManager::default().compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(r.success, "{}", r.raw_output);
    for f in ["pwned_rc", "pwned_rc2", "pwned_shell", "output/pwned_shell"] {
        assert!(!root.join(f).exists(), "{f} was created — sandbox failed");
    }
    // TeX must not write outside the project either (openout_any=p).
    fs::write(root.join("main.tex"),
        "\\documentclass{article}\\begin{document}\\newwrite\\f\\immediate\\openout\\f=../escaped.txt\\immediate\\write\\f{x}\\immediate\\closeout\\f hi\\end{document}").unwrap();
    let _ = CompileManager::default().compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(!root.parent().unwrap().join("escaped.txt").exists());
}

#[test]
fn timeout_kills_runaway_build() {
    if !have("pdflatex") { return; }
    let (_d, root) = project(StarterTemplate::Blank);
    fs::write(root.join("main.tex"), "\\documentclass{article}\\begin{document}\\def\\x{\\x}\\x\\end{document}").unwrap();
    let mut rq = req(&root, "pdflatex", false);
    rq.timeout_secs = 10;
    let t = std::time::Instant::now();
    let r = CompileManager::default().compile(&rq, |_| {}).unwrap();
    assert!(r.timed_out, "{:#?}", r.diagnostics);
    assert!(t.elapsed().as_secs() < 25);
}

#[test]
fn cancel_stops_build() {
    if !have("pdflatex") { return; }
    let (_d, root) = project(StarterTemplate::Blank);
    fs::write(root.join("main.tex"), "\\documentclass{article}\\begin{document}\\def\\x{\\x}\\x\\end{document}").unwrap();
    let m = std::sync::Arc::new(CompileManager::default());
    let rq = req(&root, "pdflatex", true);
    let m2 = m.clone();
    let key = rq.root.clone();
    let h = std::thread::spawn(move || m2.compile(&rq, |_| {}).unwrap());
    std::thread::sleep(std::time::Duration::from_millis(1500));
    assert!(m.cancel(&key));
    let r = h.join().unwrap();
    assert!(r.cancelled);
    assert!(!m.is_running(&key));
}

#[test]
fn xelatex_and_lualatex() {
    for engine in ["xelatex", "lualatex"] {
        if !have(engine) { continue; }
        let (_d, root) = project(StarterTemplate::Blank);
        fs::write(root.join("main.tex"),
            "\\documentclass{article}\\usepackage{fontspec}\\begin{document}Ünïcödé — $E=mc^2$\\end{document}").unwrap();
        let r = CompileManager::default().compile(&req(&root, engine, true), |_| {}).unwrap();
        assert!(r.success, "{engine}: {}\n{:#?}", r.raw_output, r.diagnostics);
    }
}

#[test]
fn biblatex_with_biber() {
    if !have("pdflatex") || !have("biber") { return; }
    if detect::find_tool("kpsewhich", None).is_none() { return; }
    let (_d, root) = project(StarterTemplate::ResearchPaper);
    fs::write(root.join("main.tex"), r"\documentclass{article}
\usepackage[backend=biber]{biblatex}
\addbibresource{references/references.bib}
\begin{document}
See \cite{lamport1994latex}.
\printbibliography
\end{document}").unwrap();
    for latexmk in [true, false] {
        let r = CompileManager::default().compile(&req(&root, "pdflatex", latexmk), |_| {}).unwrap();
        assert!(r.success, "latexmk={latexmk} {}\n{:#?}", r.raw_output, r.diagnostics);
        assert!(!r.diagnostics.iter().any(|d| d.category == "citation"), "{:#?}", r.diagnostics);
    }
}

#[test]
fn synctex_round_trip() {
    if !have("pdflatex") || !have("synctex") { return; }
    let (_d, root) = project(StarterTemplate::ResearchPaper);
    let r = CompileManager::default().compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(r.success);
    let pdf = PathBuf::from(r.pdf_path.unwrap());
    let tool = detect::find_tool("synctex", None).unwrap();
    let locs = synctex::forward(&tool, &pdf, &root.join("sections/results.tex"), 2, 0).unwrap();
    assert!(!locs.is_empty(), "forward search returned nothing");
    let l = &locs[0];
    let back = synctex::inverse(&tool, &pdf, l.page, l.h + 5.0, l.v - 2.0, &root).unwrap();
    assert_eq!(back.file, "sections/results.tex");
    assert!((1..=4).contains(&back.line), "{back:?}");
}

#[test]
fn missing_package_reported_with_install_hint() {
    if !have("pdflatex") { return; }
    let (_d, root) = project(StarterTemplate::Blank);
    fs::write(root.join("main.tex"), "\\documentclass{article}\n\\usepackage{doesnotexist2026}\n\\begin{document}x\\end{document}").unwrap();
    let r = CompileManager::default().compile(&req(&root, "pdflatex", true), |_| {}).unwrap();
    assert!(!r.success);
    let e = r.diagnostics.iter().find(|d| d.category == "missing-file").expect("missing-file diag");
    assert_eq!(e.line, Some(2));
    assert_eq!(e.file.as_deref(), Some("main.tex"));
    let _ = filesystem::read_meta(&root).unwrap();
}
