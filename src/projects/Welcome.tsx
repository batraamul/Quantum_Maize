import { BookOpen, CheckCircle2, Cpu, FilePlus2, FolderOpen, Globe, Library, Loader2, Presentation, Trash2, XCircle } from "lucide-react";
import { chooseAndOpenProject, openProject, ownerByline, refreshRecent, ui, useApp } from "../app/store";
import { api } from "../services/api";
import logo from "../../assets/icons/quantum-maze.svg";

export function Welcome() {
  const recent = useApp((s) => s.recent);
  const tex = useApp((s) => s.tex);
  const detecting = useApp((s) => s.texDetecting);
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div>
          <img src={logo} width={64} height={64} alt="" />
          <h1>Quantum Maze</h1>
          {ownerByline() && <div className="owner-line">by {ownerByline()}</div>}
          <p className="tag">Write, compile and submit research papers, build presentations, and publish interactive stories — all on your own machine. No account, no upload, no subscription.</p>
          <div className="actions">
            <button className="action-card" onClick={() => ui.openDialog("newProject")}>
              <span className="ai">
                <FilePlus2 size={20} />
              </span>
              <span>
                <div className="at">New project</div>
                <div className="ad">Research paper, presentation, interactive story or blank article</div>
              </span>
            </button>
            <button className="action-card" onClick={() => chooseAndOpenProject()}>
              <span className="ai">
                <FolderOpen size={20} />
              </span>
              <span>
                <div className="at">Open project or LaTeX folder</div>
                <div className="ad">Existing folders are used in place; nothing is moved or rewritten</div>
              </span>
            </button>
            <div className="mini-actions">
              <button className="btn" onClick={() => ui.openDialog("journals")}><Library size={14} /> Journal library</button>
              <button className="btn" onClick={() => ui.openDialog("newProject")}><Presentation size={14} /> Slides</button>
              <button className="btn" onClick={() => ui.openDialog("newProject")}><Globe size={14} /> Story</button>
              <button className="btn" onClick={() => ui.openDialog("convert")}>Word ⇄ LaTeX</button>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3>Recent projects</h3>
            {recent.length === 0 && <div className="hint">Projects you open will appear here.</div>}
            {recent.map((r) => (
              <div key={r.path} className="recent-item" onClick={() => r.exists && openProject(r.path)} style={{ opacity: r.exists ? 1 : 0.5 }} title={r.exists ? r.path : "Folder not found"}>
                <BookOpen size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div className="grow">
                  <div className="rn">{r.name}</div>
                  <div className="rp">{"\u200e" + r.path + "\u200e"}</div>
                </div>
                <span className="muted" style={{ fontSize: ".78rem", whiteSpace: "nowrap" }}>
                  {r.exists ? new Date(r.lastOpenedAt).toLocaleDateString() : "missing"}
                </span>
                <button
                  className="icon-btn x"
                  title="Remove from list (files are not touched)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await api.forgetRecent(r.path);
                    await refreshRecent();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>LaTeX installation</h3>
            {detecting || !tex ? (
              <div className="row hint">
                <Loader2 size={15} className="spin" /> Detecting TeX distributions…
              </div>
            ) : (
              <div className="row" style={{ alignItems: "flex-start" }}>
                {tex.ready ? <CheckCircle2 size={20} color="var(--success)" /> : <XCircle size={20} color="var(--danger)" />}
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{tex.ready ? tex.distribution : "No TeX distribution found"}</div>
                  <div className="hint" style={{ marginTop: 3 }}>
                    {tex.ready
                      ? `Engines: ${["pdflatex", "xelatex", "lualatex"].filter((e) => tex.tools.find((t) => t.name === e)?.found).join(", ")} · latexmk ${tex.latexmkUsable ? "✓" : "—"} · Biber ${tex.tools.find((t) => t.name === "biber")?.found ? "✓" : "—"}`
                      : "Install TeX Live, MacTeX or MiKTeX to compile documents."}
                  </div>
                </div>
                <button className="btn" onClick={() => ui.openDialog("setup")}>
                  <Cpu size={14} /> Details
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
