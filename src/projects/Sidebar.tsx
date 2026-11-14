import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  File,
  FileCode2,
  FileImage,
  FileText,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTree,
  RefreshCw,
  Search,
  Settings2,
  Presentation,
  ClipboardCheck,
  Link2,
  ShieldAlert,
  Sparkles,
  Star,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  confirm,
  deletePath,
  newFile,
  newFolder,
  openFile,
  refreshTree,
  renamePath,
  toast,
  ui,
  updateMeta,
  useApp,
  allFiles,
  type SidebarTab,
} from "../app/store";
import { insertSnippet } from "../editor/activeEditor";
import { isDirty } from "../editor/models";
import { INSERT_SNIPPETS } from "../editor/latexData";
import { SlidesPanel } from "../presentation/PresentationTools";
import { SubmissionPanel } from "../validation/SubmissionPanel";
import { api, errorMessage } from "../services/api";
import { confirm as askConfirm, updateSettings, readProjectText, reindex, prompt as askPrompt } from "../app/store";
import { getModel } from "../editor/models";
import { Switch } from "../components/Common";
import type { BibTool, Engine, FileNode } from "../types";

export function ActivityBar() {
  const tab = useApp((s) => s.sidebarTab);
  const visible = useApp((s) => s.sidebarVisible);
  const dup = useApp((s) => s.duplicateBibKeys.length);
  const kind = useApp((s) => s.project?.meta.kind);
  const items: { id: SidebarTab; icon: ReactNode; label: string; badge?: number }[] = [
    { id: "explorer", icon: <Folder size={20} />, label: "Project Explorer" },
    ...(kind === "presentation" ? [{ id: "slides" as SidebarTab, icon: <Presentation size={20} />, label: "Slides" }] : []),
    { id: "outline", icon: <ListTree size={20} />, label: "Outline" },
    { id: "references", icon: <BookMarked size={20} />, label: "References", badge: dup || undefined },
    { id: "snippets", icon: <Sparkles size={20} />, label: "Snippets" },
    ...(kind === "latex" ? [{ id: "submission" as SidebarTab, icon: <ClipboardCheck size={20} />, label: "Submission checklist" }] : []),
    { id: "project", icon: <Settings2 size={20} />, label: "Project Settings" },
  ];
  return (
    <nav className="activitybar" aria-label="Sidebar panels">
      {items.map((it) => (
        <button key={it.id} className={"activity-btn" + (visible && tab === it.id ? " active" : "")} title={it.label} aria-label={it.label} onClick={() => ui.showSidebarTab(it.id)}>
          {it.icon}
          {it.badge ? <span className="activity-badge">{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const tab = useApp((s) => s.sidebarTab);
  if (tab === "outline") return <OutlinePanel />;
  if (tab === "references") return <ReferencesPanel />;
  if (tab === "snippets") return <SnippetsPanel />;
  if (tab === "project") return <ProjectSettingsPanel />;
  if (tab === "slides") return <SlidesPanel />;
  if (tab === "submission") return <SubmissionPanel />;
  return <FilesAndOutline />;
}

/** File tree on top, collapsible file outline underneath. */
function FilesAndOutline() {
  const [open, setOpen] = useState(() => localStorage.getItem("qm-outline-open") !== "0");
  const toggle = () => setOpen((v) => { localStorage.setItem("qm-outline-open", v ? "0" : "1"); return !v; });
  return (
    <div className="files-outline">
      <div style={{ flex: open ? "1 1 58%" : "1 1 auto", minHeight: 0 }}><Explorer /></div>
      <div className={"outline-dock" + (open ? " open" : "")}>
        <button className="outline-head" onClick={toggle} aria-expanded={open}>
          <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} /> File outline
        </button>
        {open && <OutlineList />}
      </div>
    </div>
  );
}

// ---- explorer -------------------------------------------------------------------

function fileIcon(n: FileNode, open: boolean) {
  switch (n.kind) {
    case "folder":
      return open ? <FolderOpen size={15} color="#e0af68" /> : <Folder size={15} color="#e0af68" />;
    case "tex":
      return <FileCode2 size={15} color="#7aa2f7" />;
    case "bib":
      return <BookMarked size={15} color="#bb9af7" />;
    case "style":
      return <FileCode2 size={15} color="#9ece6a" />;
    case "image":
      return <FileImage size={15} color="#2ac3de" />;
    case "pdf":
      return <FileText size={15} color="#f7768e" />;
    case "build":
      return <File size={15} color="var(--text-3)" />;
    default:
      return <FileText size={15} color="var(--text-3)" />;
  }
}

interface Ctx {
  x: number;
  y: number;
  node: FileNode | null;
}

function Explorer() {
  const project = useApp((s) => s.project)!;
  const tree = useApp((s) => s.tree);
  const active = useApp((s) => s.activePath);
  useApp((s) => s.dirtyTick);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["sections", "figures", "references"]));
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [showBuild, setShowBuild] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [ctx]);

  // Reveal the active file's folders.
  useEffect(() => {
    if (!active?.includes("/")) return;
    const parts = active.split("/");
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
      return next;
    });
  }, [active]);

  const toggle = (p: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const render = (nodes: FileNode[], depth: number): ReactNode =>
    nodes
      .filter((n) => showBuild || n.kind !== "build")
      .map((n) => {
        const isOpen = expanded.has(n.path);
        const isMain = n.path === project.meta.mainFile;
        return (
          <div key={n.path}>
            <div
              className={"tree-row" + (active === n.path ? " active" : "")}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (n.kind === "folder" ? toggle(n.path) : void openFile(n.path))}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtx({ x: e.clientX, y: e.clientY, node: n });
              }}
              title={n.path}
              role="treeitem"
              aria-expanded={n.kind === "folder" ? isOpen : undefined}
            >
              <span className="chev">{n.kind === "folder" ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}</span>
              <span className="ficon">{fileIcon(n, isOpen)}</span>
              <span className="name">{n.name}</span>
              {isMain && <span className="main-badge">MAIN</span>}
              {!isMain && isDirty(n.path) && <span className="dirty-dot" title="Unsaved changes" />}
            </div>
            {n.kind === "folder" && isOpen && n.children && render(n.children, depth + 1)}
          </div>
        );
      });

  const parentOf = (n: FileNode | null) => (n ? (n.kind === "folder" ? n.path : n.path.includes("/") ? n.path.slice(0, n.path.lastIndexOf("/")) : "") : "");

  return (
    <div className="panel">
      <div className="panel-header">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={project.root}>
          File tree
        </span>
        <div className="actions">
          <button className="icon-btn" title="New file" onClick={() => newFile()}>
            <FilePlus size={16} />
          </button>
          <button className="icon-btn" title="New folder" onClick={() => newFolder()}>
            <FolderPlus size={16} />
          </button>
          <button className="icon-btn" title="Refresh" onClick={() => refreshTree()}>
            <RefreshCw size={15} />
          </button>
          <button className="icon-btn" title="Collapse all" onClick={() => setExpanded(new Set())}>
            <ChevronsDownUp size={15} />
          </button>
        </div>
      </div>
      <div
        className="panel-body tree"
        role="tree"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setCtx({ x: e.clientX, y: e.clientY, node: null });
          }
        }}
      >
        {render(tree, 0)}
        <label className="row hint" style={{ padding: "12px 14px", cursor: "pointer" }}>
          <input type="checkbox" checked={showBuild} onChange={(e) => setShowBuild(e.target.checked)} /> Show build files (.aux, .log, …)
        </label>
      </div>
      {ctx && (
        <div className="ctx-menu" style={{ left: ctx.x, top: ctx.y }} onMouseDown={(e) => e.stopPropagation()}>
          {[
            { label: "New file…", run: () => newFile(parentOf(ctx.node)) },
            { label: "New folder…", run: () => newFolder(parentOf(ctx.node)) },
            ...(ctx.node
              ? [
                  ...(ctx.node.kind === "tex" && ctx.node.path !== project.meta.mainFile
                    ? [{ label: "Set as main file", run: () => updateMeta({ mainFile: ctx.node!.path }) }]
                    : []),
                  ...(ctx.node.kind !== "folder" ? [{ label: "Open in split editor", run: () => openFile(ctx.node!.path, undefined, { secondary: true }) }] : []),
                  { label: "Rename…", run: () => renamePath(ctx.node!.path) },
                  { label: "Move to project trash", run: () => deletePath(ctx.node!.path) },
                ]
              : []),
            {
              label: "Reveal in file manager",
              run: async () => {
                try {
                  await revealItemInDir(ctx.node ? `${project.root}/${ctx.node.path}` : project.root);
                } catch (e) {
                  toast("error", "Could not open the file manager", String(e));
                }
              },
            },
          ].map((it) => (
            <button
              key={it.label}
              className="menu-item"
              onClick={() => {
                setCtx(null);
                void it.run();
              }}
            >
              <span className="menu-icon" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- outline ----------------------------------------------------------------------

function OutlineList() {
  const outline = useApp((s) => s.outline);
  const active = useApp((s) => s.activePath);
  const line = useApp((s) => s.cursor.line);
  // Highlight the heading the cursor is under.
  let cur = -1;
  outline.forEach((o, i) => { if (o.file === active && o.line <= line) cur = i; });
  return (
    <div className="outline-list">
      {outline.length === 0 && <div className="hint" style={{ padding: "10px 14px" }}>We can’t find any sections or subsections in this project.</div>}
      {outline.map((o, i) => (
        <div key={i} className={"outline-item" + (i === cur ? " current" : "")} style={{ paddingLeft: 12 + Math.max(0, o.level - 1) * 14 }} onClick={() => openFile(o.file, { line: o.line })} title={`${o.file}:${o.line}`}>
          <span className="t" style={{ fontStyle: o.starred ? "italic" : undefined }}>{o.title}</span>
        </div>
      ))}
    </div>
  );
}

function OutlinePanel() {
  return (
    <div className="panel">
      <div className="panel-header">File outline</div>
      <div className="panel-body" style={{ padding: "6px 0" }}><OutlineList /></div>
    </div>
  );
}

// ---- references --------------------------------------------------------------------

function ReferencesPanel() {
  const entries = useApp((s) => s.bibEntries);
  const dups = useApp((s) => s.duplicateBibKeys);
  const [q, setQ] = useState("");
  const allowOnline = useApp((s) => s.settings?.allowOnline ?? false);
  const outline = useApp((s) => s.outline);
  const cited = useMemo(() => {
    const keys = new Set<string>();
    for (const f of allFiles().filter((f) => f.kind === "tex")) {
      const t = readProjectText(f.path) ?? "";
      for (const m of t.matchAll(/\\(?:no)?cite[a-zA-Z]*\*?\s*(?:\[[^\]]*\]){0,2}\s*\{([^}]+)\}/g)) m[1].split(",").forEach((k) => k.trim() && k.trim() !== "*" && keys.add(k.trim()));
    }
    return keys;
  }, [entries, outline]);
  const missing = [...cited].filter((k) => !entries.some((e) => e.key === k));
  const uncited = entries.filter((e) => !cited.has(e.key));
  const addDoi = async () => {
    if (!allowOnline) {
      const ok = await askConfirm("Enable online DOI lookup?", "Looking up a DOI sends only the DOI to doi.org to fetch its BibTeX record. No manuscript content is uploaded. You can turn this off again in Settings → Privacy.", [{ id: "cancel", label: "Cancel" }, { id: "on", label: "Enable", variant: "primary" }]);
      if (ok !== "on") return;
      await updateSettings({ allowOnline: true });
    }
    const doi = await askPrompt("Add reference by DOI", "DOI (e.g. 10.1109/ACCESS.2024.1234567)", "");
    if (!doi) return;
    try {
      const rec = await api.doiLookup(doi);
      const key = /@\w+\s*\{\s*([^,\s]+)/.exec(rec)?.[1];
      if (key && entries.some((e) => e.key === key)) return toast("info", `${key} is already in the bibliography`);
      let bibPath = allFiles().find((f) => f.kind === "bib")?.path;
      let created = false;
      if (!bibPath) {
        // No bibliography yet: create one rather than sending the user away.
        const root = useApp.getState().project?.root;
        if (!root) return;
        bibPath = "references.bib";
        await api.createFile(root, bibPath, "");
        await refreshTree();
        created = true;
      }
      await openFile(bibPath);
      const m = getModel(bibPath);
      if (m) {
        const end = m.getFullModelRange().getEndPosition();
        const sep = m.getValue().trim() === "" ? "" : m.getValue().endsWith("\n") ? "\n" : "\n\n";
        m.pushEditOperations([], [{ range: { startLineNumber: end.lineNumber, startColumn: end.column, endLineNumber: end.lineNumber, endColumn: end.column }, text: sep + rec.trim() + "\n" }], () => null);
      }
      void reindex(false);
      toast("success", `Added ${key ?? "reference"} to ${bibPath}`, created ? "Created references.bib. Add \\bibliography{references} to your main file, then save." : "Review the record, then save.");
    } catch (e) {
      toast("error", "DOI lookup failed", errorMessage(e));
    }
  };
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? entries.filter((e) => [e.key, e.title, e.author, e.year].some((x) => x.toLowerCase().includes(t))) : entries;
  }, [entries, q]);
  return (
    <div className="panel">
      <div className="panel-header">
        References <span className="badge" style={{ marginLeft: 6 }}>{entries.length}</span>
      </div>
      <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
        <div className="row" style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 9, color: "var(--text-3)" }} />
          <input className="input grow" style={{ paddingLeft: 28 }} placeholder="Search key, title, author…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn" style={{ marginTop: 8, width: "100%" }} onClick={addDoi}><Link2 size={14} /> Add reference by DOI…</button>
        {missing.length > 0 && <div className="callout warn" style={{ marginTop: 8, padding: 8, fontSize: ".86rem" }}>Cited but not in any .bib: <span className="mono">{missing.join(", ")}</span></div>}
        {uncited.length > 0 && <div className="hint" style={{ marginTop: 6 }}>Not cited: <span className="mono">{uncited.map((u) => u.key).slice(0, 8).join(", ")}{uncited.length > 8 ? " …" : ""}</span></div>}
        {dups.length > 0 && (
          <div className="callout warn" style={{ marginTop: 10, padding: 8, fontSize: ".86rem" }}>
            <ShieldAlert size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
            <span>
              Duplicate key{dups.length > 1 ? "s" : ""}: <span className="mono">{dups.join(", ")}</span>
            </span>
          </div>
        )}
      </div>
      <div className="panel-body">
        {entries.length === 0 && <div className="hint" style={{ padding: 16 }}>No .bib entries found. Add a .bib file to the project to manage references here.</div>}
        {shown.map((e, i) => (
          <div key={e.key + i} className="ref-item" title="Click to insert citation · Alt+click to open entry" onClick={(ev) => (ev.altKey ? openFile(e.file, { line: e.line }) : insertSnippet(`\\cite{${e.key}}`))}>
            <div className="row">
              <span className="k">{e.key}</span>
              {dups.includes(e.key) && <span className="badge warn">duplicate</span>}
              <span className="muted" style={{ marginLeft: "auto", fontSize: ".8rem" }}>
                {e.type}
              </span>
            </div>
            {e.title && <div className="ti">{e.title}</div>}
            {(e.author || e.year) && <div className="au">{[e.author, e.year].filter(Boolean).join(" · ")}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- snippets ------------------------------------------------------------------------

function SnippetsPanel() {
  const hasEditor = useApp((s) => s.openFiles.find((f) => f.path === s.activePath)?.kind === "text");
  return (
    <div className="panel">
      <div className="panel-header">Snippets</div>
      <div className="panel-body">
        {!hasEditor && <div className="hint" style={{ padding: "10px 14px" }}>Open a .tex file to insert snippets at the cursor.</div>}
        {(["Structure", "Math", "Floats", "Lists", "References", "Research"] as const).map((g) => (
          <div key={g}>
            <div className="snip-group">{g}</div>
            {INSERT_SNIPPETS.filter((s) => s.group === g).map((s) => (
              <button key={s.id} className="snip" disabled={!hasEditor} onClick={() => insertSnippet(s.snippet)}>
                <Sparkles size={13} color="var(--accent)" /> {s.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- project settings ------------------------------------------------------------------

function ProjectSettingsPanel() {
  const project = useApp((s) => s.project)!;
  const tree = useApp((s) => s.tree);
  const texFiles = useMemo(() => allFiles().filter((f) => f.kind === "tex").map((f) => f.path), [tree]);
  const [name, setName] = useState(project.meta.name);
  useEffect(() => setName(project.meta.name), [project.meta.name]);
  const m = project.meta;
  return (
    <div className="panel">
      <div className="panel-header">Project Settings</div>
      <div className="panel-body">
        <div className="section-block">
          <div className="field">
            <label>Project name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== m.name && updateMeta({ name: name.trim() })} />
          </div>
          <div className="field">
            <label>Main document</label>
            <select className="select" value={m.mainFile} onChange={(e) => updateMeta({ mainFile: e.target.value })}>
              {texFiles.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <span className="hint">The file passed to the compiler. It must contain \documentclass.</span>
          </div>
          <div className="field">
            <label>LaTeX engine</label>
            <select className="select" value={m.engine} onChange={(e) => updateMeta({ engine: e.target.value as Engine })}>
              <option value="pdflatex">pdfLaTeX</option>
              <option value="xelatex">XeLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
            </select>
          </div>
          <div className="field">
            <label>Bibliography tool</label>
            <select className="select" value={m.bibTool} onChange={(e) => updateMeta({ bibTool: e.target.value as BibTool })}>
              <option value="auto">Automatic (detect BibTeX / Biber)</option>
              <option value="bibtex">BibTeX</option>
              <option value="biber">Biber (biblatex)</option>
            </select>
            <span className="hint">With latexmk the tool is detected automatically; this setting applies to direct builds.</span>
          </div>
        </div>
        <div className="section-block">
          <div className="row">
            <div className="grow">
              <div style={{ color: "var(--text-1)", fontWeight: 500 }}>Allow shell escape</div>
              <div className="hint">Needed by packages such as minted. Lets the document run programs on your computer.</div>
            </div>
            <Switch
              checked={m.shellEscape}
              label="Allow shell escape"
              onChange={async (v) => {
                if (!v) return updateMeta({ shellEscape: false });
                const c = await confirm(
                  "Enable shell escape for this project?",
                  "Shell escape lets LaTeX code in this project execute arbitrary programs with your user permissions. Only enable it for documents you wrote or fully trust. It stays enabled for this project only.",
                  [
                    { id: "cancel", label: "Cancel" },
                    { id: "enable", label: "Enable for this project", variant: "danger" },
                  ],
                );
                if (c === "enable") await updateMeta({ shellEscape: true });
              }}
            />
          </div>
        </div>
        <div className="section-block">
          <div className="hint">
            <div>
              <Star size={12} style={{ verticalAlign: -1 }} /> Location: <span className="mono" style={{ userSelect: "text" }}>{project.root}</span>
            </div>
            <div style={{ marginTop: 4 }}>Created {new Date(m.createdAt).toLocaleString()} · {m.createdWith || "Quantum Maze"}</div>
            <div style={{ marginTop: 4 }}>Build output: output/ · last good PDF kept in .qmaze/build/</div>
          </div>
        </div>
      </div>
    </div>
  );
}
