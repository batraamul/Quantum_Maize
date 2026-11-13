// Lightweight, pure-TS index of a project's LaTeX/BibTeX content used for
// autocomplete (\ref, \cite, \includegraphics …), the outline and the
// references panel. Kept free of Monaco/Tauri imports so it is unit-testable.

export interface LabelEntry {
  name: string;
  file: string;
  line: number;
}

export interface BibEntry {
  key: string;
  type: string;
  title: string;
  author: string;
  year: string;
  file: string;
  line: number;
}

export interface OutlineItem {
  level: number; // 0 part, 1 chapter, 2 section, 3 subsection, 4 subsubsection, 5 paragraph
  title: string;
  file: string;
  line: number;
  starred: boolean;
}

const SECTION_LEVELS: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
};

/** Remove comments (unescaped %) while keeping line structure. */
export function stripComments(src: string): string {
  return src
    .split("\n")
    .map((l) => {
      for (let i = 0; i < l.length; i++) {
        if (l[i] === "%" && (i === 0 || l[i - 1] !== "\\")) return l.slice(0, i);
      }
      return l;
    })
    .join("\n");
}

/** Read a balanced {...} group starting at `open` (index of '{'). */
export function readGroup(s: string, open: number): { text: string; end: number } | null {
  if (s[open] !== "{") return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { text: s.slice(open + 1, i), end: i };
    }
  }
  return null;
}

function lineAt(s: string, idx: number): number {
  let n = 1;
  for (let i = 0; i < idx && i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

export function extractLabels(src: string, file: string): LabelEntry[] {
  const clean = stripComments(src);
  const out: LabelEntry[] = [];
  const re = /\\label\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) out.push({ name: m[1].trim(), file, line: lineAt(clean, m.index) });
  return out;
}

/** Parse BibTeX/biblatex entries (keys + key fields) tolerantly. */
export function parseBib(src: string, file: string): BibEntry[] {
  const out: BibEntry[] = [];
  const re = /@([A-Za-z]+)\s*([{(])\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase();
    if (type === "comment" || type === "string" || type === "preamble") continue;
    // Find the entry body extent by brace matching from the opening delimiter.
    const openIdx = m.index + m[0].indexOf(m[2]);
    let end = src.length;
    if (m[2] === "{") {
      const g = readGroup(src, openIdx);
      if (g) end = g.end;
    } else {
      const close = src.indexOf(")", openIdx);
      if (close > 0) end = close;
    }
    const body = src.slice(openIdx + 1, end);
    const field = (name: string): string => {
      const fm = new RegExp(`(?:^|[,\\s])${name}\\s*=\\s*`, "i").exec(body);
      if (!fm) return "";
      let i = fm.index + fm[0].length;
      if (body[i] === "{") {
        const g = readGroup(body, i);
        return g ? g.text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim() : "";
      }
      if (body[i] === '"') {
        const j = body.indexOf('"', i + 1);
        return body.slice(i + 1, j > 0 ? j : undefined).replace(/[{}]/g, "").trim();
      }
      const j = body.slice(i).search(/[,\n}]/);
      return body.slice(i, j >= 0 ? i + j : undefined).trim();
    };
    out.push({
      key: m[3],
      type,
      title: field("title"),
      author: field("author"),
      year: field("year") || field("date").slice(0, 4),
      file,
      line: lineAt(src, m.index),
    });
  }
  return out;
}

export function duplicateKeys(entries: BibEntry[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.key)) dup.add(e.key);
    seen.add(e.key);
  }
  return dup;
}

/** Normalise an \input/\include argument to a project-relative .tex path. */
export function resolveInputPath(arg: string, fromFile: string, exists: (p: string) => boolean): string | null {
  const a = arg.trim().replace(/^\.\//, "");
  const withExt = a.endsWith(".tex") ? a : `${a}.tex`;
  // TeX resolves relative to the working directory (project root), which is
  // where Quantum Maze runs the engine; also try relative to the including file.
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/") + 1) : "";
  for (const c of [withExt, a, dir + withExt]) if (exists(c)) return c;
  return null;
}

/**
 * Build the document outline by following \input/\include from the main file
 * in document order. `read` returns file contents or null when unavailable.
 */
export function buildOutline(main: string, read: (path: string) => string | null, exists: (p: string) => boolean): OutlineItem[] {
  const out: OutlineItem[] = [];
  const visiting = new Set<string>();
  const walk = (file: string, depth: number) => {
    if (depth > 20 || visiting.has(file)) return;
    const raw = read(file);
    if (raw == null) return;
    visiting.add(file);
    const src = stripComments(raw);
    const re = /\\(part|chapter|section|subsection|subsubsection|paragraph)(\*?)\s*(?:\[[^\]]*\])?\s*\{|\\(input|include|subfile)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (m[1]) {
        const brace = m.index + m[0].length - 1;
        const g = readGroup(src, brace);
        const title = (g?.text ?? "")
          .replace(/\\label\{[^}]*\}/g, "")
          .replace(/(^|[^\\])[{}]/g, "$1")
          .replace(/\s+/g, " ")
          .trim();
        out.push({ level: SECTION_LEVELS[m[1]], title: title || "(untitled)", file, line: lineAt(src, m.index), starred: m[2] === "*" });
      } else if (m[4] !== undefined) {
        const target = resolveInputPath(m[4], file, exists);
        if (target) walk(target, depth + 1);
      }
    }
    visiting.delete(file);
  };
  walk(main, 0);
  return out;
}

/** Name of the innermost environment still open before `offset`. */
export function innermostOpenEnv(textBefore: string): string | null {
  const stack: string[] = [];
  const re = /\\(begin|end)\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  const clean = stripComments(textBefore);
  while ((m = re.exec(clean))) {
    if (m[1] === "begin") stack.push(m[2]);
    else {
      const i = stack.lastIndexOf(m[2]);
      if (i >= 0) stack.splice(i);
    }
  }
  return stack.length ? stack[stack.length - 1] : null;
}

/** Folding ranges for \begin…\end blocks and sectioning commands (1-based lines). */
export function foldingRanges(src: string): { start: number; end: number }[] {
  const lines = src.split("\n");
  const ranges: { start: number; end: number }[] = [];
  const envStack: { name: string; line: number }[] = [];
  const secOpen: { level: number; line: number }[] = [];
  const closeSections = (level: number, atLine: number) => {
    while (secOpen.length && secOpen[secOpen.length - 1].level >= level) {
      const s = secOpen.pop()!;
      if (atLine - 1 > s.line) ranges.push({ start: s.line, end: atLine - 1 });
    }
  };
  lines.forEach((raw, i) => {
    const ln = i + 1;
    const l = stripComments(raw);
    const sec = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?[\s{[]/.exec(l);
    if (sec) {
      const level = SECTION_LEVELS[sec[1]];
      closeSections(level, ln);
      secOpen.push({ level, line: ln });
    }
    if (/\\end\s*\{document\}/.test(l)) closeSections(-1, ln);
    const re = /\\(begin|end)\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(l))) {
      if (m[1] === "begin") envStack.push({ name: m[2], line: ln });
      else {
        for (let k = envStack.length - 1; k >= 0; k--) {
          if (envStack[k].name === m[2]) {
            const b = envStack.splice(k)[0];
            if (ln > b.line && b.name !== "document") ranges.push({ start: b.line, end: ln });
            break;
          }
        }
      }
    }
  });
  closeSections(-1, lines.length + 1);
  return ranges;
}
