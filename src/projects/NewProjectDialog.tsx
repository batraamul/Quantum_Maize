import { useEffect, useState, type ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { documentDir, homeDir } from "@tauri-apps/api/path";
import { FileText, FolderOpen, Globe, Layers, Library, PackageOpen, Presentation } from "lucide-react";
import { Modal } from "../components/Common";
import { createProject, ui, useApp } from "../app/store";
import type { StarterKind } from "../services/api";
import { SAMPLE_ID, StoryTemplateGallery } from "../story/StoryTemplates";
import type { Engine } from "../types";
import { SLIDE_DESIGNS, designPreview } from "../presentation/designs";

const THEMES = ["metropolis", "moloch", "SimplePlus", "SimpleDarkBlue", "Nord", "Verona", "Madrid", "CambridgeUS", "Copenhagen", "Warsaw", "Berlin", "Singapore", "Boadilla", "AnnArbor", "default"];
const COLORS = ["navy-gold", "quantum", "steel", "olive", "maroon", "default", "beaver", "crane", "dolphin", "orchid", "seahorse", "whale", "wolverine", "spruce"];
const COLOR_LABEL: Record<string, string> = { "navy-gold": "Navy & gold", quantum: "Navy & saffron", steel: "Steel & cyan", olive: "Olive & sand", maroon: "Maroon & gold", default: "Theme default" };
const OWN_COLORS = ["navy-gold", "quantum", "steel", "olive", "maroon"];
const DECKS: { id: string; title: string; desc: string }[] = [
  { id: "research-talk", title: "Research talk", desc: "Conference or seminar talk: motivation, method, results, conclusion." },
  { id: "selection-board", title: "Selection board presentation (senior scientific post)", desc: "Profile, programmes delivered, leadership record, vision and a 100-day to 5-year plan. 15 slides." },
  { id: "decision-briefing", title: "Decision briefing (bottom line up front)", desc: "The decision sought first, then background, options, recommendation, risks and resources." },
  { id: "programme-review", title: "Programme / project review", desc: "Status at a glance, milestones, technical progress, readiness level, budget, risks, help needed." },
  { id: "technology-roadmap", title: "Technology vision and roadmap", desc: "Strategic context, capability gaps, thrust areas, readiness roadmap, partnerships, resources." },
  { id: "project-proposal", title: "Research project proposal", desc: "Need, objectives, state of the art, approach, work packages, deliverables, cost, team, risks." },
  { id: "design-review", title: "Technical design review (PDR / CDR)", desc: "Requirements, architecture, subsystem design, analysis, verification plan, compliance matrix." },
  { id: "infographics", title: "Infographic gallery (every chart and diagram)", desc: "One deck showing every infographic, to copy from: numbers, rings, bars, timeline, roadmap, schedule, cards, matrix, pyramid, cycle, risk matrix." },
  { id: "lab-overview", title: "Laboratory / division capability overview", desc: "Mandate, organisation, competences, facilities, flagship programmes, achievements, way ahead." },
];

export function NewProjectDialog() {
  const settings = useApp((s) => s.settings);
  const [kind, setKind] = useState<StarterKind>("research-paper");
  const [name, setName] = useState("My Research Paper");
  const [dir, setDir] = useState("");
  const [engine, setEngine] = useState<Engine>(settings?.defaultEngine ?? "pdflatex");
  const [theme, setTheme] = useState("metropolis");
  const [color, setColor] = useState("default");
  const [deck, setDeck] = useState("research-talk");
  const [design, setDesign] = useState("elegant");
  const [aspect, setAspect] = useState("169");
  const [busy, setBusy] = useState(false);
  const [storyTpl, setStoryTpl] = useState(SAMPLE_ID);
  const [autoName, setAutoName] = useState("My Research Paper");

  useEffect(() => {
    (async () => {
      if (settings?.lastProjectDir) return setDir(settings.lastProjectDir);
      try {
        setDir(await documentDir());
      } catch {
        setDir(await homeDir());
      }
    })();
  }, []);

  // The name follows the selection until the user types their own.
  const suggest = (n: string) => {
    if (name === autoName) setName(n);
    setAutoName(n);
  };
  const choose = (k: StarterKind, defName: string) => {
    setKind(k);
    suggest(k === "story" && storyTpl !== SAMPLE_ID ? autoName : defName);
  };
  const invalid = !name.trim() || /[\\/:*?"<>|]/.test(name) || !dir;
  const create = async () => {
    if (invalid) return;
    setBusy(true);
    const ok = await createProject(dir, name.trim(), kind, engine, kind === "presentation" ? { beamerTheme: theme, beamerColor: design === "classic" ? color : (OWN_COLORS.includes(color) ? color : "default"), aspect, deck, design } : undefined, kind === "story" && storyTpl !== SAMPLE_ID ? storyTpl : undefined);
    setBusy(false);
    if (ok) ui.closeDialog();
  };
  const Card = ({ k, icon, title, desc, def }: { k: StarterKind; icon: ReactNode; title: string; desc: string; def: string }) => (
    <button className={"choice-card" + (kind === k ? " selected" : "")} onClick={() => choose(k, def)}>
      {icon}
      <span><div className="ct">{title}</div><div className="cd">{desc}</div></span>
    </button>
  );
  return (
    <Modal wide title="New project" onClose={ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" disabled={invalid || busy} onClick={create}>{busy ? "Creating…" : "Create project"}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card k="research-paper" def="My Research Paper" icon={<Layers size={22} color="var(--accent)" />} title="Research paper" desc="Multi-file article: sections/, references.bib, figures/." />
        <Card k="presentation" def="My Presentation" icon={<Presentation size={22} color="var(--accent)" />} title="Presentation" desc="Beamer slides with themes, presenter mode and PowerPoint export." />
        <Card k="story" def="My Interactive Story" icon={<Globe size={22} color="var(--accent)" />} title="Interactive story" desc="Scroll-driven web page with animated images, charts and quizzes." />
        <Card k="blank" def="Untitled" icon={<FileText size={22} color="var(--accent)" />} title="Blank article" desc="A single main.tex with a minimal preamble." />
        <button className="choice-card" onClick={() => ui.openDialog("journals")}>
          <Library size={22} color="var(--accent)" />
          <span><div className="ct">From a journal template…</div><div className="cd">IEEE, MDPI, Elsevier, Springer, ACM, APS, DRDO …</div></span>
        </button>
        <button className="choice-card" onClick={() => ui.openImport({ mode: "project" })}>
          <PackageOpen size={22} color="var(--accent)" />
          <span><div className="ct">Import ZIP / Overleaf…</div><div className="cd">An Overleaf download or any LaTeX archive.</div></span>
        </button>
      </div>
      {kind === "story" && <StoryTemplateGallery value={storyTpl} onChange={(id, title) => { setStoryTpl(id); suggest(title); }} />}
      <div className="field">
        <label>Project name</label>
        <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        {/[\\/:*?"<>|]/.test(name) && <span className="hint" style={{ color: "var(--danger)" }}>{'The name cannot contain \\ / : * ? " < > |'}</span>}
      </div>
      <div className="field">
        <label>Location</label>
        <div className="row">
          <input className="input grow mono" value={dir} onChange={(e) => setDir(e.target.value)} />
          <button className="btn" onClick={async () => { const d = await openDialog({ directory: true, defaultPath: dir || undefined }); if (typeof d === "string") setDir(d); }}>
            <FolderOpen size={15} /> Browse…
          </button>
        </div>
      </div>
      {kind === "presentation" && (<>
        <div className="field">
          <label>Format</label>
          <select className="select" value={deck} onChange={(e) => { setDeck(e.target.value); const d = DECKS.find((x) => x.id === e.target.value)!; suggest(d.id === "research-talk" ? "My Presentation" : d.title.replace(/ \(.*\)$/, "")); }}>
            {DECKS.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <span className="hint">{DECKS.find((d) => d.id === deck)!.desc} Grey guidance text marks what to replace; a protective marking line can be set in the preamble.</span>
        </div>
        <div className="field">
          <label>Slide design</label>
          <div className="design-grid">
            {SLIDE_DESIGNS.map((d) => (
              <button key={d.id} type="button" className={"design-opt" + (design === d.id ? " selected" : "")} title={d.desc} onClick={() => { setDesign(d.id); if (d.id !== "classic" && !OWN_COLORS.includes(color)) setColor("default"); }}>
                {designPreview(d.id, "title") ? <img src={designPreview(d.id, "title")} alt="" /> : <span className="design-classic">Beamer</span>}
                <span>{d.label}</span>
              </button>
            ))}
          </div>
          {designPreview(design, "content") && (
            <div className="design-preview"><img src={designPreview(design, "title")} alt="Title slide of this design" /><img src={designPreview(design, "content")} alt="Content slide of this design" /></div>
          )}
          <span className="hint">{SLIDE_DESIGNS.find((d) => d.id === design)!.desc}. Backgrounds, title and divider slides and the infographics are drawn by <code>qmdesign.sty</code> in the project; change one word in the preamble to switch design later.</span>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {design === "classic" && <label className="field grow"><span className="label">Theme</span><select className="select" value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t}>{t}</option>)}</select></label>}
          <label className="field grow"><span className="label">Colours</span><select className="select" value={design !== "classic" && !OWN_COLORS.includes(color) ? "default" : color} onChange={(e) => setColor(e.target.value)}>{(design === "classic" ? COLORS : ["default", ...OWN_COLORS]).map((t) => <option key={t} value={t}>{t === "default" && design !== "classic" ? "The design's own colours" : COLOR_LABEL[t] ?? t}</option>)}</select></label>
          <label className="field grow"><span className="label">Shape</span><select className="select" value={aspect} onChange={(e) => setAspect(e.target.value)}><option value="169">Widescreen 16:9</option><option value="43">Standard 4:3</option></select></label>
        </div>
      </>)}
      {kind !== "story" && (
        <div className="field">
          <label>LaTeX engine</label>
          <select className="select" value={engine} onChange={(e) => setEngine(e.target.value as Engine)}>
            <option value="pdflatex">pdfLaTeX — fastest, used by most journal templates</option>
            <option value="xelatex">XeLaTeX — Unicode text and system fonts</option>
            <option value="lualatex">LuaLaTeX — Unicode, modern font handling</option>
          </select>
        </div>
      )}
      {(settings?.ownerName || settings?.ownerOrganization) && kind !== "blank" && (
        <div className="hint">Author details will be pre-filled from your profile: {[settings.ownerName, settings.ownerRank, settings.ownerOrganization].filter(Boolean).join(", ")}.</div>
      )}
    </Modal>
  );
}
