// Interactive story document model. One JSON file (story.json) per project.
// The same schema drives the visual builder (via FIELD specs), the renderer
// and validation, so adding a block type means adding it here and in render.ts.

export type Preset = "saffron" | "midnight" | "monsoon" | "paper" | "quantum" | "emerald";
export type Animation = "fade-up" | "zoom" | "slide" | "none";

export interface StoryTheme {
  preset: Preset;
  accent: string;
  font: "serif" | "sans" | "display";
  animation: Animation;
  progressBar: boolean;
  navDots: boolean;
}

export interface StoryMeta {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  description: string;
}

export type Block = { id: string; type: BlockType; [k: string]: unknown };

export interface Story {
  version: 1;
  meta: StoryMeta;
  theme: StoryTheme;
  blocks: Block[];
}

export type BlockType =
  | "hero" | "text" | "image" | "scrolly" | "stats" | "timeline" | "quote" | "gallery"
  | "cards" | "compare" | "chart" | "hotspots" | "quiz" | "video" | "divider";

export type FieldKind = "text" | "textarea" | "number" | "bool" | "select" | "asset" | "list" | "strings" | "numbers" | "color" | "range";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  item?: Field[]; // for lists
  itemLabel?: string;
}

const T = (key: string, label: string, hint?: string): Field => ({ key, label, kind: "text", hint });
const TA = (key: string, label: string, hint?: string): Field => ({ key, label, kind: "textarea", hint });
const A = (key: string, label: string): Field => ({ key, label, kind: "asset" });
const MD_HINT = "Blank line = new paragraph · **bold** · *italic* · [link](https://…)";

