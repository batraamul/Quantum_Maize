// Central application state (zustand). UI components stay thin; every
// user-visible action that touches disk or the compiler lives here.

import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { api, errorMessage, type StarterKind, type StarterOptions } from "../services/api";
import type {
  AppInfo,
  CompileResult,
  Diagnostic,
  Engine,
  FileNode,
  HistoryEntry,
  PdfLocation,
  ProjectInfo,
  ProjectMeta,
  RecentProject,
  Settings,
  TexInstallation,
} from "../types";
import { monaco } from "../editor/monacoSetup";
import { disposeAll, disposeModel, ensureModel, getModel, isDirty, markSaved, renameModel } from "../editor/models";
import { getActiveEditor, revealLine } from "../editor/activeEditor";
import { indexState } from "../editor/indexState";
import { buildOutline, duplicateKeys, extractLabels, parseBib, resolveInputPath, stripComments, type BibEntry, type OutlineItem } from "../editor/projectIndex";

export type SidebarTab = "explorer" | "outline" | "references" | "snippets" | "project" | "slides" | "submission";
export type BottomTab = "errors" | "warnings" | "messages" | "output" | "diagnostics";
export type OpenFileKind = "text" | "image";

export interface OpenFile {
  path: string;
  kind: OpenFileKind;
  imageUrl?: string;
}

export interface Toast {
  id: number;
  kind: "info" | "success" | "warning" | "error";
  title: string;
  detail?: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  buttons: { id: string; label: string; variant?: "primary" | "danger" | "default" }[];
  resolve: (id: string) => void;
}

export interface PromptRequest {
  title: string;
  label: string;
  initial: string;
  resolve: (value: string | null) => void;
}

export type Dialog =
  | null | "newProject" | "settings" | "setup" | "about" | "shortcuts" | "recovery" | "journals" | "import" | "convert"
  | "pptx" | "present" | "table" | "equation" | "figure" | "storyExport" | "storyTemplate";

export interface ImportRequest {
  mode: "project" | "template";
  name?: string;
  publisher?: string;
}

interface State {
  settings: Settings | null;
  appInfo: AppInfo | null;
  tex: TexInstallation | null;
  texDetecting: boolean;
  recent: RecentProject[];

  project: ProjectInfo | null;
  tree: FileNode[];
  openFiles: OpenFile[];
  activePath: string | null;
  secondaryPath: string | null;
  dirtyTick: number;
  cursor: { line: number; column: number };

  compiling: boolean;
  liveOutput: string[];
  lastResult: CompileResult | null;
  diagnostics: Diagnostic[];
  history: HistoryEntry[];

  pdfData: Uint8Array | null;
  pdfVersion: number;
  pdfStale: boolean;
  pdfFromPreviousSession: boolean;
  syncTarget: { locations: PdfLocation[]; nonce: number } | null;

  outline: OutlineItem[];
  bibEntries: BibEntry[];
  duplicateBibKeys: string[];

  sidebarVisible: boolean;
  sidebarTab: SidebarTab;
  previewVisible: boolean;
  bottomVisible: boolean;
  bottomTab: BottomTab;
  splitEditor: boolean;

  dialog: Dialog;
  importRequest: ImportRequest;
  pdfPageCount: number | null;
  recoveryData: { savedAt: string; files: Record<string, string> } | null;
  confirmReq: ConfirmRequest | null;
  promptReq: PromptRequest | null;
  toasts: Toast[];
}

const initial: State = {
  settings: null,
  appInfo: null,
  tex: null,
  texDetecting: false,
  recent: [],
  project: null,
  tree: [],
  openFiles: [],
  activePath: null,
  secondaryPath: null,
  dirtyTick: 0,
  cursor: { line: 1, column: 1 },
  compiling: false,
  liveOutput: [],
  lastResult: null,
  diagnostics: [],
  history: [],
  pdfData: null,
  pdfVersion: 0,
  pdfStale: false,
  pdfFromPreviousSession: false,
  syncTarget: null,
  outline: [],
  bibEntries: [],
  duplicateBibKeys: [],
  sidebarVisible: true,
  sidebarTab: "explorer",
  previewVisible: true,
  bottomVisible: false,
  bottomTab: "errors",
  splitEditor: false,
  dialog: null,
  importRequest: { mode: "project" },
  pdfPageCount: null,
  recoveryData: null,
  confirmReq: null,
  promptReq: null,
  toasts: [],
};

export const useApp = create<State>(() => initial);
const set = useApp.setState;
const get = useApp.getState;

// ---- helpers ---------------------------------------------------------------

