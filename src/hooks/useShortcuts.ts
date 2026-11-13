import { useEffect } from "react";
import { commands, runCommand } from "../app/commands";
import { useApp } from "../app/store";

const CODE: Record<string, string> = {
  ".": "Period",
  "\\": "Backslash",
  "=": "Equal",
  "-": "Minus",
  "0": "Digit0",
  ",": "Comma",
  "/": "Slash",
  Enter: "Enter",
  F1: "F1",
  F5: "F5",
};

interface Combo {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  code: string;
}

export function parseShortcut(s: string): Combo | null {
  if (!s || s.includes(" ")) return null;
  const parts = s.split("+");
  const key = parts.pop()!;
  const code = CODE[key] ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key);
  if (/^F\d+$/.test(key)) return { mod: parts.includes("Ctrl"), shift: parts.includes("Shift"), alt: parts.includes("Alt"), code: key };
  return { mod: parts.includes("Ctrl"), shift: parts.includes("Shift"), alt: parts.includes("Alt"), code };
}

const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);

export function matches(e: KeyboardEvent, c: Combo): boolean {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return mod === c.mod && e.shiftKey === c.shift && e.altKey === c.alt && e.code === c.code;
}

// Commands that only make sense globally; editor-bound keys are handled by
// Monaco itself when it has focus (it calls preventDefault on handled keys).
const GLOBAL: (keyof typeof commands)[] = [
  "newProject", "openProject", "newFile", "save", "saveAll", "settings", "quit", "toggleSidebar", "togglePreview",
  "toggleBottom", "toggleSplit", "zoomIn", "zoomOut", "zoomReset", "compile", "stopCompile", "syncForward", "exportPdf",
  "journalLibrary", "present", "insertTable", "insertEquation", "insertFigure",
];

export function useShortcuts() {
  useEffect(() => {
    const combos = GLOBAL.map((id) => ({ id, combo: parseShortcut(commands[id].shortcut ?? "") })).filter((x) => x.combo);
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Modal dialogs own the keyboard.
      const st = useApp.getState();
      if (st.dialog || st.confirmReq || st.promptReq) return;
      for (const { id, combo } of combos) {
        if (matches(e, combo!)) {
          e.preventDefault();
          runCommand(id);
          return;
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}
