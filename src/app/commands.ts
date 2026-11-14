// Command registry shared by the menu bar, toolbar and keyboard shortcuts so a
// shortcut always does exactly what its menu item does.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  cancelCompile,
  chooseAndOpenProject,
  cleanBuild,
  closeProject,
  compile,
  exportPdf,
  exportZip,
  guardUnsaved,
  newFile,
  newFolder,
  saveAll,
  saveFile,
  syncForward,
  toast,
  ui,
  updateSettings,
  useApp,
  effectiveTheme,
} from "./store";
import { runEditorAction } from "../editor/activeEditor";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
}

const hasProject = () => !!useApp.getState().project;
const isLatex = () => { const k = useApp.getState().project?.meta.kind; return !!k && k !== "story"; };
const isStory = () => useApp.getState().project?.meta.kind === "story";
const isDeck = () => useApp.getState().project?.meta.kind === "presentation";
const hasEditor = () => !!useApp.getState().activePath;

export const commands: Record<string, Command> = {
  newProject: { id: "newProject", label: "New Project…", shortcut: "Ctrl+Shift+N", run: () => ui.openDialog("newProject") },
  openProject: { id: "openProject", label: "Open Project / Folder…", shortcut: "Ctrl+O", run: chooseAndOpenProject },
  closeProject: { id: "closeProject", label: "Close Project", run: closeProject, enabled: hasProject },
  newFile: { id: "newFile", label: "New File…", shortcut: "Ctrl+N", run: () => newFile(), enabled: hasProject },
  newFolder: { id: "newFolder", label: "New Folder…", run: () => newFolder(), enabled: hasProject },
  save: {
    id: "save",
    label: "Save",
    shortcut: "Ctrl+S",
    run: async () => {
      const p = useApp.getState().activePath;
      if (p) await saveFile(p);
    },
    enabled: hasEditor,
  },
  saveAll: { id: "saveAll", label: "Save All", shortcut: "Ctrl+Shift+S", run: () => void saveAll(false), enabled: hasProject },
  settings: { id: "settings", label: "Settings…", shortcut: "Ctrl+,", run: () => ui.openDialog("settings") },
  quit: {
    id: "quit",
    label: "Quit",
    shortcut: "Ctrl+Q",
    run: async () => {
      if (await guardUnsaved("quit")) await getCurrentWindow().destroy();
    },
  },

  undo: { id: "undo", label: "Undo", shortcut: "Ctrl+Z", run: () => runEditorAction("undo"), enabled: hasEditor },
  redo: { id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z", run: () => runEditorAction("redo"), enabled: hasEditor },
  find: { id: "find", label: "Find", shortcut: "Ctrl+F", run: () => runEditorAction("actions.find"), enabled: hasEditor },
  replace: { id: "replace", label: "Find and Replace", shortcut: "Ctrl+H", run: () => runEditorAction("editor.action.startFindReplaceAction"), enabled: hasEditor },
  toggleComment: { id: "toggleComment", label: "Toggle Comment", shortcut: "Ctrl+/", run: () => runEditorAction("editor.action.commentLine"), enabled: hasEditor },
  selectAll: { id: "selectAll", label: "Select All", shortcut: "Ctrl+A", run: () => runEditorAction("editor.action.selectAll"), enabled: hasEditor },
  foldAll: { id: "foldAll", label: "Fold All", run: () => runEditorAction("editor.foldAll"), enabled: hasEditor },
  unfoldAll: { id: "unfoldAll", label: "Unfold All", run: () => runEditorAction("editor.unfoldAll"), enabled: hasEditor },
  commandPalette: { id: "commandPalette", label: "Editor Command Palette", shortcut: "F1", run: () => runEditorAction("editor.action.quickCommand"), enabled: hasEditor },

  toggleSidebar: { id: "toggleSidebar", label: "Toggle Sidebar", shortcut: "Ctrl+Alt+B", run: ui.toggleSidebar },
  togglePreview: { id: "togglePreview", label: "Toggle PDF Preview", shortcut: "Ctrl+Alt+P", run: ui.togglePreview },
  toggleBottom: { id: "toggleBottom", label: "Toggle Output Panel", shortcut: "Ctrl+J", run: ui.toggleBottom },
  toggleSplit: { id: "toggleSplit", label: "Split Editor", shortcut: "Ctrl+\\", run: ui.toggleSplit, enabled: hasEditor },
  toggleTheme: {
    id: "toggleTheme",
    label: "Toggle Light / Dark Theme",
    run: () => updateSettings({ theme: effectiveTheme() === "dark" ? "light" : "dark" }),
  },
  zoomIn: { id: "zoomIn", label: "Increase Interface Size", shortcut: "Ctrl+=", run: () => updateSettings({ uiScale: Math.min(1.5, (useApp.getState().settings?.uiScale ?? 1) + 0.05) }) },
  zoomOut: { id: "zoomOut", label: "Decrease Interface Size", shortcut: "Ctrl+-", run: () => updateSettings({ uiScale: Math.max(0.75, (useApp.getState().settings?.uiScale ?? 1) - 0.05) }) },
  zoomReset: { id: "zoomReset", label: "Reset Interface Size", shortcut: "Ctrl+0", run: () => updateSettings({ uiScale: 1 }) },

  compile: { id: "compile", label: "Compile", shortcut: "Ctrl+Enter", run: () => compile(), enabled: isLatex },
  stopCompile: { id: "stopCompile", label: "Stop Compilation", shortcut: "Ctrl+Shift+.", run: cancelCompile, enabled: () => useApp.getState().compiling },
  toggleAutoCompile: {
    id: "toggleAutoCompile",
    label: "Auto-compile While Typing",
    run: () => updateSettings({ autoCompile: !useApp.getState().settings?.autoCompile }),
  },
  cleanBuild: { id: "cleanBuild", label: "Clean Auxiliary Files", run: cleanBuild, enabled: hasProject },
  syncForward: { id: "syncForward", label: "Show Cursor Position in PDF", shortcut: "Ctrl+Alt+J", run: syncForward, enabled: hasEditor },
  showErrors: { id: "showErrors", label: "Show Errors", run: () => ui.showBottom("errors") },
  showLog: { id: "showLog", label: "Show Compilation Output", run: () => ui.showBottom("output") },

  exportPdf: { id: "exportPdf", label: "Export PDF…", shortcut: "Ctrl+E", run: exportPdf, enabled: () => !!useApp.getState().pdfData },
  exportZip: { id: "exportZip", label: "Export Source as ZIP…", run: exportZip, enabled: hasProject },

  setupWizard: { id: "setupWizard", label: "TeX Setup Wizard…", run: () => ui.openDialog("setup") },
  projectSettings: { id: "projectSettings", label: "Project Settings", run: () => ui.showSidebarTab("project"), enabled: hasProject },
  outline: { id: "outline", label: "Document Outline", run: () => ui.showSidebarTab("outline"), enabled: hasProject },
  shortcuts: { id: "shortcuts", label: "Keyboard Shortcuts", run: () => ui.openDialog("shortcuts") },
  about: { id: "about", label: "About Quantum Maze", run: () => ui.openDialog("about") },
  newPresentation: { id: "newPresentation", label: "New Presentation…", run: () => ui.openDialog("newProject") },
  journalLibrary: { id: "journalLibrary", label: "Journal Template Library…", shortcut: "Ctrl+Shift+J", run: () => ui.openDialog("journals") },
  importTemplate: { id: "importTemplate", label: "Import Journal Template…", run: () => ui.openImport({ mode: "template" }) },
  importProject: { id: "importProject", label: "Import Project (ZIP / Overleaf)…", run: () => ui.openImport({ mode: "project" }) },
  submission: { id: "submission", label: "Submission Checklist & Package", run: () => ui.showSidebarTab("submission"), enabled: () => useApp.getState().project?.meta.kind === "latex" },
  convert: { id: "convert", label: "Conversion Centre (Word ⇄ LaTeX)…", run: () => ui.openDialog("convert") },
  present: { id: "present", label: "Present Slides", shortcut: "F5", run: () => ui.openDialog("present"), enabled: () => isDeck() && !!useApp.getState().pdfData },
  exportPptx: { id: "exportPptx", label: "Presentation as PowerPoint (.pptx)…", run: () => ui.openDialog("pptx"), enabled: isDeck },
  saveStoryTemplate: { id: "saveStoryTemplate", label: "Save Story as Template…", run: () => ui.openDialog("storyTemplate"), enabled: isStory },
  exportStory: { id: "exportStory", label: "Interactive Story as Web Page…", run: () => ui.openDialog("storyExport"), enabled: isStory },
  exportDocx: { id: "exportDocx", label: "Word Document (.docx)…", run: () => ui.openDialog("convert"), enabled: isLatex },
  insertTable: { id: "insertTable", label: "Table Designer…", shortcut: "Ctrl+Alt+T", run: () => ui.openDialog("table"), enabled: hasEditor },
  insertEquation: { id: "insertEquation", label: "Equation Editor…", shortcut: "Ctrl+Alt+E", run: () => ui.openDialog("equation"), enabled: hasEditor },
  insertFigure: { id: "insertFigure", label: "Figure…", shortcut: "Ctrl+Alt+F", run: () => ui.openDialog("figure"), enabled: hasEditor },
  latexHelp: {
    id: "latexHelp",
    label: "LaTeX Reference (online)",
    run: async () => {
      try {
        await openUrl("https://en.wikibooks.org/wiki/LaTeX");
      } catch (e) {
        toast("error", "Could not open browser", String(e));
      }
    },
  },
};

export function runCommand(id: keyof typeof commands) {
  const c = commands[id];
  if (!c || (c.enabled && !c.enabled())) return;
  void c.run();
}
