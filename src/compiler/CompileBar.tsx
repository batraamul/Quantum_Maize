// Compile controls shown at the top of the PDF pane: Recompile (with options),
// logs toggle with error/warning count, and PDF download.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileText, Loader2 } from "lucide-react";
import { runCommand } from "../app/commands";
import { compile, ui, updateMeta, updateSettings, useApp } from "../app/store";
import { sc } from "../components/Common";
import type { Engine } from "../types";

const ENGINES: { id: Engine; label: string }[] = [
  { id: "pdflatex", label: "pdfLaTeX" },
  { id: "xelatex", label: "XeLaTeX" },
  { id: "lualatex", label: "LuaLaTeX" },
];

export function CompileBar() {
  const project = useApp((s) => s.project);
  const compiling = useApp((s) => s.compiling);
  const errors = useApp((s) => s.lastResult?.errorCount ?? 0);
  const warnings = useApp((s) => s.lastResult?.warningCount ?? 0);
  const logsOpen = useApp((s) => s.bottomVisible);
  const auto = useApp((s) => s.settings?.autoCompile ?? false);
  const hasPdf = useApp((s) => !!s.pdfData);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  const engine = project?.meta.engine ?? "pdflatex";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const tick = (on: boolean) => <span className="menu-icon">{on ? "✓" : ""}</span>;

  return (
    <div className="compile-bar" ref={ref}>
      <button className={"recompile" + (compiling ? " running" : "")} disabled={!project} onClick={() => (compiling ? runCommand("stopCompile") : compile())} title={compiling ? `Stop compilation (${sc("Ctrl+Shift+.")})` : `Recompile (${sc("Ctrl+Enter")})`}>
        {compiling && <Loader2 size={15} className="spin" />}
        {compiling ? "Compiling…" : "Recompile"}
      </button>
      <button className="recompile split" disabled={!project} aria-label="Compile options" onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="menu-dropdown" style={{ left: 6, top: 36, minWidth: 250 }}>
          <div className="menu-label">Auto compile</div>
          <button className="menu-item" onClick={pick(() => void updateSettings({ autoCompile: true }))}>{tick(auto)}On</button>
          <button className="menu-item" onClick={pick(() => void updateSettings({ autoCompile: false }))}>{tick(!auto)}Off</button>
          <div className="menu-sep" />
          <div className="menu-label">Compiler</div>
          {ENGINES.map((e) => (
            <button key={e.id} className="menu-item" onClick={pick(() => void updateMeta({ engine: e.id }))}>{tick(e.id === engine)}{e.label}</button>
          ))}
          <div className="menu-sep" />
          <button className="menu-item" disabled={!compiling} onClick={pick(() => runCommand("stopCompile"))}>{tick(false)}Stop compilation</button>
          <button className="menu-item" disabled={compiling} onClick={pick(() => { void (async () => { await runCommand("cleanBuild"); void compile(); })(); })}>{tick(false)}Recompile from scratch</button>
        </div>
      )}
      <button className={"logs-btn" + (logsOpen ? " active" : "")} title="Logs and output files" aria-pressed={logsOpen} onClick={() => (logsOpen ? ui.toggleBottom() : ui.showBottom(errors ? "errors" : warnings ? "warnings" : "output"))}>
        <FileText size={16} />
        {(errors > 0 || warnings > 0) && <span className={"count " + (errors ? "err" : "warn")}>{(errors || warnings) > 999 ? "999+" : errors || warnings}</span>}
      </button>
      <button className="icon-btn" title="Download PDF" disabled={!hasPdf} onClick={() => runCommand("exportPdf")}>
        <Download size={16} />
      </button>
    </div>
  );
}
