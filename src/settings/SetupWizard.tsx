import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Cpu, ExternalLink, FolderOpen, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Modal, Switch } from "../components/Common";
import { detectTex, toast, ui, updateSettings, useApp } from "../app/store";
import type { Engine, Theme } from "../types";

const TOOL_LABEL: Record<string, string> = {
  pdflatex: "pdfLaTeX engine",
  xelatex: "XeLaTeX engine",
  lualatex: "LuaLaTeX engine",
  latexmk: "latexmk build tool",
  bibtex: "BibTeX",
  biber: "Biber (biblatex)",
  makeindex: "MakeIndex",
  makeglossaries: "MakeGlossaries",
  synctex: "SyncTeX",
  kpsewhich: "kpsewhich",
  tlmgr: "TeX Live package manager",
  mpm: "MiKTeX package manager",
  miktex: "MiKTeX console CLI",
  pandoc: "Pandoc (Word ⇄ LaTeX conversion)",
  perl: "Perl (needed by latexmk)",
};

export function TexStatus({ compact = false }: { compact?: boolean }) {
  const tex = useApp((s) => s.tex);
  const detecting = useApp((s) => s.texDetecting);
  const settings = useApp((s) => s.settings);
  const [custom, setCustom] = useState(settings?.texBinDir ?? "");
  if (!tex) return <div className="row hint"><Loader2 size={15} className="spin" /> Detecting…</div>;
  const relevant = tex.tools.filter((t) => !["mpm", "miktex", "tlmgr"].includes(t.name) || t.found);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className={"callout " + (tex.ready ? "ok" : "warn")}>
        {tex.ready ? <CheckCircle2 color="var(--success)" /> : <XCircle color="var(--danger)" />}
        <div className="grow">
          <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{tex.ready ? `${tex.distribution} detected` : "No LaTeX engine found"}</div>
          <div className="hint">
            {tex.os} · {tex.arch}
            {tex.packageManager ? ` · package manager: ${tex.packageManager}` : ""}
          </div>
        </div>
        <button className="btn" onClick={() => detectTex(custom || null)} disabled={detecting}>
          {detecting ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Rescan
        </button>
      </div>
      {tex.guidance.map((g) => (
        <div key={g.title} className="callout">
          <Cpu size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div className="grow">
            <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{g.title}</div>
            <div className="hint" style={{ marginTop: 3, userSelect: "text" }}>{g.detail}</div>
          </div>
          {g.url && (
            <button className="btn" onClick={() => openUrl(g.url!).catch((e) => toast("error", "Could not open browser", String(e)))}>
              <ExternalLink size={14} /> Open
            </button>
          )}
        </div>
      ))}
      {!compact && (
        <table className="table tool-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Status</th>
              <th>Version / location</th>
            </tr>
          </thead>
          <tbody>
            {relevant.map((t) => (
              <tr key={t.name}>
                <td title={TOOL_LABEL[t.name]}>{t.name}</td>
                <td>{t.found ? <span className="badge ok">found</span> : <span className="badge">missing</span>}</td>
                <td style={{ userSelect: "text", fontSize: ".8rem" }}>
                  {t.version && <div>{t.version}</div>}
                  {t.path && <div className="muted mono">{t.path}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="field">
        <label>Custom TeX binaries folder (optional)</label>
        <div className="row">
          <input className="input grow mono" placeholder="e.g. /usr/local/texlive/2025/bin/x86_64-linux" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button
            className="btn"
            onClick={async () => {
              const d = await openDialog({ directory: true, title: "Select the folder containing pdflatex" });
              if (typeof d === "string") setCustom(d);
            }}
          >
            <FolderOpen size={14} />
          </button>
          <button
            className="btn"
            onClick={async () => {
              await updateSettings({ texBinDir: custom.trim() || null });
              await detectTex(custom.trim() || null);
            }}
          >
            Apply
          </button>
        </div>
        <span className="hint">Searched first, before PATH and standard install locations. Quantum Maze never modifies your system PATH.</span>
      </div>
    </div>
  );
}

export function SetupWizard() {
  const settings = useApp((s) => s.settings);
  const [step, setStep] = useState(settings?.setupCompleted ? 1 : 0);
  const [theme, setTheme] = useState<Theme>(settings?.theme ?? "dark");
  const [engine, setEngine] = useState<Engine>(settings?.defaultEngine ?? "pdflatex");
  const [auto, setAuto] = useState(settings?.autoCompile ?? true);
  const [prof, setProf] = useState({ ownerName: settings?.ownerName ?? "", ownerRank: settings?.ownerRank ?? "", ownerOrganization: settings?.ownerOrganization ?? "", ownerEmail: settings?.ownerEmail ?? "" });
  const finish = async () => {
    await updateSettings({ theme, defaultEngine: engine, autoCompile: auto, setupCompleted: true, ...prof });
    ui.closeDialog();
  };
  const titles = ["Welcome to Quantum Maze", "Your profile", "LaTeX installation", "Preferences"];
  return (
    <Modal
      wide
      title={titles[step]}
      icon={<ShieldCheck size={20} color="var(--accent)" />}
      onClose={settings?.setupCompleted ? ui.closeDialog : undefined}
      footer={
        <>
          <div className="steps" style={{ width: 120, marginRight: "auto", alignSelf: "center" }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i <= step ? "on" : ""} />
            ))}
          </div>
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button className="btn primary" onClick={finish}>
              Finish
            </button>
          )}
        </>
      }
    >
      {step === 0 && (
        <>
          <p style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Quantum Maze is a local studio for research papers, presentations and interactive stories.</p>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Your projects are ordinary folders on your computer. Nothing is uploaded and no account is needed.</li>
            <li>No telemetry. Online features (template downloads, DOI lookup) will always be opt-in.</li>
            <li>Documents compile with the TeX distribution installed on this computer. Quantum Maze never installs system software or changes your PATH without asking.</li>
            <li>Shell escape is disabled by default, and imported projects cannot run build scripts.</li>
          </ul>
          <p className="hint" style={{ margin: 0 }}>The next step checks which LaTeX tools are available.</p>
        </>
      )}
      {step === 1 && <ProfileForm value={prof} onChange={setProf} />}
      {step === 2 && <TexStatus />}
      {step === 3 && (
        <div>
          <div className="setting-row">
            <div className="sr-text">
              <div className="sr-title">Theme</div>
            </div>
            <select className="select" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Follow system</option>
            </select>
          </div>
          <div className="setting-row">
            <div className="sr-text">
              <div className="sr-title">Default engine for new projects</div>
              <div className="hint">Most journal templates use pdfLaTeX.</div>
            </div>
            <select className="select" value={engine} onChange={(e) => setEngine(e.target.value as Engine)}>
              <option value="pdflatex">pdfLaTeX</option>
              <option value="xelatex">XeLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
            </select>
          </div>
          <div className="setting-row">
            <div className="sr-text">
              <div className="sr-title">Auto-compile</div>
              <div className="hint">Saves and recompiles after you pause typing. It never runs on every keystroke.</div>
            </div>
            <Switch checked={auto} onChange={setAuto} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export interface Profile {
  ownerName: string;
  ownerRank: string;
  ownerOrganization: string;
  ownerEmail: string;
}

export function ProfileForm({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const f = (k: keyof Profile, label: string, ph: string) => (
    <div className="field">
      <label>{label}</label>
      <input className="input" placeholder={ph} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="hint">Shown as “Quantum Maze by …” in the title bar and used as the default author in new papers, slides and stories. All fields are optional and stay on this computer.</div>
      {f("ownerName", "Name", "e.g. Dr. A. Researcher")}
      {f("ownerRank", "Rank / designation", "e.g. Scientist F")}
      {f("ownerOrganization", "Organization", "e.g. National Research Laboratory")}
      {f("ownerEmail", "E-mail (for manuscripts)", "name@organization.org")}
      {(value.ownerName || value.ownerRank || value.ownerOrganization) && (
        <div className="callout"><b style={{ color: "var(--text-1)" }}>Quantum Maze</b><span className="muted">by {[value.ownerName, value.ownerRank, value.ownerOrganization].filter(Boolean).join(", ")}</span></div>
      )}
    </div>
  );
}
