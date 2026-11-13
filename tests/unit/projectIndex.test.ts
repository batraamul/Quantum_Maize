import { describe, expect, it } from "vitest";
import {
  buildOutline,
  duplicateKeys,
  extractLabels,
  foldingRanges,
  innermostOpenEnv,
  parseBib,
  readGroup,
  stripComments,
} from "../../src/editor/projectIndex";

describe("stripComments", () => {
  it("keeps escaped percent signs", () => {
    expect(stripComments("50\\% done % comment\n% full")).toBe("50\\% done \n");
  });
});

describe("readGroup", () => {
  it("handles nesting and escaped braces", () => {
    const s = "\\section{A {nested} \\} title} rest";
    expect(readGroup(s, 8)?.text).toBe("A {nested} \\} title");
  });
});

describe("labels", () => {
  it("finds labels with line numbers, ignoring comments", () => {
    const src = "a\n\\label{sec:intro}\n% \\label{commented}\n\\begin{equation}x\\label{eq:1}\\end{equation}";
    const l = extractLabels(src, "main.tex");
    expect(l.map((x) => x.name)).toEqual(["sec:intro", "eq:1"]);
    expect(l[1].line).toBe(4);
  });
});

describe("bibtex", () => {
  const bib = `@comment{x}
@Article{smith2020,
  author = {Smith, John and Doe, Jane},
  title = {A {Great} Paper},
  journal = "Journal",
  year = 2020
}
@book(knuth, title = "TeXbook", year = {1984})
@misc{smith2020, title={dup}}`;
  it("parses keys and fields", () => {
    const e = parseBib(bib, "refs.bib");
    expect(e.map((x) => x.key)).toEqual(["smith2020", "knuth", "smith2020"]);
    expect(e[0].title).toBe("A Great Paper");
    expect(e[0].year).toBe("2020");
    expect(e[0].type).toBe("article");
    expect(e[0].line).toBe(2);
    expect(e[1].title).toBe("TeXbook");
  });
  it("detects duplicate keys", () => {
    expect([...duplicateKeys(parseBib(bib, "r.bib"))]).toEqual(["smith2020"]);
  });
});

describe("outline", () => {
  const files: Record<string, string> = {
    "main.tex": "\\documentclass{article}\n\\begin{document}\n\\section{Intro}\\label{s}\n\\input{sections/methods}\n% \\section{Hidden}\n\\section*{Acknowledgements}\n\\end{document}",
    "sections/methods.tex": "\\section[Short]{Methods}\n\\subsection{Data {and} setup}\n\\include{sections/loop}",
    "sections/loop.tex": "\\input{sections/methods}\n\\subsection{Loop safe}",
  };
  it("follows inputs in document order and survives cycles", () => {
    const o = buildOutline("main.tex", (p) => files[p] ?? null, (p) => p in files);
    expect(o.map((x) => [x.level, x.title, x.file, x.line])).toEqual([
      [2, "Intro", "main.tex", 3],
      [2, "Methods", "sections/methods.tex", 1],
      [3, "Data and setup", "sections/methods.tex", 2],
      [3, "Loop safe", "sections/loop.tex", 2],
      [2, "Acknowledgements", "main.tex", 6],
    ]);
    expect(o[4].starred).toBe(true);
  });
});

describe("environments and folding", () => {
  it("finds innermost open environment", () => {
    expect(innermostOpenEnv("\\begin{figure}\\begin{center}x\\end{center}\n")).toBe("figure");
    expect(innermostOpenEnv("\\begin{a}\\end{a}")).toBeNull();
  });
  it("produces folding ranges for environments and sections", () => {
    const src = ["\\begin{document}", "\\section{A}", "\\begin{equation}", "x", "\\end{equation}", "\\section{B}", "text", "\\end{document}"].join("\n");
    const r = foldingRanges(src);
    expect(r).toContainEqual({ start: 3, end: 5 });
    expect(r).toContainEqual({ start: 2, end: 5 });
    expect(r).toContainEqual({ start: 6, end: 7 });
  });
});
