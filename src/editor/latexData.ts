// Static LaTeX knowledge used by autocomplete and the Insert/Format menus.
// `snippet` uses Monaco/TextMate snippet syntax ($1, ${1:placeholder}, $0).

export interface CommandSpec {
  name: string; // without backslash
  snippet?: string; // inserted after the backslash
  detail: string;
  math?: boolean;
}

export const COMMANDS: CommandSpec[] = [
  // structure
  { name: "part", snippet: "part{${1:title}}$0", detail: "Part heading" },
  { name: "chapter", snippet: "chapter{${1:title}}\\label{ch:${2}}$0", detail: "Chapter heading (book/report)" },
  { name: "section", snippet: "section{${1:title}}\\label{sec:${2}}$0", detail: "Section heading" },
  { name: "subsection", snippet: "subsection{${1:title}}\\label{sec:${2}}$0", detail: "Subsection heading" },
  { name: "subsubsection", snippet: "subsubsection{${1:title}}$0", detail: "Subsubsection heading" },
  { name: "paragraph", snippet: "paragraph{${1:title}}$0", detail: "Paragraph heading" },
  { name: "section*", snippet: "section*{${1:title}}$0", detail: "Unnumbered section" },
  { name: "appendix", snippet: "appendix\n$0", detail: "Start appendices" },
  { name: "tableofcontents", detail: "Table of contents" },
  { name: "maketitle", detail: "Typeset the title block" },
  { name: "title", snippet: "title{${1}}$0", detail: "Document title" },
  { name: "author", snippet: "author{${1}}$0", detail: "Document author(s)" },
  { name: "date", snippet: "date{${1:\\today}}$0", detail: "Document date" },
  { name: "thanks", snippet: "thanks{${1}}$0", detail: "Footnote in title block" },
  { name: "documentclass", snippet: "documentclass[${2:11pt}]{${1:article}}$0", detail: "Document class" },
  { name: "usepackage", snippet: "usepackage{${1}}$0", detail: "Load a package" },
  { name: "input", snippet: "input{${1}}$0", detail: "Insert a .tex file" },
  { name: "include", snippet: "include{${1}}$0", detail: "Include a .tex file on a new page" },
  { name: "begin", snippet: "begin{${1:env}}\n\t$0\n\\end{${1:env}}", detail: "Begin an environment" },
  { name: "end", snippet: "end{${1}}", detail: "End an environment" },
  // references
  { name: "label", snippet: "label{${1}}$0", detail: "Label for cross-references" },
  { name: "ref", snippet: "ref{${1}}$0", detail: "Cross-reference" },
  { name: "eqref", snippet: "eqref{${1}}$0", detail: "Equation reference (amsmath)" },
  { name: "pageref", snippet: "pageref{${1}}$0", detail: "Page reference" },
  { name: "autoref", snippet: "autoref{${1}}$0", detail: "Reference with automatic name (hyperref)" },
  { name: "cref", snippet: "cref{${1}}$0", detail: "Clever reference (cleveref)" },
  { name: "cite", snippet: "cite{${1}}$0", detail: "Citation" },
  { name: "citep", snippet: "citep{${1}}$0", detail: "Parenthetical citation (natbib)" },
  { name: "citet", snippet: "citet{${1}}$0", detail: "Textual citation (natbib)" },
  { name: "parencite", snippet: "parencite{${1}}$0", detail: "Parenthetical citation (biblatex)" },
  { name: "textcite", snippet: "textcite{${1}}$0", detail: "Textual citation (biblatex)" },
  { name: "autocite", snippet: "autocite{${1}}$0", detail: "Automatic citation (biblatex)" },
  { name: "nocite", snippet: "nocite{${1:*}}$0", detail: "Add to bibliography without citing" },
  { name: "bibliography", snippet: "bibliography{${1:references}}$0", detail: "BibTeX database(s)" },
  { name: "bibliographystyle", snippet: "bibliographystyle{${1:plain}}$0", detail: "BibTeX style" },
  { name: "addbibresource", snippet: "addbibresource{${1:references.bib}}$0", detail: "biblatex database" },
  { name: "printbibliography", detail: "Print bibliography (biblatex)" },
  { name: "footnote", snippet: "footnote{${1}}$0", detail: "Footnote" },
  { name: "url", snippet: "url{${1}}$0", detail: "URL" },
  { name: "href", snippet: "href{${1:url}}{${2:text}}$0", detail: "Hyperlink" },
  // graphics & floats
  { name: "includegraphics", snippet: "includegraphics[width=${2:\\linewidth}]{${1}}$0", detail: "Insert image (graphicx)" },
  { name: "caption", snippet: "caption{${1}}$0", detail: "Float caption" },
  { name: "centering", detail: "Centre content" },
  { name: "graphicspath", snippet: "graphicspath{{${1:figures/}}}$0", detail: "Image search folders" },
  // text formatting
  { name: "textbf", snippet: "textbf{${1:$TM_SELECTED_TEXT}}$0", detail: "Bold" },
  { name: "textit", snippet: "textit{${1:$TM_SELECTED_TEXT}}$0", detail: "Italic" },
  { name: "emph", snippet: "emph{${1:$TM_SELECTED_TEXT}}$0", detail: "Emphasis" },
  { name: "underline", snippet: "underline{${1:$TM_SELECTED_TEXT}}$0", detail: "Underline" },
  { name: "texttt", snippet: "texttt{${1:$TM_SELECTED_TEXT}}$0", detail: "Monospace" },
  { name: "textsc", snippet: "textsc{${1}}$0", detail: "Small caps" },
  { name: "item", snippet: "item $0", detail: "List item" },
  { name: "newline", detail: "Line break" },
  { name: "newpage", detail: "Page break" },
  { name: "clearpage", detail: "Flush floats and break page" },
  { name: "noindent", detail: "Suppress paragraph indent" },
  { name: "vspace", snippet: "vspace{${1:1em}}$0", detail: "Vertical space" },
  { name: "hspace", snippet: "hspace{${1:1em}}$0", detail: "Horizontal space" },
  { name: "today", detail: "Current date" },
  { name: "newcommand", snippet: "newcommand{\\\\${1:name}}[${2:0}]{${3}}$0", detail: "Define a command" },
  { name: "renewcommand", snippet: "renewcommand{\\\\${1:name}}{${2}}$0", detail: "Redefine a command" },
  { name: "newtheorem", snippet: "newtheorem{${1:theorem}}{${2:Theorem}}$0", detail: "Define theorem environment" },
  { name: "SI", snippet: "SI{${1:value}}{${2:\\metre}}$0", detail: "Quantity with unit (siunitx)" },
  { name: "si", snippet: "si{${1:\\metre}}$0", detail: "Unit (siunitx)" },
  { name: "num", snippet: "num{${1}}$0", detail: "Formatted number (siunitx)" },
  { name: "toprule", detail: "Table top rule (booktabs)" },
  { name: "midrule", detail: "Table middle rule (booktabs)" },
  { name: "bottomrule", detail: "Table bottom rule (booktabs)" },
  { name: "multicolumn", snippet: "multicolumn{${1:2}}{${2:c}}{${3}}$0", detail: "Span columns" },
  { name: "multirow", snippet: "multirow{${1:2}}{*}{${2}}$0", detail: "Span rows (multirow)" },
  { name: "hline", detail: "Horizontal table line" },
  // math
  { name: "frac", snippet: "frac{${1}}{${2}}$0", detail: "Fraction", math: true },
  { name: "dfrac", snippet: "dfrac{${1}}{${2}}$0", detail: "Display-style fraction", math: true },
  { name: "sqrt", snippet: "sqrt{${1}}$0", detail: "Square root", math: true },
  { name: "sum", snippet: "sum_{${1:i=1}}^{${2:n}}$0", detail: "Summation", math: true },
  { name: "prod", snippet: "prod_{${1:i=1}}^{${2:n}}$0", detail: "Product", math: true },
  { name: "int", snippet: "int_{${1:a}}^{${2:b}}$0", detail: "Integral", math: true },
  { name: "lim", snippet: "lim_{${1:x\\to\\infty}}$0", detail: "Limit", math: true },
  { name: "left(", snippet: "left( ${1} \\right)$0", detail: "Auto-sized parentheses", math: true },
  { name: "mathbf", snippet: "mathbf{${1}}$0", detail: "Bold math", math: true },
  { name: "mathrm", snippet: "mathrm{${1}}$0", detail: "Upright math", math: true },
  { name: "mathcal", snippet: "mathcal{${1}}$0", detail: "Calligraphic", math: true },
  { name: "mathbb", snippet: "mathbb{${1}}$0", detail: "Blackboard bold (amssymb)", math: true },
  { name: "boldsymbol", snippet: "boldsymbol{${1}}$0", detail: "Bold symbol", math: true },
  { name: "hat", snippet: "hat{${1}}$0", detail: "Hat accent", math: true },
  { name: "bar", snippet: "bar{${1}}$0", detail: "Bar accent", math: true },
  { name: "vec", snippet: "vec{${1}}$0", detail: "Vector arrow", math: true },
  { name: "tilde", snippet: "tilde{${1}}$0", detail: "Tilde accent", math: true },
  { name: "dot", snippet: "dot{${1}}$0", detail: "Dot accent", math: true },
  { name: "text", snippet: "text{${1}}$0", detail: "Text inside math", math: true },
  { name: "operatorname", snippet: "operatorname{${1}}$0", detail: "Operator name", math: true },
  { name: "partial", detail: "∂", math: true },
  { name: "nabla", detail: "∇", math: true },
  { name: "infty", detail: "∞", math: true },
  { name: "cdot", detail: "·", math: true },
  { name: "times", detail: "×", math: true },
  { name: "pm", detail: "±", math: true },
  { name: "leq", detail: "≤", math: true },
  { name: "geq", detail: "≥", math: true },
  { name: "neq", detail: "≠", math: true },
  { name: "approx", detail: "≈", math: true },
  { name: "equiv", detail: "≡", math: true },
  { name: "propto", detail: "∝", math: true },
  { name: "in", detail: "∈", math: true },
  { name: "subset", detail: "⊂", math: true },
  { name: "forall", detail: "∀", math: true },
  { name: "exists", detail: "∃", math: true },
  { name: "rightarrow", detail: "→", math: true },
  { name: "Rightarrow", detail: "⇒", math: true },
  { name: "leftrightarrow", detail: "↔", math: true },
  { name: "mapsto", detail: "↦", math: true },
  { name: "ldots", detail: "…", math: true },
  { name: "cdots", detail: "⋯", math: true },
  { name: "quad", detail: "Space", math: true },
  { name: "qquad", detail: "Wide space", math: true },
  ...["alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi", "Omega"].map(
    (g) => ({ name: g, detail: `Greek letter ${g}`, math: true }),
  ),
];