let toastId = 0;
export function toast(kind: Toast["kind"], title: string, detail?: string) {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts, { id, kind, title, detail }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 9000 : 4500);
}

export function confirm(title: string, message: string, buttons: ConfirmRequest["buttons"]): Promise<string> {
  return new Promise((resolve) =>
    set({
      confirmReq: {
        title,
        message,
        buttons,
        resolve: (id) => {
          set({ confirmReq: null });
          resolve(id);
        },
      },
    }),
  );
}

export function prompt(title: string, label: string, initialValue = ""): Promise<string | null> {
  return new Promise((resolve) =>
    set({
      promptReq: {
        title,
        label,
        initial: initialValue,
        resolve: (v) => {
          set({ promptReq: null });
          resolve(v);
        },
      },
    }),
  );
}

const TEXT_KINDS = new Set(["tex", "bib", "style", "text", "other", "build"]);
const IMAGE_PREVIEWABLE = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;

function flatten(nodes: FileNode[], out: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children) flatten(n.children, out);
  }
  return out;
}

export function allFiles(): FileNode[] {
  return flatten(get().tree).filter((n) => n.kind !== "folder");
}

export function dirtyPaths(): string[] {
  return get().openFiles.filter((f) => f.kind === "text" && isDirty(f.path)).map((f) => f.path);
}

function requireProject(): ProjectInfo {
  const p = get().project;
  if (!p) throw new Error("No project is open");
  return p;
}

// ---- theme -------------------------------------------------------------------

export function effectiveTheme(): "dark" | "light" {
  const t = get().settings?.theme ?? "dark";
  if (t === "system") return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return t;
}

function applyTheme() {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--ui-scale", String(get().settings?.uiScale ?? 1));
  monaco.editor.setTheme(theme === "dark" ? "qmaze-dark" : "qmaze-light");
}

// ---- initialisation --------------------------------------------------------------

let outputBuffer: string[] = [];
let outputFlush: number | null = null;
let initialised = false;

export async function init() {
  if (initialised) return;
  initialised = true;
  try {
    const [settings, appInfo, recent] = await Promise.all([api.getSettings(), api.appInfo(), api.recentProjects()]);
    set({ settings, appInfo, recent });
    applyTheme();
    window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", applyTheme);
    if (!settings.setupCompleted) set({ dialog: "setup" });
  } catch (e) {
    toast("error", "Failed to load settings", errorMessage(e));
  }
  void detectTex();
  await listen<{ root: string; line: string; stderr: boolean }>("compile-output", (ev) => {
    outputBuffer.push(ev.payload.line);
    if (outputFlush == null) {
      outputFlush = window.setTimeout(() => {
        const lines = outputBuffer;
        outputBuffer = [];
        outputFlush = null;
        set((s) => ({ liveOutput: [...s.liveOutput, ...lines].slice(-5000) }));
      }, 120);
    }
  });
  startBackgroundTimers();
}

export async function detectTex(customBinDir?: string | null) {
  set({ texDetecting: true });
  try {
    const tex = await api.detectTex(customBinDir);
    set({ tex });
    return tex;
  } catch (e) {
    toast("error", "TeX detection failed", errorMessage(e));
    return null;
  } finally {
    set({ texDetecting: false });
  }
}

export async function updateSettings(patch: Partial<Settings>) {
  const cur = get().settings;
  if (!cur) return;
  try {
    const saved = await api.saveSettings({ ...cur, ...patch });
    set({ settings: saved });
    applyTheme();
    for (const m of monaco.editor.getModels()) m.updateOptions({ tabSize: saved.tabSize });
  } catch (e) {
    toast("error", "Could not save settings", errorMessage(e));
  }
}

// ---- projects ------------------------------------------------------------------

export async function refreshRecent() {
  set({ recent: await api.recentProjects() });
}

async function guardUnsaved(action: string): Promise<boolean> {
  const dirty = dirtyPaths();
  if (!dirty.length) return true;
  const choice = await confirm(
    "Unsaved changes",
    `${dirty.length} file${dirty.length > 1 ? "s have" : " has"} unsaved changes (${dirty.join(", ")}). Save before you ${action}?`,
    [
      { id: "cancel", label: "Cancel" },
      { id: "discard", label: "Don't save", variant: "danger" },
      { id: "save", label: "Save all", variant: "primary" },
    ],
  );
  if (choice === "cancel") return false;
  if (choice === "save") return await saveAll();
  return true;
}

export async function chooseAndOpenProject() {
  const dir = await openDialog({ directory: true, multiple: false, title: "Open a Quantum Maze project or LaTeX folder" });
  if (typeof dir === "string") await openProject(dir);
}

