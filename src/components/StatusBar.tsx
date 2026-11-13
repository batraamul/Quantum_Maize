import { AlertTriangle, CheckCircle2, CircleDashed, Cpu, Loader2, Moon, Save, Sun, XCircle } from "lucide-react";
import { commands } from "../app/commands";
import { dirtyPaths, effectiveTheme, ui, useApp } from "../app/store";

export function StatusBar() {
  const project = useApp((s) => s.project);
  const tex = useApp((s) => s.tex);
  const detecting = useApp((s) => s.texDetecting);
  const compiling = useApp((s) => s.compiling);
  const r = useApp((s) => s.lastResult);
  const settings = useApp((s) => s.settings);
  useApp((s) => s.dirtyTick);
  const dirty = dirtyPaths().length;
  const theme = effectiveTheme();

  return (
    <footer className="statusbar">
      <button className={"status-item" + (tex && !tex.ready ? " err" : "")} onClick={() => ui.openDialog("setup")} title="TeX installation — click for details">
        {detecting ? <Loader2 size={12} className="spin" /> : <Cpu size={12} />}
        {detecting ? "Detecting TeX…" : tex?.ready ? tex.distribution : "No TeX distribution"}
      </button>
      {project && project.meta.kind !== "story" && (
        <>
          <span className="status-item">
            {project.meta.mainFile} · {project.meta.engine}
            {project.meta.shellEscape && <span className="badge warn">shell-escape</span>}
          </span>
          {compiling ? (
            <span className="status-item">
              <Loader2 size={12} className="spin" /> Compiling…
            </span>
          ) : r ? (
            <button className={"status-item " + (r.success ? "ok" : "err")} onClick={() => ui.showBottom(r.errorCount ? "errors" : r.warningCount ? "warnings" : "diagnostics")}>
              {r.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {r.success ? `Built in ${(r.durationMs / 1000).toFixed(1)} s` : r.message}
              {r.warningCount > 0 && (
                <span className="row" style={{ gap: 3, color: "var(--warning)" }}>
                  <AlertTriangle size={12} /> {r.warningCount}
                </span>
              )}
            </button>
          ) : (
            <span className="status-item">
              <CircleDashed size={12} /> Not compiled yet
            </span>
          )}
        </>
      )}
      <span style={{ flex: 1 }} />
      {project && (
        <span className="status-item" title={settings?.autosave ? `Auto-save every ${settings.autosaveIntervalSecs}s` : "Auto-save off"}>
          <Save size={12} /> {dirty ? `${dirty} unsaved` : "All saved"}
          {settings?.autosave ? " · auto" : ""}
        </span>
      )}
      {settings?.autoCompile && project && project.meta.kind !== "story" && <span className="status-item">Auto-compile on</span>}
      <button className="status-item" onClick={() => void commands.toggleTheme.run()} title="Toggle theme">
        {theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
      </button>
      <span className="status-item">Local · offline-first</span>
    </footer>
  );
}
