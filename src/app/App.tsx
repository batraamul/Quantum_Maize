import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MenuBar } from "../components/MenuBar";
import { Library, MonitorPlay, PanelRight, Settings as SettingsIcon } from "lucide-react";
import { runCommand } from "./commands";
import { Toolbar } from "../components/Toolbar";
import { StatusBar } from "../components/StatusBar";
import { ConfirmHost, PromptHost, Toasts } from "../components/Common";
import { AboutDialog, RecoveryDialog, ShortcutsDialog } from "../components/Dialogs";
import { Workbench } from "../layouts/Workbench";
import { Welcome } from "../projects/Welcome";
import { NewProjectDialog } from "../projects/NewProjectDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { SetupWizard } from "../settings/SetupWizard";
import { useShortcuts } from "../hooks/useShortcuts";
import { checkExternalChanges, dirtyPaths, guardUnsaved, init, onBufferChanged, ownerByline, ui, useApp } from "./store";
import { JournalLibrary, ImportDialog } from "../journal-library/JournalLibrary";
import { ConversionDialog } from "../conversion/ConversionDialog";
import { PptxDialog, PresentMode } from "../presentation/PresentationTools";
import { SaveStoryTemplateDialog } from "../story/StoryTemplates";
import { StoryExportDialog } from "../story/StoryExportDialog";
import { EquationDialog, FigureDialog, TableDesigner } from "../authoring/AuthoringDialogs";
import { monaco } from "../editor/monacoSetup";
import logo from "../../assets/icons/quantum-maze.svg";

export function App() {
  const project = useApp((s) => s.project);
  const dialog = useApp((s) => s.dialog);
  const settingsLoaded = useApp((s) => !!s.settings);
  useApp((s) => s.settings);
  const byline = ownerByline();
  useShortcuts();

  useEffect(() => {
    const sub = monaco.editor.onDidCreateModel((m) => {
      if (m.uri.scheme === "pf") m.onDidChangeContent(() => onBufferChanged());
    });
    void init();
    document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
    // Ask before closing the window with unsaved work.
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (ev) => {
        if (!dirtyPaths().length) return;
        ev.preventDefault();
        if (await guardUnsaved("quit")) await getCurrentWindow().destroy();
      })
      .then((u) => (unlisten = u))
      .catch(() => {});
    // Files can be edited by other programs while Quantum Maze is in the background.
    const onFocus = () => void checkExternalChanges();
    window.addEventListener("focus", onFocus);
    return () => {
      sub.dispose();
      unlisten?.();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const by = ownerByline();
    const title = (project ? `${project.meta.name} — Quantum Maze` : "Quantum Maze – Research & LaTeX Studio") + (by ? ` · by ${by}` : "");
    document.title = title;
    getCurrentWindow().setTitle(title).catch(() => {});
  }, [project?.meta.name, byline]);

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <img src={logo} alt="" />
          Quantum Maze
          {byline && <small>by {byline}</small>}
        </div>
        <MenuBar />
        <div className="title-center" title={project?.root}>{project?.meta.name}</div>
        {project && (
          <div className="row" style={{ gap: 2, paddingRight: 6 }}>
            {project.meta.kind === "presentation" && <button className="tool-btn" title="Present full-screen (F5)" onClick={() => runCommand("present")}><MonitorPlay size={16} /> Present</button>}
            <button className="tool-btn" title="Journal Template Library (Ctrl+Shift+J)" onClick={() => runCommand("journalLibrary")}><Library size={16} /> Journals</button>
            {project.meta.kind !== "story" && <button className="tool-btn" title="Show or hide the PDF" onClick={ui.togglePreview}><PanelRight size={16} /> Layout</button>}
            <button className="tool-btn" title="Settings" onClick={() => ui.openDialog("settings")}><SettingsIcon size={16} /></button>
          </div>
        )}
      </header>
      {project?.meta.kind === "story" && <Toolbar />}
      {project ? <Workbench /> : settingsLoaded ? <Welcome /> : <div className="welcome" />}
      <StatusBar />

      {dialog === "newProject" && <NewProjectDialog />}
      {dialog === "settings" && <SettingsDialog />}
      {dialog === "setup" && <SetupWizard />}
      {dialog === "about" && <AboutDialog />}
      {dialog === "shortcuts" && <ShortcutsDialog />}
      {dialog === "recovery" && <RecoveryDialog />}
      {dialog === "journals" && <JournalLibrary />}
      {dialog === "import" && <ImportDialog />}
      {dialog === "convert" && <ConversionDialog />}
      {dialog === "pptx" && project && <PptxDialog />}
      {dialog === "present" && project && <PresentMode />}
      {dialog === "storyExport" && project && <StoryExportDialog />}
      {dialog === "storyTemplate" && project && <SaveStoryTemplateDialog />}
      {dialog === "table" && <TableDesigner />}
      {dialog === "equation" && <EquationDialog />}
      {dialog === "figure" && <FigureDialog />}
      <ConfirmHost />
      <PromptHost />
      <Toasts />
    </div>
  );
}
