import { History, Keyboard } from "lucide-react";
import { Modal, sc } from "./Common";
import { restoreRecovery, ui, useApp } from "../app/store";
import { commands } from "../app/commands";
import logo from "../../assets/icons/quantum-maze.svg";

export function AboutDialog() {
  const info = useApp((s) => s.appInfo);
  const tex = useApp((s) => s.tex);
  return (
    <Modal title="About Quantum Maze" onClose={ui.closeDialog} footer={<button className="btn primary" onClick={ui.closeDialog}>Close</button>}>
      <div className="row" style={{ gap: 16 }}>
        <img src={logo} width={56} height={56} alt="" />
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)" }}>Quantum Maze – Research &amp; LaTeX Studio</div>
          <div className="hint">
            Version {info?.version} · {info?.os}/{info?.arch}
          </div>
        </div>
      </div>
      <div>A local, private desktop environment for writing and compiling research papers in LaTeX.</div>
      <div className="hint">
        TeX: {tex?.distribution ?? "not detected"}. Built with Tauri, React, Monaco Editor and Mozilla PDF.js. Compilation uses your locally installed TeX distribution.
      </div>
    </Modal>
  );
}

export function ShortcutsDialog() {
  const groups: [string, (keyof typeof commands)[]][] = [
    ["Project & files", ["newProject", "openProject", "newFile", "save", "saveAll", "settings"]],
    ["Compile & preview", ["compile", "stopCompile", "syncForward", "exportPdf"]],
    ["Layout", ["toggleSidebar", "togglePreview", "toggleBottom", "toggleSplit", "zoomIn", "zoomOut"]],
    ["Editing", ["undo", "redo", "find", "replace", "toggleComment", "commandPalette"]],
  ];
  return (
    <Modal wide title="Keyboard shortcuts" icon={<Keyboard size={20} color="var(--accent)" />} onClose={ui.closeDialog} footer={<button className="btn primary" onClick={ui.closeDialog}>Close</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
        {groups.map(([g, ids]) => (
          <div key={g}>
            <div className="label" style={{ margin: "8px 0" }}>
              {g}
            </div>
            {ids.map((id) => (
              <div key={id} className="row" style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="grow" style={{ color: "var(--text-1)" }}>
                  {commands[id].label.replace("…", "")}
                </span>
                <span className="kbd">{sc(commands[id].shortcut ?? "")}</span>
              </div>
            ))}
          </div>
        ))}
        <div>
          <div className="label" style={{ margin: "8px 0" }}>
            In the editor
          </div>
          {[
            ["Bold / italic", "Ctrl+B / Ctrl+I"],
            ["Autocomplete", "Ctrl+Space"],
            ["Fold / unfold block", "Ctrl+Shift+[ / ]"],
            ["Multi-cursor", "Alt+Click"],
            ["PDF → source", "Double-click in PDF"],
          ].map(([a, b]) => (
            <div key={a} className="row" style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="grow" style={{ color: "var(--text-1)" }}>
                {a}
              </span>
              <span className="kbd">{sc(b)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function RecoveryDialog() {
  const data = useApp((s) => s.recoveryData);
  if (!data) return null;
  const files = Object.keys(data.files);
  return (
    <Modal
      title="Recover unsaved changes?"
      icon={<History size={20} color="var(--warning)" />}
      footer={
        <>
          <button className="btn danger" onClick={() => restoreRecovery(false)}>
            Discard
          </button>
          <button className="btn primary" onClick={() => restoreRecovery(true)}>
            Restore changes
          </button>
        </>
      }
    >
      <div>Quantum Maze found unsaved edits from a previous session that ended unexpectedly ({new Date(data.savedAt).toLocaleString()}):</div>
      <ul style={{ margin: 0 }}>
        {files.map((f) => (
          <li key={f} className="mono">
            {f}
          </li>
        ))}
      </ul>
      <div className="hint">Restoring loads them into the editor as unsaved changes. Your files on disk are not modified until you save.</div>
    </Modal>
  );
}
