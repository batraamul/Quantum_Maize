import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  FileArchive,
  FilePlus2,
  FolderOpen,
  Loader2,
  PanelBottom,
  PanelRight,
  Play,
  Redo2,
  Save,
  Square,
  Undo2,
  Zap,
  Globe,
  Library,
  MonitorPlay,
  Presentation,
} from "lucide-react";
import { runCommand } from "../app/commands";
import { compile, ui, updateMeta, updateSettings, useApp, dirtyPaths } from "../app/store";
import { runEditorAction } from "../editor/activeEditor";
import { sc } from "./Common";
import type { Engine } from "../types";

const ENGINES: { id: Engine; label: string; hint: string }[] = [
  { id: "pdflatex", label: "pdfLaTeX", hint: "Fast, most journal templates" },
  { id: "xelatex", label: "XeLaTeX", hint: "Unicode & system fonts" },
  { id: "lualatex", label: "LuaLaTeX", hint: "Unicode, Lua scripting" },
];

export function Toolbar() {
  const project = useApp((s) => s.project);
  const compiling = useApp((s) => s.compiling);
  const previewVisible = useApp((s) => s.previewVisible);
  const bottomVisible = useApp((s) => s.bottomVisible);
  const errorCount = useApp((s) => s.lastResult?.errorCount ?? 0);
  const autoCompile = useApp((s) => s.settings?.autoCompile ?? false);
  const hasPdf = useApp((s) => !!s.pdfData);
  const activeIsText = useApp((s) => s.openFiles.find((f) => f.path === s.activePath)?.kind === "text");
  useApp((s) => s.dirtyTick);
  const anyDirty = dirtyPaths().length > 0;
  const [engineOpen, setEngineOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engineOpen) return;
    const h = (e: MouseEvent) => ddRef.current && !ddRef.current.contains(e.target as Node) && setEngineOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [engineOpen]);

  const engine = ENGINES.find((e) => e.id === project?.meta.engine) ?? ENGINES[0];
  const kind = project?.meta.kind;

  return (
    <div className="toolbar" role="toolbar" aria-label="Main toolbar">
      <button className="tool-btn" title={`New project (${sc("Ctrl+Shift+N")})`} onClick={() => runCommand("newProject")}>
        <FilePlus2 size={17} /> New
      </button>
      <button className="tool-btn" title={`Open project or LaTeX folder (${sc("Ctrl+O")})`} onClick={() => runCommand("openProject")}>
        <FolderOpen size={17} /> Open
      </button>
      <button className="tool-btn" title={`Save all (${sc("Ctrl+Shift+S")})`} disabled={!project || !anyDirty} onClick={() => runCommand("saveAll")}>
        <Save size={17} />
        Save
      </button>
      <div className="sep" />
      <button className="tool-btn" title={`Undo (${sc("Ctrl+Z")})`} disabled={!activeIsText} onClick={() => runEditorAction("undo")}>
        <Undo2 size={17} />
      </button>
      <button className="tool-btn" title={`Redo (${sc("Ctrl+Shift+Z")})`} disabled={!activeIsText} onClick={() => runEditorAction("redo")}>
        <Redo2 size={17} />
      </button>
      <div className="sep" />

      {kind === "story" ? (
        <button className="compile-btn" style={{ borderRadius: 6 }} onClick={() => runCommand("exportStory")}>
          <Globe size={15} /> Export web page
        </button>
      ) : (
      <div className="row" style={{ gap: 0, position: "relative" }} ref={ddRef}>
        <button
          className={"compile-btn" + (compiling ? " running" : "")}
          disabled={!project}
          onClick={() => compile()}
          title={`Compile with ${engine.label} (${sc("Ctrl+Enter")})`}
        >
          {compiling ? <Loader2 size={16} className="spin" /> : <Play size={15} fill="currentColor" />}
          {compiling ? "Compiling…" : "Compile"}
          <span style={{ opacity: 0.75, fontWeight: 500, fontSize: ".85rem" }}>{engine.label}</span>
        </button>
        <button className="compile-split" disabled={!project} aria-label="Choose engine" onClick={() => setEngineOpen((v) => !v)}>
          <ChevronDown size={15} />
        </button>
        {!compiling && errorCount > 0 && (
          <button className="err-badge" title={`${errorCount} error${errorCount === 1 ? "" : "s"} in the last compile — click to see them`} onClick={() => ui.showBottom("errors")}>
            {errorCount > 999 ? "999+" : errorCount}
          </button>
        )}
        {engineOpen && (
          <div className="menu-dropdown" style={{ left: 0, minWidth: 260 }}>
            <div className="menu-label">LaTeX engine for this project</div>
            {ENGINES.map((e) => (
              <button
                key={e.id}
                className="menu-item"
                style={{ height: 40 }}
                onClick={() => {
                  setEngineOpen(false);
                  void updateMeta({ engine: e.id });
                }}
              >
                <span className="menu-icon">{e.id === engine.id ? "✓" : ""}</span>
                <span>
                  {e.label}
                  <div className="kbd" style={{ paddingLeft: 0 }}>
                    {e.hint}
                  </div>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}
      {kind !== "story" && <>
      <button className="tool-btn stop-btn" title={`Stop compilation (${sc("Ctrl+Shift+.")})`} disabled={!compiling} onClick={() => runCommand("stopCompile")}>
        <Square size={14} fill="currentColor" /> Stop
      </button>
      <button
        className={"tool-btn" + (autoCompile ? " active" : "")}
        title="Auto-compile after a pause in typing"
        onClick={() => updateSettings({ autoCompile: !autoCompile })}
        aria-pressed={autoCompile}
      >
        <Zap size={16} /> Auto
      </button>
      </>}
      {kind === "presentation" && (
        <button className="tool-btn" title="Present full-screen (F5)" disabled={!hasPdf} onClick={() => runCommand("present")}>
          <MonitorPlay size={17} /> Present
        </button>
      )}
      <div className="sep" />
      <button className="tool-btn" title="Journal Template Library (Ctrl+Shift+J)" onClick={() => runCommand("journalLibrary")}>
        <Library size={17} /> Journals
      </button>

      <div style={{ flex: 1 }} />

      {kind !== "story" && <>
      <button className={"tool-btn" + (previewVisible ? " active" : "")} title={`PDF preview (${sc("Ctrl+Alt+P")})`} onClick={ui.togglePreview} aria-pressed={previewVisible}>
        <PanelRight size={17} /> Preview
      </button>
      <button className={"tool-btn" + (bottomVisible ? " active" : "")} title={`Output & errors (${sc("Ctrl+J")})`} onClick={ui.toggleBottom} aria-pressed={bottomVisible}>
        <PanelBottom size={17} />
      </button>
      <div className="sep" />
      <button className="tool-btn" title="Export the compiled PDF" disabled={!hasPdf} onClick={() => runCommand("exportPdf")}>
        <Download size={17} /> PDF
      </button>
      {kind === "presentation" && (
        <button className="tool-btn" title="Export to PowerPoint" onClick={() => runCommand("exportPptx")}>
          <Presentation size={17} /> PPTX
        </button>
      )}
      </>}
      <button className="tool-btn" title="Export project sources as a ZIP archive" disabled={!project} onClick={() => runCommand("exportZip")}>
        <FileArchive size={17} /> ZIP
      </button>
    </div>
  );
}
