import { describe, expect, it } from "vitest";
import { detex, isBeamer, parseFrames, setBeamerTheme } from "../../src/presentation/beamer";
import { runChecks, summary, wordCount } from "../../src/validation/checks";

const deck = String.raw`\documentclass[aspectratio=169]{beamer}
\usetheme{Madrid}
\title{My \textbf{Talk}}
\author{A. Researcher}
\institute{Lab}
\begin{document}
\begin{frame}\titlepage\end{frame}
\begin{frame}{Outline}\tableofcontents\end{frame}
\section{Motivation}
\begin{frame}{Why it matters}
  \begin{itemize}
    \item<1-> First \emph{point}
    \begin{itemize}
      \item Nested $\alpha \leq 2$
    \end{itemize}
    \item<2-> Second % comment
  \end{itemize}
\end{frame}
\section{Results}
\begin{frame}
  \frametitle{Result}
  \includegraphics[width=\linewidth]{figures/plot}
  \begin{block}{Observation}
    Faster by 2x.
  \end{block}
\end{frame}
\end{document}`;

describe("beamer parser", () => {
  it("detects beamer", () => {
    expect(isBeamer(deck)).toBe(true);
    expect(isBeamer("\\documentclass{article}")).toBe(false);
  });
  it("extracts frames, bullets, images and title slide", () => {
    const f = parseFrames(deck);
    expect(f.length).toBe(4);
    expect(f[0]).toMatchObject({ isTitle: true, title: "My Talk" });
    expect(f[0].subtitle).toContain("A. Researcher");
    expect(f[1].bullets.map((b) => b.text)).toEqual(["Motivation", "Results"]);
    expect(f[2].title).toBe("Why it matters");
    expect(f[2].bullets).toEqual([
      { level: 0, text: "First point" },
      { level: 1, text: "Nested α ≤ 2" },
      { level: 0, text: "Second" },
    ]);
    expect(f[2].overlays).toBe(true);
    expect(f[3].title).toBe("Result");
    expect(f[3].images).toEqual(["figures/plot"]);
    expect(f[3].bullets.map((b) => b.text)).toEqual(["Observation", "Faster by 2x."]);
  });
  it("detexes common markup", () => {
    expect(detex("\\textbf{Bold} and $x \\times y$ ~50\\%")).toBe("Bold and x × y 50%");
    expect(detex("$y = e^{-\\alpha t}\\cos(\\omega t)$")).toBe("y = e^-α t cos(ω t)");
  });
  it("turns table rows into text lines", () => {
    const f = parseFrames("\\begin{frame}{T}\n\\begin{tabular}{lc}\n\\toprule\nA & B \\\\\n\\midrule\nx & 1.5\\% \\\\\n\\end{tabular}\n\\end{frame}");
    expect(f[0].bullets.map((b) => b.text)).toEqual(["A  |  B", "x  |  1.5%"]);
  });
  it("switches themes", () => {
    const s = setBeamerTheme(deck, "metropolis", "whale");
    expect(s).toContain("\\usetheme{metropolis}\n\\usecolortheme{whale}");
    expect(setBeamerTheme(s, "Madrid", "default")).not.toContain("usecolortheme");
  });
});

describe("manuscript checks", () => {
  const paper = String.raw`\documentclass{article}
\title{T}\author{A \thanks{Lab}}
\begin{document}
\begin{abstract} One two three four five six. \end{abstract}
\noindent Keywords: a; b
\section{Introduction} See \cite{a,b} and Fig.~\ref{fig:1}.
\begin{figure}\includegraphics{x}\caption{C}\label{fig:1}\end{figure}
\begin{table}\label{tab:1}\end{table}
\section{Conclusion}
\section*{Author Contributions} x
\bibliography{refs}
\end{document}`;
  const base = { bibKeys: ["a", "c", "c2"], duplicateBibKeys: [], diagnostics: [], compiled: true, pdfPages: 9 };

  it("counts words ignoring commands", () => {
    expect(wordCount("\\textbf{One} two $x+y$ three")).toBe(4);
  });

  it("finds problems and successes", () => {
    const items = runChecks({ ...base, sources: [{ path: "main.tex", text: paper }], journalName: "J", requirements: { sections: ["abstract", "keywords", "introduction", "conclusion", "references", "author contributions", "funding"], abstractMaxWords: 5, maxPages: 8, statements: [], notes: ["Plagiarism < 10%"], source: null, verified: true } });
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by.title.status).toBe("verified");
    expect(by.affil.status).toBe("verified");
    expect(by.abstract).toMatchObject({ status: "warning" });
    expect(by.abstract.detail).toContain("6 words");
    expect(by.keywords.status).toBe("verified");
    expect(by["sec-introduction"].status).toBe("verified");
    expect(by["sec-author contributions"].status).toBe("verified");
    expect(by["sec-funding"].status).toBe("missing");
    expect(by.captions.status).toBe("missing"); // table without caption
    expect(by.floatrefs.status).toBe("warning"); // tab:1 not referenced
    expect(by.cites.detail).toContain("b");
    expect(by.uncited.detail).toContain("c");
    expect(by.pages.status).toBe("missing");
    expect(items.some((i) => i.label === "Plagiarism < 10%" && i.status === "not-checked")).toBe(true);
    const s = summary(items);
    expect(s.missing).toBeGreaterThan(0);
  });
});

import { setBeamerTheme as sbt } from "../../src/presentation/beamer";
describe("theme guard", () => {
  it("is collapsed when the theme is changed", () => {
    const src = "\\documentclass{beamer}\n\\IfFileExists{beamerthememoloch.sty}{\\usetheme{moloch}}{\\usetheme{Madrid}}\n\\begin{document}";
    expect(sbt(src, "Berlin", "whale")).toBe("\\documentclass{beamer}\n\\usetheme{Berlin}\n\\usecolortheme{whale}\n\\begin{document}");
  });
});
