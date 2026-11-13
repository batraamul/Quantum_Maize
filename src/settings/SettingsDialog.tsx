import { useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Modal, Switch } from "../components/Common";
import { ui, updateSettings, useApp } from "../app/store";
import { ProfileForm, TexStatus } from "./SetupWizard";
import type { Engine, Settings, Theme } from "../types";

type Section = "profile" | "appearance" | "editor" | "saving" | "compiler" | "tex" | "privacy" | "about";

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="sr-text">
        <div className="sr-title">{title}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Num({ value, min, max, step = 1, onChange, suffix }: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string }) {
  const [v, setV] = useState(String(value));
  return (
    <div className="row">
      <input
        className="input"
        style={{ width: 90 }}
        type="number"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.min(max, Math.max(min, Number(v) || min));
          setV(String(n));
          onChange(n);
        }}
      />
      {suffix && <span className="muted">{suffix}</span>}
    </div>
  );
}

export function SettingsDialog() {
  const s = useApp((st) => st.settings) as Settings;
  const info = useApp((st) => st.appInfo);
  const [sec, setSec] = useState<Section>("profile");
  const set = (p: Partial<Settings>) => updateSettings(p);
  const nav: { id: Section; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "saving", label: "Saving & recovery" },
    { id: "compiler", label: "Compiler" },
    { id: "tex", label: "TeX installation" },
    { id: "privacy", label: "Privacy & online" },
    { id: "about", label: "About" },
  ];
  return (
    <Modal wide title="Settings" icon={<Settings2 size={20} color="var(--accent)" />} onClose={ui.closeDialog} bodyClass="no-pad" footer={<button className="btn primary" onClick={ui.closeDialog}>Done</button>}>
      <div className="settings-layout" style={{ margin: "-10px -22px -18px" }}>
        <div className="settings-nav">
          {nav.map((n) => (
            <button key={n.id} className={sec === n.id ? "active" : ""} onClick={() => setSec(n.id)}>
              {n.label}
            </button>
          ))}
        </div>
        <div className="settings-content">
          {sec === "profile" && (
            <div style={{ paddingTop: 12 }}>
              <ProfileFormLive />
            </div>
          )}
          {sec === "privacy" && (
            <>
              <Row title="Allow online services" hint="Currently used only for DOI lookup (sends just the DOI to doi.org). Off by default. Quantum Maze has no telemetry and never uploads manuscripts.">
                <Switch checked={s.allowOnline} onChange={(v) => set({ allowOnline: v })} />
              </Row>
              <div className="hint" style={{ paddingTop: 10, lineHeight: 1.6 }}>Template downloads always happen in your web browser, from the publisher's own site. Links you click open in the system browser.</div>
            </>
          )}
          {sec === "appearance" && (
            <>
              <Row title="Theme">
                <select className="select" value={s.theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">Follow system</option>
                </select>
              </Row>
              <Row title="Interface size" hint="Scales the whole interface (Ctrl + = / Ctrl + -).">
                <select className="select" value={s.uiScale} onChange={(e) => set({ uiScale: Number(e.target.value) })}>
                  {[0.85, 0.9, 1, 1.1, 1.2, 1.3].map((z) => (
                    <option key={z} value={z}>
                      {Math.round(z * 100)}%
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
          {sec === "editor" && (
            <>
              <Row title="Font size">
                <Num value={s.editorFontSize} min={8} max={40} onChange={(n) => set({ editorFontSize: n })} suffix="px" />
              </Row>
              <Row title="Font family" hint="CSS font list; the first installed font is used.">
                <input className="input mono" style={{ width: 300 }} defaultValue={s.editorFontFamily} onBlur={(e) => set({ editorFontFamily: e.target.value })} />
              </Row>
              <Row title="Word wrap" hint="Wrap long lines at the editor width (recommended for prose).">
                <Switch checked={s.wordWrap} onChange={(v) => set({ wordWrap: v })} />
              </Row>
              <Row title="Minimap">
                <Switch checked={s.minimap} onChange={(v) => set({ minimap: v })} />
              </Row>
              <Row title="Tab size">
                <Num value={s.tabSize} min={1} max={8} onChange={(n) => set({ tabSize: n })} suffix="spaces" />
              </Row>
            </>
          )}
          {sec === "saving" && (
            <>
              <Row title="Auto-save" hint="Saves modified files periodically. Files are always saved before compiling.">
                <Switch checked={s.autosave} onChange={(v) => set({ autosave: v })} />
              </Row>
              <Row title="Auto-save interval">
                <Num value={s.autosaveIntervalSecs} min={5} max={3600} onChange={(n) => set({ autosaveIntervalSecs: n })} suffix="seconds" />
              </Row>
              <div className="hint" style={{ paddingTop: 10, lineHeight: 1.6 }}>
                <strong>Crash recovery:</strong> unsaved buffers are written every few seconds to <span className="mono">.qmaze/recovery.json</span> in the project and offered for restore after an unexpected exit.
                <br />
                <strong>Version history:</strong> before a file is overwritten, the previous version is kept in <span className="mono">.qmaze/history/</span> (at most one snapshot per 5 minutes, 30 per file).
                <br />
                <strong>Deleting</strong> moves files to <span className="mono">.qmaze/trash/</span>.
              </div>
            </>
          )}
          {sec === "compiler" && (
            <>
              <Row title="Auto-compile while typing" hint="Saves and recompiles after a pause. It never runs on every keystroke.">
                <Switch checked={s.autoCompile} onChange={(v) => set({ autoCompile: v })} />
              </Row>
              <Row title="Typing pause before auto-compile">
                <Num value={s.autoCompileDelayMs} min={500} max={30000} step={250} onChange={(n) => set({ autoCompileDelayMs: n })} suffix="ms" />
              </Row>
              <Row title="Default engine for new projects">
                <select className="select" value={s.defaultEngine} onChange={(e) => set({ defaultEngine: e.target.value as Engine })}>
                  <option value="pdflatex">pdfLaTeX</option>
                  <option value="xelatex">XeLaTeX</option>
                  <option value="lualatex">LuaLaTeX</option>
                </select>
              </Row>
              <Row title="Use latexmk when available" hint="latexmk decides how many passes are needed and runs BibTeX/Biber. Without it, Quantum Maze runs the passes itself.">
                <Switch checked={s.useLatexmk} onChange={(v) => set({ useLatexmk: v })} />
              </Row>
              <Row title="Compilation time limit" hint="Builds running longer than this are stopped (protects against infinite loops).">
                <Num value={s.compileTimeoutSecs} min={10} max={3600} onChange={(n) => set({ compileTimeoutSecs: n })} suffix="seconds" />
              </Row>
              <Row title="Show bad-box messages" hint="Overfull/underfull box notices in the Messages tab.">
                <Switch checked={s.showBadboxes} onChange={(v) => set({ showBadboxes: v })} />
              </Row>
              <div className="hint" style={{ paddingTop: 10 }}>
                Security: shell escape is disabled unless enabled per project. Project-supplied latexmkrc files are ignored. TeX may only write files inside the project.
              </div>
            </>
          )}
          {sec === "tex" && (
            <div style={{ paddingTop: 12 }}>
              <TexStatus />
            </div>
          )}
          {sec === "about" && (
            <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <strong>Quantum Maze</strong> {info?.version}
              </div>
              <div className="hint">
                Platform: {info?.os} / {info?.arch}
              </div>
              <div className="hint">
                Application data: <span className="mono" style={{ userSelect: "text" }}>{info?.dataDir}</span>
              </div>
              <div className="hint">Database schema version: {info?.schemaVersion}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ProfileFormLive() {
  const s = useApp((st) => st.settings) as Settings;
  const [v, setV] = useState({ ownerName: s.ownerName, ownerRank: s.ownerRank, ownerOrganization: s.ownerOrganization, ownerEmail: s.ownerEmail });
  return (
    <>
      <ProfileForm value={v} onChange={setV} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={() => updateSettings(v)}>Save profile</button>
      </div>
    </>
  );
}
