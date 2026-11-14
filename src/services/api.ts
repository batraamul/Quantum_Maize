// Typed wrappers around the Rust IPC commands. All filesystem paths passed
// with a `root` are project-relative; the backend enforces containment.

import { invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  ClassStatus,
  ConversionReport,
  Indexing,
  JournalEntry,
  ManifestEntry,
  Staged,
  CompileResult,
  Engine,
  FileNode,
  HistoryEntry,
  PdfLocation,
  ProjectInfo,
  ProjectMeta,
  RecentProject,
  Settings,
  Snapshot,
  SourceLocation,
  TexInstallation, StoryTemplate } from "../types";

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

const toBytes = (v: unknown): Uint8Array =>
  v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : new Uint8Array(v as number[]);

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<Settings>("save_settings", { settings }),
  detectTex: (customBinDir?: string | null) => invoke<TexInstallation>("detect_tex", { customBinDir: customBinDir ?? null }),
  appInfo: () => invoke<AppInfo>("app_info"),

  recentProjects: () => invoke<RecentProject[]>("recent_projects"),
  forgetRecent: (path: string) => invoke<void>("forget_recent", { path }),
  createProject: (parentDir: string, name: string, template: StarterKind, engine: Engine, options?: StarterOptions) =>
    invoke<ProjectInfo>("create_project", { parentDir, name, template, engine, options: options ?? null }),
  openProject: (path: string) => invoke<ProjectInfo>("open_project", { path }),
  updateProjectMeta: (root: string, meta: ProjectMeta) => invoke<ProjectMeta>("update_project_meta", { root, meta }),

  listFiles: (root: string) => invoke<FileNode[]>("list_files", { root }),
  readText: (root: string, path: string) => invoke<string>("read_text_file", { root, path }),
  writeText: (root: string, path: string, content: string) => invoke<void>("write_text_file", { root, path, content }),
  readBinary: async (root: string, path: string) => toBytes(await invoke<ArrayBuffer>("read_binary_file", { root, path })),
  createFile: (root: string, path: string, content = "") => invoke<void>("create_file", { root, path, content }),
  createFolder: (root: string, path: string) => invoke<void>("create_folder", { root, path }),
  renamePath: (root: string, from: string, to: string) => invoke<void>("rename_path", { root, from, to }),
  deletePath: (root: string, path: string) => invoke<string>("delete_path", { root, path }),
  listSnapshots: (root: string, path: string) => invoke<Snapshot[]>("list_snapshots", { root, path }),
  readSnapshot: (root: string, path: string, id: string) => invoke<string>("read_snapshot", { root, path, id }),
  writeRecovery: (root: string, data: string) => invoke<void>("write_recovery", { root, data }),
  readRecovery: (root: string) => invoke<string | null>("read_recovery", { root }),
  clearRecovery: (root: string) => invoke<void>("clear_recovery", { root }),

  compile: (root: string) => invoke<CompileResult>("compile", { root }),
  cancelCompile: (root: string) => invoke<boolean>("cancel_compile", { root }),
  compileHistory: (root: string) => invoke<HistoryEntry[]>("compile_history", { root }),
  readLastPdf: async (root: string) => toBytes(await invoke<ArrayBuffer>("read_last_pdf", { root })),
  cleanBuild: (root: string) => invoke<number>("clean_build", { root }),
  synctexForward: (root: string, file: string, line: number, column: number) =>
    invoke<PdfLocation[]>("synctex_forward", { root, file, line, column }),
  synctexInverse: (root: string, page: number, x: number, y: number) =>
    invoke<SourceLocation>("synctex_inverse", { root, page, x, y }),

  exportPdf: (root: string, dest: string) => invoke<void>("export_pdf", { root, dest }),
  exportZip: (root: string, dest: string) => invoke<string[]>("export_zip", { root, dest }),

  listJournals: () => invoke<JournalEntry[]>("list_journals"),
  setJournalIndexing: (id: string, indexing: Indexing) => invoke<void>("set_journal_indexing", { id, indexing }),
  classStatus: (names: string[]) => invoke<ClassStatus[]>("class_status", { names }),
  createJournalProject: (parentDir: string, name: string, journalId: string) => invoke<ProjectInfo>("create_journal_project", { parentDir, name, journalId }),
  stageImport: (source: string) => invoke<Staged>("stage_import", { source }),
  installCustomTemplate: (input: {
    stagingPath: string; name: string; publisher: string; official: boolean; mainFile: string; engine: string; bibTool: string;
    authorInstructionsUrl: string | null; notes: string; layout: string; venue: string;
  }) => invoke<JournalEntry>("install_custom_template", { input }),
  deleteCustomTemplate: (id: string) => invoke<void>("delete_custom_template", { id }),
  createProjectFromStaged: (stagingPath: string, parentDir: string, name: string, mainFile: string) =>
    invoke<ProjectInfo>("create_project_from_staged", { stagingPath, parentDir, name, mainFile }),
  convertDocxToLatex: (docx: string, parentDir: string, name: string) => invoke<[ConversionReport, ProjectInfo]>("convert_docx_to_latex", { docx, parentDir, name }),
  convertLatexToDocx: (root: string, dest: string) => invoke<ConversionReport>("convert_latex_to_docx", { root, dest }),
  buildSubmission: (root: string, dest: string) => invoke<ManifestEntry[]>("build_submission", { root, dest }),
  doiLookup: (doi: string) => invoke<string>("doi_lookup", { doi }),
  setStoryPreview: (root: string, html: string) => invoke<void>("set_story_preview", { root, html }),
  exportStory: (root: string, html: string, dest: string, single: boolean) => invoke<string[]>("export_story", { root, html, dest, single }),
  listStoryTemplates: () => invoke<StoryTemplate[]>("list_story_templates"),
  storyTemplateCover: (id: string) => invoke<string>("story_template_cover", { id }),
  createStoryFromTemplate: (parentDir: string, name: string, templateId: string) => invoke<ProjectInfo>("create_story_from_template", { parentDir, name, templateId }),
  saveStoryTemplate: (root: string, title: string, description: string, category: string) => invoke<StoryTemplate>("save_story_template", { root, title, description, category }),
  deleteStoryTemplate: (id: string) => invoke<void>("delete_story_template", { id }),
  exportStoryTemplate: (id: string, dest: string) => invoke<void>("export_story_template", { id, dest }),
  importStoryTemplate: (source: string) => invoke<StoryTemplate>("import_story_template", { source }),
  importFigure: (root: string, source: string) => invoke<string>("import_figure", { root, source }),
  importStoryAsset: (root: string, source: string) => invoke<string>("import_story_asset", { root, source }),
  exportPptx: (deck: unknown, dest: string) => invoke<number>("export_pptx", { deck, dest }),
};

export type StarterKind = "blank" | "research-paper" | "presentation" | "story";
export interface StarterOptions {
  beamerTheme?: string;
  beamerColor?: string;
  aspect?: string;
}
