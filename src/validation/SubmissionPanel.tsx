import { useEffect, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { CheckCircle2, CircleDashed, FileArchive, Loader2, PlayCircle, XCircle, AlertTriangle } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { collectSources, openFile, saveAll, toast, ui, updateMeta, useApp } from "../app/store";
import { runChecks, summary, type CheckItem, type CheckStatus } from "./checks";
import { useJournals } from "../journal-library/JournalLibrary";

const ICON: Record<CheckStatus, JSX.Element> = {
  verified: <CheckCircle2 size={15} color="var(--success)" />,
  warning: <AlertTriangle size={15} color="var(--warning)" />,
  missing: <XCircle size={15} color="var(--danger)" />,
  "not-checked": <CircleDashed size={15} color="var(--text-3)" />,
};

export function SubmissionPanel() {
  const project = useApp((s) => s.project)!;
  const { list } = useJournals();
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const journal = list?.find((j) => j.id === project.meta.journalId) ?? null;
  const run = async () => {
    setBusy(true);
    try {
      const st = useApp.getState();
      const sources = await collectSources();
      setItems(
        runChecks({
          sources,
          bibKeys: st.bibEntries.map((b) => b.key),
          duplicateBibKeys: st.duplicateBibKeys,
          diagnostics: st.lastResult?.diagnostics ?? [],
          compiled: st.lastResult ? st.lastResult.success : st.pdfFromPreviousSession ? true : null,
          pdfPages: st.pdfPageCount,
          requirements: journal?.requirements ?? null,
          journalName: journal?.name ?? null,
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (list) void run();
  }, [list, project.meta.journalId]);
  const pkg = async () => {
    await saveAll(true);
    const dest = await saveDialog({ title: "Save submission package", defaultPath: `${project.meta.name}-submission.zip`, filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (!dest) return;
    try {
      const m = await api.buildSubmission(project.root, dest);
      toast("success", `Submission package created (${m.length} files + MANIFEST.txt)`, dest);
      revealItemInDir(dest).catch(() => {});
    } catch (e) {
      toast("error", "Could not build the package", errorMessage(e));
    }
  };
  const s = items ? summary(items) : null;
  return (
    <div className="panel">
      <div className="panel-header">Submission</div>
      <div className="section-block" style={{ gap: 10 }}>
        <div className="field">
          <label>Target journal profile</label>
          <select className="select" value={project.meta.journalId ?? ""} onChange={(e) => updateMeta({ journalId: e.target.value || null })}>
            <option value="">Generic checks (no journal)</option>
            {list?.map((j) => <option key={j.id} value={j.id}>{j.name} — {j.publisher}</option>)}
          </select>
        </div>
        <div className="row">
          <button className="btn grow" onClick={run} disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <PlayCircle size={14} />} Re-check</button>
          <button className="btn primary grow" onClick={pkg}><FileArchive size={14} /> Package…</button>
        </div>
        {journal?.templateType === "community-profile" && <button className="btn" onClick={() => ui.openDialog("convert")}>This journal takes Word files — Convert…</button>}
        {s && (
          <div className="pkg-list">
            <span className="badge ok">{s.verified} verified</span>
            <span className="badge warn">{s.warning} warnings</span>
            <span className="badge err">{s.missing} missing</span>
            <span className="badge">{s["not-checked"]} manual</span>
          </div>
        )}
      </div>
      <div className="panel-body">
        {items?.map((i) => (
          <div key={i.id} className="check-item" onClick={() => i.file && openFile(i.file, i.line ? { line: i.line } : undefined)} style={{ cursor: i.file ? "pointer" : "default" }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>{ICON[i.status]}</span>
            <div className="grow">
              <div style={{ color: "var(--text-1)" }}>{i.label}</div>
              <div className="hint">{i.detail}{i.file ? ` — ${i.file}${i.line ? `:${i.line}` : ""}` : ""}</div>
            </div>
          </div>
        ))}
        <div className="hint" style={{ padding: 14 }}>A clean checklist does not guarantee compliance or acceptance. Always read the journal's current author instructions.</div>
      </div>
    </div>
  );
}
