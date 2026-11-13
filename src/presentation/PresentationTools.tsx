import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPath } from "@tauri-apps/plugin-opener";
import { Expand, FileDown, Layers, Loader2, Monitor, Plus, X } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { allFiles, compile, openFile, ownerByline, readProjectText, toast, ui, useApp } from "../app/store";
import { getModel } from "../editor/models";
import { insertSnippet } from "../editor/activeEditor";
import { Modal } from "../components/Common";
import { parseFrames, setBeamerTheme, type ParsedSlide } from "./beamer";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const THEMES = ["metropolis", "Madrid", "CambridgeUS", "Copenhagen", "Warsaw", "Berlin", "Singapore", "Boadilla", "AnnArbor", "default"];
const COLORS = ["default", "beaver", "crane", "dolphin", "orchid", "seahorse", "whale", "wolverine", "spruce"];

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function useFrames(): ParsedSlide[] {
  const main = useApp((s) => s.project?.meta.mainFile);
  useApp((s) => s.dirtyTick);
  useApp((s) => s.outline);
  return useMemo(() => (main ? parseFrames(readProjectText(main) ?? "") : []), [main, useApp.getState().dirtyTick, useApp.getState().outline]);
}

export function SlidesPanel() {
  const project = useApp((s) => s.project)!;
  const hasPdf = useApp((s) => !!s.pdfData);
  const frames = useFrames();
  const src = readProjectText(project.meta.mainFile) ?? "";
  const theme = /\\usetheme(?:\[[^\]]*\])?\{([^}]*)\}/.exec(src)?.[1] ?? "default";
  const color = /\\usecolortheme\{([^}]*)\}/.exec(src)?.[1] ?? "default";
  const applyTheme = (t: string, c: string) => {
    const m = getModel(project.meta.mainFile);
    if (!m) return toast("warning", "Open the main file first");
    m.pushEditOperations([], [{ range: m.getFullModelRange(), text: setBeamerTheme(m.getValue(), t, c) }], () => null);
    void compile();
  };
  return (
    <div className="panel">
      <div className="panel-header">
        Slides <span className="badge" style={{ marginLeft: 6 }}>{frames.length}</span>
        <div className="actions">
          <button className="icon-btn" title="Insert a new frame at the cursor" onClick={() => insertSnippet("\\begin{frame}{${1:Title}}\n\t\\begin{itemize}\n\t\t\\item ${2:Point}\n\t\\end{itemize}\n\\end{frame}\n")}>
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="section-block" style={{ gap: 10 }}>
        <div className="row">
          <button className="btn primary grow" onClick={() => ui.openDialog("present")} disabled={!hasPdf}>
            <Monitor size={14} /> Present
          </button>
          <button className="btn grow" onClick={() => ui.openDialog("pptx")}>
            <FileDown size={14} /> PowerPoint
          </button>
        </div>
        <div className="row">
          <select className="select grow" value={THEMES.includes(theme) ? theme : "default"} onChange={(e) => applyTheme(e.target.value, color)} title="Beamer theme">
            {THEMES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="select grow" value={COLORS.includes(color) ? color : "default"} onChange={(e) => applyTheme(theme, e.target.value)} title="Colour theme">
            {COLORS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="panel-body">
        {frames.length === 0 && <div className="hint" style={{ padding: 16 }}>No \begin{"{frame}"} found in {project.meta.mainFile}.</div>}
        {frames.map((f, i) => (
          <div key={i} className="outline-item" style={{ paddingLeft: 10, height: "auto", minHeight: 30, padding: "5px 10px" }} onClick={() => openFile(project.meta.mainFile, { line: f.line })}>
            <span className="lvl">{i + 1}</span>
            <span className="t" style={{ fontWeight: f.isTitle ? 700 : 500 }}>
              {f.title || <i className="muted">untitled</i>}
              {f.overlays && <span className="badge" style={{ marginLeft: 6 }} title="Uses overlays (<1->, \pause)">steps</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PresentMode() {
  const data = useApp((s) => s.pdfData);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [black, setBlack] = useState(false);
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const canvas = useRef<HTMLCanvasElement>(null);
  const close = () => {
    getCurrentWindow().setFullscreen(false).catch(() => {});
    ui.closeDialog();
  };
  useEffect(() => {
    if (!data) return;
    getCurrentWindow().setFullscreen(true).catch(() => {});
    const task = pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false });
    task.promise.then(setDoc).catch((e) => toast("error", "Cannot present", String(e)));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      task.destroy();
    };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const n = doc?.numPages ?? 1;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n"].includes(e.key)) setPage((p) => Math.min(n, p + 1));
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p"].includes(e.key)) setPage((p) => Math.max(1, p - 1));
      else if (e.key === "Home") setPage(1);
      else if (e.key === "End") setPage(n);
      else if (e.key === "b" || e.key === ".") setBlack((b) => !b);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [doc]);
  useEffect(() => {
    let task: pdfjsLib.RenderTask | null = null;
    (async () => {
      if (!doc || !canvas.current) return;
      const pg = await doc.getPage(page);
      const vp1 = pg.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const scale = Math.min(window.innerWidth / vp1.width, window.innerHeight / vp1.height);
      const vp = pg.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${vp.width / dpr}px`;
      c.style.height = `${vp.height / dpr}px`;
      task = pg.render({ canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [doc, page]);
  const secs = Math.floor((now - t0) / 1000);
  return (
    <div className="present" onClick={() => doc && setPage((p) => Math.min(doc.numPages, p + 1))} onContextMenu={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}>
      <canvas ref={canvas} style={{ opacity: black ? 0 : 1 }} />
      <div className="present-hud" onClick={(e) => e.stopPropagation()}>
        <span>{page} / {doc?.numPages ?? "…"}</span>
        <span className="mono">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>
        <span className="muted">← → navigate · B blank · Esc exit</span>
        <button className="icon-btn" onClick={close} aria-label="Exit presentation"><X size={16} /></button>
      </div>
    </div>
  );
}

export function PptxDialog() {
  const project = useApp((s) => s.project)!;
  const pdf = useApp((s) => s.pdfData);
  const [mode, setMode] = useState<"exact" | "editable">("exact");
  const [busy, setBusy] = useState<string | null>(null);
  const frames = useFrames();
  const run = async () => {
    const stem = project.meta.name || "presentation";
    const dest = await saveDialog({ title: "Export PowerPoint", defaultPath: `${stem}.pptx`, filters: [{ name: "PowerPoint", extensions: ["pptx"] }] });
    if (!dest) return;
    try {
      let deck: Record<string, unknown>;
      if (mode === "exact") {
        if (!pdf) throw new Error("Compile the presentation first.");
        const doc = await pdfjsLib.getDocument({ data: pdf.slice(), isEvalSupported: false }).promise;
        const slides = [];
        let w = 0, h = 0;
        for (let i = 1; i <= doc.numPages; i++) {
          setBusy(`Rendering slide ${i} of ${doc.numPages}…`);
          const pg = await doc.getPage(i);
          const vp1 = pg.getViewport({ scale: 1 });
          if (i === 1) { w = vp1.width; h = vp1.height; }
          const vp = pg.getViewport({ scale: 1920 / vp1.width });
          const c = document.createElement("canvas");
          c.width = vp.width;
          c.height = vp.height;
          await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          slides.push({ fullImage: true, images: [{ data: c.toDataURL("image/png").split(",")[1] }] });
        }
        await doc.destroy();
        deck = { title: stem, author: ownerByline(), widthPt: w, heightPt: h, accent: "14235C", slides };
      } else {
        const files = allFiles().map((f) => f.path);
        const skipped: string[] = [];
        const slides = [];
        for (const f of frames) {
          const images = [];
          for (const im of f.images) {
            const hit = ["", ".png", ".jpg", ".jpeg", ".gif"].map((e) => im.replace(/^\.\//, "") + e).find((p) => files.includes(p) && /\.(png|jpe?g|gif)$/i.test(p));
            if (hit) images.push({ data: toBase64(await api.readBinary(project.root, hit)) });
            else skipped.push(im);
          }
          slides.push({ title: f.title || null, subtitle: f.isTitle ? f.subtitle ?? "" : null, bullets: f.bullets, images });
        }
        if (!slides.length) throw new Error("No frames found in the main file.");
        if (skipped.length) toast("warning", "Some images were not embedded", `PDF/EPS figures cannot be placed as editable pictures: ${skipped.join(", ")}. Use “Exact” mode to keep them.`);
        deck = { title: stem, author: ownerByline(), widthPt: 16, heightPt: 9, accent: "14235C", slides };
      }
      setBusy("Writing PowerPoint file…");
      const n = await api.exportPptx(deck, dest);
      toast("success", `PowerPoint exported (${n} slides)`, dest);
      ui.closeDialog();
      openPath(dest).catch(() => {});
    } catch (e) {
      toast("error", "Export failed", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal title="Export as PowerPoint (.pptx)" icon={<Layers size={20} color="var(--accent)" />} onClose={busy ? undefined : ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog} disabled={!!busy}>Cancel</button><button className="btn primary" onClick={run} disabled={!!busy || (mode === "exact" && !pdf)}>{busy ? <><Loader2 size={14} className="spin" /> {busy}</> : "Export…"}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button className={"choice-card" + (mode === "exact" ? " selected" : "")} onClick={() => setMode("exact")}>
          <Expand size={22} color="var(--accent)" />
          <span><div className="ct">Exact</div><div className="cd">Every page of the compiled PDF becomes a full-slide picture. Looks identical — equations, themes, TikZ — but text is not editable.</div></span>
        </button>
        <button className={"choice-card" + (mode === "editable" ? " selected" : "")} onClick={() => setMode("editable")}>
          <Layers size={22} color="var(--accent)" />
          <span><div className="ct">Editable</div><div className="cd">Frame titles and bullet points become native PowerPoint text; PNG/JPEG figures are placed as pictures. Layout is simplified.</div></span>
        </button>
      </div>
      {mode === "exact" && !pdf && <div className="callout warn">Compile the presentation first — Exact mode uses the compiled PDF.</div>}
      {mode === "exact" && <div className="hint">Overlay steps (<code>\pause</code>, <code>&lt;2-&gt;</code>) become separate slides, as in the PDF.</div>}
      {mode === "editable" && <div className="hint">{frames.length} frames found. Overlays are flattened; maths is converted to plain text (e.g. α ≤ 2); tables and TikZ are not converted.</div>}
    </Modal>
  );
}
