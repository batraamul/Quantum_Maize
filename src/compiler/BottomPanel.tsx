import { useEffect, useMemo, useRef } from "react";
import { CheckCircle2, FileText, Lightbulb, Loader2, X } from "lucide-react";
import { goToDiagnostic, openFile, ui, useApp, type BottomTab } from "../app/store";
import { SeverityIcon } from "../components/Common";
import type { Diagnostic } from "../types";

function DiagList({ items, empty }: { items: Diagnostic[]; empty: string }) {
  if (!items.length)
    return (
      <div className="empty-state">
        <CheckCircle2 size={16} color="var(--success)" /> {empty}
      </div>
    );
  return (
    <div>
      {items.map((d, i) => (
        <div key={i} className="diag" onClick={() => goToDiagnostic(d)} title={d.file ? "Go to source" : undefined}>
          <span className="sev">
            <SeverityIcon s={d.severity} />
          </span>
          <div className="grow">
            <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
              {(d.file || d.externalFile) && (
                <span className="loc" style={{ color: d.file ? undefined : "var(--text-3)" }}>
                  {d.file ?? d.externalFile?.split("/").pop()}
                  {d.line ? `:${d.line}` : ""}
                </span>
              )}
              <span className="msg">{d.message}</span>
              <span className="badge" style={{ marginLeft: "auto", flexShrink: 0 }}>
                {d.source === "latex" ? d.category : d.source}
              </span>
            </div>
            {d.context && <div className="ctx">{d.context}</div>}
            {d.suggestion && (
              <div className="sugg">
                <Lightbulb size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{d.suggestion}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogView({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  if (!lines.length) return <div className="empty-state">No output yet. Compile to see the compiler's output here.</div>;
  return (
    <div
      className="log-view"
      ref={ref}
      onWheel={(e) => {
        const el = e.currentTarget.parentElement!;
        stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
      }}
    >
      {lines.map((l, i) => {
        const cls = l.startsWith("$ ") ? "l-cmd" : /^!|:\d+: |error/i.test(l) ? "l-err" : /warning/i.test(l) ? "l-warn" : "";
        return (
          <div key={i} className={cls}>
            {l || " "}
          </div>
        );
      })}
    </div>
  );
}

function DiagnosticsTab() {
  const r = useApp((s) => s.lastResult);
  const tex = useApp((s) => s.tex);
  const history = useApp((s) => s.history);
  const project = useApp((s) => s.project);
  const logRel = r?.logFile && project ? r.logFile.slice(project.root.length + 1).replace(/\\/g, "/") : null;
  return (
    <div style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 18 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Last build
        </div>
        {r ? (
          <table className="table">
            <tbody>
              <tr><td>Result</td><td>{r.success ? <span className="badge ok">success</span> : <span className="badge err">{r.cancelled ? "cancelled" : r.timedOut ? "timed out" : "failed"}</span>}</td></tr>
              <tr><td>Engine</td><td className="mono">{r.engine}</td></tr>
              <tr><td>Build tool</td><td className="mono">{r.tool === "direct" ? "direct passes (no latexmk)" : r.tool}</td></tr>
              <tr><td>Exit code</td><td className="mono">{r.exitCode ?? "—"}</td></tr>
              <tr><td>Duration</td><td className="mono">{(r.durationMs / 1000).toFixed(2)} s</td></tr>
              <tr><td>Errors / warnings</td><td className="mono">{r.errorCount} / {r.warningCount}</td></tr>
              <tr>
                <td>Full log</td>
                <td>
                  {logRel ? (
                    <button className="btn ghost" style={{ height: 22, padding: "0 6px" }} onClick={() => openFile(logRel)}>
                      <FileText size={13} /> {logRel}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="hint">No build yet in this session.</div>
        )}
        <div className="label" style={{ margin: "16px 0 8px" }}>
          TeX installation
        </div>
        <div className="hint">
          {tex?.distribution ?? "Not detected"} · latexmk {tex?.latexmkUsable ? "available" : "not available"} · {tex?.os}/{tex?.arch}
        </div>
      </div>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Compilation history
        </div>
        {history.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Result</th>
                <th>Engine</th>
                <th>Tool</th>
                <th>Time</th>
                <th>Err / Warn</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 25).map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.startedAt).toLocaleString()}</td>
                  <td>{h.success ? <span className="badge ok">ok</span> : <span className="badge err">failed</span>}</td>
                  <td className="mono">{h.engine}</td>
                  <td className="mono">{h.tool}</td>
                  <td className="mono">{(h.durationMs / 1000).toFixed(1)} s</td>
                  <td className="mono">
                    {h.errorCount} / {h.warningCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="hint">No compilations recorded for this project yet.</div>
        )}
      </div>
    </div>
  );
}

export function BottomPanel() {
  const tab = useApp((s) => s.bottomTab);
  const diags = useApp((s) => s.diagnostics);
  const out = useApp((s) => s.liveOutput);
  const compiling = useApp((s) => s.compiling);
  const raw = useApp((s) => s.lastResult?.rawOutput);
  const errors = useMemo(() => diags.filter((d) => d.severity === "error"), [diags]);
  const warnings = useMemo(() => diags.filter((d) => d.severity === "warning"), [diags]);
  const infos = useMemo(() => diags.filter((d) => d.severity === "info"), [diags]);
  const lines = out.length || compiling ? out : raw ? raw.split("\n") : [];
  const tabs: { id: BottomTab; label: string; count?: number; color?: string }[] = [
    { id: "errors", label: "Errors", count: errors.length, color: "var(--danger)" },
    { id: "warnings", label: "Warnings", count: warnings.length, color: "var(--warning)" },
    { id: "messages", label: "Messages", count: infos.length },
    { id: "output", label: "Compilation Output" },
    { id: "diagnostics", label: "Build Diagnostics" },
  ];
  return (
    <div className="bottom">
      <div className="bottom-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={"bottom-tab" + (tab === t.id ? " active" : "")} onClick={() => ui.showBottom(t.id)}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="badge" style={{ background: t.color ? `color-mix(in srgb, ${t.color} 20%, transparent)` : undefined, color: t.color }}>
                {t.count}
              </span>
            )}
            {t.id === "output" && compiling && <Loader2 size={12} className="spin" />}
          </button>
        ))}
        <button className="icon-btn" style={{ marginLeft: "auto", alignSelf: "center" }} title="Close panel" onClick={ui.toggleBottom}>
          <X size={15} />
        </button>
      </div>
      <div className="bottom-body">
        {tab === "errors" && <DiagList items={errors} empty="No errors" />}
        {tab === "warnings" && <DiagList items={warnings} empty="No warnings" />}
        {tab === "messages" && <DiagList items={infos} empty="No informational messages (bad boxes are hidden unless enabled in Settings → Compiler)" />}
        {tab === "output" && <LogView lines={lines} />}
        {tab === "diagnostics" && <DiagnosticsTab />}
      </div>
    </div>
  );
}
