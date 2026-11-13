import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Image, ImagePlus, Merge, Sigma, Split, Table2 } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api, errorMessage } from "../services/api";
import { Modal } from "../components/Common";
import { allFiles, readProjectText, refreshTree, toast, ui, useApp } from "../app/store";
import { insertSnippet, getActiveEditor } from "../editor/activeEditor";
import { getModel } from "../editor/models";

/** Insert raw text (not a snippet) at the cursor of the active editor. */
function insertText(text: string) {
  const e = getActiveEditor();
  if (!e) return toast("warning", "Open a .tex file and place the cursor first");
  const sel = e.getSelection()!;
  e.pushUndoStop();
  e.executeEdits("qmaze-insert", [{ range: sel, text, forceMoveMarkers: true }]);
  e.pushUndoStop();
  e.focus();
}

function ensurePackage(pkg: string) {
  const main = useApp.getState().project?.meta.mainFile;
  if (!main) return;
  const m = getModel(main);
  const src = m?.getValue() ?? readProjectText(main) ?? "";
  if (new RegExp(`\\\\usepackage(\\[[^\\]]*\\])?\\{[^}]*\\b${pkg}\\b`).test(src)) return;
  if (!m) return toast("warning", `Add \\usepackage{${pkg}} to the preamble`);
  const lines = src.split("\n");
  const at = lines.findIndex((l) => l.startsWith("\\documentclass"));
  if (at < 0) return;
  m.pushEditOperations([], [{ range: { startLineNumber: at + 2, startColumn: 1, endLineNumber: at + 2, endColumn: 1 }, text: `\\usepackage{${pkg}}\n` }], () => null);
  toast("info", `Added \\usepackage{${pkg}} to ${main}`);
}