export const BLOCKS: Record<BlockType, { label: string; icon: string; description: string; fields: Field[]; make: () => Omit<Block, "id"> }> = {
  hero: {
    label: "Hero cover", icon: "🌄", description: "Full-screen opening with title over an image or video",
    fields: [T("kicker", "Kicker"), T("title", "Title"), TA("subtitle", "Subtitle"), A("image", "Background image / GIF / video"),
      { key: "effect", label: "Motion", kind: "select", options: ["kenburns", "parallax", "none"] },
      { key: "overlay", label: "Darken overlay", kind: "range", min: 0, max: 0.9, step: 0.05 },
      { key: "align", label: "Alignment", kind: "select", options: ["center", "left", "bottom-left"] }],
    make: () => ({ type: "hero", kicker: "", title: "New chapter", subtitle: "", image: "", effect: "kenburns", overlay: 0.4, align: "center" }),
  },
  text: {
    label: "Text", icon: "¶", description: "Paragraphs with optional heading and drop cap",
    fields: [T("heading", "Heading"), TA("text", "Text", MD_HINT), { key: "dropcap", label: "Drop cap", kind: "bool" }],
    make: () => ({ type: "text", heading: "", text: "Write here.", dropcap: false }),
  },
  image: {
    label: "Image", icon: "🖼", description: "Photo, diagram or animated GIF with caption",
    fields: [A("src", "Image / GIF"), T("caption", "Caption"), T("credit", "Credit"),
      { key: "width", label: "Width", kind: "select", options: ["column", "wide", "full"] },
      { key: "effect", label: "Animation", kind: "select", options: ["zoom-in", "parallax", "kenburns", "float", "none"] }],
    make: () => ({ type: "image", src: "", caption: "", credit: "", width: "wide", effect: "zoom-in" }),
  },
  scrolly: {
    label: "Scrollytelling", icon: "📜", description: "Sticky visual that changes as text steps scroll past",
    fields: [{ key: "steps", label: "Steps", kind: "list", itemLabel: "Step", item: [A("image", "Image"), TA("text", "Text", MD_HINT)] },
      { key: "side", label: "Visual side", kind: "select", options: ["right", "left"] }],
    make: () => ({ type: "scrolly", side: "right", steps: [{ image: "", text: "First step" }, { image: "", text: "Second step" }] }),
  },
  stats: {
    label: "Animated numbers", icon: "🔢", description: "Counters that count up when they appear",
    fields: [{ key: "items", label: "Numbers", kind: "list", itemLabel: "Number", item: [{ key: "value", label: "Value", kind: "number" }, T("prefix", "Prefix"), T("suffix", "Suffix"), T("label", "Label")] }],
    make: () => ({ type: "stats", items: [{ value: 100, prefix: "", suffix: "%", label: "Label" }] }),
  },
  timeline: {
    label: "Timeline", icon: "🕰", description: "Vertical timeline revealed on scroll",
    fields: [{ key: "items", label: "Events", kind: "list", itemLabel: "Event", item: [T("date", "Date"), T("title", "Title"), TA("text", "Text"), A("image", "Image (optional)")] }],
    make: () => ({ type: "timeline", items: [{ date: "2026", title: "Event", text: "", image: "" }] }),
  },
  quote: {
    label: "Pull quote", icon: "❝", description: "Large highlighted quotation",
    fields: [TA("text", "Quote"), T("by", "Attribution")],
    make: () => ({ type: "quote", text: "A memorable line.", by: "" }),
  },
  gallery: {
    label: "Gallery", icon: "🎞", description: "Carousel or grid of images",
    fields: [{ key: "mode", label: "Layout", kind: "select", options: ["carousel", "grid"] },
      { key: "images", label: "Images", kind: "list", itemLabel: "Image", item: [A("src", "Image"), T("caption", "Caption")] }],
    make: () => ({ type: "gallery", mode: "carousel", images: [{ src: "", caption: "" }] }),
  },
  cards: {
    label: "Cards", icon: "🃏", description: "Grid of cards, optionally flipping on hover/tap",
    fields: [{ key: "flip", label: "Flip on hover / tap", kind: "bool" },
      { key: "items", label: "Cards", kind: "list", itemLabel: "Card", item: [T("icon", "Icon / emoji"), T("title", "Title"), TA("text", "Text"), A("image", "Image (optional)")] }],
    make: () => ({ type: "cards", flip: true, items: [{ icon: "✨", title: "Title", text: "Detail", image: "" }] }),
  },
  compare: {
    label: "Before / after", icon: "↔", description: "Drag a handle to compare two images",
    fields: [A("before", "Before image"), A("after", "After image"), T("beforeLabel", "Before label"), T("afterLabel", "After label"), T("caption", "Caption")],
    make: () => ({ type: "compare", before: "", after: "", beforeLabel: "Before", afterLabel: "After", caption: "" }),
  },
  chart: {
    label: "Bar chart", icon: "📊", description: "Animated bar chart from your numbers",
    fields: [T("title", "Title"), { key: "labels", label: "Labels (comma-separated)", kind: "strings" }, { key: "values", label: "Values (comma-separated)", kind: "numbers" }, T("unit", "Unit suffix")],
    make: () => ({ type: "chart", title: "Chart", labels: ["A", "B", "C"], values: [3, 5, 2], unit: "" }),
  },
  hotspots: {
    label: "Hotspot image", icon: "📍", description: "Image with tappable markers (maps, diagrams)",
    fields: [A("image", "Image"), T("caption", "Caption"),
      { key: "points", label: "Markers", kind: "list", itemLabel: "Marker", item: [{ key: "x", label: "X position (%)", kind: "number", min: 0, max: 100 }, { key: "y", label: "Y position (%)", kind: "number", min: 0, max: 100 }, T("title", "Title"), TA("text", "Text")] }],
    make: () => ({ type: "hotspots", image: "", caption: "", points: [{ x: 50, y: 50, title: "Marker", text: "" }] }),
  },
  quiz: {
    label: "Quiz", icon: "❓", description: "Multiple-choice question with instant feedback",
    fields: [T("question", "Question"), { key: "options", label: "Options (one per line)", kind: "strings" }, { key: "answer", label: "Correct option number (0 = first)", kind: "number", min: 0 }, TA("explanation", "Explanation")],
    make: () => ({ type: "quiz", question: "Question?", options: ["Option A", "Option B"], answer: 0, explanation: "" }),
  },
  video: {
    label: "Video", icon: "🎬", description: "Local MP4/WebM, optionally autoplaying muted loop",
    fields: [A("src", "Video file"), T("caption", "Caption"), { key: "autoplay", label: "Autoplay muted loop", kind: "bool" }],
    make: () => ({ type: "video", src: "", caption: "", autoplay: true }),
  },
  divider: {
    label: "Divider", icon: "〰", description: "Decorative section break",
    fields: [{ key: "style", label: "Style", kind: "select", options: ["wave", "dots", "line"] }],
    make: () => ({ type: "divider", style: "wave" }),
  },
};