export async function openProject(path: string) {
  if (!(await guardUnsaved("switch projects"))) return;
  let info: ProjectInfo;
  try {
    info = await api.openProject(path);
  } catch (e) {
    toast("error", "Could not open project", errorMessage(e));
    await refreshRecent();
    return;
  }
  resetProjectState();
  set({ project: info, dialog: null });
  if (info.newlyRegistered) toast("info", "Folder registered as a Quantum Maze project", `Main file detected: ${info.meta.mainFile}. Only a hidden .qmaze folder was added.`);
  await refreshTree();
  if (info.meta.kind !== "story") {
    await openFile(info.meta.mainFile);
    await reindex(true);
  }
  set({ sidebarTab: info.meta.kind === "presentation" ? "slides" : "explorer" });
  try {
    const pdf = await api.readLastPdf(info.root);
    set((s) => ({ pdfData: pdf, pdfVersion: s.pdfVersion + 1, pdfFromPreviousSession: true }));
  } catch {
    /* no previous build */
  }
  void loadHistory();
  void refreshRecent();
  if (info.hasRecovery) {
    try {
      const raw = await api.readRecovery(info.root);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.files && Object.keys(data.files).length) set({ recoveryData: data, dialog: "recovery" });
      }
    } catch {
      /* ignore corrupt recovery */
    }
  }
}

export async function createProject(parentDir: string, name: string, template: StarterKind, engine: Engine, options?: StarterOptions, storyTemplateId?: string) {
  try {
    const info = storyTemplateId
      ? await api.createStoryFromTemplate(parentDir, name, storyTemplateId)
      : await api.createProject(parentDir, name, template, engine, options);
    set((s) => ({ settings: s.settings ? { ...s.settings, lastProjectDir: parentDir } : s.settings }));
    await openProject(info.root);
    toast("success", "Project created", info.root);
    return true;
  } catch (e) {
    toast("error", "Could not create project", errorMessage(e));
    return false;
  }
}

function resetProjectState() {
  for (const f of get().openFiles) if (f.imageUrl) URL.revokeObjectURL(f.imageUrl);
  disposeAll();
  set({
    project: null,
    tree: [],
    openFiles: [],
    activePath: null,
    secondaryPath: null,
    liveOutput: [],
    lastResult: null,
    diagnostics: [],
    history: [],
    pdfData: null,
    pdfStale: false,
    pdfFromPreviousSession: false,
    pdfPageCount: null,
    syncTarget: null,
    outline: [],
    bibEntries: [],
    duplicateBibKeys: [],
    recoveryData: null,
  });
  fileCache.clear();
  recoveryWritten = false;
}

export async function closeProject() {
  if (!(await guardUnsaved("close the project"))) return;
  const p = get().project;
  if (p) await api.clearRecovery(p.root).catch(() => {});
  resetProjectState();
  void refreshRecent();
}

export async function refreshTree() {
  const p = get().project;
  if (!p) return;
  try {
    const tree = await api.listFiles(p.root);
    set({ tree });
    const files = flatten(tree).filter((n) => n.kind !== "folder");
    indexState.texFiles = files.filter((f) => f.kind === "tex").map((f) => f.path);
    indexState.bibFiles = files.filter((f) => f.kind === "bib").map((f) => f.path);
    indexState.imageFiles = files.filter((f) => f.kind === "image" || (f.kind === "pdf" && !f.path.startsWith("output/"))).map((f) => f.path);
  } catch (e) {
    toast("error", "Could not read project folder", errorMessage(e));
  }
}

export async function updateMeta(patch: Partial<ProjectMeta>) {
  const p = get().project;
  if (!p) return;
  try {
    const meta = await api.updateProjectMeta(p.root, { ...p.meta, ...patch });
    set({ project: { ...p, meta } });
    if (patch.mainFile) void reindex(false);
  } catch (e) {
    toast("error", "Could not update project settings", errorMessage(e));
  }
}

// ---- files ------------------------------------------------------------------------

