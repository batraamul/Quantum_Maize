// Notebook data model. A notebook is one JSON document; this module validates what is
// loaded from disk so a damaged or hand-edited file cannot break the editor.

export type BlockType = "heading" | "text" | "bullets" | "checklist" | "table" | "image" | "code" | "callout" | "divider";

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  level?: 1 | 2 | 3;
  items?: { text: string; done?: boolean }[];
  rows?: string[][];
  header?: boolean;
  src?: string;
  caption?: string;
  width?: number;
  kind?: "note" | "important" | "idea" | "question";
  /** Horizontal alignment of text, or of an image on the page. */
  align?: Align;
  /** Text size step: an index into TEXT_SIZES (absent = normal). */
  size?: number;
}

export type Align = "left" | "center" | "right" | "justify";
const ALIGNS: Align[] = ["left", "center", "right", "justify"];

/** Text sizes. `lines` is how many ruled lines one line of writing occupies, so writing always sits on a rule. */
export const TEXT_SIZES: { px: number; lines: number }[] = [
  { px: 13, lines: 1 }, { px: 16.5, lines: 1 }, { px: 20, lines: 1 }, { px: 24, lines: 1 }, { px: 30, lines: 2 }, { px: 38, lines: 2 },
];
export const NORMAL_SIZE = 1;
const HEADING_SIZES: Record<number, { px: number; lines: number }> = { 1: { px: 30, lines: 2 }, 2: { px: 22, lines: 1 }, 3: { px: 17, lines: 1 } };
const SIZABLE: BlockType[] = ["text", "bullets", "checklist", "callout", "table"];
const ALIGNABLE: BlockType[] = ["text", "heading", "callout", "table", "image"];

export const canResize = (b: Block) => SIZABLE.includes(b.type) || b.type === "heading" || b.type === "image";
export const canAlign = (b: Block) => ALIGNABLE.includes(b.type);

/** Font size and line span a block is written at. */
export function blockSize(b: Block): { px: number; lines: number } | null {
  if (b.type === "heading") return HEADING_SIZES[b.level ?? 2];
  if (SIZABLE.includes(b.type)) return TEXT_SIZES[b.size ?? NORMAL_SIZE] ?? TEXT_SIZES[NORMAL_SIZE];
  return null;
}

/** One step larger (d = 1) or smaller (d = -1): text size, heading level, or picture width. */
export function resized(b: Block, d: 1 | -1): Block {
  if (b.type === "heading") return { ...b, level: Math.min(3, Math.max(1, (b.level ?? 2) - d)) as 1 | 2 | 3 };
  if (b.type === "image") return { ...b, width: Math.min(100, Math.max(10, Math.round((b.width ?? 70) / 10) * 10 + d * 10)) };
  if (SIZABLE.includes(b.type)) return { ...b, size: Math.min(TEXT_SIZES.length - 1, Math.max(0, (b.size ?? NORMAL_SIZE) + d)) };
  return b;
}

/** Moves the block `id` so it sits before the block currently at index `to` (`to` = length puts it last). */
export function moveBlock(blocks: Block[], id: string, to: number): Block[] {
  const from = blocks.findIndex((b) => b.id === id);
  if (from < 0 || to === from || to === from + 1) return blocks;
  const c = [...blocks];
  const [it] = c.splice(from, 1);
  c.splice(Math.min(c.length, Math.max(0, to > from ? to - 1 : to)), 0, it);
  return c;
}

export interface Page {
  id: string;
  title: string;
  blocks: Block[];
}

export interface Notebook {
  format: "quantum-maze-notebook";
  version: 1;
  id: string;
  title: string;
  subject: string;
  owner: string;
  cover: { theme: string; color: string };
  paper: { style: string; color: string; font: string };
  created: string;
  updated: string;
  pages: Page[];
}

