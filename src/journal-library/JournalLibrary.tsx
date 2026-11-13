import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { documentDir } from "@tauri-apps/api/path";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BadgeCheck, BookOpen, Download, ExternalLink, FolderOpen, Library, Loader2, PackageOpen, Search, ShieldQuestion, Trash2, Upload } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { confirm, openProject, toast, ui, useApp } from "../app/store";
import { Modal } from "../components/Common";
import type { ClassStatus, JournalEntry, Staged } from "../types";

const open = (u: string | null) => u && openUrl(u).catch((e) => toast("error", "Could not open browser", String(e)));

export function useJournals() {
  const [list, setList] = useState<JournalEntry[] | null>(null);
  const reload = async () => setList(await api.listJournals().catch(() => []));
  useEffect(() => {
    void reload();
  }, []);
  return { list, reload };
}

function readiness(j: JournalEntry, cls: Record<string, ClassStatus>): { ready: boolean; label: string } {
  if (j.templateType === "custom") return { ready: true, label: "Imported template" };
  if (j.templateType === "community-profile") return { ready: true, label: "Community draft layout" };
  if (j.templateType === "ctan-class") {
    const c = cls[j.ctanClass ?? ""];
    if (!c) return { ready: false, label: "Checking…" };
    return c.installed ? { ready: true, label: "Class installed" } : { ready: false, label: `Install class ${j.ctanClass}` };
  }
  return { ready: false, label: "Download from publisher" };
}