export async function openFile(path: string, at?: { line: number; column?: number }, opts?: { secondary?: boolean }) {
  const p = requireProject();
  const node = allFiles().find((f) => f.path === path);
  const kind = node?.kind ?? "tex";
  const existing = get().openFiles.find((f) => f.path === path);
  if (!existing) {
    if (kind === "image" || kind === "pdf") {
      if (!IMAGE_PREVIEWABLE.test(path)) {
        toast("info", "No preview for this file type", `${path} is used by LaTeX but cannot be displayed in Quantum Maze.`);
        return;
      }
      try {
        const bytes = await api.readBinary(p.root, path);
        const mime = path.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/" + path.split(".").pop()!.toLowerCase().replace("jpg", "jpeg");
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
        set((s) => ({ openFiles: [...s.openFiles, { path, kind: "image", imageUrl: url }] }));
      } catch (e) {
        toast("error", `Could not open ${path}`, errorMessage(e));
        return;
      }
    } else if (TEXT_KINDS.has(kind)) {
      try {
        const content = await api.readText(p.root, path);
        ensureModel(path, content);
        fileCache.set(path, content);
        knownDisk.set(path, content);
        set((s) => ({ openFiles: [...s.openFiles, { path, kind: "text" }] }));
        applyMarkers();
      } catch (e) {
        toast("error", `Could not open ${path}`, errorMessage(e));
        return;
      }
    }
  }
  if (opts?.secondary) set({ secondaryPath: path, splitEditor: true });
  else set({ activePath: path });
  if (at) {
    // Wait for the editor to attach the model before revealing.
    setTimeout(() => revealLine(at.line, at.column ?? 1), 30);
  }
}

export async function closeFile(path: string) {
  const f = get().openFiles.find((x) => x.path === path);
  if (!f) return;
  if (f.kind === "text" && isDirty(path)) {
    const c = await confirm("Unsaved changes", `Save changes to ${path} before closing?`, [
      { id: "cancel", label: "Cancel" },
      { id: "discard", label: "Don't save", variant: "danger" },
      { id: "save", label: "Save", variant: "primary" },
    ]);
    if (c === "cancel") return;
    if (c === "save" && !(await saveFile(path))) return;
  }
  if (f.imageUrl) URL.revokeObjectURL(f.imageUrl);
  knownDisk.delete(path);
  disposeModel(path);
  set((s) => {
    const idx = s.openFiles.findIndex((x) => x.path === path);
    const openFiles = s.openFiles.filter((x) => x.path !== path);
    const neighbour = openFiles[Math.min(idx, openFiles.length - 1)]?.path ?? null;
    return {
      openFiles,
      activePath: s.activePath === path ? neighbour : s.activePath,
      secondaryPath: s.secondaryPath === path ? null : s.secondaryPath,
    };
  });
}

// ---- external changes ------------------------------------------------------------
// The text each open buffer was last loaded from / saved to. If the file on disk no longer
// matches it, another program changed the file and we must not overwrite it silently.
const knownDisk = new Map<string, string>();

function replaceModelText(path: string, text: string) {
  const m = getModel(path);
  if (!m) return;
  // pushEditOperations keeps the change undoable (setValue would wipe the undo stack).
  m.pushStackElement();
  m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null);
  m.pushStackElement();
  markSaved(path);
  knownDisk.set(path, text);
  fileCache.set(path, text);
  bumpDirty();
}

let checkingExternal = false;
/** Compares every open text buffer with its file on disk (run on window focus). */
export async function checkExternalChanges() {
  const p = get().project;
  if (!p || checkingExternal) return;
  checkingExternal = true;
  try {
    for (const f of get().openFiles) {
      if (f.kind !== "text" || !knownDisk.has(f.path)) continue;
      let disk: string;
      try {
        disk = await api.readText(p.root, f.path);
      } catch {
        continue; // deleted or unreadable: the next save will recreate it from the buffer
      }
      if (disk === knownDisk.get(f.path)) continue;
      if (!isDirty(f.path)) {
        replaceModelText(f.path, disk);
        toast("info", `Reloaded ${f.path}`, "The file was changed by another program. Undo (Ctrl+Z) restores the previous text.");
      } else {
        const c = await confirm(
          "File changed on disk",
          `${f.path} was changed by another program, and you also have unsaved edits in Quantum Maze. Which version do you want?`,
          [
            { id: "keep", label: "Keep my edits" },
            { id: "reload", label: "Load the disk version", variant: "danger" },
          ],
        );
        if (c === "reload") replaceModelText(f.path, disk);
        else knownDisk.set(f.path, disk); // the user has seen it; their next save is deliberate
      }
    }
  } finally {
    checkingExternal = false;
  }
}

