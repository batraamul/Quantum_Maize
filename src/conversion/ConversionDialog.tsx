import { useEffect, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { documentDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { ArrowRightLeft, FileText, FolderOpen, Loader2 } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { openProject, saveAll, toast, ui, useApp } from "../app/store";
import { Modal } from "../components/Common";
import type { ConversionReport } from "../types";

export function ReportView({ r }: { r: ConversionReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="callout ok" style={{ flexDirection: "column", gap: 2 }}>
        <b style={{ color: "var(--text-1)" }}>{r.direction} finished</b>
        <span className="hint mono" style={{ wordBreak: "break-all" }}>{r.output}</span>
      </div>
      <div className="pkg-list">{r.counts.map(([k, v]) => <span key={k} className="badge">{k}: {v}</span>)}</div>
      <div className="label">Needs manual attention</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>{r.manual.map((m) => <li key={m}>{m}</li>)}</ul>
      {r.warnings.length > 0 && (
        <details>
          <summary className="label" style={{ cursor: "pointer" }}>Pandoc warnings ({r.warnings.length})</summary>
          <div className="log-view" style={{ maxHeight: 160, overflow: "auto" }}>{r.warnings.join("\n")}</div>
        </details>
      )}
      <div className="hint">{r.pandocVersion}. Conversion is never guaranteed to be lossless — proof-read the result. The original file was not modified.</div>
    </div>
  );
}

export function ConversionDialog() {
  const project = useApp((s) => s.project);
  const settings = useApp((s) => s.settings);
  const pandoc = useApp((s) => s.tex?.tools.find((t) => t.name === "pandoc"));
  const [tab, setTab] = useState<"in" | "out">(project && project.meta.kind !== "story" ? "out" : "in");
  const [docx, setDocx] = useState("");
  const [dir, setDir] = useState(settings?.lastProjectDir ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [newRoot, setNewRoot] = useState<string | null>(null);
  useEffect(() => {
    if (!dir) documentDir().then(setDir).catch(() => {});
  }, []);
  const runIn = async () => {
    setBusy(true);
    try {
      const [r, info] = await api.convertDocxToLatex(docx, dir, name.trim());
      setReport(r);
      setNewRoot(info.root);
    } catch (e) {
      toast("error", "Conversion failed", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const runOut = async () => {
    if (!project) return;
    await saveAll(true);
    const dest = await saveDialog({ title: "Save Word document", defaultPath: `${project.meta.name}.docx`, filters: [{ name: "Word document", extensions: ["docx"] }] });
    if (!dest) return;
    setBusy(true);
    try {
      setReport(await api.convertLatexToDocx(project.root, dest));
      setNewRoot(null);
    } catch (e) {
      toast("error", "Conversion failed", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal wide title="Conversion Centre" icon={<ArrowRightLeft size={20} color="var(--accent)" />} onClose={busy ? undefined : ui.closeDialog}
      footer={report ? (
        <>
          {newRoot ? <button className="btn primary" onClick={async () => { ui.closeDialog(); await openProject(newRoot); }}>Open converted project</button> : <button className="btn primary" onClick={() => openPath(report.output).catch((e) => toast("error", "Could not open", String(e)))}>Open in Word / LibreOffice</button>}
          <button className="btn" onClick={() => setReport(null)}>Convert another</button>
          <button className="btn" onClick={ui.closeDialog}>Close</button>
        </>
      ) : (
        <>
          <button className="btn" onClick={ui.closeDialog} disabled={busy}>Cancel</button>
          {tab === "in" ? <button className="btn primary" disabled={busy || !docx || !name.trim() || !dir} onClick={runIn}>{busy ? <><Loader2 size={14} className="spin" /> Converting…</> : "Convert to LaTeX project"}</button>
            : <button className="btn primary" disabled={busy || !project || project.meta.kind === "story"} onClick={runOut}>{busy ? <><Loader2 size={14} className="spin" /> Converting…</> : "Convert to Word…"}</button>}
        </>
      )}>
      {!pandoc?.found && <div className="callout warn">Pandoc was not found. Install it from pandoc.org, then rescan in Tools → TeX Setup Wizard.</div>}
      {report ? <ReportView r={report} /> : (
        <>
          <div className="row" style={{ gap: 0 }}>
            <button className={"bottom-tab" + (tab === "out" ? " active" : "")} onClick={() => setTab("out")}>LaTeX → Word</button>
            <button className={"bottom-tab" + (tab === "in" ? " active" : "")} onClick={() => setTab("in")}>Word → LaTeX</button>
          </div>
          {tab === "in" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field"><label>Word document</label><div className="row"><input className="input grow mono" value={docx} readOnly placeholder="Choose a .docx file" />
                <button className="btn" onClick={async () => { const p = await openDialog({ filters: [{ name: "Word", extensions: ["docx"] }] }); if (typeof p === "string") { setDocx(p); if (!name) setName(p.split(/[\\/]/).pop()!.replace(/\.docx$/i, "") + " (LaTeX)"); } }}><FileText size={14} /> Choose…</button></div></div>
              <div className="field"><label>New project name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><label>Location</label><div className="row"><input className="input grow mono" value={dir} onChange={(e) => setDir(e.target.value)} /><button className="btn" onClick={async () => { const d = await openDialog({ directory: true }); if (typeof d === "string") setDir(d); }}><FolderOpen size={14} /></button></div></div>
              <div className="hint">Creates a structured project: main.tex, one file per section in sections/, extracted images in media/, and CONVERSION_REPORT.md. Headings, lists, tables, images, captions, equations, footnotes and links are preserved where Pandoc can. The Word file is not modified.</div>
            </div>
          ) : (
            <div className="hint" style={{ lineHeight: 1.6 }}>
              {project && project.meta.kind !== "story" ? <>Converts <b className="mono">{project.meta.mainFile}</b> of <b>{project.meta.name}</b> (including \input files and the .bib bibliography) to a Word document. Use this for journals that require Word submissions, such as the Defence Science Journal. The LaTeX sources are not changed.</> : "Open a LaTeX project first."}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