export interface EnvSpec {
  name: string;
  body?: string; // snippet body between begin/end
  args?: string; // snippet after \begin{name}
  detail: string;
}

export const ENVIRONMENTS: EnvSpec[] = [
  { name: "document", detail: "Document body" },
  { name: "abstract", detail: "Abstract" },
  { name: "itemize", body: "\t\\item ${1}", detail: "Bulleted list" },
  { name: "enumerate", body: "\t\\item ${1}", detail: "Numbered list" },
  { name: "description", body: "\t\\item[${1:term}] ${2}", detail: "Description list" },
  { name: "equation", body: "\t${1}\n\t\\label{eq:${2}}", detail: "Numbered equation" },
  { name: "equation*", body: "\t${1}", detail: "Unnumbered equation" },
  { name: "align", body: "\t${1} &= ${2} \\\\\\\\\n\t${3} &= ${4}", detail: "Aligned equations (amsmath)" },
  { name: "align*", body: "\t${1} &= ${2}", detail: "Unnumbered aligned equations" },
  { name: "gather", body: "\t${1}", detail: "Gathered equations" },
  { name: "multline", body: "\t${1}", detail: "Multi-line equation" },
  { name: "cases", body: "\t${1} & \\text{if } ${2} \\\\\\\\\n\t${3} & \\text{otherwise}", detail: "Piecewise cases" },
  { name: "pmatrix", body: "\t${1:a} & ${2:b} \\\\\\\\\n\t${3:c} & ${4:d}", detail: "Matrix with parentheses" },
  { name: "bmatrix", body: "\t${1:a} & ${2:b} \\\\\\\\\n\t${3:c} & ${4:d}", detail: "Matrix with brackets" },
  {
    name: "figure",
    args: "[${1:htbp}]",
    body: "\t\\centering\n\t\\includegraphics[width=${2:0.8\\linewidth}]{${3:file}}\n\t\\caption{${4:Caption}}\n\t\\label{fig:${5:label}}",
    detail: "Figure float",
  },
  {
    name: "table",
    args: "[${1:htbp}]",
    body: "\t\\centering\n\t\\caption{${2:Caption}}\n\t\\label{tab:${3:label}}\n\t\\begin{tabular}{${4:lcc}}\n\t\t\\toprule\n\t\t${5:A} & ${6:B} & ${7:C} \\\\\\\\\n\t\t\\midrule\n\t\t${8} &  &  \\\\\\\\\n\t\t\\bottomrule\n\t\\end{tabular}",
    detail: "Table float with booktabs",
  },
  { name: "tabular", args: "{${1:lcc}}", body: "\t${2}", detail: "Table body" },
  { name: "tabularx", args: "{\\linewidth}{${1:lXX}}", body: "\t${2}", detail: "Table with flexible columns (tabularx)" },
  { name: "longtable", args: "{${1:lcc}}", body: "\t${2}", detail: "Multi-page table (longtable)" },
  { name: "center", detail: "Centred block" },
  { name: "minipage", args: "{${1:0.48\\linewidth}}", body: "\t${2}", detail: "Mini page" },
  { name: "quote", detail: "Quotation" },
  { name: "verbatim", detail: "Verbatim text" },
  { name: "theorem", detail: "Theorem" },
  { name: "lemma", detail: "Lemma" },
  { name: "proof", detail: "Proof (amsthm)" },
  { name: "definition", detail: "Definition" },
  { name: "algorithm", args: "[${1:htbp}]", body: "\t\\caption{${2:Algorithm}}\n\t\\label{alg:${3}}\n\t${0}", detail: "Algorithm float" },
  { name: "algorithmic", args: "[1]", body: "\t\\STATE ${1}", detail: "Pseudocode (algorithmic)" },
  { name: "lstlisting", args: "[language=${1:Python}]", body: "${2}", detail: "Code listing (listings)" },
  { name: "subfigure", args: "{${1:0.48\\linewidth}}", body: "\t\\centering\n\t\\includegraphics[width=\\linewidth]{${2}}\n\t\\caption{${3}}", detail: "Sub-figure (subcaption)" },
  { name: "frame", args: "{${1:Title}}", body: "\t${2}", detail: "Beamer frame" },
];