export async function saveFile(path: string, silent = false): Promise<boolean> {
  const p = get().project;
  const m = getModel(path);
  if (!p || !m) return false;
  try {
    const known = knownDisk.get(path);
    if (known !== undefined) {
      const disk = await api.readText(p.root, path).catch(() => null);
      if (disk !== null && disk !== known) {
        const c = await confirm(
          "File changed on disk",
          `${path} was changed by another program since Quantum Maze last read it. Saving now would overwrite those changes.`,
          [
            { id: "cancel", label: "Cancel" },
            { id: "reload", label: "Load the disk version" },
            { id: "overwrite", label: "Overwrite with my version", variant: "danger" },
          ],
        );
        if (c === "cancel") return false;
        if (c === "reload") {
          replaceModelText(path, disk);
          return true;
        }
      }
    }
    const content = m.getValue();
    await api.writeText(p.root, path, content);
    markSaved(path);
    knownDisk.set(path, content);
    fileCache.set(path, content);
    bumpDirty();
    if (!silent) toast("success", `Saved ${path}`);
    return true;
  } catch (e) {
    toast("error", `Could not save ${path}`, errorMessage(e));
    return false;
  }
}

export async function saveAll(silent = true): Promise<boolean> {
  const dirty = dirtyPaths();
  let ok = true;
  for (const d of dirty) ok = (await saveFile(d, true)) && ok;
  if (ok && dirty.length) {
    const p = get().project;
    if (p && recoveryWritten) {
      await api.clearRecovery(p.root).catch(() => {});
      recoveryWritten = false;
    }
    if (!silent) toast("success", `Saved ${dirty.length} file${dirty.length > 1 ? "s" : ""}`);
  } else if (!dirty.length && !silent) toast("info", "Nothing to save");
  return ok;
}

export function bumpDirty() {
  set((s) => ({ dirtyTick: s.dirtyTick + 1 }));
}

export async function newFile(folder = "") {
  const p = requireProject();
  const name = await prompt("New file", "File name (e.g. discussion.tex)", "untitled.tex");
  if (!name) return;
  const path = (folder ? folder + "/" : "") + name.trim();
  const content = path.endsWith(".tex") ? `\\section{${name.replace(/\.tex$/, "").replace(/[_-]/g, " ")}}\n\n` : "";
  try {
    await api.createFile(p.root, path, content);
    await refreshTree();
    await openFile(path);
    if (path.endsWith(".tex")) toast("info", `Created ${path}`, `Add \\input{${path.replace(/\.tex$/, "")}} to ${p.meta.mainFile} to include it.`);
  } catch (e) {
    toast("error", "Could not create file", errorMessage(e));
  }
}

export async function newFolder(parent = "") {
  const p = requireProject();
  const name = await prompt("New folder", "Folder name", "figures");
  if (!name) return;
  try {
    await api.createFolder(p.root, (parent ? parent + "/" : "") + name.trim());
    await refreshTree();
  } catch (e) {
    toast("error", "Could not create folder", errorMessage(e));
  }
}

export async function renamePath(path: string) {
  const p = requireProject();
  const base = path.split("/").pop()!;
  const name = await prompt("Rename", "New name", base);
  if (!name || name === base) return;
  const to = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) + name.trim() : name.trim();
  try {
    await api.renamePath(p.root, path, to);
    // Keep editors open on renamed files (including files inside a renamed folder).
    const moved = get().openFiles.filter((f) => f.path === path || f.path.startsWith(path + "/"));
    for (const f of moved) {
      const np = to + f.path.slice(path.length);
      if (f.kind === "text") renameModel(f.path, np);
      fileCache.delete(f.path);
    }
    set((s) => ({
      openFiles: s.openFiles.map((f) => (moved.includes(f) ? { ...f, path: to + f.path.slice(path.length) } : f)),
      activePath: s.activePath && (s.activePath === path || s.activePath.startsWith(path + "/")) ? to + s.activePath.slice(path.length) : s.activePath,
    }));
    if (p.meta.mainFile === path) await updateMeta({ mainFile: to });
    await refreshTree();
    void reindex(true);
  } catch (e) {
    toast("error", "Rename failed", errorMessage(e));
  }
}

export async function deletePath(path: string) {
  const p = requireProject();
  if (path === p.meta.mainFile) {
    toast("warning", "This is the main file", "Choose another main file in Project Settings before deleting it.");
    return;
  }
  const c = await confirm("Move to project trash?", `"${path}" will be moved to .qmaze/trash inside the project, where you can recover it.`, [
    { id: "cancel", label: "Cancel" },
    { id: "delete", label: "Move to trash", variant: "danger" },
  ]);
  if (c !== "delete") return;
  try {
    for (const f of get().openFiles.filter((f) => f.path === path || f.path.startsWith(path + "/"))) {
      disposeModel(f.path);
      if (f.imageUrl) URL.revokeObjectURL(f.imageUrl);
    }
    set((s) => {
      const openFiles = s.openFiles.filter((f) => !(f.path === path || f.path.startsWith(path + "/")));
      return { openFiles, activePath: openFiles.some((f) => f.path === s.activePath) ? s.activePath : openFiles[0]?.path ?? null };
    });
    const where = await api.deletePath(p.root, path);
    toast("success", `Moved ${path} to trash`, where);
    await refreshTree();
    void reindex(true);
  } catch (e) {
    toast("error", "Delete failed", errorMessage(e));
  }
}