export function JournalLibrary() {
  const { list, reload } = useJournals();
  const settings = useApp((s) => s.settings);
  const [q, setQ] = useState("");
  const [pub, setPub] = useState("");
  const [venue, setVenue] = useState("");
  const [layout, setLayout] = useState("");
  const [kind, setKind] = useState("");
  const [onlyReady, setOnlyReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [cls, setCls] = useState<Record<string, ClassStatus>>({});
  const [name, setName] = useState("My Journal Paper");
  const [dir, setDir] = useState(settings?.lastProjectDir ?? "");
  const [busy, setBusy] = useState(false);
  const [ixEdit, setIxEdit] = useState(false);
  const [ix, setIx] = useState({ detail: "", source: "", date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    if (!dir) documentDir().then(setDir).catch(() => {});
  }, []);
  useEffect(() => {
    if (!list) return;
    const names = [...new Set(list.map((j) => j.ctanClass).filter(Boolean) as string[])];
    api.classStatus(names).then((r) => setCls(Object.fromEntries(r.map((c) => [c.name, c])))).catch(() => {});
    if (!sel && list.length) setSel(list[0].id);
  }, [list]);

  const publishers = useMemo(() => [...new Set((list ?? []).map((j) => j.publisher))].sort(), [list]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list ?? []).filter((j) => {
      if (pub && j.publisher !== pub) return false;
      if (venue && j.venue !== venue) return false;
      if (layout && j.layout !== layout) return false;
      if (kind === "official" && !j.official) return false;
      if (kind === "community" && (j.official || j.origin === "custom")) return false;
      if (kind === "custom" && j.origin !== "custom") return false;
      if (onlyReady && !readiness(j, cls).ready) return false;
      if (!t) return true;
      const hay = [j.name, j.publisher, j.issn?.print, j.issn?.electronic, ...j.subjects, ...j.disciplines, ...j.manuscriptTypes, j.templateType, j.ctanClass].join(" ").toLowerCase();
      return t.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [list, q, pub, venue, layout, kind, onlyReady, cls]);
  const j = (list ?? []).find((x) => x.id === sel) ?? null;
  const rd = j ? readiness(j, cls) : null;

  const create = async () => {
    if (!j || !name.trim() || !dir) return;
    setBusy(true);
    try {
      const info = await api.createJournalProject(dir, name.trim(), j.id);
      ui.closeDialog();
      await openProject(info.root);
      toast("success", `Project created for ${j.name}`, j.templateType === "community-profile" ? "Community draft layout — not an official template." : undefined);
    } catch (e) {
      toast("error", "Could not create the project", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title="Journal Template Library" icon={<Library size={20} color="var(--accent)" />} onClose={ui.closeDialog} bodyClass="journal-body"
      footer={<><button className="btn" onClick={() => ui.openImport({ mode: "template" })}><Upload size={14} /> Import a template…</button><span className="grow" /><button className="btn primary" onClick={ui.closeDialog}>Close</button></>}>
      <div className="journal-layout">
        <div className="journal-list">
          <div className="row" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 9, color: "var(--text-3)" }} />
            <input className="input grow" autoFocus style={{ paddingLeft: 28 }} placeholder="Journal, publisher, ISSN, subject…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="filters">
            <select className="select" value={pub} onChange={(e) => setPub(e.target.value)}><option value="">All publishers</option>{publishers.map((p) => <option key={p}>{p}</option>)}</select>
            <select className="select" value={venue} onChange={(e) => setVenue(e.target.value)}><option value="">Journal & conference</option><option value="journal">Journal</option><option value="conference">Conference</option></select>
            <select className="select" value={layout} onChange={(e) => setLayout(e.target.value)}><option value="">Any layout</option><option value="two-column">Two-column</option><option value="single-column">Single-column</option></select>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Official & community</option><option value="official">Official only</option><option value="community">Community only</option><option value="custom">Imported by me</option></select>
            <label className="row hint" style={{ cursor: "pointer" }}><input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Ready to use (installed)</label>
          </div>
          <div className="jl-items">
            {!list && <div className="row hint" style={{ padding: 12 }}><Loader2 size={14} className="spin" /> Loading…</div>}
            {list && shown.length === 0 && <div className="hint" style={{ padding: 12 }}>No journals match. Import the publisher's template ZIP to add any journal.</div>}
            {shown.map((x) => {
              const r = readiness(x, cls);
              return (
                <button key={x.id} className={"jl-item" + (x.id === sel ? " active" : "")} onClick={() => setSel(x.id)}>
                  <div className="jl-name">{x.name}</div>
                  <div className="jl-meta">
                    <span>{x.publisher}</span>
                    {x.origin === "bundled" && !x.lastVerified ? <span className="badge">unverified</span> : x.official ? <span className="badge ok">official</span> : <span className="badge warn">{x.origin === "custom" ? "imported" : "community"}</span>}
                    <span className={"badge" + (r.ready ? " accent" : "")}>{r.ready ? "ready" : "needs download"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {j && rd && (
          <div className="journal-detail">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "1.2rem" }}>{j.name}</h3>
                <div className="hint">{j.publisher} · {j.venue} · {j.layout}</div>
              </div>
              {j.origin === "bundled" && !j.lastVerified ? <span className="badge"><ShieldQuestion size={12} /> Template source not verified</span> : j.official ? <span className="badge ok"><BadgeCheck size={12} /> Official template</span> : <span className="badge warn"><ShieldQuestion size={12} /> {j.origin === "custom" ? "Imported" : "Community / unofficial"}</span>}
            </div>
            {j.notes.map((n) => <div key={n} className="callout" style={{ padding: 10 }}>{n}</div>)}
            <table className="table">
              <tbody>
                {j.issn && <tr><td>ISSN</td><td className="mono">{[j.issn.print && `print ${j.issn.print}`, j.issn.electronic && `online ${j.issn.electronic}`].filter(Boolean).join(" · ")}</td></tr>}
                <tr><td>Template</td><td>{j.templateType === "ctan-class" ? <>Official class <span className="mono">{j.ctanClass}</span>{j.classOptions ? <> [<span className="mono">{j.classOptions}</span>]</> : null} from your TeX distribution{cls[j.ctanClass ?? ""]?.version && <div className="hint mono">Installed: {cls[j.ctanClass!].version}</div>}</> : j.templateType === "publisher-download" ? "Distributed by the publisher — download the ZIP, then import it here" : j.templateType === "community-profile" ? "No official LaTeX template — community draft layout from the author guidelines" : `Imported ${j.installedAt ? new Date(j.installedAt).toLocaleDateString() : ""}`}</td></tr>
                <tr><td>Engine / bibliography</td><td className="mono">{j.engine || "pdflatex"} · {j.bibTool}{j.bibStyle ? ` (${j.bibStyle})` : ""}</td></tr>
                {j.subjects.length > 0 && <tr><td>Subjects</td><td>{j.subjects.join(", ")}</td></tr>}
                <tr><td>Open access</td><td>{j.openAccess === null ? <span className="muted">not recorded</span> : j.openAccess ? "Yes (publisher model)" : "No"}</td></tr>
                <tr>
                  <td>Indexing</td>
                  <td>
                    {j.indexing.status === "not-verified" ? <span className="muted">Not verified — Quantum Maze does not assume indexing status.</span> : <>{j.indexing.detail} <div className="hint">{j.indexing.status === "user-verified" ? "Verified by you" : "Publisher's statement"} · {j.indexing.date}{j.indexing.source ? <> · <a href="#" onClick={(e) => { e.preventDefault(); void open(j.indexing.source); }}>source</a></> : null}</div></>}
                    {!ixEdit && <button className="btn ghost" style={{ height: 22, padding: "0 6px", marginLeft: 6 }} onClick={() => setIxEdit(true)}>Record verification…</button>}
                    {ixEdit && (
                      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                        <input className="input" placeholder="e.g. SCIE, Scopus (checked in JCR 2026)" value={ix.detail} onChange={(e) => setIx({ ...ix, detail: e.target.value })} />
                        <input className="input" placeholder="Source URL" value={ix.source} onChange={(e) => setIx({ ...ix, source: e.target.value })} />
                        <div className="row"><input className="input" type="date" value={ix.date} onChange={(e) => setIx({ ...ix, date: e.target.value })} />
                          <button className="btn primary" disabled={!ix.detail.trim()} onClick={async () => { await api.setJournalIndexing(j.id, { status: "user-verified", detail: ix.detail.trim(), source: ix.source.trim() || null, date: ix.date }); setIxEdit(false); await reload(); }}>Save</button>
                          <button className="btn" onClick={() => setIxEdit(false)}>Cancel</button></div>
                      </div>
                    )}
                  </td>
                </tr>
                <tr><td>Last verified</td><td>{j.lastVerified ?? <span className="muted">never — check links before use</span>}{j.verificationNote && <div className="hint">{j.verificationNote}</div>}</td></tr>
                {j.license && <tr><td>License</td><td>{j.license}</td></tr>}
              </tbody>
            </table>
            {(j.requirements.notes.length > 0 || j.requirements.statements.length > 0) && (
              <div>
                <div className="label">Submission requirements {j.requirements.verified ? "(from the cited source)" : "(general — verify)"}</div>
                <ul className="hint" style={{ margin: "6px 0", paddingLeft: 18 }}>
                  {j.requirements.statements.map((s) => <li key={s}>Statement required: {s}</li>)}
                  {j.requirements.abstractMaxWords && <li>Abstract ≤ {j.requirements.abstractMaxWords} words</li>}
                  {j.requirements.notes.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}
            <div className="row" style={{ flexWrap: "wrap" }}>
              {j.authorInstructionsUrl && <button className="btn" onClick={() => open(j.authorInstructionsUrl)}><BookOpen size={14} /> Author instructions</button>}
              {j.templateType !== "custom" && j.downloadUrl && <button className="btn" onClick={() => open(j.downloadUrl)}><ExternalLink size={14} /> {j.templateType === "ctan-class" ? "CTAN page" : "Template download page"}</button>}
              {j.templateType === "publisher-download" && <button className="btn" onClick={() => ui.openImport({ mode: "template", name: j.name, publisher: j.publisher })}><PackageOpen size={14} /> Import downloaded ZIP…</button>}
              {j.origin === "custom" && <button className="btn danger" onClick={async () => { if ((await confirm("Remove imported template?", `“${j.name}” will be removed from the library. Projects created from it are not affected.`, [{ id: "cancel", label: "Cancel" }, { id: "rm", label: "Remove", variant: "danger" }])) === "rm") { await api.deleteCustomTemplate(j.id); setSel(null); await reload(); } }}><Trash2 size={14} /> Remove</button>}
            </div>
            {rd.ready ? (
              <div className="create-box">
                <div className="label">Create a project with this format</div>
                <div className="row"><input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" /></div>
                <div className="row"><input className="input grow mono" value={dir} onChange={(e) => setDir(e.target.value)} /><button className="btn" onClick={async () => { const d = await openDialog({ directory: true }); if (typeof d === "string") setDir(d); }}><FolderOpen size={14} /></button></div>
                <button className="btn primary" disabled={busy || !name.trim()} onClick={create}>{busy ? "Creating…" : "Create project"}</button>
              </div>
            ) : (
              <div className="callout warn">
                <Download size={16} />
                <div>
                  {j.templateType === "ctan-class" ? <>The class <b>{j.ctanClass}</b> is not installed. TeX Live: <span className="mono">tlmgr install {j.ctanClass?.toLowerCase()}</span> (Debian/Ubuntu: <span className="mono">texlive-publishers</span>); MiKTeX installs it on first use or via MiKTeX Console. Then reopen this library.</> : <>Quantum Maze never redistributes publisher templates. Download the official ZIP from the publisher page, then use <b>Import downloaded ZIP</b>.</>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ImportDialog() {
  const req = useApp((s) => s.importRequest);
  const settings = useApp((s) => s.settings);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: req.name ?? "", publisher: req.publisher ?? "", official: false, mainFile: "", engine: "pdflatex", bibTool: "auto", url: "", notes: "", layout: "single-column", venue: "journal", dir: settings?.lastProjectDir ?? "" });
  useEffect(() => {
    if (!f.dir) documentDir().then((d) => setF((x) => ({ ...x, dir: d }))).catch(() => {});
  }, []);
  const pick = async (folder: boolean) => {
    const src = folder
      ? await openDialog({ directory: true, title: "Choose a folder of LaTeX sources" })
      : await openDialog({ title: req.mode === "project" ? "Choose a ZIP (Overleaf export or project archive)" : "Choose the template ZIP or class file", filters: [{ name: "Archives and LaTeX files", extensions: ["zip", "cls", "sty", "tex", "bst", "bbx", "cbx", "bib"] }] });
    if (typeof src !== "string") return;
    setBusy(true);
    try {
      const s = await api.stageImport(src);
      setStaged(s);
      const base = src.split(/[\\/]/).pop()!.replace(/\.zip$/i, "");
      setF((x) => ({ ...x, mainFile: s.report.mainFile ?? s.report.texFiles[0] ?? "", engine: s.report.engine, bibTool: s.report.bibTool === "biber" ? "biber" : "auto", name: x.name || base }));
    } catch (e) {
      toast("error", "Import rejected", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    if (!staged) return;
    setBusy(true);
    try {
      if (req.mode === "project") {
        const info = await api.createProjectFromStaged(staged.stagingPath, f.dir, f.name.trim(), f.mainFile);
        ui.closeDialog();
        await openProject(info.root);
        toast("success", "Project imported", "Imported sources are treated as untrusted: shell escape stays off and build scripts are ignored.");
      } else {
        const e = await api.installCustomTemplate({ stagingPath: staged.stagingPath, name: f.name.trim(), publisher: f.publisher.trim(), official: f.official, mainFile: f.mainFile, engine: f.engine, bibTool: f.bibTool, authorInstructionsUrl: f.url.trim() || null, notes: f.notes, layout: f.layout, venue: f.venue });
        toast("success", "Template added to the library", e.name);
        ui.openDialog("journals");
      }
    } catch (e) {
      toast("error", "Import failed", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const r = staged?.report;
  return (
    <Modal wide title={req.mode === "project" ? "Import project (ZIP, Overleaf archive or folder)" : "Import a journal template"} icon={<PackageOpen size={20} color="var(--accent)" />} onClose={busy ? undefined : ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog} disabled={busy}>Cancel</button><button className="btn primary" disabled={!r || busy || !f.name.trim() || !f.mainFile || (req.mode === "project" && !f.dir)} onClick={finish}>{req.mode === "project" ? "Create project" : "Add to library"}</button></>}>
      {!staged && (
        <>
          <div className="hint">Archives are extracted into a private staging folder with path-traversal, symlink and size protection, then analysed. Nothing inside is executed.</div>
          <div className="row">
            <button className="btn primary lg" onClick={() => pick(false)} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Choose ZIP or file…</button>
            <button className="btn lg" onClick={() => pick(true)} disabled={busy}><FolderOpen size={15} /> Choose folder…</button>
          </div>
        </>
      )}
      {r && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
          <div>
            <div className="label">Dependency report</div>
            <table className="table" style={{ marginTop: 6 }}>
              <tbody>
                <tr><td>Files</td><td>{r.fileCount}{staged.extract ? ` (extracted ${(staged.extract.bytes / 1024).toFixed(0)} KB)` : ""}</td></tr>
                <tr><td>Main document</td><td className="mono">{r.mainFile ?? "—"}</td></tr>
                <tr><td>Document class</td><td className="mono">{r.documentClass ?? "—"}</td></tr>
                <tr><td>Class / style files</td><td className="mono">{[...r.classes, ...r.styles].join(", ") || "—"}</td></tr>
                <tr><td>Bibliography</td><td className="mono">{[...r.bibFiles, ...r.bibStyles, ...r.biblatexStyles].join(", ") || "—"} · {r.bibTool}</td></tr>
                <tr><td>Images</td><td>{r.images.length}</td></tr>
                {r.instructions.length > 0 && <tr><td>Instructions</td><td className="mono">{r.instructions.join(", ")}</td></tr>}
              </tbody>
            </table>
            <div className="label" style={{ marginTop: 12 }}>Packages</div>
            <div className="pkg-list">
              {r.packages.map((p) => (
                <span key={p.name} className={"badge " + (p.providedByTemplate ? "accent" : p.installed ? "ok" : p.installed === false ? "err" : "")} title={p.providedByTemplate ? "Provided by the template" : p.installed ? "Installed" : p.installed === false ? "Not installed" : "Unknown"}>{p.name}</span>
              ))}
            </div>
            {(r.warnings.length > 0 || (staged.extract?.skipped.length ?? 0) > 0) && (
              <div className="callout warn" style={{ marginTop: 12, flexDirection: "column", gap: 4 }}>
                {r.warnings.map((w) => <div key={w}>{w}</div>)}
                {staged.extract?.skipped.map((w) => <div key={w} className="hint">Skipped: {w}</div>)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field"><label>{req.mode === "project" ? "Project name" : "Template / journal name"}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label>Main file</label><select className="select" value={f.mainFile} onChange={(e) => setF({ ...f, mainFile: e.target.value })}>{r.texFiles.map((t) => <option key={t}>{t}</option>)}</select></div>
            {req.mode === "project" ? (
              <div className="field"><label>Location</label><div className="row"><input className="input grow mono" value={f.dir} onChange={(e) => setF({ ...f, dir: e.target.value })} /><button className="btn" onClick={async () => { const d = await openDialog({ directory: true }); if (typeof d === "string") setF({ ...f, dir: d }); }}><FolderOpen size={14} /></button></div></div>
            ) : (
              <>
                <div className="field"><label>Publisher</label><input className="input" value={f.publisher} onChange={(e) => setF({ ...f, publisher: e.target.value })} /></div>
                <div className="row"><select className="select grow" value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })}><option value="pdflatex">pdfLaTeX</option><option value="xelatex">XeLaTeX</option><option value="lualatex">LuaLaTeX</option></select>
                  <select className="select grow" value={f.bibTool} onChange={(e) => setF({ ...f, bibTool: e.target.value })}><option value="auto">Bib: automatic</option><option value="bibtex">BibTeX</option><option value="biber">Biber</option></select></div>
                <div className="row"><select className="select grow" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })}><option value="journal">Journal</option><option value="conference">Conference</option></select>
                  <select className="select grow" value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value })}><option value="single-column">Single-column</option><option value="two-column">Two-column</option></select></div>
                <div className="field"><label>Author instructions URL (optional)</label><input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
                <label className="row" style={{ cursor: "pointer", alignItems: "flex-start" }}><input type="checkbox" checked={f.official} onChange={(e) => setF({ ...f, official: e.target.checked })} /><span>This ZIP was downloaded from the publisher's official site <span className="hint">(it will be labelled “official — declared by you”)</span></span></label>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