export const PACKAGES = [
  "amsmath", "amssymb", "amsthm", "mathtools", "bm", "graphicx", "xcolor", "hyperref", "cleveref", "geometry",
  "booktabs", "tabularx", "longtable", "multirow", "array", "makecell", "siunitx", "natbib", "biblatex", "cite",
  "subcaption", "caption", "float", "placeins", "algorithm", "algorithmic", "algorithm2e", "algpseudocode",
  "listings", "minted", "tikz", "pgfplots", "fontenc", "inputenc", "fontspec", "lmodern", "microtype", "babel",
  "polyglossia", "enumitem", "titlesec", "fancyhdr", "setspace", "lipsum", "url", "acronym", "glossaries",
  "nomencl", "appendix", "authblk", "csquotes", "xspace", "todonotes", "lineno", "physics", "units", "upgreek",
  "threeparttable", "adjustbox", "rotating", "pdfpages", "standalone", "comment", "etoolbox", "ifthen",
];

export const CITE_COMMANDS = ["cite", "citep", "citet", "citealp", "citeauthor", "citeyear", "parencite", "textcite", "autocite", "footcite", "nocite", "fullcite", "Cite", "Citep", "Citet"];
export const REF_COMMANDS = ["ref", "eqref", "pageref", "autoref", "cref", "Cref", "nameref", "vref"];

