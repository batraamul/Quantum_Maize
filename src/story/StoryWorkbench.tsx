import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ArrowDown, ArrowUp, Braces, Copy, Download, ImagePlus, Palette, Plus, RefreshCw, Trash2, Type } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { api, errorMessage } from "../services/api";
import { allFiles, refreshTree, toast, ui, useApp } from "../app/store";
import { Switch } from "../components/Common";
import { BLOCKS, PRESETS, assetRefs, newBlock, parseStory, type Block, type BlockType, type Field, type Preset, type Story } from "./schema";
import { renderStory } from "./render";

export const STORY_FILE = "story.json";
const MEDIA = /\.(png|jpe?g|gif|webp|svg|mp4|webm)$/i;

export function storyOrigin(os: string | undefined) {
  return os === "windows" ? "http://qmstory.localhost/" : "qmstory://localhost/";
}

/** Shared state so the toolbar/menus can export the current story. */
export const storyRef: { current: Story | null } = { current: null };

export function StoryWorkbench() {
  const project = useApp((s) => s.project)!;
  const os = useApp((s) => s.appInfo?.os);
  const tree = useApp((s) => s.tree);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null); // block id, "theme" or "meta"
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [nonce, setNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  const scrollY = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const origin = storyOrigin(os);
  // Thumbnails are served by the preview origin once the project root is registered.
  const thumbOrigin = nonce > 0 ? origin : "";

  const assets = useMemo(() => allFiles().filter((f) => MEDIA.test(f.path)).map((f) => f.path), [tree]);

  // Load story.json
  useEffect(() => {
    (async () => {
      try {
        const s = parseStory(await api.readText(project.root, STORY_FILE));
        setStory(s);
        setSel(s.blocks[0]?.id ?? "meta");
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [project.root]);

  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  // Remember the preview's scroll position across reloads.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data && typeof e.data.qmScroll === "number") scrollY.current = e.data.qmScroll;
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []);

  // Render → backend preview → reload iframe (debounced); save story.json.
  useEffect(() => {
    if (!story) return;
    const t = window.setTimeout(async () => {
      try {
        await api.setStoryPreview(project.root, renderStory(story, (p) => `{{qm-asset:${p}}}`, { preview: true }));
        setNonce((n) => n + 1);
      } catch (e) {
        toast("error", "Preview failed", errorMessage(e));
      }
    }, 350);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.writeText(project.root, STORY_FILE, JSON.stringify(story, null, 2) + "\n").catch((e) => toast("error", "Could not save story.json", errorMessage(e)));
    }, 700);
    return () => clearTimeout(t);
  }, [story, project.root]);

  const update = useCallback((fn: (s: Story) => Story) => setStory((s) => (s ? fn(structuredClone(s)) : s)), []);
  const block = story?.blocks.find((b) => b.id === sel) ?? null;
  const setField = (key: string, value: unknown) => update((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === sel ? { ...b, [key]: value } : b)) }));
  const move = (d: number) =>
    update((s) => {
      const i = s.blocks.findIndex((b) => b.id === sel);
      const j = i + d;
      if (i < 0 || j < 0 || j >= s.blocks.length) return s;
      [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
      return s;
    });
  const addBlock = (t: BlockType) => {
    const nb = newBlock(t);
    update((s) => {
      const i = s.blocks.findIndex((b) => b.id === sel);
      s.blocks.splice(i < 0 ? s.blocks.length : i + 1, 0, nb);
      return s;
    });
    setSel(nb.id);
    setAdding(false);
    setTimeout(() => goto(nb.id), 700);
  };
  const goto = (id: string) => frame.current?.contentWindow?.postMessage({ qmGoto: id }, "*");

  const importAsset = async (): Promise<string | null> => {
    const f = await openDialog({ multiple: false, title: "Add media to the story", filters: [{ name: "Images, GIFs and video", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm"] }] });
    if (typeof f !== "string") return null;
    try {
      const rel = await api.importStoryAsset(project.root, f);
      await refreshTree();
      toast("success", "Media added", rel);
      return rel;
    } catch (e) {
      toast("error", "Could not add media", errorMessage(e));
      return null;
    }
  };

  if (error)
    return (
      <div className="pdf-empty">
        <div className="big">This story could not be opened</div>
        <div className="hint mono" style={{ maxWidth: 520 }}>{error}</div>
        <div className="hint">Fix story.json in a text editor (it is a plain JSON file in the project folder), then reopen the project.</div>
      </div>
    );
  if (!story) return <div className="pdf-empty">Loading story…</div>;
  const missing = assetRefs(story).filter((a) => !assets.includes(a));

  return (
    <PanelGroup direction="horizontal" autoSaveId="qm-story" style={{ flex: 1 }}>
      <Panel defaultSize={20} minSize={14} maxSize={34}>
        <div className="panel">
          <div className="panel-header">
            Story blocks
            <div className="actions">
              <button className="icon-btn" title="Add block" onClick={() => setAdding((v) => !v)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="panel-body">
            <button className={"story-row" + (sel === "meta" ? " active" : "")} onClick={() => setSel("meta")}>
              <Type size={15} /> Title & byline
            </button>
            <button className={"story-row" + (sel === "theme" ? " active" : "")} onClick={() => setSel("theme")}>
              <Palette size={15} /> Theme & motion
            </button>
            <div className="menu-sep" />
            {story.blocks.map((b, i) => (
              <button
                key={b.id}
                className={"story-row" + (sel === b.id ? " active" : "")}
                onClick={() => {
                  setSel(b.id);
                  goto(b.id);
                }}
              >
                <span className="sicon">{BLOCKS[b.type].icon}</span>
                <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span className="muted" style={{ fontSize: ".75rem", marginRight: 6 }}>{i + 1}</span>
                  {blockSummary(b)}
                </span>
              </button>
            ))}
            {adding && (
              <div className="add-grid">
                {(Object.keys(BLOCKS) as BlockType[]).map((t) => (
                  <button key={t} className="add-card" onClick={() => addBlock(t)} title={BLOCKS[t].description}>
                    <span style={{ fontSize: 20 }}>{BLOCKS[t].icon}</span>
                    <span>{BLOCKS[t].label}</span>
                  </button>
                ))}
              </div>
            )}
            {!adding && (
              <button className="btn" style={{ margin: 12, width: "calc(100% - 24px)" }} onClick={() => setAdding(true)}>
                <Plus size={14} /> Add block
              </button>
            )}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={30} minSize={22}>
        <div className="panel" style={{ background: "var(--bg-2)" }}>
          <div className="panel-header">
            {jsonMode ? "Source (story.json)" : sel === "theme" ? "Theme & motion" : sel === "meta" ? "Title & byline" : block ? BLOCKS[block.type].label : "Properties"}
            <div className="actions">
              {block && !jsonMode && (
                <>
                  <button className="icon-btn" title="Move up" onClick={() => move(-1)}><ArrowUp size={15} /></button>
                  <button className="icon-btn" title="Move down" onClick={() => move(1)}><ArrowDown size={15} /></button>
                  <button
                    className="icon-btn"
                    title="Duplicate"
                    onClick={() => {
                      const copy = { ...structuredClone(block), id: newBlock(block.type).id };
                      update((s) => {
                        s.blocks.splice(s.blocks.findIndex((b) => b.id === block.id) + 1, 0, copy);
                        return s;
                      });
                      setSel(copy.id);
                    }}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete block"
                    onClick={() => {
                      const i = story.blocks.findIndex((b) => b.id === block.id);
                      update((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== block.id) }));
                      setSel(story.blocks[i + 1]?.id ?? story.blocks[i - 1]?.id ?? "meta");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <button
                className={"icon-btn" + (jsonMode ? " active" : "")}
                title="Edit the JSON source"
                onClick={() => {
                  setJsonText(JSON.stringify(story, null, 2));
                  setJsonMode((v) => !v);
                }}
              >
                <Braces size={15} />
              </button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 16 }}>
            {jsonMode ? (
              <div className="field" style={{ height: "100%" }}>
                <textarea className="input mono" style={{ flex: 1, minHeight: 420, padding: 10, fontSize: 12.5, lineHeight: 1.5 }} value={jsonText} spellCheck={false} onChange={(e) => setJsonText(e.target.value)} />
                <div className="row">
                  <button
                    className="btn primary"
                    onClick={() => {
                      try {
                        setStory(parseStory(jsonText));
                        setJsonMode(false);
                      } catch (e) {
                        toast("error", "Invalid story JSON", errorMessage(e));
                      }
                    }}
                  >
                    Apply
                  </button>
                  <button className="btn" onClick={() => setJsonMode(false)}>Cancel</button>
                </div>
              </div>
            ) : sel === "meta" ? (
              <Fields
                fields={[
                  { key: "title", label: "Story title", kind: "text" },
                  { key: "subtitle", label: "Subtitle", kind: "text" },
                  { key: "author", label: "Byline (author, rank, organization)", kind: "text" },
                  { key: "date", label: "Date", kind: "text" },
                  { key: "description", label: "Description (for sharing / search)", kind: "textarea" },
                ]}
                value={story.meta as unknown as Record<string, unknown>}
                onChange={(k, v) => update((s) => ({ ...s, meta: { ...s.meta, [k]: v } }))}
                assets={assets}
                onImport={importAsset}
                origin={thumbOrigin}
              />
            ) : sel === "theme" ? (
              <ThemeEditor story={story} onChange={(t) => update((s) => ({ ...s, theme: { ...s.theme, ...t } }))} />
            ) : block ? (
              <>
                <div className="hint" style={{ marginBottom: 12 }}>{BLOCKS[block.type].description}</div>
                <Fields fields={BLOCKS[block.type].fields} value={block} onChange={setField} assets={assets} onImport={importAsset} origin={thumbOrigin} />
              </>
            ) : (
              <div className="hint">Select a block.</div>
            )}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={50} minSize={25}>
        <div className="pdf-panel" style={{ background: "var(--bg-1s)" }}>
          <div className="pdf-toolbar">
            <span className="muted" style={{ fontSize: ".85rem", paddingLeft: 8 }}>Live preview — fully interactive</span>
            {missing.length > 0 && <span className="badge warn" style={{ marginLeft: 8 }} title={missing.join("\n")}>{missing.length} missing media</span>}
            <div style={{ marginLeft: "auto" }} className="row">
              <button className="icon-btn" title="Reload preview" onClick={() => setNonce((n) => n + 1)}><RefreshCw size={15} /></button>
              <button className="btn" style={{ height: 26 }} onClick={() => ui.openDialog("storyExport")}>
                <Download size={14} /> Export web page
              </button>
            </div>
          </div>
          <iframe
            ref={frame}
            key={nonce}
            title="Story preview"
            className="story-frame"
            sandbox="allow-scripts"
            src={`${origin}preview?n=${nonce}&y=${Math.round(scrollY.current)}`}
          />
        </div>
      </Panel>
    </PanelGroup>
  );
}

function blockSummary(b: Block): string {
  const t = (b.title || b.heading || b.text || b.question || b.caption || "") as string;
  const s = String(t).replace(/[*_[\]()]/g, "").trim();
  return s ? s.slice(0, 48) : BLOCKS[b.type].label;
}

function ThemeEditor({ story, onChange }: { story: Story; onChange: (t: Partial<Story["theme"]>) => void }) {
  const th = story.theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>Colour theme</label>
        <div className="preset-grid">
          {(Object.keys(PRESETS) as Preset[]).map((k) => {
            const p = PRESETS[k];
            return (
              <button key={k} className={"preset" + (th.preset === k ? " selected" : "")} onClick={() => onChange({ preset: k })} style={{ background: p.bg, color: p.text }}>
                <span className="swatches">
                  <i style={{ background: p.accent }} />
                  <i style={{ background: p.accent2 }} />
                  <i style={{ background: p.surface, border: "1px solid #0002" }} />
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field">
        <label>Accent colour override</label>
        <div className="row">
          <input type="color" value={th.accent || PRESETS[th.preset].accent} onChange={(e) => onChange({ accent: e.target.value })} />
          <button className="btn ghost" onClick={() => onChange({ accent: "" })} disabled={!th.accent}>Use theme colour</button>
        </div>
      </div>
      <div className="field">
        <label>Typography</label>
        <select className="select" value={th.font} onChange={(e) => onChange({ font: e.target.value as Story["theme"]["font"] })}>
          <option value="serif">Editorial serif</option>
          <option value="sans">Modern sans</option>
          <option value="display">Display headings + serif text</option>
        </select>
      </div>
      <div className="field">
        <label>Reveal animation</label>
        <select className="select" value={th.animation} onChange={(e) => onChange({ animation: e.target.value as Story["theme"]["animation"] })}>
          <option value="fade-up">Fade up</option>
          <option value="zoom">Zoom in</option>
          <option value="slide">Slide in</option>
          <option value="none">None</option>
        </select>
        <span className="hint">Readers with “reduce motion” enabled always get a static page.</span>
      </div>
      <div className="row"><span className="grow">Reading progress bar</span><Switch checked={th.progressBar} onChange={(v) => onChange({ progressBar: v })} /></div>
      <div className="row"><span className="grow">Section navigation dots</span><Switch checked={th.navDots} onChange={(v) => onChange({ navDots: v })} /></div>
    </div>
  );
}

function Fields(props: { fields: Field[]; value: Record<string, unknown>; onChange: (k: string, v: unknown) => void; assets: string[]; onImport: () => Promise<string | null>; origin: string }) {
  if (!props.origin) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {props.fields.map((f) => (
        <FieldEditor key={f.key} f={f} v={props.value[f.key]} set={(v) => props.onChange(f.key, v)} assets={props.assets} onImport={props.onImport} origin={props.origin} />
      ))}
    </div>
  );
}

function FieldEditor({ f, v, set, assets, onImport, origin }: { f: Field; v: unknown; set: (v: unknown) => void; assets: string[]; onImport: () => Promise<string | null>; origin: string }) {
  const wrap = (child: ReactNode) => (
    <div className="field">
      <label>{f.label}</label>
      {child}
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>
  );
  switch (f.kind) {
    case "text":
      return wrap(<input className="input" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />);
    case "textarea":
      return wrap(<textarea className="input" style={{ minHeight: 110, padding: 8, lineHeight: 1.5 }} value={String(v ?? "")} onChange={(e) => set(e.target.value)} />);
    case "number":
      return wrap(<input className="input" type="number" min={f.min} max={f.max} value={Number(v ?? 0)} onChange={(e) => set(Number(e.target.value))} style={{ width: 140 }} />);
    case "range":
      return wrap(
        <div className="row">
          <input type="range" min={f.min} max={f.max} step={f.step} value={Number(v ?? 0)} onChange={(e) => set(Number(e.target.value))} className="grow" />
          <span className="mono muted">{Number(v ?? 0).toFixed(2)}</span>
        </div>,
      );
    case "bool":
      return (
        <div className="row">
          <span className="grow" style={{ color: "var(--text-2)" }}>{f.label}</span>
          <Switch checked={!!v} onChange={set} />
        </div>
      );
    case "select":
      return wrap(
        <select className="select" value={String(v ?? "")} onChange={(e) => set(e.target.value)}>
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>,
      );
    case "color":
      return wrap(<input type="color" value={String(v || "#000000")} onChange={(e) => set(e.target.value)} />);
    case "strings":
      return wrap(
        <textarea
          className="input"
          style={{ minHeight: 70, padding: 8 }}
          value={(Array.isArray(v) ? v : []).join(f.key === "options" ? "\n" : ", ")}
          onChange={(e) => set(e.target.value.split(f.key === "options" ? "\n" : ",").map((x) => (f.key === "options" ? x : x.trim())).filter((x, i, a) => x.trim() || i < a.length - 1))}
        />,
      );
    case "numbers":
      return wrap(
        <input
          className="input mono"
          value={(Array.isArray(v) ? v : []).join(", ")}
          onChange={(e) => set(e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)))}
        />,
      );
    case "asset": {
      const val = String(v ?? "");
      const isVid = /\.(mp4|webm)$/i.test(val);
      return wrap(
        <div className="asset-field">
          {val && !isVid && <img src={/^https?:/.test(val) ? val : `${origin}asset/${encodeURI(val)}`} alt="" />}
          <div className="row">
            <select className="select grow" value={val} onChange={(e) => set(e.target.value)}>
              <option value="">— none —</option>
              {val && !assets.includes(val) && <option value={val}>{val} (missing)</option>}
              {assets.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              className="btn"
              title="Add an image, GIF or video from your computer"
              onClick={async () => {
                const r = await onImport();
                if (r) set(r);
              }}
            >
              <ImagePlus size={14} />
            </button>
          </div>
        </div>,
      );
    }
    case "list": {
      const items = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
      const setItem = (i: number, k: string, val: unknown) => set(items.map((it, j) => (j === i ? { ...it, [k]: val } : it)));
      const blank = () => Object.fromEntries(f.item!.map((x) => [x.key, x.kind === "number" ? 0 : ""]));
      return (
        <div className="field">
          <label>{f.label}</label>
          {items.map((it, i) => (
            <div key={i} className="list-item">
              <div className="row" style={{ marginBottom: 6 }}>
                <b style={{ fontSize: ".85rem" }}>{f.itemLabel} {i + 1}</b>
                <span className="grow" />
                <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set(a); }}><ArrowUp size={13} /></button>
                <button className="icon-btn" title="Remove" onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
              </div>
              {f.item!.map((sub) => (
                <FieldEditor key={sub.key} f={sub} v={it[sub.key]} set={(val) => setItem(i, sub.key, val)} assets={assets} onImport={onImport} origin={origin} />
              ))}
            </div>
          ))}
          <button className="btn" onClick={() => set([...items, blank()])}>
            <Plus size={14} /> Add {f.itemLabel?.toLowerCase()}
          </button>
        </div>
      );
    }
  }
}
