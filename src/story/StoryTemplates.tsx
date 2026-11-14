// Story template gallery (used inside the New Project dialog) and the
// "Save as template" dialog.
import { useEffect, useMemo, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { BookmarkPlus, Download, Trash2, Upload } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { confirm, toast, ui, useApp } from "../app/store";
import { storyRef } from "./StoryWorkbench";
import { Modal } from "../components/Common";
import type { StoryTemplate } from "../types";

/** "" selects the built-in sample story. */
export const SAMPLE_ID = "";
const covers = new Map<string, string>();

function Cover({ id }: { id: string }) {
  const [src, setSrc] = useState(covers.get(id) ?? "");
  useEffect(() => {
    if (covers.has(id)) return setSrc(covers.get(id)!);
    let live = true;
    api.storyTemplateCover(id).then((d) => {
      covers.set(id, d);
      if (live) setSrc(d);
    }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return <div className="tpl-cover" style={src ? { backgroundImage: `url("${src}")` } : undefined} />;
}

export function StoryTemplateGallery({ value, onChange }: { value: string; onChange: (id: string, title: string) => void }) {
  const [list, setList] = useState<StoryTemplate[]>([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const load = () => api.listStoryTemplates().then(setList).catch((e) => toast("error", "Could not load story templates", errorMessage(e)));
  useEffect(() => { void load(); }, []);

  const cats = useMemo(() => ["All", ...Array.from(new Set(list.map((t) => t.category)))], [list]);
  const shown = list.filter((t) => (cat === "All" || t.category === cat) && (!q.trim() || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q.trim().toLowerCase())));

  const importZip = async () => {
    const f = await openDialog({ title: "Import a story template (.zip)", filters: [{ name: "Story template", extensions: ["zip"] }] });
    if (typeof f !== "string") return;
    try {
      const t = await api.importStoryTemplate(f);
      await load();
      setCat("All");
      onChange(t.id, t.title);
      toast("success", "Template imported", t.title);
    } catch (e) {
      toast("error", "Could not import template", errorMessage(e));
    }
  };
  const exportZip = async (t: StoryTemplate) => {
    const dest = await saveDialog({ title: "Export story template", defaultPath: `${t.title.replace(/[^\w-]+/g, "-").toLowerCase()}-template.zip`, filters: [{ name: "Story template", extensions: ["zip"] }] });
    if (typeof dest !== "string") return;
    try {
      await api.exportStoryTemplate(t.id, dest);
      toast("success", "Template exported", dest);
    } catch (e) {
      toast("error", "Could not export template", errorMessage(e));
    }
  };
  const remove = async (t: StoryTemplate) => {
    const c = await confirm("Remove template", `Remove “${t.title}” from your templates? Stories already created from it are not affected.`, [{ id: "cancel", label: "Cancel" }, { id: "remove", label: "Remove", variant: "danger" }]);
    if (c !== "remove") return;
    try {
      await api.deleteStoryTemplate(t.id);
      if (value === t.id) onChange(SAMPLE_ID, "My Interactive Story");
      await load();
    } catch (e) {
      toast("error", "Could not remove template", errorMessage(e));
    }
  };
  const sel = list.find((t) => t.id === value);

  return (
    <div className="tpl-gallery">
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input className="input grow" placeholder={`Search ${list.length} story templates…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: "auto" }} value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn" onClick={importZip} title="Add a template ZIP exported from Quantum Maze"><Upload size={14} /> Import template…</button>
      </div>
      <div className="tpl-grid">
        {cat === "All" && !q.trim() && (
          <button className={"tpl-card" + (value === SAMPLE_ID ? " selected" : "")} onClick={() => onChange(SAMPLE_ID, "My Interactive Story")}>
            <div className="tpl-cover sample" />
            <div className="tpl-t">Sample story with photographs</div>
            <div className="tpl-m">Short demo · every block type</div>
          </button>
        )}
        {shown.map((t) => (
          <button key={t.id} className={"tpl-card" + (value === t.id ? " selected" : "")} onClick={() => onChange(t.id, t.title)} title={t.description}>
            <Cover id={t.id} />
            <div className="tpl-t">{t.title}</div>
            <div className="tpl-m">{t.category} · {t.sections} sections</div>
          </button>
        ))}
        {shown.length === 0 && <div className="muted" style={{ padding: 12 }}>No template matches.</div>}
      </div>
      {sel && (
        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <div className="hint grow" style={{ margin: 0 }}><b>{sel.title}.</b> {sel.description}{sel.origin === "bundled" ? " Artwork is generated and free to reuse; replace it with your own pictures." : ""}</div>
          <button className="btn" onClick={() => exportZip(sel)} title="Save this template as a ZIP to share"><Download size={14} /> Export</button>
          {sel.origin === "user" && <button className="btn" onClick={() => remove(sel)} title="Remove from my templates"><Trash2 size={14} /></button>}
        </div>
      )}
    </div>
  );
}

export function SaveStoryTemplateDialog() {
  const project = useApp((s) => s.project)!;
  const [title, setTitle] = useState(project.meta.name);
  const [category, setCategory] = useState("My templates");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      // The template is made from story.json on disk, so write the current state first
      // (the studio otherwise saves a moment after each edit).
      if (storyRef.current) await api.writeText(project.root, "story.json", JSON.stringify(storyRef.current, null, 2) + "\n");
      const t = await api.saveStoryTemplate(project.root, title, description, category);
      covers.delete(t.id);
      toast("success", "Saved as template", `“${t.title}” is now in New Project → Interactive story.`);
      ui.closeDialog();
    } catch (e) {
      toast("error", "Could not save template", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Save story as a template" icon={<BookmarkPlus size={20} color="var(--accent)" />} onClose={ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" disabled={busy || !title.trim()} onClick={run}>{busy ? "Saving…" : "Save template"}</button></>}>
      <div className="field"><label>Template name</label><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>Category</label><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
      <div className="field"><label>Description (optional)</label><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="hint">Copies this story's blocks, theme and the media it uses into your template library. The story itself is not changed. Share a template with colleagues using Export in the template gallery.</div>
    </Modal>
  );
}
