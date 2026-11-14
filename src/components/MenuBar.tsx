import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { commands, type Command } from "../app/commands";
import { openProject, updateMeta, useApp } from "../app/store";
import { FORMAT_ACTIONS, INSERT_SNIPPETS } from "../editor/latexData";
import { insertSnippet, wrapSelection } from "../editor/activeEditor";
import { sc } from "./Common";
import type { Engine } from "../types";

type Item =
  | { type: "cmd"; cmd: Command; checked?: boolean }
  | { type: "action"; label: string; run: () => void; shortcut?: string; enabled?: boolean; checked?: boolean }
  | { type: "sep" }
  | { type: "label"; label: string }
  | { type: "note"; label: string };

const c = (id: keyof typeof commands, checked?: boolean): Item => ({ type: "cmd", cmd: commands[id], checked });
const sep: Item = { type: "sep" };

function useMenus(): { name: string; items: Item[] }[] {
  const s = useApp();
  const hasEditor = !!s.activePath && s.openFiles.find((f) => f.path === s.activePath)?.kind === "text";
  const engine = s.project?.meta.engine;
  const setEngine = (e: Engine) => updateMeta({ engine: e });
  const recent = s.recent.filter((r) => r.exists).slice(0, 8);
  return [
    {
      name: "File",
      items: [
        c("newProject"),
        c("openProject"),
        c("importProject"),
        ...(recent.length ? [{ type: "label", label: "Recent" } as Item] : []),
        ...recent.map<Item>((r) => ({ type: "action", label: r.name, run: () => openProject(r.path), enabled: r.path !== s.project?.root })),
        sep,
        c("newFile"),
        c("newFolder"),
        sep,
        c("save"),
        c("saveAll"),
        sep,
        c("closeProject"),
        c("settings"),
        sep,
        c("quit"),
      ],
    },
    {
      name: "Edit",
      items: [c("undo"), c("redo"), sep, c("find"), c("replace"), sep, c("toggleComment"), c("selectAll"), sep, c("foldAll"), c("unfoldAll"), sep, c("commandPalette")],
    },
    {
      name: "View",
      items: [
        c("toggleSidebar", s.sidebarVisible),
        c("togglePreview", s.previewVisible),
        c("toggleBottom", s.bottomVisible),
        c("toggleSplit", s.splitEditor),
        sep,
        c("outline"),
        sep,
        c("toggleTheme"),
        c("zoomIn"),
        c("zoomOut"),
        c("zoomReset"),
      ],
    },
    {
      name: "Insert",
      items: [c("insertTable"), c("insertEquation"), c("insertFigure"), sep, ...(["Structure", "Math", "Floats", "Lists", "References", "Research"] as const).flatMap((g, gi) => [
        ...(gi ? [sep] : []),
        { type: "label", label: g } as Item,
        ...INSERT_SNIPPETS.filter((x) => x.group === g).map<Item>((x) => ({ type: "action", label: x.label, run: () => insertSnippet(x.snippet), enabled: hasEditor })),
      ])],
    },
    {
      name: "Format",
      items: FORMAT_ACTIONS.map<Item>((f) => ({ type: "action", label: f.label, shortcut: f.shortcut, run: () => wrapSelection(f.before, f.after), enabled: hasEditor })),
    },
    {
      name: "Tools",
      items: [c("convert"), c("importProject"), sep, c("setupWizard"), sep, c("syncForward"), c("cleanBuild")],
    },
    {
      name: "Journal",
      items: [c("journalLibrary"), c("importTemplate"), sep, c("submission")],
    },
    {
      name: "Project",
      items: [
        c("projectSettings"),
        sep,
        { type: "label", label: "Engine" },
        ...(["pdflatex", "xelatex", "lualatex"] as Engine[]).map<Item>((e) => ({
          type: "action",
          label: { pdflatex: "pdfLaTeX", xelatex: "XeLaTeX", lualatex: "LuaLaTeX" }[e],
          run: () => setEngine(e),
          enabled: !!s.project,
          checked: engine === e,
        })),
      ],
    },
    {
      name: "Compile",
      items: [c("compile"), c("stopCompile"), sep, c("toggleAutoCompile", !!s.settings?.autoCompile), sep, c("present"), sep, c("showErrors"), c("showLog")],
    },
    { name: "Export", items: [c("exportPdf"), c("exportZip"), sep, c("exportDocx"), c("exportPptx"), c("exportStory"), c("saveStoryTemplate")] },
    { name: "Help", items: [c("shortcuts"), c("latexHelp"), sep, c("setupWizard"), c("about")] },
  ];
}

export function MenuBar({ children }: { children?: ReactNode }) {
  const menus = useMenus();
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % menus.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o + menus.length - 1) % menus.length));
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open, menus.length]);

  return (
    <div className="menubar" ref={ref} role="menubar">
      {menus.map((m, i) => (
        <div key={m.name} style={{ position: "relative" }}>
          <button
            className={"menu-trigger" + (open === i ? " open" : "")}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === i}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(open === i ? null : i);
            }}
            onMouseEnter={() => open !== null && setOpen(i)}
          >
            {m.name}
          </button>
          {open === i && (
            <div className="menu-dropdown" role="menu">
              {m.items.map((it, j) => renderItem(it, j, () => setOpen(null)))}
            </div>
          )}
        </div>
      ))}
      {children}
    </div>
  );
}

function renderItem(it: Item, key: number, close: () => void) {
  if (it.type === "sep") return <div key={key} className="menu-sep" />;
  if (it.type === "label") return <div key={key} className="menu-label">{it.label}</div>;
  if (it.type === "note")
    return (
      <div key={key} className="menu-item" style={{ color: "var(--text-3)", height: "auto", padding: "6px 10px", whiteSpace: "normal", maxWidth: 280 }}>
        {it.label}
      </div>
    );
  const label = it.type === "cmd" ? it.cmd.label : it.label;
  const shortcut = it.type === "cmd" ? it.cmd.shortcut : it.shortcut;
  const enabled = it.type === "cmd" ? (it.cmd.enabled ? it.cmd.enabled() : true) : it.enabled !== false;
  const run = it.type === "cmd" ? it.cmd.run : it.run;
  return (
    <button
      key={key}
      className="menu-item"
      role="menuitem"
      disabled={!enabled}
      onClick={() => {
        close();
        void run();
      }}
    >
      <span className="menu-icon">{it.checked ? <Check size={14} /> : null}</span>
      <span>{label}</span>
      {shortcut && <span className="kbd">{sc(shortcut)}</span>}
    </button>
  );
}