export const PRESETS: Record<Preset, { label: string; bg: string; surface: string; text: string; muted: string; accent: string; accent2: string; heroText: string }> = {
  saffron: { label: "Saffron Dusk", bg: "#fff8f0", surface: "#ffffff", text: "#2b1d14", muted: "#7a6252", accent: "#e8730c", accent2: "#b8325a", heroText: "#fff" },
  midnight: { label: "Midnight Ink", bg: "#0b1020", surface: "#141a30", text: "#e9ecf8", muted: "#9aa3c4", accent: "#7c9bff", accent2: "#ff7ab6", heroText: "#fff" },
  monsoon: { label: "Monsoon Teal", bg: "#eef7f6", surface: "#ffffff", text: "#12302d", muted: "#4f6f6b", accent: "#0f8b8d", accent2: "#ec9a29", heroText: "#fff" },
  paper: { label: "Paper Classic", bg: "#faf7f0", surface: "#ffffff", text: "#1f1f1f", muted: "#6b6b6b", accent: "#9b2226", accent2: "#005f73", heroText: "#fff" },
  quantum: { label: "Quantum Maze", bg: "#070b1f", surface: "#111836", text: "#e6ebff", muted: "#97a2cf", accent: "#ff8a3d", accent2: "#5f7fff", heroText: "#fff" },
  emerald: { label: "Emerald Court", bg: "#f2f7f2", surface: "#ffffff", text: "#13261a", muted: "#5a6e60", accent: "#1e7a46", accent2: "#c9a227", heroText: "#fff" },
};

let counter = 0;
export function newId(): string {
  counter++;
  return `b${Date.now().toString(36)}${counter}`;
}

export function newBlock(type: BlockType): Block {
  return { id: newId(), ...BLOCKS[type].make() } as Block;
}

export function defaultStory(title = "Untitled story"): Story {
  return {
    version: 1,
    meta: { title, subtitle: "", author: "", date: "", description: "" },
    theme: { preset: "saffron", accent: "", font: "serif", animation: "fade-up", progressBar: true, navDots: true },
    blocks: [{ ...newBlock("hero"), title }, newBlock("text")],
  };
}

/** Parse and normalise story.json; throws with a readable message. */
export function parseStory(json: string): Story {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`story.json is not valid JSON: ${(e as Error).message}`);
  }
  const r = raw as Partial<Story>;
  if (!r || typeof r !== "object" || !Array.isArray(r.blocks)) throw new Error("story.json must contain a \"blocks\" array");
  const d = defaultStory();
  const seen = new Set<string>();
  const blocks = r.blocks
    .filter((b): b is Block => !!b && typeof b === "object" && typeof (b as Block).type === "string" && (b as Block).type in BLOCKS)
    .map((b) => {
      const id = typeof b.id === "string" && b.id && !seen.has(b.id) ? b.id : newId();
      seen.add(id);
      return { ...BLOCKS[b.type].make(), ...b, id } as Block;
    });
  return { version: 1, meta: { ...d.meta, ...(r.meta ?? {}) }, theme: { ...d.theme, ...(r.theme ?? {}) }, blocks };
}

/** Every project asset referenced by the story (for validation/export). */
export function assetRefs(s: Story): string[] {
  const out = new Set<string>();
  const visit = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (["image", "src", "before", "after"].includes(key) && v && !/^https?:|^data:/.test(v)) out.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => visit(x, k));
  };
  s.blocks.forEach((b) => visit(b));
  return [...out];
}