export const PAPER_STYLES: { id: string; label: string }[] = [
  { id: "ruled", label: "Ruled" },
  { id: "legal", label: "Ruled with margin" },
  { id: "grid", label: "Squared grid" },
  { id: "dots", label: "Dot grid" },
  { id: "blank", label: "Plain" },
  { id: "engineering", label: "Engineering pad" },
  { id: "blueprint", label: "Blueprint" },
  { id: "terminal", label: "Terminal" },
];

export const PAPER_COLORS: { id: string; label: string; bg: string; ink: string; line: string }[] = [
  { id: "white", label: "White", bg: "#ffffff", ink: "#1c2333", line: "#b9c6dc" },
  { id: "cream", label: "Cream", bg: "#fbf5e3", ink: "#2c2618", line: "#d6c9a3" },
  { id: "yellow", label: "Legal yellow", bg: "#fff7b8", ink: "#2a2610", line: "#9db7d6" },
  { id: "blue", label: "Sky", bg: "#eaf3ff", ink: "#12233f", line: "#a9c3e8" },
  { id: "green", label: "Mint", bg: "#ebf7ec", ink: "#14301c", line: "#a8cfae" },
  { id: "pink", label: "Rose", bg: "#fdeef1", ink: "#3a1820", line: "#e3b3bf" },
  { id: "grey", label: "Grey", bg: "#eceef1", ink: "#20242c", line: "#b6bcc8" },
  { id: "kraft", label: "Kraft", bg: "#d9c3a0", ink: "#2e2212", line: "#b49a70" },
  { id: "night", label: "Night", bg: "#151a26", ink: "#e6ebf5", line: "#34405a" },
];

export const FONTS: { id: string; label: string; css: string }[] = [
  { id: "sans", label: "Clean", css: 'Inter, "Segoe UI", system-ui, sans-serif' },
  { id: "serif", label: "Book", css: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Typewriter", css: '"JetBrains Mono", "Courier New", monospace' },
  { id: "hand", label: "Handwritten", css: '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive' },
];

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading", text: "Text", bullets: "Bullet list", checklist: "Checklist", table: "Table",
  image: "Image", code: "Code", callout: "Callout", divider: "Divider",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const str = (v: unknown, max = 100000) => (typeof v === "string" ? v.slice(0, max) : "");
const IMG = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

export function newBlock(type: BlockType): Block {
  const b: Block = { id: uid(), type };
  if (type === "heading") Object.assign(b, { text: "", level: 2 });
  else if (type === "bullets") b.items = [{ text: "" }];
  else if (type === "checklist") b.items = [{ text: "", done: false }];
  else if (type === "table") Object.assign(b, { rows: [["", "", ""], ["", "", ""], ["", "", ""]], header: true });
  else if (type === "image") Object.assign(b, { src: "", caption: "", width: 70 });
  else if (type === "callout") Object.assign(b, { text: "", kind: "note" });
  else if (type !== "divider") b.text = "";
  return b;
}

export function newPage(title = "Untitled page"): Page {
  return { id: uid(), title, blocks: [{ ...newBlock("heading"), text: title, level: 1 }, newBlock("text")] };
}

export function newNotebook(o: { title: string; subject: string; owner: string; theme: string; color: string; style: string; paper: string; font: string }): Notebook {
  const now = new Date().toISOString();
  return {
    format: "quantum-maze-notebook", version: 1, id: uid() + uid(), title: o.title.trim() || "Untitled notebook", subject: o.subject.trim(), owner: o.owner,
    cover: { theme: o.theme, color: o.color }, paper: { style: o.style, color: o.paper, font: o.font }, created: now, updated: now, pages: [newPage("First page")],
  };
}

function parseBlock(v: unknown): Block | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const type = r.type as BlockType;
  if (!(type in BLOCK_LABEL)) return null;
  const b: Block = { id: str(r.id, 40) || uid(), type };
  if (type === "heading") Object.assign(b, { text: str(r.text, 500), level: [1, 2, 3].includes(r.level as number) ? r.level : 2 });
  else if (type === "text" || type === "code") b.text = str(r.text);
  else if (type === "callout") Object.assign(b, { text: str(r.text), kind: ["note", "important", "idea", "question"].includes(r.kind as string) ? r.kind : "note" });
  else if (type === "bullets" || type === "checklist") {
    const items = Array.isArray(r.items) ? r.items.slice(0, 2000).map((i) => ({ text: str((i as Record<string, unknown>)?.text, 5000), done: !!(i as Record<string, unknown>)?.done })) : [];
    b.items = items.length ? items : [{ text: "" }];
  } else if (type === "table") {
    const rows = Array.isArray(r.rows) ? r.rows.slice(0, 500).map((row) => (Array.isArray(row) ? row.slice(0, 30).map((c) => str(c, 5000)) : [])) : [];
    const cols = Math.max(1, ...rows.map((x) => x.length));
    b.rows = (rows.length ? rows : [[""]]).map((x) => [...x, ...Array(cols - x.length).fill("")]);
    b.header = r.header !== false;
  } else if (type === "image") {
    const src = typeof r.src === "string" && IMG.test(r.src) ? r.src : ""; // embedded raster images only
    Object.assign(b, { src, caption: str(r.caption, 1000), width: Math.min(100, Math.max(10, Number(r.width) || 70)) });
  }
  if (ALIGNABLE.includes(type) && ALIGNS.includes(r.align as Align) && !(type === "image" && r.align === "justify")) b.align = r.align as Align;
  if (SIZABLE.includes(type) && Number.isInteger(r.size) && (r.size as number) >= 0 && (r.size as number) < TEXT_SIZES.length && r.size !== NORMAL_SIZE) b.size = r.size as number;
  return b;
}