export interface InsertSnippet {
  id: string;
  label: string;
  group: "Structure" | "Math" | "Floats" | "Lists" | "References" | "Research";
  snippet: string;
}

const env = (name: string): string => {
  const e = ENVIRONMENTS.find((x) => x.name === name)!;
  return `\\begin{${e.name}}${e.args ?? ""}\n${e.body ?? "\t$0"}\n\\end{${e.name}}`;
};

export const INSERT_SNIPPETS: InsertSnippet[] = [
  { id: "section", label: "Section", group: "Structure", snippet: "\\section{${1:Title}}\\label{sec:${2}}\n$0" },
  { id: "subsection", label: "Subsection", group: "Structure", snippet: "\\subsection{${1:Title}}\\label{sec:${2}}\n$0" },
  { id: "abstract", label: "Abstract", group: "Structure", snippet: "\\begin{abstract}\n\t${1}\n\\end{abstract}" },
  { id: "inline-math", label: "Inline equation  $…$", group: "Math", snippet: "$${1:${TM_SELECTED_TEXT}}$$0" },
  { id: "display-math", label: "Display equation  \\[…\\]", group: "Math", snippet: "\\[\n\t${1}\n\\]" },
  { id: "equation", label: "Numbered equation", group: "Math", snippet: env("equation") },
  { id: "align", label: "Aligned equations", group: "Math", snippet: env("align") },
  { id: "matrix", label: "Matrix", group: "Math", snippet: "\\begin{bmatrix}\n\t${1:a} & ${2:b} \\\\\\\\\n\t${3:c} & ${4:d}\n\\end{bmatrix}" },
  { id: "cases", label: "Piecewise cases", group: "Math", snippet: "\\begin{cases}\n\t${1} & \\text{if } ${2} \\\\\\\\\n\t${3} & \\text{otherwise}\n\\end{cases}" },
  { id: "figure", label: "Figure", group: "Floats", snippet: env("figure") },
  { id: "subfigures", label: "Two sub-figures", group: "Floats", snippet: "\\begin{figure}[htbp]\n\t\\centering\n\t\\begin{subfigure}{0.48\\linewidth}\n\t\t\\includegraphics[width=\\linewidth]{${1:a}}\n\t\t\\caption{${2}}\\label{fig:${3}}\n\t\\end{subfigure}\\hfill\n\t\\begin{subfigure}{0.48\\linewidth}\n\t\t\\includegraphics[width=\\linewidth]{${4:b}}\n\t\t\\caption{${5}}\\label{fig:${6}}\n\t\\end{subfigure}\n\t\\caption{${7:Caption}}\\label{fig:${8}}\n\\end{figure}" },
  { id: "table", label: "Table (booktabs)", group: "Floats", snippet: env("table") },
  { id: "itemize", label: "Bulleted list", group: "Lists", snippet: env("itemize") },
  { id: "enumerate", label: "Numbered list", group: "Lists", snippet: env("enumerate") },
  { id: "cite", label: "Citation", group: "References", snippet: "\\cite{${1}}$0" },
  { id: "ref", label: "Cross-reference", group: "References", snippet: "\\ref{${1}}$0" },
  { id: "label", label: "Label", group: "References", snippet: "\\label{${1}}$0" },
  { id: "footnote", label: "Footnote", group: "References", snippet: "\\footnote{${1}}$0" },
  { id: "algorithm", label: "Algorithm", group: "Research", snippet: "\\begin{algorithm}[htbp]\n\t\\caption{${1:Algorithm}}\\label{alg:${2}}\n\t\\begin{algorithmic}[1]\n\t\t\\STATE ${3}\n\t\\end{algorithmic}\n\\end{algorithm}" },
  { id: "listing", label: "Code listing", group: "Research", snippet: env("lstlisting") },
  { id: "theorem", label: "Theorem + proof", group: "Research", snippet: "\\begin{theorem}\\label{thm:${1}}\n\t${2}\n\\end{theorem}\n\\begin{proof}\n\t${3}\n\\end{proof}" },
];

export interface FormatAction {
  id: string;
  label: string;
  before: string;
  after: string;
  shortcut?: string;
}

export const FORMAT_ACTIONS: FormatAction[] = [
  { id: "bold", label: "Bold", before: "\\textbf{", after: "}", shortcut: "Ctrl+B" },
  { id: "italic", label: "Italic", before: "\\textit{", after: "}", shortcut: "Ctrl+I" },
  { id: "emph", label: "Emphasis", before: "\\emph{", after: "}" },
  { id: "underline", label: "Underline", before: "\\underline{", after: "}" },
  { id: "mono", label: "Monospace", before: "\\texttt{", after: "}" },
  { id: "smallcaps", label: "Small caps", before: "\\textsc{", after: "}" },
  { id: "math", label: "Inline math", before: "$", after: "$" },
];
