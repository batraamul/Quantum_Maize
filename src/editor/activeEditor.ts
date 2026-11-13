// Handle to the focused Monaco editor so menus/toolbars can act on it.
import type { monaco } from "./monacoSetup";

let current: monaco.editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(e: monaco.editor.IStandaloneCodeEditor | null) {
  current = e;
}

export function getActiveEditor() {
  return current;
}

export function insertSnippet(snippet: string) {
  const e = current;
  if (!e) return false;
  e.focus();
  const ctrl = e.getContribution("snippetController2") as unknown as { insert: (s: string) => void } | null;
  if (ctrl) ctrl.insert(snippet);
  else e.trigger("qmaze", "type", { text: snippet.replace(/\$\{\d+:?([^}]*)\}|\$\d/g, "$1") });
  return true;
}

export function wrapSelection(before: string, after: string) {
  const e = current;
  if (!e) return false;
  const model = e.getModel();
  const sel = e.getSelection();
  if (!model || !sel) return false;
  const text = model.getValueInRange(sel);
  e.pushUndoStop();
  e.executeEdits("qmaze-format", [{ range: sel, text: before + text + after, forceMoveMarkers: true }]);
  if (!text) {
    const pos = sel.getStartPosition();
    e.setPosition({ lineNumber: pos.lineNumber, column: pos.column + before.length });
  }
  e.pushUndoStop();
  e.focus();
  return true;
}

export function revealLine(line: number, column = 1) {
  const e = current;
  if (!e) return;
  e.revealLineInCenter(line);
  e.setPosition({ lineNumber: line, column });
  e.focus();
}

export function runEditorAction(id: string) {
  const e = current;
  if (!e) return;
  e.focus();
  e.trigger("qmaze-menu", id, null);
}
