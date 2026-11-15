// Notebooks: a shelf of notebooks kept as JSON files in a folder the user chooses,
// and a page editor with selectable paper styles.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, BookOpen, CheckSquare, Code2, FolderOpen, GripVertical, Heading, Image as ImageIcon, Lightbulb, List, Minus, Palette, Plus, Search, Table2, Trash2, Type, X,
} from "lucide-react";
import { api, errorMessage } from "../services/api";
import { confirm, ownerByline, toast, ui, updateSettings, useApp } from "../app/store";
import { Modal } from "../components/Common";
import type { NotebookInfo } from "../types";
import { COVER_THEMES, coverUri } from "./covers";
import { BLOCK_LABEL, FONTS, PAPER_COLORS, PAPER_STYLES, blockSize, canAlign, canResize, fileNameFor, moveBlock, newBlock, newNotebook, newPage, pageText, parseNotebook, resized } from "./model";
import type { Align, Block, BlockType, Notebook, Page } from "./model";

export function NotebooksView() {
  const dir = useApp((s) => s.settings?.notebooksDir ?? null);
  const [list, setList] = useState<NotebookInfo[] | null>(null);
  const [open, setOpen] = useState<{ file: string; nb: Notebook } | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    if (!dir) return setList(null);
    try {
      setList(await api.notebooksList());
    } catch (e) {
      setList([]);
      toast("error", "Could not read the notebooks folder", errorMessage(e));
    }
  }, [dir]);
  useEffect(() => { void reload(); }, [reload]);

  const chooseFolder = async () => {
    const d = await openDialog({ directory: true, title: "Choose a folder for your notebooks", defaultPath: dir ?? undefined });
    if (typeof d === "string") await updateSettings({ notebooksDir: d });
  };
  const openNotebook = async (file: string) => {
    try {
      setOpen({ file, nb: parseNotebook(await api.notebookRead(file)) });
    } catch (e) {
      toast("error", "Could not open notebook", errorMessage(e));
    }
  };
  const remove = async (n: NotebookInfo) => {
    const c = await confirm("Remove notebook", `Move “${n.title}” to the .qm-trash folder inside your notebooks folder? You can move it back by hand.`, [{ id: "cancel", label: "Cancel" }, { id: "go", label: "Move to trash", variant: "danger" }]);
    if (c !== "go") return;
    try {
      await api.notebookTrash(n.file);
      await reload();
    } catch (e) {
      toast("error", "Could not remove notebook", errorMessage(e));
    }
  };

  if (open) return <NotebookEditor key={open.file} file={open.file} initial={open.nb} onClose={() => { setOpen(null); void reload(); }} />;

  const shown = (list ?? []).filter((n) => !q.trim() || `${n.title} ${n.subject}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="nb-root">
      <div className="nb-top">
        <button className="btn" onClick={ui.closeDialog}><ArrowLeft size={15} /> Back</button>
        <BookOpen size={20} color="var(--accent)" />
        <b style={{ fontSize: "1.1rem" }}>Notebooks</b>
        <div className="grow" />
        {dir && <span className="nb-search"><Search size={14} /><input placeholder="Search notebooks" value={q} onChange={(e) => setQ(e.target.value)} /></span>}
        {dir && <button className="btn" title={dir} onClick={chooseFolder}><FolderOpen size={15} /> Folder</button>}
        {dir && <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} /> New notebook</button>}
      </div>
      {!dir ? (
        <div className="nb-empty">
          <BookOpen size={46} color="var(--accent)" />
          <h2>Choose where to keep your notebooks</h2>
          <p>Each notebook is saved as one <code>.qmnote.json</code> file in the folder you pick, with its pictures inside. Nothing is uploaded.</p>
          <button className="btn primary" onClick={chooseFolder}><FolderOpen size={15} /> Choose folder…</button>
        </div>
      ) : (
        <div className="nb-shelf-wrap">
          <div className="muted" style={{ fontSize: ".85rem", marginBottom: 14 }}>Saved in <code>{dir}</code></div>
          <div className="nb-shelf">
            {shown.map((n) => (
              <div key={n.file} className="nb-book" onClick={() => openNotebook(n.file)} title={n.file}>
                <img src={coverUri(n.cover, n.title, n.subject, "", n.color)} alt="" />
                <div className="nb-meta">{n.pages} page{n.pages === 1 ? "" : "s"}{n.updated ? ` · ${new Date(n.updated).toLocaleDateString()}` : ""}</div>
                <button className="nb-del" title="Move to trash" onClick={(e) => { e.stopPropagation(); void remove(n); }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="nb-book nb-new" onClick={() => setCreating(true)}><Plus size={30} /><span>New notebook</span></button>
          </div>
          {list && list.length === 0 && <p className="muted" style={{ marginTop: 18 }}>No notebooks in this folder yet.</p>}
        </div>
      )}
      {creating && <NewNotebookDialog onClose={() => setCreating(false)} onCreated={(file, nb) => { setCreating(false); setOpen({ file, nb }); }} />}
    </div>
  );
}

function StylePickers({ paper, onChange }: { paper: Notebook["paper"]; onChange: (p: Notebook["paper"]) => void }) {
  return (
    <>
      <label className="field grow"><span className="label">Page style</span>
        <select className="select" value={paper.style} onChange={(e) => onChange({ ...paper, style: e.target.value })}>{PAPER_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="field grow"><span className="label">Page colour</span>
        <select className="select" value={paper.color} onChange={(e) => onChange({ ...paper, color: e.target.value })}>{PAPER_COLORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="field grow"><span className="label">Writing style</span>
        <select className="select" value={paper.font} onChange={(e) => onChange({ ...paper, font: e.target.value })}>{FONTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    </>
  );
}

function CoverPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="nb-covers">
      {COVER_THEMES.map((t) => (
        <button key={t.id} className={"nb-cover-opt" + (value === t.id ? " selected" : "")} onClick={() => onChange(t.id)} title={t.label}>
          <img src={coverUri(t.id, t.label, "")} alt={t.label} />
        </button>
      ))}
    </div>
  );
}

function NewNotebookDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (file: string, nb: Notebook) => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [theme, setTheme] = useState("aviation");
  const [paper, setPaper] = useState<Notebook["paper"]>({ style: "ruled", color: "cream", font: "sans" });
  const [busy, setBusy] = useState(false);
  const owner = ownerByline();
  const create = async () => {
    setBusy(true);
    try {
      const nb = newNotebook({ title, subject, owner, theme, color: "", style: paper.style, paper: paper.color, font: paper.font });
      const file = fileNameFor(nb);
      await api.notebookWrite(file, JSON.stringify(nb, null, 1), true);
      onCreated(file, nb);
    } catch (e) {
      toast("error", "Could not create notebook", errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="New notebook" wide icon={<BookOpen size={20} color="var(--accent)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !title.trim()} onClick={create}>Create notebook</button></>}>
      <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
        <img className="nb-preview" src={coverUri(theme, title || "Notebook title", subject, owner)} alt="Cover preview" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="field"><label>Title</label><input className="input" autoFocus value={title} placeholder="e.g. Flight Control Laws" onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>Subject (optional)</label><input className="input" value={subject} placeholder="e.g. Course, project or volume" onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="field"><label>Cover — {COVER_THEMES.length} themes</label><CoverPicker value={theme} onChange={setTheme} /></div>
          <div className="row" style={{ flexWrap: "wrap" }}><StylePickers paper={paper} onChange={setPaper} /></div>
        </div>
      </div>
    </Modal>
  );
}

// ---- editor -------------------------------------------------------------------------

type TextKeys = (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

function AutoText({ value, onChange, placeholder, className, style, onKeyDown }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; style?: CSSProperties; onKeyDown?: TextKeys }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const el = ref.current; if (el) { el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(fit);
  useEffect(() => { window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);
  return <textarea ref={ref} rows={1} className={"nb-ta " + (className ?? "")} style={style} value={value} placeholder={placeholder} spellCheck onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />;
}

/** Where the text baseline falls in a line of the given font, as a fraction of the font size
 *  below the middle of the line. Measured, because it differs between fonts and platforms;
 *  it is what lets writing sit exactly on the ruled lines. */
function baselineFactor(fontFamily: string): number {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;font-size:100px;line-height:100px;white-space:nowrap";
  d.style.fontFamily = fontFamily;
  d.innerHTML = 'x<span style="display:inline-block;width:1px;height:0;vertical-align:baseline"></span>';
  document.body.appendChild(d);
  const k = ((d.lastElementChild as HTMLElement).offsetTop - 50) / 100;
  d.remove();
  return Number.isFinite(k) && k > 0.1 && k < 0.6 ? k : 0.36;
}

/** Downscales a picked image and returns it as a data URI (kept inside the notebook JSON). */
async function fileToDataUri(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("This file is not an image the app can read.")); i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const png = c.toDataURL("image/png");
    const jpg = c.toDataURL("image/jpeg", 0.86);
    // Keep PNG for diagrams/screenshots unless JPEG is much smaller (photographs).
    return file.type === "image/png" && png.length < jpg.length * 2.5 ? png : jpg;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A picture on the page. Its box is rounded up to whole ruled lines so the writing below stays on the lines.
 *  Drag the picture to move it; drag the corner to resize it. */
function ImageFrame({ b, onChange, onGrab }: { b: Block; onChange: (b: Block) => void; onGrab: (e: React.PointerEvent) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null);
  const width = live ?? b.width ?? 70;
  useEffect(() => {
    const el = box.current, inner = frame.current;
    if (!el || !inner) return;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(el).getPropertyValue("--lh")) || 30;
      el.style.height = `${Math.max(1, Math.ceil((inner.offsetHeight + 8) / lh)) * lh}px`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    fit();
    return () => ro.disconnect();
  }, []);
  const resize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const total = box.current?.clientWidth || 1;
    const start = frame.current?.offsetWidth || 1;
    const x0 = e.clientX;
    const align = b.align ?? "center";
    const gain = align === "center" ? 2 : align === "right" ? -1 : 1; // centred pictures grow on both sides
    let w = b.width ?? 70;
    const mv = (ev: PointerEvent) => { w = Math.min(100, Math.max(10, Math.round(((start + (ev.clientX - x0) * gain) / total) * 100))); setLive(w); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setLive(null); onChange({ ...b, width: w }); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };
  return (
    <div ref={box} className="nb-img-box">
      <div ref={frame} className="nb-img-frame" style={{ width: `${width}%` }}>
        <img src={b.src} alt={b.caption ?? ""} draggable={false} onPointerDown={onGrab} title="Drag to move" />
        <span className={"nb-img-grip" + ((b.align ?? "center") === "right" ? " left" : "")} onPointerDown={resize} title="Drag to resize" />
        {live !== null && <span className="nb-img-size">{live}%</span>}
      </div>
    </div>
  );
}

function BlockView({ b, onChange, onGrab, keys }: { b: Block; onChange: (b: Block) => void; onGrab: (e: React.PointerEvent) => void; keys: TextKeys }) {
  const pick = useRef<HTMLInputElement>(null);
  const setItems = (items: Block["items"]) => onChange({ ...b, items });
  switch (b.type) {
    case "heading":
      return <AutoText className={"nb-h nb-h" + b.level} value={b.text ?? ""} placeholder="Heading" onChange={(text) => onChange({ ...b, text })} onKeyDown={keys} />;
    case "text":
      return <AutoText value={b.text ?? ""} placeholder="Write here…" onChange={(text) => onChange({ ...b, text })} onKeyDown={keys} />;
    case "code":
      return <AutoText className="nb-code" value={b.text ?? ""} placeholder="Code, commands or formulae" onChange={(text) => onChange({ ...b, text })} />;
    case "callout":
      return (
        <div className={"nb-callout k-" + b.kind}>
          <select value={b.kind} onChange={(e) => onChange({ ...b, kind: e.target.value as Block["kind"] })} aria-label="Callout type">
            <option value="note">Note</option><option value="important">Important</option><option value="idea">Idea</option><option value="question">Question</option>
          </select>
          <AutoText value={b.text ?? ""} placeholder="Something to remember" onChange={(text) => onChange({ ...b, text })} />
        </div>
      );
    case "divider":
      return <hr className="nb-hr" />;
    case "bullets":
    case "checklist": {
      const items = b.items ?? [];
      return (
        <div className="nb-list">
          {items.map((it, i) => (
            <div key={i} className={"nb-li" + (it.done ? " done" : "")}>
              {b.type === "checklist" ? <input type="checkbox" checked={!!it.done} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} /> : <span className="dot">•</span>}
              <AutoText value={it.text} placeholder="List item" onChange={(text) => setItems(items.map((x, j) => (j === i ? { ...x, text } : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setItems([...items.slice(0, i + 1), { text: "", done: false }, ...items.slice(i + 1)]);
                    const li = e.currentTarget.closest(".nb-li");
                    setTimeout(() => (li?.nextElementSibling?.querySelector("textarea") as HTMLTextAreaElement | null)?.focus(), 30);
                  } else if (e.key === "Backspace" && it.text === "" && items.length > 1) {
                    e.preventDefault();
                    const prev = e.currentTarget.closest(".nb-li")?.previousElementSibling?.querySelector("textarea") as HTMLTextAreaElement | null;
                    setItems(items.filter((_, j) => j !== i));
                    setTimeout(() => prev?.focus(), 30);
                  }
                }} />
            </div>
          ))}
        </div>
      );
    }
    case "table": {
      const rows = b.rows ?? [[""]];
      const set = (r: number, c: number, v: string) => onChange({ ...b, rows: rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
      return (
        <table className="nb-table"><tbody>
          {rows.map((row, r) => (
            <tr key={r} className={b.header && r === 0 ? "head" : ""}>{row.map((cell, c) => <td key={c}><AutoText value={cell} onChange={(v) => set(r, c, v)} /></td>)}</tr>
          ))}
        </tbody></table>
      );
    }
    case "image": {
      const load = async (f?: File | null) => {
        if (!f) return;
        try {
          onChange({ ...b, src: await fileToDataUri(f) });
        } catch (e) {
          toast("error", "Could not add image", errorMessage(e));
        }
      };
      return (
        <div className="nb-img" data-replace="" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files[0]); }}>
          <input ref={pick} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} />
          {b.src ? <ImageFrame b={b} onChange={onChange} onGrab={onGrab} /> : <button className="nb-img-pick" onClick={() => pick.current?.click()}><ImageIcon size={22} /> Choose an image, or drop one here</button>}
          {(b.src || b.caption) && <AutoText className="nb-cap" value={b.caption ?? ""} placeholder="Caption (optional)" onChange={(caption) => onChange({ ...b, caption })} />}
        </div>
      );
    }
  }
}

const ALIGN_ICON = { left: <AlignLeft size={14} />, center: <AlignCenter size={14} />, right: <AlignRight size={14} />, justify: <AlignJustify size={14} /> };

/** The small toolbar that appears above the block being edited. */
function BlockBar({ b, onChange, onMove, onDelete }: { b: Block; onChange: (b: Block) => void; onMove: (d: number) => void; onDelete: () => void }) {
  const rows = b.rows ?? [[""]];
  const align = b.align ?? (b.type === "image" ? "center" : "left");
  return (
    <div className="nb-bar" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault(); }}>
      {canResize(b) && <>
        <button title={b.type === "image" ? "Smaller picture" : "Smaller text"} onClick={() => onChange(resized(b, -1))}>A<sub>−</sub></button>
        <button title={b.type === "image" ? "Larger picture" : "Larger text"} onClick={() => onChange(resized(b, 1))}><b>A</b><sup>+</sup></button>
        <i />
      </>}
      {canAlign(b) && <>
        {(["left", "center", "right", "justify"] as Align[]).filter((a) => !(b.type === "image" && a === "justify")).map((a) => (
          <button key={a} className={align === a ? "on" : ""} title={`Align ${a}`} onClick={() => onChange({ ...b, align: a })}>{ALIGN_ICON[a]}</button>
        ))}
        <i />
      </>}
      {b.type === "image" && b.src && <><button className="w" title="Choose a different picture" onClick={(e) => (e.currentTarget.closest(".nb-block")?.querySelector("input[type=file]") as HTMLInputElement | null)?.click()}>Replace</button><i /></>}
      {b.type === "table" && <>
        <button className="w" title="Add a row" onClick={() => onChange({ ...b, rows: [...rows, rows[0].map(() => "")] })}>+Row</button>
        <button className="w" title="Add a column" onClick={() => onChange({ ...b, rows: rows.map((r) => [...r, ""]) })}>+Col</button>
        <button className="w" title="Remove the last row" disabled={rows.length < 2} onClick={() => onChange({ ...b, rows: rows.slice(0, -1) })}>−Row</button>
        <button className="w" title="Remove the last column" disabled={rows[0].length < 2} onClick={() => onChange({ ...b, rows: rows.map((r) => r.slice(0, -1)) })}>−Col</button>
        <label title="Show the first row as a header"><input type="checkbox" checked={!!b.header} onChange={(e) => onChange({ ...b, header: e.target.checked })} /> Header</label>
        <i />
      </>}
      <button title="Move up" onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
      <button title="Move down" onClick={() => onMove(1)}><ArrowDown size={14} /></button>
      <button title="Delete" className="del" onClick={onDelete}><Trash2 size={14} /></button>
    </div>
  );
}

const INSERT: { type: BlockType; icon: ReactNode }[] = [
  { type: "heading", icon: <Heading size={15} /> }, { type: "text", icon: <Type size={15} /> }, { type: "bullets", icon: <List size={15} /> },
  { type: "checklist", icon: <CheckSquare size={15} /> }, { type: "table", icon: <Table2 size={15} /> }, { type: "image", icon: <ImageIcon size={15} /> },
  { type: "code", icon: <Code2 size={15} /> }, { type: "callout", icon: <Lightbulb size={15} /> }, { type: "divider", icon: <Minus size={15} /> },
];

function NotebookEditor({ file, initial, onClose }: { file: string; initial: Notebook; onClose: () => void }) {
  const [nb, setNb] = useState(initial);
  const [pageId, setPageId] = useState(initial.pages[0].id);
  const [state, setState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [styleOpen, setStyleOpen] = useState(false);
  const [q, setQ] = useState("");
  const latest = useRef(nb);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const activeId = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const [k, setK] = useState(0.36);

  const save = useCallback(async () => {
    if (!dirty.current) return true;
    dirty.current = false;
    setState("saving");
    try {
      await api.notebookWrite(file, JSON.stringify({ ...latest.current, updated: new Date().toISOString() }, null, 1), false);
      if (!dirty.current) setState("saved");
      return true;
    } catch (e) {
      dirty.current = true;
      setState("error");
      toast("error", "Could not save notebook", errorMessage(e));
      return false;
    }
  }, [file]);

  const update = (fn: (n: Notebook) => Notebook) => {
    setNb((cur) => {
      const next = fn(cur);
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setState("unsaved");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 900);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); void save(); }, [save]);

  const page = nb.pages.find((p) => p.id === pageId) ?? nb.pages[0];
  const setPage = (fn: (p: Page) => Page) => update((n) => ({ ...n, pages: n.pages.map((p) => (p.id === page.id ? fn(p) : p)) }));
  const setBlocks = (fn: (b: Block[]) => Block[]) => setPage((p) => ({ ...p, blocks: fn(p.blocks) }));
  const focusBlock = (id: string, atEnd = false) => window.setTimeout(() => {
    const el = document.querySelector(`[data-block="${id}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = el?.querySelector("textarea, input:not([type=file]):not([type=checkbox]), button.nb-img-pick") as HTMLElement | null;
    t?.focus();
    if (atEnd && t instanceof HTMLTextAreaElement) t.setSelectionRange(t.value.length, t.value.length);
  }, 60);
  /** Adds a block after the one being edited (or at the end of the page) and puts the cursor in it. */
  const insertAfter = (b: Block, afterId = activeId.current) => {
    setBlocks((bs) => { const i = bs.findIndex((x) => x.id === afterId); return i < 0 ? [...bs, b] : [...bs.slice(0, i + 1), b, ...bs.slice(i + 1)]; });
    activeId.current = b.id;
    focusBlock(b.id);
  };
  const insert = (type: BlockType) => insertAfter(newBlock(type));
  const move = (i: number, d: number) => setBlocks((bs) => { const j = i + d; if (j < 0 || j >= bs.length) return bs; const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  // Drag a block (by its handle, or a picture by itself) to another place on the page.
  const grab = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    const desk = document.querySelector(".nb-desk") as HTMLElement | null;
    let active = false, y = y0, raf = 0;
    const indexAt = (py: number) => {
      const els = Array.from(document.querySelectorAll(".nb-paper > .nb-block"));
      let i = 0;
      for (; i < els.length; i++) { const r = els[i].getBoundingClientRect(); if (py < r.top + r.height / 2) break; }
      return i;
    };
    const tick = () => {
      if (desk) { const r = desk.getBoundingClientRect(); const d = y < r.top + 80 ? -16 : y > r.bottom - 80 ? 16 : 0; if (d) { desk.scrollTop += d; setDrag({ id, over: indexAt(y) }); } }
      raf = requestAnimationFrame(tick);
    };
    const mv = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        active = true;
        document.body.classList.add("nb-dragging");
        raf = requestAnimationFrame(tick);
      }
      y = ev.clientY;
      setDrag({ id, over: indexAt(y) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      document.body.classList.remove("nb-dragging");
      if (active && ev.type === "pointerup") { const to = indexAt(ev.clientY); setBlocks((bs) => moveBlock(bs, id, to)); }
      setDrag(null);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Enter after a heading starts a paragraph; Backspace in an empty paragraph removes it, as on paper you just carry on.
  const keysFor = (b: Block, i: number): TextKeys => (e) => {
    if (b.type === "heading" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertAfter(newBlock("text"), b.id);
    } else if (e.key === "Backspace" && (b.text ?? "") === "" && page.blocks.length > 1) {
      e.preventDefault();
      const prev = page.blocks[i - 1] ?? page.blocks[i + 1];
      setBlocks((bs) => bs.filter((x) => x.id !== b.id));
      if (prev) focusBlock(prev.id, true);
    }
  };
  // Clicking the empty part of the page continues writing at the end.
  // (Only when the press also began on the empty page: releasing a drag over the page is not a click on it.)
  const pressedOnPaper = useRef(false);
  const paperClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || !pressedOnPaper.current) return;
    const last = page.blocks[page.blocks.length - 1];
    if (last && last.type === "text") focusBlock(last.id, true);
    else insertAfter(newBlock("text"), last?.id ?? null);
  };
  const addPage = () => { const p = newPage(`Page ${nb.pages.length + 1}`); update((n) => ({ ...n, pages: [...n.pages, p] })); setPageId(p.id); };
  useEffect(() => { document.querySelector(".nb-desk")?.scrollTo({ top: 0 }); }, [pageId]);
  const movePage = (d: number) => update((n) => { const i = n.pages.findIndex((p) => p.id === page.id); const j = i + d; if (j < 0 || j >= n.pages.length) return n; const c = [...n.pages]; [c[i], c[j]] = [c[j], c[i]]; return { ...n, pages: c }; });
  const deletePage = async () => {
    if (nb.pages.length < 2) return toast("info", "A notebook needs at least one page");
    const c = await confirm("Delete page", `Delete “${page.title}” and everything on it? The previous saved version of the notebook stays in .qm-backup.`, [{ id: "cancel", label: "Cancel" }, { id: "go", label: "Delete page", variant: "danger" }]);
    if (c !== "go") return;
    const i = nb.pages.findIndex((p) => p.id === page.id);
    setPageId(nb.pages[i === 0 ? 1 : i - 1].id);
    update((n) => ({ ...n, pages: n.pages.filter((p) => p.id !== page.id) }));
  };
  const close = async () => { window.clearTimeout(timer.current); if (await save()) onClose(); };

  // Paste a picture from the clipboard straight onto the page.
  const onPaste = async (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    e.preventDefault();
    try {
      const src = await fileToDataUri(f);
      insertAfter({ ...newBlock("image"), src });
    } catch (err) {
      toast("error", "Could not paste image", errorMessage(err));
    }
  };

  const col = PAPER_COLORS.find((c) => c.id === nb.paper.color) ?? PAPER_COLORS[0];
  const dark = ["blueprint", "terminal"].includes(nb.paper.style);
  const vars = {
    "--nb-bg": nb.paper.style === "blueprint" ? "#0f3d7a" : nb.paper.style === "terminal" ? "#07100a" : nb.paper.style === "engineering" ? "#eef5e4" : col.bg,
    "--nb-ink": nb.paper.style === "blueprint" ? "#eaf3ff" : nb.paper.style === "terminal" ? "#7dff9b" : nb.paper.style === "engineering" ? "#1d2b18" : col.ink,
    "--nb-line": nb.paper.style === "blueprint" ? "#ffffff38" : nb.paper.style === "terminal" ? "#1f8f3a40" : nb.paper.style === "engineering" ? "#7fae6e" : col.line,
    "--nb-font": nb.paper.style === "terminal" ? FONTS[2].css : (FONTS.find((f) => f.id === nb.paper.font) ?? FONTS[0]).css,
  } as CSSProperties;
  const fontCss = vars["--nb-font" as keyof CSSProperties] as string;
  useEffect(() => {
    let live = true;
    const measure = () => { if (live) setK(baselineFactor(fontCss)); };
    measure();
    void document.fonts?.ready.then(measure);
    return () => { live = false; };
  }, [fontCss]);
  const sideCover = useMemo(() => coverUri(nb.cover.theme, nb.title, nb.subject, "", nb.cover.color), [nb.cover.theme, nb.cover.color, nb.title, nb.subject]);
  const matches = useMemo(() => { const t = q.trim().toLowerCase(); return t ? new Set(nb.pages.filter((p) => pageText(p).includes(t)).map((p) => p.id)) : null; }, [q, nb.pages]);

  return (
    <div className="nb-root">
      <div className="nb-top">
        <button className="btn" onClick={close}><ArrowLeft size={15} /> Shelf</button>
        <input className="nb-title" value={nb.title} aria-label="Notebook title" onChange={(e) => update((n) => ({ ...n, title: e.target.value }))} />
        <input className="nb-subject" value={nb.subject} placeholder="Subject" aria-label="Subject" onChange={(e) => update((n) => ({ ...n, subject: e.target.value }))} />
        <div className="grow" />
        <span className={"nb-state " + state}>{state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "error" ? "Not saved" : "Editing…"}</span>
        <button className={"btn" + (styleOpen ? " active" : "")} onClick={() => setStyleOpen((v) => !v)}><Palette size={15} /> Style</button>
      </div>
      {styleOpen && (
        <div className="nb-stylebar">
          <div className="row" style={{ flexWrap: "wrap", maxWidth: 620 }}><StylePickers paper={nb.paper} onChange={(paper) => update((n) => ({ ...n, paper }))} /></div>
          <div style={{ flex: 1, minWidth: 260 }}><span className="label">Cover</span><CoverPicker value={nb.cover.theme} onChange={(theme) => update((n) => ({ ...n, cover: { ...n.cover, theme } }))} /></div>
          <button className="icon-btn" title="Close" onClick={() => setStyleOpen(false)}><X size={16} /></button>
        </div>
      )}
      <div className="nb-body">
        <aside className="nb-pages">
          <img className="nb-side-cover" src={sideCover} alt="" />
          <span className="nb-search"><Search size={14} /><input placeholder="Search pages" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          <div className="nb-page-list">
            {nb.pages.map((p, i) => (matches && !matches.has(p.id) ? null : (
              <button key={p.id} className={"nb-page-item" + (p.id === page.id ? " current" : "")} onClick={() => setPageId(p.id)}><span className="n">{i + 1}</span><span className="t">{p.title}</span></button>
            )))}
            {matches && matches.size === 0 && <div className="muted" style={{ padding: 10, fontSize: ".85rem" }}>No page contains that.</div>}
          </div>
          <div className="row" style={{ gap: 4, padding: 8 }}>
            <button className="btn grow" onClick={addPage}><Plus size={14} /> Page</button>
            <button className="icon-btn" title="Move page up" onClick={() => movePage(-1)}><ArrowUp size={15} /></button>
            <button className="icon-btn" title="Move page down" onClick={() => movePage(1)}><ArrowDown size={15} /></button>
            <button className="icon-btn" title="Delete page" onClick={deletePage}><Trash2 size={15} /></button>
          </div>
        </aside>
        <main className="nb-desk" onPaste={onPaste}>
          <div className="nb-insert">
            {INSERT.map((x) => <button key={x.type} className="btn" onClick={() => insert(x.type)} title={`Add ${BLOCK_LABEL[x.type].toLowerCase()}`}>{x.icon} {BLOCK_LABEL[x.type]}</button>)}
          </div>
          <div className={`nb-paper s-${nb.paper.style}` + (dark ? " dark" : "")} style={{ ...vars, "--k": k } as CSSProperties} onMouseDown={(e) => { pressedOnPaper.current = e.target === e.currentTarget; }} onClick={paperClick}>
            <input className="nb-page-title" value={page.title} aria-label="Page title" onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))} />
            {page.blocks.map((b, i) => {
              const sz = blockSize(b);
              const style = { ...(sz ? { fontSize: `${sz.px}px`, "--m": sz.lines } : {}), ...(canAlign(b) ? { textAlign: b.align ?? (b.type === "image" ? "center" : "left") } : {}) } as CSSProperties;
              const cls = "nb-block t-" + b.type + (drag?.id === b.id ? " moving" : "") + (drag && drag.over === i ? " drop-before" : "") + (drag && drag.over === page.blocks.length && i === page.blocks.length - 1 ? " drop-after" : "");
              const change = (nbk: Block) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? nbk : x)));
              return (
                <div key={b.id} className={cls} data-block={b.id} style={style} onFocusCapture={() => { activeId.current = b.id; }}>
                  <button className="nb-grip" title="Drag to move" aria-label="Drag to move" onPointerDown={(e) => { e.preventDefault(); grab(e, b.id); }}><GripVertical size={16} /></button>
                  <BlockBar b={b} onChange={change} onMove={(d) => move(i, d)} onDelete={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))} />
                  <BlockView b={b} onChange={change} onGrab={(e) => grab(e, b.id)} keys={keysFor(b, i)} />
                </div>
              );
            })}
            {page.blocks.length === 0 && <p style={{ opacity: 0.6, pointerEvents: "none" }}>This page is empty. Click here to start writing.</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
