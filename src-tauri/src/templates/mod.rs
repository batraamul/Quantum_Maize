//! Built-in starter documents and journal skeletons.
//!
//! Starters are Quantum Maze's own generic documents. Journal skeletons are
//! Quantum Maze-written `main.tex` files that load a publisher's *official*
//! document class from the user's TeX distribution (CTAN); the class itself is
//! never copied or modified. Publisher templates that are only distributed as
//! downloads are imported by the user (see `importer`).

pub mod decks;
pub mod importer;
pub mod registry;

use registry::JournalEntry;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum StarterTemplate {
    Blank,
    ResearchPaper,
    Presentation,
    Story,
}

impl StarterTemplate {
    pub fn kind(self) -> &'static str {
        match self {
            StarterTemplate::Presentation => "presentation",
            StarterTemplate::Story => "story",
            _ => "latex",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct StarterOptions {
    pub author: String,
    pub rank: String,
    pub organization: String,
    pub email: String,
    /// Beamer theme (e.g. Madrid, metropolis) and colour theme.
    pub beamer_theme: String,
    pub beamer_color: String,
    /// "169" or "43"
    pub aspect: String,
    /// Presentation format (see `decks::DECKS`); empty = research talk.
    pub deck: String,
    /// Slide design (see `SLIDE_DESIGNS`). Empty = `classic`, so older callers keep their Beamer theme.
    #[serde(default)]
    pub design: String,
}

const SAMPLE_FIGURE: &[u8] = include_bytes!("../../assets/starter/sample-figure.png");
const STORY_JSON: &str = include_str!("../../assets/story/story.json");
const STORY_ASSETS: &[(&str, &[u8])] = &[
    ("assets/hero.jpg", include_bytes!("../../assets/story/hero.jpg")),
    ("assets/terrain.jpg", include_bytes!("../../assets/story/terrain.jpg")),
    ("assets/before.jpg", include_bytes!("../../assets/story/before.jpg")),
    ("assets/after.jpg", include_bytes!("../../assets/story/after.jpg")),
    ("assets/radar.gif", include_bytes!("../../assets/story/radar.gif")),
];

pub const BEAMER_THEMES: &[&str] = &["metropolis", "moloch", "SimplePlus", "SimpleDarkBlue", "Nord", "Verona", "Madrid", "CambridgeUS", "Copenhagen", "Warsaw", "Berlin", "Singapore", "Boadilla", "AnnArbor", "default"];
/// Slide designs drawn by `qmdesign.sty`; `classic` keeps an ordinary Beamer theme.
pub const SLIDE_DESIGNS: &[&str] = &["elegant", "executive", "geometric", "blueprint", "wave", "minimal", "radar", "circuit", "aurora", "classic"];
const QMDESIGN_STY: &str = include_str!("../../assets/presentation/qmdesign.sty");

pub const BEAMER_COLORS: &[&str] = &["default", "beaver", "crane", "dolphin", "orchid", "seahorse", "whale", "wolverine", "spruce", "quantum", "navy-gold", "olive", "steel", "maroon"];

/// Own two-colour palettes (primary, accent), defined in the preamble so no package is needed.
fn palette(name: &str) -> Option<(&'static str, &'static str)> {
    Some(match name {
        "quantum" => ("14235C", "FF8A3D"),
        "navy-gold" => ("0B1F3A", "C9A227"),
        "olive" => ("3B4A2A", "B8A45A"),
        "steel" => ("263238", "1FA8C9"),
        "maroon" => ("5A1220", "C9A227"),
        _ => return None,
    })
}

/// Escape text for use inside LaTeX arguments.
pub fn tex_escape(t: &str) -> String {
    let mut o = String::with_capacity(t.len());
    for c in t.chars() {
        match c {
            '&' | '%' | '$' | '#' | '_' | '{' | '}' => {
                o.push('\\');
                o.push(c)
            }
            '~' => o.push_str("\\textasciitilde{}"),
            '^' => o.push_str("\\textasciicircum{}"),
            '\\' => o.push_str("\\textbackslash{}"),
            _ => o.push(c),
        }
    }
    o
}

fn or<'a>(s: &'a str, d: &'a str) -> &'a str {
    if s.trim().is_empty() { d } else { s }
}

fn s(x: &str) -> Vec<u8> {
    x.as_bytes().to_vec()
}

fn section_files() -> Vec<(String, Vec<u8>)> {
    vec![
        ("sections/introduction.tex".into(), s(r"\section{Introduction}\label{sec:intro}
Research writing benefits from a modular structure~\cite{lamport1994latex}.
Section~\ref{sec:method} describes the method and Section~\ref{sec:results}
reports results.
")),
        ("sections/methodology.tex".into(), s(r"\section{Methodology}\label{sec:method}
We model the response as a damped oscillation,
\begin{equation}
  y(t) = e^{-\alpha t}\cos(\omega t), \qquad \alpha > 0,
  \label{eq:model}
\end{equation}
where $\alpha$ is the damping coefficient and $\omega$ the angular frequency.
")),
        ("sections/results.tex".into(), s(r"\section{Results}\label{sec:results}
Figure~\ref{fig:response} compares the proposed method with a baseline using
Eq.~\eqref{eq:model}; Table~\ref{tab:summary} summarises the metrics.

\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.9\linewidth]{figures/sample-figure}
  \caption{Step response of the proposed method and the baseline.}
  \label{fig:response}
\end{figure}

\begin{table}[htbp]
  \centering
  \caption{Summary of results.}
  \label{tab:summary}
  \begin{tabular}{lcc}
    \toprule
    Method   & Settling time (s) & Overshoot (\%) \\
    \midrule
    Baseline & 8.4 & 21.0 \\
    Proposed & 4.1 & 12.5 \\
    \bottomrule
  \end{tabular}
\end{table}
")),
        ("sections/conclusion.tex".into(), s(r"\section{Conclusion}\label{sec:conclusion}
Summarise the contributions and outline future work~\cite{knuth1984texbook}.
")),
        ("references/references.bib".into(), s(r"@book{lamport1994latex,
  author    = {Leslie Lamport},
  title     = {{\LaTeX}: A Document Preparation System},
  edition   = {2},
  publisher = {Addison-Wesley},
  year      = {1994}
}

@book{knuth1984texbook,
  author    = {Donald E. Knuth},
  title     = {The {\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984}
}
")),
        ("figures/sample-figure.png".into(), SAMPLE_FIGURE.to_vec()),
    ]
}

const SECTION_INPUTS: &str = "\\input{sections/introduction}\n\\input{sections/methodology}\n\\input{sections/results}\n\\input{sections/conclusion}\n";

pub fn files(t: StarterTemplate, name: &str, o: &StarterOptions) -> Vec<(String, Vec<u8>)> {
    let title = tex_escape(name);
    let author = tex_escape(or(&o.author, "Author Name"));
    let org = tex_escape(or(&o.organization, "Organization"));
    let rank = tex_escape(&o.rank);
    let rank_line = if rank.is_empty() { String::new() } else { format!("{rank}, ") };
    match t {
        StarterTemplate::Blank => vec![(
            "main.tex".into(),
            format!(
                r"\documentclass[11pt]{{article}}
\usepackage[T1]{{fontenc}}
\usepackage[utf8]{{inputenc}}
\usepackage{{amsmath,amssymb}}
\usepackage{{graphicx}}
\usepackage[margin=1in]{{geometry}}
\usepackage{{hyperref}}

\title{{{title}}}
\author{{{author}\\ \small {rank_line}{org}}}
\date{{\today}}

\begin{{document}}
\maketitle

\begin{{abstract}}
Write your abstract here.
\end{{abstract}}

\section{{Introduction}}
Start writing. Press \texttt{{Ctrl+Enter}} to compile.

\end{{document}}
"
            )
            .into_bytes(),
        )],
        StarterTemplate::ResearchPaper => {
            let mut v = vec![(
                "main.tex".to_string(),
                format!(
                    r"% Quantum Maze starter: multi-file research paper (generic article class).
% For a specific journal, use Journal > Journal Library.
\documentclass[11pt]{{article}}
\usepackage[T1]{{fontenc}}
\usepackage[utf8]{{inputenc}}
\usepackage{{amsmath,amssymb,amsthm}}
\usepackage{{graphicx}}
\usepackage{{booktabs}}
\usepackage[margin=1in]{{geometry}}
\usepackage[numbers]{{natbib}}
\usepackage{{hyperref}}

\newtheorem{{theorem}}{{Theorem}}

\title{{{title}}}
\author{{{author}\thanks{{{rank_line}{org}.}}}}
\date{{\today}}

\begin{{document}}
\maketitle

\begin{{abstract}}
This is a structured starter paper. Each section lives in its own file under
\texttt{{sections/}}, the bibliography is in \texttt{{references/references.bib}},
and figures are stored in \texttt{{figures/}}.
\end{{abstract}}

\noindent\textbf{{Keywords:}} keyword one; keyword two; keyword three

{SECTION_INPUTS}
\bibliographystyle{{plainnat}}
\bibliography{{references/references}}

\end{{document}}
"
                )
                .into_bytes(),
            )];
            v.extend(section_files());
            v
        }
        StarterTemplate::Presentation => presentation(&title, &author, &rank, &org, o),
        StarterTemplate::Story => {
            let mut story: serde_json::Value = serde_json::from_str(STORY_JSON).expect("bundled story.json");
            story["meta"]["title"] = serde_json::Value::String(name.to_string());
            let byline = [o.author.trim(), o.rank.trim(), o.organization.trim()].iter().filter(|x| !x.is_empty()).cloned().collect::<Vec<_>>().join(", ");
            story["meta"]["author"] = serde_json::Value::String(byline);
            story["meta"]["date"] = serde_json::Value::String(chrono::Local::now().format("%-d %B %Y").to_string());
            if let Some(b) = story["blocks"].get_mut(0) {
                b["title"] = serde_json::Value::String(name.to_string());
            }
            let mut v = vec![("story.json".to_string(), serde_json::to_vec_pretty(&story).unwrap())];
            v.extend(STORY_ASSETS.iter().map(|(p, b)| (p.to_string(), b.to_vec())));
            v
        }
    }
}

fn presentation(title: &str, author: &str, rank: &str, org: &str, o: &StarterOptions) -> Vec<(String, Vec<u8>)> {
    let theme = if BEAMER_THEMES.contains(&o.beamer_theme.as_str()) { o.beamer_theme.as_str() } else { "metropolis" };
    let color = if BEAMER_COLORS.contains(&o.beamer_color.as_str()) { o.beamer_color.as_str() } else { "default" };
    let aspect = if o.aspect == "43" { "43" } else { "169" };
    let deck = decks::get(&o.deck);
    let design = if SLIDE_DESIGNS.contains(&o.design.as_str()) { o.design.as_str() } else { "classic" };
    let classic = design == "classic";
    let inst = if rank.is_empty() { org.to_string() } else { format!("{rank}, {org}") };
    // Themes outside the Beamer core fall back to Madrid when not installed.
    let core = ["Madrid", "CambridgeUS", "Copenhagen", "Warsaw", "Berlin", "Singapore", "Boadilla", "AnnArbor", "default"];
    let own = palette(color).map(|(p, a)| format!("\\definecolor{{qmPrimary}}{{HTML}}{{{p}}}\\definecolor{{qmAccent}}{{HTML}}{{{a}}}\n"));
    let look = if classic {
        let theme_line = if core.contains(&theme) { format!("\\usetheme{{{theme}}}") } else { format!("\\IfFileExists{{beamertheme{theme}.sty}}{{\\usetheme{{{theme}}}}}{{\\usetheme{{Madrid}}}}") };
        let color_line = match (color, &own) {
            ("default", _) => String::new(),
            (_, Some(defs)) => format!(
                "{defs}\\setbeamercolor{{palette primary}}{{bg=qmPrimary,fg=white}}\n\\setbeamercolor{{frametitle}}{{bg=qmPrimary,fg=white}}\n\\setbeamercolor{{title}}{{fg=qmPrimary}}\n\\setbeamercolor{{structure}}{{fg=qmPrimary}}\n\\setbeamercolor{{block title}}{{bg=qmPrimary,fg=white}}\n\\setbeamercolor{{block body}}{{bg=qmPrimary!6}}\n\\setbeamercolor{{alerted text}}{{fg=qmAccent!85!black}}\n\\setbeamercolor{{block title alerted}}{{bg=qmAccent,fg=black}}\n\\setbeamercolor{{block body alerted}}{{bg=qmAccent!12}}\n\\setbeamercolor{{progress bar}}{{fg=qmAccent}}\n\\setbeamercolor{{title separator}}{{fg=qmAccent}}\n"
            ),
            (c, None) => format!("\\usecolortheme{{{c}}}\n"),
        };
        format!("{theme_line}\n{color_line}")
    } else {
        // A design brings its own colour pair; one of the app's palettes replaces it.
        match &own {
            Some(defs) => format!("% Colours of the design. Delete this line to use the design's own pair.\n{defs}"),
            None => "% To use your own colours, define them here before the design is loaded, e.g.\n% \\definecolor{qmPrimary}{HTML}{0B1F3A}\\definecolor{qmAccent}{HTML}{C9A227}\n".to_string(),
        }
    };
    let preamble = format!(
        r"% Quantum Maze presentation (Beamer): {deck_title}
% Compile with pdfLaTeX, XeLaTeX or LuaLaTeX.
% Export to PowerPoint: Export > Presentation as PowerPoint (.pptx).
\documentclass[aspectratio={aspect}]{{beamer}}
{look}
% Slide design. Change the word to restyle every slide:
%   elegant, executive, geometric, blueprint, wave, minimal, radar, circuit, aurora
%   classic = an ordinary Beamer theme (add a usetheme line above).
% qmdesign.sty is in this project folder. It also provides the infographics
% (\qmStats, \qmTimeline, \qmRoadmap, \qmCards, \qmBars, \qmDonuts, \qmTRL, \qmGantt, \qmRisk ...).
\newcommand{{\qmDesign}}{{{design}}}
\usepackage{{qmdesign}}
% \qmNoSectionSlides   % uncomment to drop the divider slide at each \section

\usepackage{{graphicx}}
\usepackage{{booktabs}}
\usepackage{{amsmath}}

% Grey guidance text is written as \hint{{...}}. Replace each with your own content.

% Protective marking printed at the top and bottom of every slide.
% Leave empty for none, or set it as your organisation's rules require.
\newcommand{{\Marking}}{{}}
\IfFileExists{{eso-pic.sty}}{{\usepackage{{eso-pic}}
  \AddToShipoutPictureFG{{\ifx\Marking\empty\else
    \AtPageUpperLeft{{\makebox[\paperwidth]{{\raisebox{{-2.2ex}}{{\tiny\bfseries\color{{red!70!black}}\Marking}}}}}}%
    \AtPageLowerLeft{{\makebox[\paperwidth]{{\raisebox{{0.8ex}}{{\tiny\bfseries\color{{red!70!black}}\Marking}}}}}}\fi}}}}{{}}

\title{{{title}}}
\subtitle{{{subtitle}}}
\author{{{author}}}
\institute{{{inst}}}
\date{{\today}}

\begin{{document}}

\qmTitleSlide

",
        deck_title = deck.title,
        subtitle = deck.subtitle,
    );
    let main = format!("{preamble}{}\n\\end{{document}}\n", deck.body);
    let mut files = vec![("main.tex".to_string(), main.into_bytes()), ("qmdesign.sty".to_string(), QMDESIGN_STY.as_bytes().to_vec())];
    if deck.body.contains("figures/sample-figure") {
        files.push(("figures/sample-figure.png".into(), SAMPLE_FIGURE.to_vec()));
    }
    files
}

/// Quantum Maze-written skeleton that loads the journal's official class.
pub fn journal_skeleton(e: &JournalEntry, name: &str, o: &StarterOptions) -> Vec<(String, Vec<u8>)> {
    let title = tex_escape(name);
    let author = tex_escape(or(&o.author, "Author Name"));
    let org = tex_escape(or(&o.organization, "Organization"));
    let email = tex_escape(or(&o.email, "author@example.org"));
    let cls = e.ctan_class.as_deref().unwrap_or("article");
    let opts = e.class_options.as_deref().unwrap_or("");
    let header = format!(
        "% Quantum Maze skeleton for: {} ({})\n% Uses the official `{cls}` class from your TeX distribution.\n% Always check the current author instructions: {}\n",
        e.name,
        e.publisher,
        e.author_instructions_url.as_deref().unwrap_or("see publisher website")
    );
    let pkgs = "\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{booktabs}\n";
    let abstract_text = "Write an abstract that states the problem, the method, the main quantitative result and its significance.";
    let bib = e.bib_style.as_deref().unwrap_or("plain");
    let main = match cls {
        "IEEEtran" => format!(
            r"{header}\documentclass[{opts}]{{IEEEtran}}
{pkgs}\usepackage{{cite}}
\begin{{document}}
\title{{{title}}}
\author{{{author}\thanks{{{author} is with {org} (e-mail: {email}).}}}}
\maketitle
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\begin{{IEEEkeywords}}
Keyword one, keyword two, keyword three.
\end{{IEEEkeywords}}
{SECTION_INPUTS}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
"
        ),
        "elsarticle" => format!(
            r"{header}\documentclass[{opts}]{{elsarticle}}
{pkgs}\journal{{{journal}}}
\begin{{document}}
\begin{{frontmatter}}
\title{{{title}}}
\author{{{author}\corref{{cor1}}}}
\ead{{{email}}}
\cortext[cor1]{{Corresponding author}}
\affiliation{{organization={{{org}}}}}
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\begin{{keyword}}
Keyword one \sep keyword two \sep keyword three
\end{{keyword}}
\end{{frontmatter}}
{SECTION_INPUTS}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
",
            journal = tex_escape(&e.name)
        ),
        "acmart" => format!(
            r"{header}\documentclass[{opts}]{{acmart}}
\usepackage{{booktabs}}
\setcopyright{{none}}
\begin{{document}}
\title{{{title}}}
\author{{{author}}}
\email{{{email}}}
\affiliation{{\institution{{{org}}}\country{{Country}}}}
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\keywords{{keyword one, keyword two}}
\maketitle
{SECTION_INPUTS}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
"
        ),
        "revtex4-2" => format!(
            r"{header}\documentclass[{opts}]{{revtex4-2}}
{pkgs}\begin{{document}}
\title{{{title}}}
\author{{{author}}}
\email{{{email}}}
\affiliation{{{org}}}
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\maketitle
{SECTION_INPUTS}
\bibliography{{references/references}}
\end{{document}}
"
        ),
        "llncs" => format!(
            r"{header}\documentclass[{opts}]{{llncs}}
{pkgs}\begin{{document}}
\title{{{title}}}
\author{{{author}}}
\institute{{{org} \email{{{email}}}}}
\maketitle
\begin{{abstract}}
{abstract_text}
\keywords{{Keyword one \and keyword two \and keyword three.}}
\end{{abstract}}
{SECTION_INPUTS}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
"
        ),
        "spie" => format!(
            r"{header}\documentclass[{opts}]{{spie}}
{pkgs}\title{{{title}}}
\author{{{author}}}
\affiliation{{{org}}}
\authorinfo{{Send correspondence to {author}: {email}}}
\begin{{document}}
\maketitle
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\keywords{{Keyword one, keyword two}}
{SECTION_INPUTS}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
"
        ),
        // Community draft layout (no official LaTeX template exists).
        _ => format!(
            r"{header}% COMMUNITY DRAFT LAYOUT — not an official journal template.
% {note}
\documentclass[11pt]{{article}}
{pkgs}\usepackage[margin=1in]{{geometry}}
\usepackage[numbers]{{natbib}}
\usepackage{{hyperref}}
\title{{{title}}}
\author{{{author}\\ \small {org}\\ \small \texttt{{{email}}}}}
\date{{}}
\begin{{document}}
\maketitle
\begin{{abstract}}
{abstract_text}
\end{{abstract}}
\noindent\textbf{{Keywords:}} keyword one; keyword two; keyword three
{SECTION_INPUTS}
{statements}
\bibliographystyle{{{bib}}}
\bibliography{{references/references}}
\end{{document}}
",
            note = e.notes.first().cloned().unwrap_or_default(),
            statements = e
                .requirements
                .statements
                .iter()
                .map(|st| format!("\\section*{{{}}}\nTo be completed.\n", tex_escape(st)))
                .collect::<String>()
        ),
    };
    let mut v = vec![("main.tex".to_string(), main.into_bytes())];
    v.extend(section_files());
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn title_escaping() {
        assert_eq!(tex_escape("R&D 100%"), "R\\&D 100\\%");
        assert_eq!(tex_escape("a\\b~"), "a\\textbackslash{}b\\textasciitilde{}");
    }
    #[test]
    fn story_template_is_valid_json_with_assets() {
        let f = files(StarterTemplate::Story, "My Story", &StarterOptions { author: "A. Researcher".into(), ..Default::default() });
        let story: serde_json::Value = serde_json::from_slice(&f[0].1).unwrap();
        assert_eq!(story["meta"]["title"], "My Story");
        assert_eq!(story["meta"]["author"], "A. Researcher");
        for (p, _) in &f[1..] {
            assert!(STORY_JSON.contains(p.as_str()), "{p} unused");
        }
    }
}
