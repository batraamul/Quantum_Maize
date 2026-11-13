// Registry of Monaco text models, one per open project file. The model is the
// source of truth for buffer contents; "dirty" is derived by comparing the
// model's alternative version id with the one recorded at the last save, so
// undoing back to the saved state clears the dirty marker.

import { monaco } from "./monacoSetup";

const saved = new Map<string, number>();

export function uriFor(path: string): monaco.Uri {
  return monaco.Uri.from({ scheme: "pf", path: "/" + path });
}

export function languageFor(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".bib")) return "bibtex";
  if (/\.(tex|sty|cls|ltx|bbx|cbx|def|clo)$/.test(p)) return "latex";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".py")) return "python";
  if (p.endsWith(".lua")) return "lua";
  if (/\.(ya?ml)$/.test(p)) return "yaml";
  return "plaintext";
}

export function getModel(path: string): monaco.editor.ITextModel | null {
  return monaco.editor.getModel(uriFor(path));
}

export function ensureModel(path: string, content: string): monaco.editor.ITextModel {
  const existing = getModel(path);
  if (existing) return existing;
  const m = monaco.editor.createModel(content, languageFor(path), uriFor(path));
  m.updateOptions({ insertSpaces: true });
  saved.set(path, m.getAlternativeVersionId());
  return m;
}

export function markSaved(path: string) {
  const m = getModel(path);
  if (m) saved.set(path, m.getAlternativeVersionId());
}

export function isDirty(path: string): boolean {
  const m = getModel(path);
  return !!m && saved.get(path) !== m.getAlternativeVersionId();
}

export function disposeModel(path: string) {
  getModel(path)?.dispose();
  saved.delete(path);
}

export function disposeAll() {
  for (const m of monaco.editor.getModels()) if (m.uri.scheme === "pf") m.dispose();
  saved.clear();
}

export function renameModel(from: string, to: string) {
  const m = getModel(from);
  if (!m) return;
  const dirty = isDirty(from);
  const value = m.getValue();
  disposeModel(from);
  const n = ensureModel(to, value);
  if (dirty) saved.set(to, -1);
  return n;
}

export function pathOfModel(m: monaco.editor.ITextModel): string | null {
  return m.uri.scheme === "pf" ? m.uri.path.slice(1) : null;
}