/** Parses and validates notebook JSON. Throws if it is not a notebook. */
export function parseNotebook(raw: string): Notebook {
  const v = JSON.parse(raw) as Record<string, unknown>;
  if (!v || typeof v !== "object" || !Array.isArray(v.pages)) throw new Error("This file is not a Quantum Maze notebook.");
  const cover = (v.cover ?? {}) as Record<string, unknown>;
  const paper = (v.paper ?? {}) as Record<string, unknown>;
  const pages = v.pages.slice(0, 5000).map((p) => {
    const r = (p ?? {}) as Record<string, unknown>;
    return { id: str(r.id, 40) || uid(), title: str(r.title, 300) || "Untitled page", blocks: (Array.isArray(r.blocks) ? r.blocks : []).map(parseBlock).filter((b): b is Block => !!b) };
  });
  return {
    format: "quantum-maze-notebook", version: 1, id: str(v.id, 60) || uid(), title: str(v.title, 300) || "Untitled notebook", subject: str(v.subject, 300), owner: str(v.owner, 300),
    cover: { theme: str(cover.theme, 40) || "general", color: str(cover.color, 20) },
    paper: {
      style: PAPER_STYLES.some((s) => s.id === paper.style) ? (paper.style as string) : "ruled",
      color: PAPER_COLORS.some((s) => s.id === paper.color) ? (paper.color as string) : "white",
      font: FONTS.some((s) => s.id === paper.font) ? (paper.font as string) : "sans",
    },
    created: str(v.created, 40), updated: str(v.updated, 40), pages: pages.length ? pages : [newPage("First page")],
  };
}

export function fileNameFor(nb: Notebook): string {
  const slug = nb.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "notebook";
  return `${slug}-${nb.id.slice(0, 6)}.qmnote.json`;
}

/** Plain text of a page, for search. */
export function pageText(p: Page): string {
  return [p.title, ...p.blocks.map((b) => [b.text, b.caption, ...(b.items ?? []).map((i) => i.text), ...(b.rows ?? []).flat()].filter(Boolean).join(" "))].join(" ").toLowerCase();
}
