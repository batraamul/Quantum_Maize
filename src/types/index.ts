// Shared types mirroring the Rust backend's serialised structures.

export type Engine = "pdflatex" | "xelatex" | "lualatex";
export type BibTool = "auto" | "bibtex" | "biber";
export type Theme = "dark" | "light" | "system";

export interface Settings {
  theme: Theme;
  uiScale: number;
  editorFontSize: number;
  editorFontFamily: string;
  wordWrap: boolean;
  minimap: boolean;
  tabSize: number;
  autosave: boolean;
  autosaveIntervalSecs: number;
  autoCompile: boolean;
  autoCompileDelayMs: number;
  defaultEngine: Engine;
  useLatexmk: boolean;
  compileTimeoutSecs: number;
  texBinDir: string | null;
  setupCompleted: boolean;
  lastProjectDir: string | null;
  showBadboxes: boolean;
  ownerName: string;
  ownerRank: string;
  ownerOrganization: string;
  ownerEmail: string;
  allowOnline: boolean;
}

export type ProjectKind = "latex" | "presentation" | "story";

export interface ProjectMeta {
  formatVersion: number;
  id: string;
  name: string;
  mainFile: string;
  engine: Engine;
  bibTool: BibTool;
  shellEscape: boolean;
  createdAt: string;
  createdWith: string;
  kind: ProjectKind;
  journalId: string | null;
}

export interface ProjectInfo {
  root: string;
  meta: ProjectMeta;
  newlyRegistered: boolean;
  hasRecovery: boolean;
}

export type FileKind = "folder" | "tex" | "bib" | "style" | "image" | "pdf" | "text" | "build" | "other";

export interface FileNode {
  name: string;
  path: string;
  kind: FileKind;
  children: FileNode[] | null;
  size: number;
}

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  mainFile: string;
  engine: string;
  lastOpenedAt: string;
  exists: boolean;
}

export interface ToolInfo {
  name: string;
  found: boolean;
  path: string | null;
  version: string | null;
}

export interface Guidance {
  title: string;
  detail: string;
  url: string | null;
}

export interface TexInstallation {
  os: string;
  arch: string;
  distribution: string | null;
  tools: ToolInfo[];
  packageManager: string | null;
  ready: boolean;
  latexmkUsable: boolean;
  searchedDirs: string[];
  guidance: Guidance[];
}

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  category: string;
  file: string | null;
  externalFile: string | null;
  line: number | null;
  message: string;
  context: string | null;
  suggestion: string | null;
  source: string;
}

export interface CompileResult {
  success: boolean;
  cancelled: boolean;
  timedOut: boolean;
  exitCode: number | null;
  durationMs: number;
  tool: string;
  engine: string;
  pdfPath: string | null;
  pdfUpdated: boolean;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  logFile: string | null;
  rawOutput: string;
  startedAt: string;
  message: string;
}

export interface HistoryEntry {
  startedAt: string;
  durationMs: number;
  engine: string;
  tool: string;
  success: boolean;
  errorCount: number;
  warningCount: number;
}

export interface PdfLocation {
  page: number;
  h: number;
  v: number;
  width: number;
  height: number;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface Snapshot {
  id: string;
  created: string;
  size: number;
}

export interface AppInfo {
  version: string;
  os: string;
  arch: string;
  dataDir: string;
  schemaVersion: number;
}

export interface AppError {
  kind: string;
  message: string;
}

export interface Indexing {
  status: "not-verified" | "publisher-stated" | "user-verified" | string;
  detail: string;
  source: string | null;
  date: string | null;
}

export interface Requirements {
  sections: string[];
  abstractMaxWords: number | null;
  maxPages: number | null;
  statements: string[];
  notes: string[];
  source: string | null;
  verified: boolean;
}

export interface JournalEntry {
  id: string;
  name: string;
  publisher: string;
  issn: { print: string | null; electronic: string | null } | null;
  subjects: string[];
  disciplines: string[];
  manuscriptTypes: string[];
  venue: "journal" | "conference" | string;
  layout: "two-column" | "single-column" | string;
  templateType: "ctan-class" | "publisher-download" | "community-profile" | "custom" | string;
  official: boolean;
  ctanClass: string | null;
  classOptions: string | null;
  bibStyle: string | null;
  bibTool: string;
  engine: string;
  sourceUrl: string | null;
  downloadUrl: string | null;
  authorInstructionsUrl: string | null;
  homepageUrl: string | null;
  license: string | null;
  version: string | null;
  lastVerified: string | null;
  verificationNote: string;
  openAccess: boolean | null;
  indexing: Indexing;
  requiredPackages: string[];
  notes: string[];
  requirements: Requirements;
  origin: "bundled" | "custom" | string;
  templatePath: string | null;
  mainFile: string | null;
  installedAt: string | null;
}

export interface ClassStatus {
  name: string;
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface PackageStatus {
  name: string;
  providedByTemplate: boolean;
  installed: boolean | null;
}

export interface TemplateReport {
  mainFile: string | null;
  texFiles: string[];
  classes: string[];
  styles: string[];
  bibStyles: string[];
  biblatexStyles: string[];
  bibFiles: string[];
  images: string[];
  instructions: string[];
  documentClass: string | null;
  bibTool: string;
  engine: string;
  packages: PackageStatus[];
  warnings: string[];
  fileCount: number;
}

export interface Staged {
  stagingPath: string;
  report: TemplateReport;
  extract: { files: number; bytes: number; skipped: string[] } | null;
}

export interface ConversionReport {
  direction: string;
  output: string;
  pandocVersion: string;
  counts: [string, number][];
  warnings: string[];
  manual: string[];
  files: string[];
}

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
  role: string;
}

export interface StoryTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  sections: number;
  preset: string;
  cover: string;
  origin: "bundled" | "user";
}
