//! Integration tests for templates, conversion, submission and PPTX export
//! using the real local toolchain (skipped when a tool is missing).

use qmaze_lib::compiler::{detect, CompileManager, CompileRequest};
use qmaze_lib::filesystem::create_project_with;
use qmaze_lib::templates::{self, registry, StarterOptions, StarterTemplate};
use qmaze_lib::{converter, presentation, submission};
use std::path::{Path, PathBuf};

fn have(t: &str) -> bool {
    let ok = detect::find_tool(t, None).is_some();
    if !ok { eprintln!("SKIP: {t} missing"); }
    ok
}

fn compile(root: &Path, engine: &str) -> qmaze_lib::compiler::CompileResult {
    CompileManager::default().compile(&CompileRequest {
        root: root.to_string_lossy().into(), main_file: "main.tex".into(), engine: engine.into(), bib_tool: "auto".into(),
        use_latexmk: true, shell_escape: false, timeout_secs: 180, tex_bin_dir: None,
    }, |_| {}).unwrap()
}

fn opts() -> StarterOptions {
    StarterOptions { author: "Dr. A. Researcher".into(), rank: "Scientist F".into(), organization: "Research & Development Lab".into(), email: "a@example.org".into(), ..Default::default() }
}

#[test]
fn every_ctan_and_community_journal_skeleton_compiles() {
    if !have("pdflatex") || !have("latexmk") { return; }
    let d = tempfile::tempdir().unwrap();
    let mut failures = vec![];
    for j in registry::bundled().into_iter().filter(|j| j.template_type == "ctan-class" || j.template_type == "community-profile") {
        let files = templates::journal_skeleton(&j, &format!("Paper for {}", j.id), &opts());
        let info = create_project_with(d.path(), &j.id, files, "main.tex", "pdflatex", "latex", Some(j.id.clone())).unwrap();
        let r = compile(&PathBuf::from(&info.root), "pdflatex");
        if !r.success {
            failures.push(format!("{}: {:#?}\n{}", j.id, r.diagnostics.iter().filter(|d| d.severity == qmaze_lib::compiler::log_parser::Severity::Error).collect::<Vec<_>>(), &r.raw_output[r.raw_output.len().saturating_sub(1500)..]));
        } else {
            assert!(!r.diagnostics.iter().any(|d| d.category == "citation"), "{}: unresolved citations", j.id);
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n\n"));
}

#[test]
fn beamer_starter_compiles_with_all_themes() {
    if !have("pdflatex") { return; }
    let d = tempfile::tempdir().unwrap();
    for (i, (theme, color)) in [("metropolis", "quantum"), ("Madrid", "whale"), ("CambridgeUS", "default"), ("Copenhagen", "beaver")].iter().enumerate() {
        let mut o = opts();
        o.beamer_theme = theme.to_string();
        o.beamer_color = color.to_string();
        o.aspect = if i % 2 == 0 { "169".into() } else { "43".into() };
        let files = templates::files(StarterTemplate::Presentation, &format!("Talk {i}"), &o);
        let info = create_project_with(d.path(), &format!("talk{i}"), files, "main.tex", "pdflatex", "presentation", None).unwrap();
        let r = compile(&PathBuf::from(&info.root), "pdflatex");
        assert!(r.success, "{theme}/{color}: {:#?}", r.diagnostics);
    }
}

#[test]
fn every_presentation_format_compiles() {
    if !have("pdflatex") { return; }
    let d = tempfile::tempdir().unwrap();
    let looks = [("moloch", "navy-gold"), ("Madrid", "olive"), ("SimplePlus", "default"), ("metropolis", "steel"), ("Nord", "default"), ("Verona", "default"), ("SimpleDarkBlue", "default"), ("Boadilla", "maroon")];
    let mut failures = Vec::new();
    for (i, deck) in templates::decks::DECKS.iter().enumerate() {
        let (theme, color) = looks[i % looks.len()];
        let mut o = opts();
        o.beamer_theme = theme.into();
        o.beamer_color = color.into();
        o.deck = deck.id.into();
        o.rank = "Scientist G & Director".into(); // '&' must be escaped
        let files = templates::files(StarterTemplate::Presentation, deck.title, &o);
        let info = create_project_with(d.path(), deck.id, files, "main.tex", "pdflatex", "presentation", None).unwrap();
        let root = PathBuf::from(&info.root);
        // Also exercise the protective marking.
        let main = root.join("main.tex");
        let src = std::fs::read_to_string(&main).unwrap().replace("\\newcommand{\\Marking}{}", "\\newcommand{\\Marking}{RESTRICTED (example)}");
        assert!(src.contains("RESTRICTED (example)"));
        std::fs::write(&main, src).unwrap();
        let r = compile(&root, "pdflatex");
        if !r.success {
            failures.push(format!("{} with {theme}/{color}: {:#?}", deck.id, r.diagnostics.iter().filter(|x| x.severity == qmaze_lib::compiler::log_parser::Severity::Error).take(3).collect::<Vec<_>>()));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n\n"));
}

#[test]
fn docx_round_trip_with_report() {
    if !have("pandoc") || !have("pdflatex") { return; }
    let d = tempfile::tempdir().unwrap();
    // LaTeX → DOCX from the research starter.
    let files = templates::files(StarterTemplate::ResearchPaper, "Round Trip", &opts());
    let info = create_project_with(d.path(), "src", files, "main.tex", "pdflatex", "latex", None).unwrap();
    let root = PathBuf::from(&info.root);
    let main_before = std::fs::read(root.join("main.tex")).unwrap();
    let docx = d.path().join("paper.docx");
    let rep = converter::latex_to_docx(&root, "main.tex", &docx, None).unwrap();
    assert!(docx.exists() && std::fs::metadata(&docx).unwrap().len() > 5000);
    assert_eq!(std::fs::read(root.join("main.tex")).unwrap(), main_before, "source modified");
    assert!(rep.counts.iter().any(|(k, v)| k == "Figures" && *v == 1));
    // DOCX → LaTeX into a new structured project, which must compile.
    let dest = d.path().join("back");
    let rep2 = converter::docx_to_latex(&docx, &dest, None).unwrap();
    assert!(dest.join("main.tex").exists() && dest.join("CONVERSION_REPORT.md").exists());
    assert!(rep2.counts.iter().any(|(k, v)| k == "Sections" && *v >= 4), "{:?}", rep2.counts);
    assert!(rep2.counts.iter().any(|(k, v)| k == "Images" && *v == 1), "{:?}", rep2.counts);
    assert!(std::fs::read_dir(dest.join("sections")).unwrap().count() >= 4);
    std::fs::create_dir_all(dest.join(".qmaze")).unwrap();
    let r = compile(&dest, "pdflatex");
    assert!(r.success, "converted project failed: {:#?}\n{}", r.diagnostics, r.raw_output);
    assert!(converter::docx_to_latex(&docx, &dest, None).is_err(), "must not overwrite");
}

#[test]
fn submission_package_has_manifest_bbl_and_pdf() {
    if !have("pdflatex") || !have("bibtex") { return; }
    let d = tempfile::tempdir().unwrap();
    let files = templates::files(StarterTemplate::ResearchPaper, "Sub", &opts());
    let info = create_project_with(d.path(), "sub", files, "main.tex", "pdflatex", "latex", None).unwrap();
    let root = PathBuf::from(&info.root);
    let zip = d.path().join("pkg.zip");
    assert!(submission::build(&root, "main.tex", None, &zip).is_err(), "must require a build");
    assert!(compile(&root, "pdflatex").success);
    let m = submission::build(&root, "main.tex", Some("Test Journal"), &zip).unwrap();
    let names: Vec<&str> = m.iter().map(|e| e.path.as_str()).collect();
    for need in ["main.tex", "sections/results.tex", "references/references.bib", "figures/sample-figure.png", "main.bbl", "main.pdf"] {
        assert!(names.contains(&need), "missing {need}: {names:?}");
    }
    assert!(!names.iter().any(|n| n.ends_with(".aux") || n.starts_with(".qmaze") || n.starts_with("output/")));
    let mut za = zip::ZipArchive::new(std::fs::File::open(&zip).unwrap()).unwrap();
    let mut txt = String::new();
    std::io::Read::read_to_string(&mut za.by_name("MANIFEST.txt").unwrap(), &mut txt).unwrap();
    assert!(txt.contains("Test Journal") && txt.contains(&m[0].sha256));
}

#[test]
fn pptx_opens_in_libreoffice() {
    let Some(soffice) = detect::find_tool("soffice", None) else { eprintln!("SKIP soffice"); return };
    let d = tempfile::tempdir().unwrap();
    let png = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/assets/starter/sample-figure.png")).unwrap();
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
    let deck = presentation::DeckSpec {
        title: "Deck".into(), author: "A".into(), width_pt: 364.0, height_pt: 273.0, accent: "14235C".into(),
        slides: vec![
            presentation::SlideSpec { title: Some("Title".into()), subtitle: Some("Sub".into()), ..Default::default() },
            presentation::SlideSpec { title: Some("Bullets".into()), bullets: vec![presentation::Bullet { level: 0, text: "One".into() }, presentation::Bullet { level: 1, text: "Two".into() }], images: vec![presentation::ImageSpec { data: b64.clone() }], ..Default::default() },
            presentation::SlideSpec { images: vec![presentation::ImageSpec { data: b64 }], full_image: true, ..Default::default() },
        ],
    };
    let p = d.path().join("deck.pptx");
    presentation::write_pptx(&deck, &p).unwrap();
    let out = std::process::Command::new(soffice).args(["--headless", "--convert-to", "pdf", "--outdir"]).arg(d.path()).arg(&p)
        .env("HOME", d.path()).output().unwrap();
    let pdf = d.path().join("deck.pdf");
    assert!(pdf.exists(), "LibreOffice could not open the pptx: {}", String::from_utf8_lossy(&out.stderr));
    let bytes = std::fs::read(&pdf).unwrap();
    let pages = bytes.windows(10).filter(|w| w == b"/Type /Pag" || w == b"/Type/Page").count();
    assert!(pages >= 3, "expected 3 pages, found {pages}");
}
