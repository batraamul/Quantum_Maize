// Beamer source → slide outline (titles, bullet hierarchy, images). Used for
// the editable PowerPoint export and the Slides panel. Pure; unit-tested.

import { readGroup, stripComments } from "../editor/projectIndex";

export interface ParsedSlide {
  line: number;
  title: string;
  subtitle?: string;
  bullets: { level: number; text: string }[];
  images: string[];
  isTitle: boolean;
  overlays: boolean;
}

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω", infty: "∞", times: "×", cdot: "·", pm: "±", leq: "≤",
  geq: "≥", neq: "≠", approx: "≈", rightarrow: "→", Rightarrow: "⇒", to: "→", sum: "∑", int: "∫", partial: "∂", nabla: "∇",
  cos: " cos", sin: " sin", tan: " tan", log: " log", ln: " ln", exp: " exp", max: " max", min: " min", lim: " lim", det: " det", arg: " arg",
};

/** Turn a LaTeX fragment into readable plain text. */
export function detex(s: string): string {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(/\\(?:textbf|textit|emph|underline|texttt|textsc|textrm|textsf|mathrm|mathbf|mathit|text|alert|structure|url|mbox|hl)\s*(?:<[^>]*>)?\{([^{}]*)\}/g, "$1");
  t = t.replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1");
  t = t.replace(/\\(?:label|ref|eqref|cite[pt]?|footnote|pause|vfill|centering|hfill|vspace\*?|hspace\*?|onslide|uncover|only)\s*(?:<[^>]*>)?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, (m) => (m.startsWith("\\ref") || m.startsWith("\\eqref") ? "(ref)" : m.startsWith("\\cite") ? "[ref]" : ""));
  t = t.replace(/\\([a-zA-Z]+)/g, (_m, c) => GREEK[c] ?? (["LaTeX", "TeX"].includes(c) ? c : ""));
  t = t.replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, "");
  t = t.replace(/\\[%&#_$]/g, (m) => m[1]).replace(/~/g, " ").replace(/[{}]/g, "").replace(/\\\\/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

function lineAt(src: string, idx: number) {
  return src.slice(0, idx).split("\n").length;
}

function preambleField(src: string, cmd: string): string {
  const m = new RegExp(`\\\\${cmd}\\s*(?:\\[[^\\]]*\\])?\\s*\\{`).exec(src);
  if (!m) return "";
  const g = readGroup(src, m.index + m[0].length - 1);
  return g ? detex(g.text) : "";
}

export function isBeamer(src: string): boolean {
  return /\\documentclass\s*(\[[^\]]*\])?\s*\{beamer\}/.test(stripComments(src));
}

/** Parse frames from a (flattened) Beamer document. */
export function parseFrames(source: string): ParsedSlide[] {
  const src = stripComments(source);
  const out: ParsedSlide[] = [];
  // Pre-collect section titles so \tableofcontents can list later sections.
  const sections: string[] = [];
  for (const sm of src.matchAll(/\\section\*?\s*(?:\[[^\]]*\])?\s*\{/g)) {
    const g = readGroup(src, sm.index! + sm[0].length - 1);
    if (g) sections.push(detex(g.text));
  }
  const re = /\\begin\{frame\}/g;
  let m: RegExpExecArray | null;
  const docTitle = preambleField(src, "title");
  const docSub = [preambleField(src, "subtitle"), preambleField(src, "author"), preambleField(src, "institute")].filter(Boolean).join(" · ");
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf("\\end{frame}", start);
    if (end < 0) break;
    let body = src.slice(start, end);
    re.lastIndex = end;
    // Options [..] then optional {title}{subtitle}
    let title = "";
    let subtitle: string | undefined;
    let k = 0;
    const skipWs = () => {
      while (k < body.length && /\s/.test(body[k])) k++;
    };
    skipWs();
    if (body[k] === "<") k = body.indexOf(">", k) + 1;
    skipWs();
    if (body[k] === "[") k = body.indexOf("]", k) + 1;
    skipWs();
    if (body[k] === "{") {
      const g = readGroup(body, k);
      if (g) {
        title = detex(g.text);
        k = g.end + 1;
        if (body[k] === "{") {
          const g2 = readGroup(body, k);
          if (g2) {
            subtitle = detex(g2.text);
            k = g2.end + 1;
          }
        }
      }
    }
    body = body.slice(k);
    const ft = /\\frametitle\s*(?:<[^>]*>)?\s*\{/.exec(body);
    if (ft) {
      const g = readGroup(body, ft.index + ft[0].length - 1);
      if (g) title = detex(g.text);
    }
    const fs = /\\framesubtitle\s*\{/.exec(body);
    if (fs) {
      const g = readGroup(body, fs.index + fs[0].length - 1);
      if (g) subtitle = detex(g.text);
    }
    const slide: ParsedSlide = { line: lineAt(src, m.index), title, subtitle, bullets: [], images: [], isTitle: false, overlays: /<\d|\\pause|\\only|\\uncover|\\onslide/.test(body) };
    if (/\\titlepage|\\maketitle/.test(body)) {
      slide.isTitle = true;
      slide.title = docTitle || title;
      slide.subtitle = docSub || subtitle;
      out.push(slide);
      continue;
    }
    for (const im of body.matchAll(/\\includegraphics\s*(?:<[^>]*>)?\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) slide.images.push(im[1].trim());
    if (/\\tableofcontents/.test(body)) slide.bullets.push(...sections.map((s) => ({ level: 0, text: s })));
    // Lists, blocks and plain text, line by line.
    let depth = -1;
    let pendingBlock: string | null = null;
    for (const raw of body.split("\n")) {
      const l = raw.trim();
      if (!l) continue;
      const b = /\\begin\{(itemize|enumerate|description)\}/.exec(l);
      if (b) {
        depth++;
        continue;
      }
      if (/\\end\{(itemize|enumerate|description)\}/.test(l)) {
        depth = Math.max(-1, depth - 1);
        continue;
      }
      const blk = /\\begin\{(block|alertblock|exampleblock)\}\s*(?:<[^>]*>)?\s*\{([^}]*)\}/.exec(l);
      if (blk) {
        pendingBlock = detex(blk[2]);
        if (pendingBlock) slide.bullets.push({ level: 0, text: pendingBlock });
        continue;
      }
      if (/\\end\{(block|alertblock|exampleblock)\}/.test(l)) {
        pendingBlock = null;
        continue;
      }
      const item = /^\\item\s*(?:<[^>]*>)?\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(l);
      if (item) {
        const label = item[1] ? detex(item[1]) + ": " : "";
        const text = detex(label + item[2]);
        if (text) slide.bullets.push({ level: Math.max(0, depth), text });
        continue;
      }
      if (/^\\(begin|end)\{|^\\(includegraphics|frametitle|framesubtitle|tableofcontents|column|centering|vfill|pause|label|toprule|midrule|bottomrule|hline)/.test(l)) continue;
      if (/&|\\\\\s*$/.test(l) && /\\begin\{tabular/.test(body)) {
        // Table row → one text line with cells separated by " | ".
        const row = l.replace(/\\\\\s*$/, "").split(/(?<!\\)&/).map((c) => detex(c)).filter(Boolean).join("  |  ");
        if (row) slide.bullets.push({ level: 0, text: row });
        continue;
      }
      const text = detex(l);
      if (text && text.length > 1) {
        if (depth >= 0 && slide.bullets.length) slide.bullets[slide.bullets.length - 1].text += " " + text;
        else slide.bullets.push({ level: pendingBlock ? 1 : 0, text });
      }
    }
    out.push(slide);
  }
  return out;
}

/** Replace (or insert) \usetheme / \usecolortheme in a Beamer preamble. */
export function setBeamerTheme(src: string, theme: string, color: string): string {
  let s = src;
  if (/\\usetheme(\[[^\]]*\])?\{[^}]*\}/.test(s)) s = s.replace(/\\usetheme(\[[^\]]*\])?\{[^}]*\}/, `\\usetheme{${theme}}`);
  else s = s.replace(/(\\documentclass[^\n]*\n)/, `$1\\usetheme{${theme}}\n`);
  s = s.replace(/\\usecolortheme\{[^}]*\}\n?/g, "");
  if (color && color !== "default") s = s.replace(/(\\usetheme\{[^}]*\}\n?)/, `$1\\usecolortheme{${color}}\n`);
  return s;
}