// ---- indexing (outline, labels, bibliography) ------------------------------------

const fileCache = new Map<string, string>();

/** All .tex sources reachable from the main file, in document order. */
export async function collectSources(): Promise<{ path: string; text: string }[]> {
  const p = get().project;
  if (!p) return [];
  await reindex(true);
  const files = allFiles();
  const exists = (path: string) => files.some((f) => f.path === path);
  const read = (path: string) => getModel(path)?.getValue() ?? fileCache.get(path) ?? null;
  const out: { path: string; text: string }[] = [];
  const seen = new Set<string>();
  const walk = (file: string, depth: number) => {
    if (depth > 20 || seen.has(file)) return;
    const text = read(file);
    if (text == null) return;
    seen.add(file);
    out.push({ path: file, text });
    for (const m of stripComments(text).matchAll(/\\(?:input|include|subfile)\s*\{([^}]*)\}/g)) {
      const t = resolveInputPath(m[1], file, exists);
      if (t) walk(t, depth + 1);
    }
  };
  walk(p.meta.mainFile, 0);
  return out;
}

export function readProjectText(path: string): string | null {
  return getModel(path)?.getValue() ?? fileCache.get(path) ?? null;
}

export async function reindex(fullRead: boolean) {
  const p = get().project;
  if (!p) return;
  const files = allFiles().filter((f) => f.kind === "tex" || f.kind === "bib");
  if (fullRead) {
    await Promise.all(
      files
        .filter((f) => !getModel(f.path) && f.size < 4_000_000)
        .map(async (f) => {
          try {
            fileCache.set(f.path, await api.readText(p.root, f.path));
          } catch {
            /* unreadable (e.g. non-UTF-8): skip */
          }
        }),
    );
  }
  const read = (path: string) => getModel(path)?.getValue() ?? fileCache.get(path) ?? null;
  const labels = files.filter((f) => f.kind === "tex").flatMap((f) => extractLabels(read(f.path) ?? "", f.path));
  const bib = files.filter((f) => f.kind === "bib").flatMap((f) => parseBib(read(f.path) ?? "", f.path));
  const exists = (path: string) => files.some((f) => f.path === path);
  const outline = buildOutline(p.meta.mainFile, read, exists);
  const main = stripComments(read(p.meta.mainFile) ?? "");
  const gp = /\\graphicspath\s*\{((?:\{[^}]*\})+)\}/.exec(main);
  indexState.graphicsPaths = gp ? [...gp[1].matchAll(/\{([^}]*)\}/g)].map((m) => m[1].replace(/^\.\//, "")) : [];
  indexState.labels = labels;
  indexState.bib = bib;
  set({ outline, bibEntries: bib, duplicateBibKeys: [...duplicateKeys(bib)] });
}

// ---- compilation -------------------------------------------------------------------

let pendingRecompile = false;

export async function compile(opts: { auto?: boolean } = {}) {
  const p = get().project;
  if (!p || p.meta.kind === "story") return;
  if (get().compiling) {
    pendingRecompile = true;
    return;
  }
  if (!opts.auto) await checkExternalChanges();
  const tex = get().tex;
  if (tex && !tex.ready) {
    if (!opts.auto) {
      toast("error", "No LaTeX engine found", "Open Tools → TeX Setup Wizard to install or configure a TeX distribution.");
      set({ dialog: "setup" });
    }
    return;
  }
  if (!(await saveAll(true))) return;
  set({ compiling: true, liveOutput: [] });
  try {
    const res = await api.compile(p.root);
    const show = get().settings?.showBadboxes ?? false;
    const diagnostics = res.diagnostics.filter((d) => show || d.category !== "badbox");
    set({ lastResult: res, diagnostics });
    applyMarkers();
    if (res.pdfUpdated) {
      const pdf = await api.readLastPdf(p.root);
      set((s) => ({ pdfData: pdf, pdfVersion: s.pdfVersion + 1, pdfStale: false, pdfFromPreviousSession: false }));
    } else if (!res.cancelled) {
      set({ pdfStale: !!get().pdfData });
    }
    if (!res.success && !res.cancelled && !res.pdfUpdated && !opts.auto) {
      // Nothing to show: open the logs. With a PDF, the count beside Recompile is enough.
      set({ bottomVisible: true, bottomTab: res.errorCount > 0 ? "errors" : "output" });
    } else if (res.pdfUpdated && !opts.auto) {
      set({ bottomVisible: false });
    }
    if (!opts.auto || !res.success) {
      if (res.cancelled) toast("info", "Compilation cancelled");
      else if (!res.success) toast(res.pdfUpdated ? "warning" : "error", res.message, res.errorCount ? firstErrorSummary(diagnostics) : undefined);
    }
    void loadHistory();
    void refreshTree();
  } catch (e) {
    toast("error", "Compilation could not start", errorMessage(e));
    set({ bottomVisible: true, bottomTab: "output" });
  } finally {
    set({ compiling: false });
    if (pendingRecompile) {
      pendingRecompile = false;
      void compile({ auto: true });
    }
  }
}

function firstErrorSummary(d: Diagnostic[]): string | undefined {
  const e = d.find((x) => x.severity === "error");
  if (!e) return undefined;
  return `${e.file ? `${e.file}${e.line ? ":" + e.line : ""} — ` : ""}${e.message}`;
}

export async function cancelCompile() {
  const p = get().project;
  if (p) await api.cancelCompile(p.root);
}

export async function loadHistory() {
  const p = get().project;
  if (!p) return;
  try {
    set({ history: await api.compileHistory(p.root) });
  } catch {
    /* non-critical */
  }
}

export async function cleanBuild() {
  const p = requireProject();
  try {
    const n = await api.cleanBuild(p.root);
    toast("success", `Removed ${n} auxiliary file${n === 1 ? "" : "s"}`, "The last successful PDF is kept for preview.");
    await refreshTree();
  } catch (e) {
    toast("error", "Clean failed", errorMessage(e));
  }
}

/** Push compiler diagnostics into Monaco as inline markers. */
export function applyMarkers() {
  const diags = get().diagnostics;
  for (const f of get().openFiles) {
    const m = getModel(f.path);
    if (!m) continue;
    const markers = diags
      .filter((d) => d.file === f.path && d.line)
      .map((d) => {
        const line = Math.min(d.line!, m.getLineCount());
        return {
          severity: d.severity === "error" ? monaco.MarkerSeverity.Error : d.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
          message: d.message + (d.suggestion ? `\n\n💡 ${d.suggestion}` : ""),
          startLineNumber: line,
          endLineNumber: line,
          startColumn: m.getLineFirstNonWhitespaceColumn(line) || 1,
          endColumn: m.getLineMaxColumn(line),
          source: d.source,
        };
      });
    monaco.editor.setModelMarkers(m, "latex", markers);
  }
}

export async function goToDiagnostic(d: Diagnostic) {
  if (!d.file) {
    if (d.externalFile) toast("info", "This message refers to a file outside your project", d.externalFile);
    return;
  }
  await openFile(d.file, d.line ? { line: d.line } : undefined);
}

// ---- SyncTeX -----------------------------------------------------------------------

export async function syncForward() {
  const p = get().project;
  const path = get().activePath;
  const ed = getActiveEditor();
  if (!p || !path || !ed) return;
  if (!path.endsWith(".tex")) return toast("info", "Forward search works from .tex files");
  const pos = ed.getPosition();
  if (!pos) return;
  try {
    const locations = await api.synctexForward(p.root, path, pos.lineNumber, pos.column);
    if (!locations.length) return toast("info", "No PDF location for this line", "Compile first, or move the cursor to typeset text.");
    set((s) => ({ syncTarget: { locations, nonce: (s.syncTarget?.nonce ?? 0) + 1 }, previewVisible: true }));
  } catch (e) {
    toast("warning", "SyncTeX unavailable", errorMessage(e));
  }
}

export async function syncInverse(page: number, x: number, y: number) {
  const p = get().project;
  if (!p) return;
  try {
    const loc = await api.synctexInverse(p.root, page, x, y);
    await openFile(loc.file, { line: loc.line });
  } catch (e) {
    toast("info", "No source location found", errorMessage(e));
  }
}

// ---- export ----------------------------------------------------------------------

export async function exportPdf() {
  const p = get().project;
  if (!p) return;
  if (!get().pdfData) return toast("warning", "Nothing to export yet", "Compile the document successfully first.");
  const stem = p.meta.mainFile.split("/").pop()!.replace(/\.tex$/, "");
  const dest = await saveDialog({ title: "Export PDF", defaultPath: `${p.meta.name || stem}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (!dest) return;
  try {
    await api.exportPdf(p.root, dest);
    toast("success", "PDF exported", dest);
  } catch (e) {
    toast("error", "Export failed", errorMessage(e));
  }
}

export async function exportZip() {
  const p = get().project;
  if (!p) return;
  await saveAll(true);
  const dest = await saveDialog({ title: "Export project sources as ZIP", defaultPath: `${p.meta.name}-source.zip`, filters: [{ name: "ZIP archive", extensions: ["zip"] }] });
  if (!dest) return;
  try {
    const manifest = await api.exportZip(p.root, dest);
    toast("success", `ZIP exported (${manifest.length} files)`, dest);
  } catch (e) {
    toast("error", "Export failed", errorMessage(e));
  }
}

// ---- background: autosave, crash recovery, auto-compile ----------------------------

let recoveryWritten = false;
let autoCompileTimer: number | null = null;
let reindexTimer: number | null = null;
let lastAutosave = Date.now();

export function onBufferChanged() {
  bumpDirty();
  const s = get().settings;
  if (reindexTimer) clearTimeout(reindexTimer);
  reindexTimer = window.setTimeout(() => void reindex(false), 700);
  if (s?.autoCompile && get().project) {
    if (autoCompileTimer) clearTimeout(autoCompileTimer);
    autoCompileTimer = window.setTimeout(() => void compile({ auto: true }), s.autoCompileDelayMs);
  }
}

function startBackgroundTimers() {
  window.setInterval(async () => {
    const s = get().settings;
    const p = get().project;
    if (!s || !p) return;
    const dirty = dirtyPaths();
    // Crash-recovery buffer every few seconds while anything is unsaved.
    if (dirty.length) {
      const files: Record<string, string> = {};
      for (const d of dirty) files[d] = getModel(d)?.getValue() ?? "";
      try {
        await api.writeRecovery(p.root, JSON.stringify({ savedAt: new Date().toISOString(), files }));
        recoveryWritten = true;
      } catch {
        /* best effort */
      }
    }
    if (s.autosave && dirty.length && Date.now() - lastAutosave >= s.autosaveIntervalSecs * 1000) {
      lastAutosave = Date.now();
      await saveAll(true);
    }
  }, 4000);
}

export async function restoreRecovery(apply: boolean) {
  const p = get().project;
  const data = get().recoveryData;
  set({ dialog: null, recoveryData: null });
  if (!p || !data) return;
  if (apply) {
    for (const [path, content] of Object.entries(data.files)) {
      try {
        await openFile(path);
        const m = getModel(path);
        if (m && m.getValue() !== content) {
          m.pushEditOperations([], [{ range: m.getFullModelRange(), text: content }], () => null);
        }
      } catch {
        /* file may have been removed */
      }
    }
    bumpDirty();
    toast("success", "Unsaved changes restored", "Review them, then save.");
  } else {
    await api.clearRecovery(p.root).catch(() => {});
  }
}

// ---- layout ----------------------------------------------------------------------

export const ui = {
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  showSidebarTab: (t: SidebarTab) => set((s) => ({ sidebarVisible: s.sidebarTab === t ? !s.sidebarVisible : true, sidebarTab: t })),
  togglePreview: () => set((s) => (s.previewVisible || s.bottomVisible ? { previewVisible: false, bottomVisible: false } : { previewVisible: true })),
  toggleBottom: () => set((s) => ({ bottomVisible: !s.bottomVisible })),
  showBottom: (t: BottomTab) => set({ bottomVisible: true, bottomTab: t }),
  toggleSplit: () =>
    set((s) => ({ splitEditor: !s.splitEditor, secondaryPath: s.splitEditor ? s.secondaryPath : s.secondaryPath ?? s.activePath })),
  openDialog: (d: Dialog) => set({ dialog: d }),
  openImport: (r: ImportRequest) => set({ dialog: "import", importRequest: r }),
  setPdfPages: (n: number | null) => set({ pdfPageCount: n }),
  closeDialog: () => set({ dialog: null }),
  setActive: (path: string) => set({ activePath: path }),
  setSecondary: (path: string) => set({ secondaryPath: path }),
  setCursor: (line: number, column: number) => set({ cursor: { line, column } }),
};

export { guardUnsaved };

/** "Quantum Maze by <name>, <rank>, <organization>" (only the parts set). */
export function ownerByline(): string {
  const st = get().settings;
  if (!st) return "";
  return [st.ownerName, st.ownerRank, st.ownerOrganization].map((x) => x?.trim()).filter(Boolean).join(", ");
}