const esc = (s: string) => s.replace(/([&%$#_{}])/g, "\\$1");

// ---------------------------------------------------------------- table ----

interface Cell { text: string; span: number }

export function TableDesigner() {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [grid, setGrid] = useState<Cell[][]>(() => Array.from({ length: 4 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({ text: r === 0 ? `Header ${c + 1}` : "", span: 1 }))));
  const [align, setAlign] = useState<string[]>(["l", "c", "c"]);
  const [style, setStyle] = useState<"booktabs" | "grid" | "plain">("booktabs");
  const [env, setEnv] = useState<"tabular" | "tabularx" | "longtable">("tabular");
  const [header, setHeader] = useState(true);
  const [caption, setCaption] = useState("Caption.");
  const [label, setLabel] = useState("tab:results");
  const [escape, setEscape] = useState(true);
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [code, setCode] = useState("");
  const [edited, setEdited] = useState(false);

  const resize = (r: number, c: number) => {
    r = Math.max(1, Math.min(40, r));
    c = Math.max(1, Math.min(15, c));
    setGrid((g) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => g[i]?.[j] ?? { text: "", span: 1 })));
    setAlign((a) => Array.from({ length: c }, (_, j) => a[j] ?? "c"));
    setRows(r);
    setCols(c);
  };
  const generated = useMemo(() => {
    const spec = align.map((a) => (env === "tabularx" && a === "X" ? "X" : a)).join(style === "grid" ? "|" : "");
    const colspec = style === "grid" ? `|${spec}|` : spec;
    const hl = (k: "top" | "mid" | "bot" | "row") => (style === "booktabs" ? { top: "\\toprule", mid: "\\midrule", bot: "\\bottomrule", row: "" }[k] : style === "grid" ? "\\hline" : k === "mid" && header ? "\\hline" : "");
    const line = (row: Cell[], bold: boolean) => {
      const parts: string[] = [];
      for (let c = 0; c < row.length; ) {
        const cell = row[c];
        let t = escape ? esc(cell.text) : cell.text;
        if (bold && t) t = `\\textbf{${t}}`;
        parts.push(cell.span > 1 ? `\\multicolumn{${cell.span}}{${style === "grid" ? "|c|" : "c"}}{${t}}` : t);
        c += Math.max(1, cell.span);
      }
      return "    " + parts.join(" & ") + " \\\\";
    };
    const body: string[] = [];
    const top = hl("top");
    if (top) body.push("    " + top);
    grid.forEach((row, i) => {
      body.push(line(row, header && i === 0));
      if (i === 0 && header) {
        const m = hl("mid");
        if (m) body.push("    " + m);
      } else if (i < grid.length - 1 && style === "grid") body.push("    \\hline");
    });
    const bot = hl("bot");
    if (bot) body.push("    " + bot);
    const open = env === "tabularx" ? `\\begin{tabularx}{\\linewidth}{${colspec}}` : `\\begin{${env}}{${colspec}}`;
    if (env === "longtable") return `\\begin{longtable}{${colspec}}\n  \\caption{${caption}}\\label{${label}} \\\\\n${body.join("\n")}\n\\end{longtable}\n`;
    return `\\begin{table}[htbp]\n  \\centering\n  \\caption{${caption}}\n  \\label{${label}}\n  ${open}\n${body.join("\n")}\n  \\end{${env}}\n\\end{table}\n`;
  }, [grid, align, style, env, header, caption, label, escape]);
  useEffect(() => {
    if (!edited) setCode(generated);
  }, [generated, edited]);
  const setCell = (r: number, c: number, text: string) => setGrid((g) => g.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? { ...cell, text } : cell)) : row)));
  const merge = (d: 1 | -1) =>
    setGrid((g) => g.map((row, i) => (i !== sel[0] ? row : row.map((cell, j) => (j !== sel[1] ? cell : { ...cell, span: Math.max(1, Math.min(cols - j, cell.span + d)) })))));
  const insert = () => {
    if (style === "booktabs") ensurePackage("booktabs");
    if (env !== "tabular") ensurePackage(env);
    if (grid.some((r) => r.some((c) => c.span > 1)) && style !== "booktabs") {
      /* multicolumn is built in */
    }
    insertText(code);
    ui.closeDialog();
  };
  const hidden = (r: number, c: number) => grid[r].slice(0, c).some((cell, j) => j + cell.span > c);
  return (
    <Modal wide title="Table designer" icon={<Table2 size={20} color="var(--accent)" />} onClose={ui.closeDialog}
      footer={<><span className="hint grow">The generated code is editable before inserting.</span><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" onClick={insert}>Insert table</button></>}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <label className="row">Rows <input className="input" type="number" style={{ width: 64 }} value={rows} onChange={(e) => resize(+e.target.value, cols)} /></label>
        <label className="row">Columns <input className="input" type="number" style={{ width: 64 }} value={cols} onChange={(e) => resize(rows, +e.target.value)} /></label>
        <select className="select" value={style} onChange={(e) => setStyle(e.target.value as typeof style)}><option value="booktabs">Booktabs (journal style)</option><option value="grid">Full grid</option><option value="plain">Plain</option></select>
        <select className="select" value={env} onChange={(e) => setEnv(e.target.value as typeof env)}><option value="tabular">tabular</option><option value="tabularx">tabularx (full width)</option><option value="longtable">longtable (multi-page)</option></select>
        <label className="row"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Header row</label>
        <label className="row"><input type="checkbox" checked={escape} onChange={(e) => setEscape(e.target.checked)} /> Escape special characters</label>
        <button className="btn" onClick={() => merge(1)} title="Merge selected cell with the cell to its right"><Merge size={14} /> Merge →</button>
        <button className="btn" onClick={() => merge(-1)} title="Split merged cell"><Split size={14} /> Split</button>
      </div>
      <div className="tbl-designer" style={{ gridTemplateColumns: `repeat(${cols}, minmax(90px, 1fr))` }}>
        {align.map((a, j) => (
          <select key={"a" + j} className="select" value={a} onChange={(e) => setAlign(align.map((x, k) => (k === j ? e.target.value : x)))} title="Column alignment">
            <option value="l">Left</option><option value="c">Centre</option><option value="r">Right</option>{env === "tabularx" && <option value="X">Stretch (X)</option>}
          </select>
        ))}
        {grid.map((row, i) =>
          row.map((cell, j) =>
            hidden(i, j) ? null : (
              <input
                key={`${i}-${j}`}
                className={"input" + (sel[0] === i && sel[1] === j ? " cell-sel" : "") + (header && i === 0 ? " cell-head" : "")}
                style={{ gridColumn: `span ${cell.span}` }}
                value={cell.text}
                onFocus={() => setSel([i, j])}
                onChange={(e) => setCell(i, j, e.target.value)}
              />
            ),
          ),
        )}
      </div>
      <div className="row">
        <input className="input grow" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
        <input className="input mono" style={{ width: 200 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
      </div>
      <div className="field">
        <label>LaTeX code {edited && <button className="btn ghost" style={{ height: 20, padding: "0 6px" }} onClick={() => setEdited(false)}>Regenerate</button>}</label>
        <textarea className="input mono" style={{ minHeight: 150, padding: 8, fontSize: 12.5 }} value={code} onChange={(e) => { setCode(e.target.value); setEdited(true); }} spellCheck={false} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- equation ----

const SYMBOLS: [string, string][] = [
  ["\\frac{a}{b}", "\\frac{${1}}{${2}}"], ["\\sqrt{x}", "\\sqrt{${1}}"], ["x^{n}", "^{${1}}"], ["x_{i}", "_{${1}}"], ["\\sum_{i=1}^{n}", "\\sum_{${1:i=1}}^{${2:n}}"],
  ["\\int_{a}^{b}", "\\int_{${1:a}}^{${2:b}}"], ["\\lim_{x\\to 0}", "\\lim_{${1:x \\to 0}}"], ["\\partial", "\\partial"], ["\\nabla", "\\nabla"], ["\\infty", "\\infty"],
  ["\\alpha", "\\alpha"], ["\\beta", "\\beta"], ["\\gamma", "\\gamma"], ["\\theta", "\\theta"], ["\\lambda", "\\lambda"], ["\\mu", "\\mu"], ["\\sigma", "\\sigma"], ["\\omega", "\\omega"], ["\\Delta", "\\Delta"],
  ["\\leq", "\\leq"], ["\\geq", "\\geq"], ["\\neq", "\\neq"], ["\\approx", "\\approx"], ["\\pm", "\\pm"], ["\\times", "\\times"], ["\\cdot", "\\cdot"], ["\\in", "\\in"], ["\\rightarrow", "\\rightarrow"],
  ["\\hat{x}", "\\hat{${1}}"], ["\\bar{x}", "\\bar{${1}}"], ["\\vec{x}", "\\vec{${1}}"], ["\\mathbf{x}", "\\mathbf{${1}}"], ["\\mathbb{R}", "\\mathbb{R}"],
  ["\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}", "\\begin{bmatrix} ${1:a} & ${2:b} \\\\\\\\ ${3:c} & ${4:d} \\end{bmatrix}"],
  ["\\left( x \\right)", "\\left( ${1} \\right)"],
];

export function EquationDialog() {
  const [tex, setTex] = useState("y(t) = e^{-\\alpha t}\\cos(\\omega t)");
  const [kind, setKind] = useState<"inline" | "display" | "equation" | "align" | "multline">("equation");
  const [label, setLabel] = useState("eq:model");
  const html = useMemo(() => {
    try {
      const src = kind === "align" ? `\\begin{aligned}${tex}\\end{aligned}` : tex;
      return { ok: true, h: katex.renderToString(src, { displayMode: kind !== "inline", throwOnError: true, strict: "ignore" }) };
    } catch (e) {
      return { ok: false, h: String((e as Error).message).replace(/^KaTeX parse error: /, "") };
    }
  }, [tex, kind]);
  const addSym = (snippet: string) => setTex((t) => t + snippet.replace(/\$\{\d+:?([^}]*)\}/g, "$1").replace(/\\\\\\\\/g, "\\\\"));
  const insert = () => {
    const lbl = label.trim() ? `\n\t\\label{${label.trim()}}` : "";
    const out = {
      inline: `$${tex}$`,
      display: `\\[\n\t${tex}\n\\]\n`,
      equation: `\\begin{equation}\n\t${tex}${lbl}\n\\end{equation}\n`,
      align: `\\begin{align}\n\t${tex}${lbl}\n\\end{align}\n`,
      multline: `\\begin{multline}\n\t${tex}${lbl}\n\\end{multline}\n`,
    }[kind];
    if (kind === "align" || kind === "multline") ensurePackage("amsmath");
    insertText(out);
    ui.closeDialog();
  };
  return (
    <Modal wide title="Equation editor" icon={<Sigma size={20} color="var(--accent)" />} onClose={ui.closeDialog}
      footer={<><span className="hint grow">Preview by KaTeX; the final typesetting is done by LaTeX.</span><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" onClick={insert} disabled={!tex.trim()}>Insert</button></>}>
      <div className="sym-grid">
        {SYMBOLS.map(([shown, snip]) => (
          <button key={shown} className="sym" title={snip} onClick={() => addSym(snip)} dangerouslySetInnerHTML={{ __html: katex.renderToString(shown, { throwOnError: false }) }} />
        ))}
      </div>
      <textarea className="input mono" style={{ minHeight: 90, padding: 8 }} value={tex} onChange={(e) => setTex(e.target.value)} spellCheck={false} placeholder={kind === "align" ? "a &= b \\\\ c &= d" : "E = mc^2"} />
      <div className={"eq-preview" + (html.ok ? "" : " err")} dangerouslySetInnerHTML={html.ok ? { __html: html.h } : undefined}>{html.ok ? undefined : html.h}</div>
      <div className="row">
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="inline">Inline $…$</option><option value="display">Display \[…\] (unnumbered)</option><option value="equation">Numbered equation</option><option value="align">Aligned equations (use &amp; and \\)</option><option value="multline">Long equation (multline)</option>
        </select>
        {kind !== "inline" && kind !== "display" && <input className="input mono" style={{ width: 200 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- figure ----

export function FigureDialog() {
  useApp((s) => s.tree);
  const images = allFiles().filter((f) => (f.kind === "image" || (f.kind === "pdf" && !f.path.startsWith("output/"))) && !f.path.startsWith(".qmaze")).map((f) => f.path);
  const [picks, setPicks] = useState<string[]>(images.slice(0, 1));
  const [width, setWidth] = useState(80);
  const [place, setPlace] = useState("htbp");
  const [caption, setCaption] = useState("Caption.");
  const [label, setLabel] = useState("fig:result");
  const [subs, setSubs] = useState<string[]>([]);
  const multi = picks.length > 1;
  const addImages = async () => {
    const root = useApp.getState().project?.root;
    if (!root) return;
    const chosen = await openDialog({ title: "Add image(s) to the project", multiple: true, filters: [{ name: "Images LaTeX can include", extensions: ["png", "jpg", "jpeg", "pdf", "eps"] }] });
    const list = Array.isArray(chosen) ? chosen : chosen ? [chosen] : [];
    const added: string[] = [];
    for (const src of list) {
      try {
        added.push(await api.importFigure(root, src));
      } catch (e) {
        toast("error", "Could not add image", errorMessage(e));
      }
    }
    if (added.length) {
      await refreshTree();
      setPicks((p) => [...p, ...added]);
    }
  };
  const path = (p: string) => p.replace(/\.(png|jpe?g|pdf|eps)$/i, "");
  const code = multi
    ? `\\begin{figure}[${place}]\n  \\centering\n${picks
        .map((p, i) => `  \\begin{subfigure}{${(0.96 / picks.length).toFixed(2)}\\linewidth}\n    \\centering\n    \\includegraphics[width=\\linewidth]{${path(p)}}\n    \\caption{${subs[i] ?? ""}}\n    \\label{${label}-${String.fromCharCode(97 + i)}}\n  \\end{subfigure}`)
        .join("\\hfill\n")}\n  \\caption{${caption}}\n  \\label{${label}}\n\\end{figure}\n`
    : `\\begin{figure}[${place}]\n  \\centering\n  \\includegraphics[width=${(width / 100).toFixed(2)}\\linewidth]{${path(picks[0] ?? "figures/file")}}\n  \\caption{${caption}}\n  \\label{${label}}\n\\end{figure}\n`;
  const insert = () => {
    ensurePackage("graphicx");
    if (multi) ensurePackage("subcaption");
    insertText(code);
    ui.closeDialog();
  };
  return (
    <Modal wide title="Insert figure" icon={<Image size={20} color="var(--accent)" />} onClose={ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" onClick={insert} disabled={!picks.length}>Insert figure</button></>}>
      <div className="field">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <label>Image(s) — select two or more to create sub-figures</label>
          <button className="btn" onClick={addImages}><ImagePlus size={14} /> Add image from computer…</button>
        </div>
        {images.length === 0 && <div className="muted" style={{ fontSize: ".85rem" }}>No images in this project yet. Added images are copied into <code>figures/</code>; the originals are not moved.</div>}
        <div className="img-pick">
          {images.map((p) => (
            <label key={p} className={"img-opt" + (picks.includes(p) ? " on" : "")}>
              <input type="checkbox" checked={picks.includes(p)} onChange={(e) => setPicks(e.target.checked ? [...picks, p] : picks.filter((x) => x !== p))} />
              <span className="mono">{p}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {!multi && <label className="row">Width <input type="range" min={20} max={100} value={width} onChange={(e) => setWidth(+e.target.value)} /> <span className="mono">{width}% of line</span></label>}
        <label className="row">Placement <select className="select" value={place} onChange={(e) => setPlace(e.target.value)}><option value="htbp">Automatic (htbp)</option><option value="t">Top of page</option><option value="b">Bottom</option><option value="H">Exactly here (needs float)</option><option value="p">Separate page</option></select></label>
      </div>
      {multi && picks.map((p, i) => <input key={p} className="input" placeholder={`Sub-caption (${String.fromCharCode(97 + i)}) for ${p}`} value={subs[i] ?? ""} onChange={(e) => { const s = [...subs]; s[i] = e.target.value; setSubs(s); }} />)}
      <div className="row"><input className="input grow" value={caption} onChange={(e) => setCaption(e.target.value)} /><input className="input mono" style={{ width: 200 }} value={label} onChange={(e) => setLabel(e.target.value)} /></div>
      <pre className="log-view" style={{ margin: 0, border: "1px solid var(--border)", borderRadius: 8 }}>{code}</pre>
      {place === "H" && <div className="hint">Placement “H” requires \usepackage{"{float}"}.</div>}
    </Modal>
  );
}

export { insertSnippet };
