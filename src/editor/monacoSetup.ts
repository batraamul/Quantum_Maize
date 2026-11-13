// Monaco bootstrap: local (offline) workers, LaTeX + BibTeX languages, themes,
// context-aware completion and folding. Imported once from main.tsx.

// Editor core + all editor features, without Monaco's ~80 bundled languages
// (only the few Quantum Maze needs are imported below) — keeps the app small.
import "monaco-editor/esm/vs/editor/edcore.main.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { CITE_COMMANDS, COMMANDS, ENVIRONMENTS, PACKAGES, REF_COMMANDS } from "./latexData";
import { foldingRanges, innermostOpenEnv } from "./projectIndex";
import { indexState } from "./indexState";

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

let registered = false;

export function setupMonaco(): typeof monaco {
  if (registered) return monaco;
  registered = true;

  // ---- LaTeX ---------------------------------------------------------------
  monaco.languages.register({ id: "latex", extensions: [".tex", ".sty", ".cls", ".ltx"], aliases: ["LaTeX"] });
  monaco.languages.setLanguageConfiguration("latex", {
    comments: { lineComment: "%" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "`", close: "'", notIn: ["string", "comment"] },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
    ],
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s$]+)/g,
    indentationRules: {
      increaseIndentPattern: /\\begin\{(?!document)[^}]*\}(?!.*\\end\{)/,
      decreaseIndentPattern: /^\s*\\end\{(?!document)[^}]*\}/,
    },
  });
  monaco.languages.setMonarchTokensProvider("latex", {
    defaultToken: "",
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/(\\(?:begin|end))(\s*)(\{)([^}]*)(\})/, ["keyword", "", "delimiter.curly", "type.identifier", "delimiter.curly"]],
        [/\\(?:part|chapter|(?:sub)*section|paragraph)\*?/, "keyword.section"],
        [/\\(?:label|ref|eqref|pageref|autoref|[cC]ref|cite[pt]?|parencite|textcite|autocite|nocite)\b/, "tag"],
        [/\\(?:usepackage|documentclass|input|include|includegraphics|bibliography|addbibresource)\b/, "keyword.directive"],
        [/\\\[/, { token: "string.math", next: "@displaymath" }],
        [/\\\(/, { token: "string.math", next: "@inlinemath2" }],
        [/\$\$/, { token: "string.math", next: "@ddmath" }],
        [/\$/, { token: "string.math", next: "@inlinemath" }],
        [/\\[a-zA-Z@]+\*?/, "keyword"],
        [/\\./, "constant.character.escape"],
        [/[{}]/, "delimiter.curly"],
        [/[[\]]/, "delimiter.square"],
        [/&/, "operator"],
        [/~/, "operator"],
        [/\d+(\.\d+)?(pt|em|ex|cm|mm|in|bp|sp|pc|mu)?/, "number"],
      ],
      inlinemath: [[/%.*$/, "comment"], [/\\\$/, "string.math"], [/\$/, { token: "string.math", next: "@pop" }], [/\\[a-zA-Z]+/, "string.math.command"], [/[^$\\%]+/, "string.math"], [/./, "string.math"]],
      inlinemath2: [[/\\\)/, { token: "string.math", next: "@pop" }], [/\\[a-zA-Z]+/, "string.math.command"], [/[^\\]+/, "string.math"], [/./, "string.math"]],
      ddmath: [[/\$\$/, { token: "string.math", next: "@pop" }], [/\\[a-zA-Z]+/, "string.math.command"], [/[^$\\]+/, "string.math"], [/./, "string.math"]],
      displaymath: [[/\\\]/, { token: "string.math", next: "@pop" }], [/\\[a-zA-Z]+/, "string.math.command"], [/[^\\]+/, "string.math"], [/./, "string.math"]],
    },
  } as monaco.languages.IMonarchLanguage);

  // ---- BibTeX --------------------------------------------------------------
  monaco.languages.register({ id: "bibtex", extensions: [".bib"], aliases: ["BibTeX"] });
  monaco.languages.setLanguageConfiguration("bibtex", {
    comments: { lineComment: "%" },
    brackets: [["{", "}"], ["(", ")"]],
    autoClosingPairs: [{ open: "{", close: "}" }, { open: '"', close: '"' }],
  });
  monaco.languages.setMonarchTokensProvider("bibtex", {
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/(@[a-zA-Z]+)(\s*[{(]\s*)([^,\s]+)/, ["keyword", "delimiter", "type.identifier"]],
        [/([a-zA-Z_-]+)(\s*=)/, ["attribute.name", "operator"]],
        [/"[^"]*"/, "string"],
        [/\{/, { token: "string", next: "@braced" }],
        [/\d+/, "number"],
      ],
      braced: [[/\{/, { token: "string", next: "@push" }], [/\}/, { token: "string", next: "@pop" }], [/[^{}]+/, "string"]],
    },
  } as monaco.languages.IMonarchLanguage);

  // ---- themes ----------------------------------------------------------------
  monaco.editor.defineTheme("qmaze-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7894", fontStyle: "italic" },
      { token: "keyword", foreground: "7aa2f7" },
      { token: "keyword.section", foreground: "ff9e64", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "bb9af7" },
      { token: "tag", foreground: "2ac3de" },
      { token: "type.identifier", foreground: "e0af68" },
      { token: "string.math", foreground: "9ece6a" },
      { token: "string.math.command", foreground: "73daca" },
      { token: "delimiter.curly", foreground: "a9b1d6" },
      { token: "constant.character.escape", foreground: "f7768e" },
      { token: "number", foreground: "ff9e64" },
      { token: "attribute.name", foreground: "7dcfff" },
      { token: "string", foreground: "9ece6a" },
    ],
    colors: {
      "editor.background": "#141826",
      "editor.lineHighlightBackground": "#1b2032",
      "editorLineNumber.foreground": "#3e4560",
      "editorLineNumber.activeForeground": "#a0a8c8",
      "editorGutter.background": "#141826",
      "editor.selectionBackground": "#2e3a66",
      "editorIndentGuide.background1": "#232842",
      "editorBracketMatch.border": "#7aa2f7",
      "editorWidget.background": "#1a1f31",
      "editorSuggestWidget.background": "#1a1f31",
      "editorSuggestWidget.selectedBackground": "#2a3354",
    },
  });
  monaco.editor.defineTheme("qmaze-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8a93a8", fontStyle: "italic" },
      { token: "keyword", foreground: "2d59c4" },
      { token: "keyword.section", foreground: "b4441f", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "7a3fc2" },
      { token: "tag", foreground: "0b7e95" },
      { token: "type.identifier", foreground: "9a6a00" },
      { token: "string.math", foreground: "2f7d32" },
      { token: "string.math.command", foreground: "11786b" },
      { token: "constant.character.escape", foreground: "c2185b" },
      { token: "number", foreground: "b4441f" },
      { token: "attribute.name", foreground: "0b6e99" },
      { token: "string", foreground: "2f7d32" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.lineHighlightBackground": "#f3f5fb",
      "editorLineNumber.foreground": "#b5bccd",
      "editorLineNumber.activeForeground": "#4a5372",
      "editor.selectionBackground": "#cfdcfb",
    },
  });

  // ---- completion --------------------------------------------------------------
  const K = monaco.languages.CompletionItemKind;
  const Rule = monaco.languages.CompletionItemInsertTextRule;
  monaco.languages.registerCompletionItemProvider("latex", {
    triggerCharacters: ["\\", "{", ",", "/"],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);

      // Inside an argument: \cmd[opt]{partial
      const arg = /\\([a-zA-Z]+)\*?(?:\[[^\]]*\])*\{([^{}]*)$/.exec(line);
      if (arg) {
        const cmd = arg[1];
        const typed = arg[2];
        const lastComma = typed.lastIndexOf(",");
        const startCol = position.column - (typed.length - (lastComma + 1));
        const range = new monaco.Range(position.lineNumber, startCol, position.lineNumber, position.column);
        const items = (list: { label: string; detail?: string; doc?: string; kind: monaco.languages.CompletionItemKind; insert?: string }[]) => ({
          suggestions: list.map((x, i) => ({
            label: x.label,
            kind: x.kind,
            detail: x.detail,
            documentation: x.doc,
            insertText: x.insert ?? x.label,
            range,
            sortText: String(i).padStart(5, "0"),
          })),
        });
        if (CITE_COMMANDS.includes(cmd)) {
          return items(indexState.bib.map((b) => ({ label: b.key, kind: K.Reference, detail: [b.author, b.year].filter(Boolean).join(", "), doc: b.title })));
        }
        if (REF_COMMANDS.includes(cmd)) {
          return items(indexState.labels.map((l) => ({ label: l.name, kind: K.Reference, detail: `${l.file}:${l.line}` })));
        }
        if (cmd === "includegraphics") {
          const list = indexState.imageFiles.flatMap((p) => {
            const noExt = p.replace(/\.[^./]+$/, "");
            const base = noExt.split("/").pop()!;
            const viaGraphicspath = indexState.graphicsPaths.some((g) => noExt === g + base) ? [{ label: base, kind: K.File, detail: p }] : [];
            return [...viaGraphicspath, { label: p, kind: K.File, detail: "project path" }];
          });
          return items(list);
        }
        if (cmd === "input" || cmd === "include" || cmd === "subfile") {
          return items(indexState.texFiles.map((p) => ({ label: p.replace(/\.tex$/, ""), kind: K.File, detail: p })));
        }
        if (cmd === "bibliography") {
          return items(indexState.bibFiles.map((p) => ({ label: p.replace(/\.bib$/, ""), kind: K.File, detail: p })));
        }
        if (cmd === "addbibresource") {
          return items(indexState.bibFiles.map((p) => ({ label: p, kind: K.File })));
        }
        if (cmd === "usepackage" || cmd === "RequirePackage") {
          return items(PACKAGES.map((p) => ({ label: p, kind: K.Module })));
        }
        if (cmd === "begin") {
          return {
            suggestions: ENVIRONMENTS.map((e, i) => ({
              label: e.name,
              kind: K.Snippet,
              detail: e.detail,
              insertText: `${e.name}}${e.args ?? ""}\n${e.body ?? "\t$0"}\n\\end{${e.name}`,
              insertTextRules: Rule.InsertAsSnippet,
              range: new monaco.Range(position.lineNumber, startCol, position.lineNumber, closingBraceEnd(model, position)),
              sortText: String(i).padStart(5, "0"),
            })),
          };
        }
        if (cmd === "end") {
          const before = model.getValueInRange(new monaco.Range(1, 1, position.lineNumber, position.column));
          const open = innermostOpenEnv(before.replace(/\\end\{[^{}]*$/, ""));
          const names = open ? [open, ...ENVIRONMENTS.map((e) => e.name).filter((n) => n !== open)] : ENVIRONMENTS.map((e) => e.name);
          return items(names.map((n) => ({ label: n, kind: K.Struct })));
        }
        return { suggestions: [] };
      }

      // Command name: \partial
      const cmdm = /\\([a-zA-Z@]*)$/.exec(line);
      if (cmdm) {
        const range = new monaco.Range(position.lineNumber, position.column - cmdm[1].length, position.lineNumber, position.column);
        const cmds = COMMANDS.map((c) => ({
          label: "\\" + c.name,
          filterText: c.name,
          kind: c.math ? K.Operator : K.Function,
          detail: c.detail,
          insertText: c.snippet ?? c.name,
          insertTextRules: c.snippet ? Rule.InsertAsSnippet : undefined,
          range,
        }));
        const envs = ENVIRONMENTS.map((e) => ({
          label: `\\begin{${e.name}}`,
          filterText: `begin${e.name}`,
          kind: K.Snippet,
          detail: e.detail,
          insertText: `begin{${e.name}}${e.args ?? ""}\n${e.body ?? "\t$0"}\n\\end{${e.name}}`,
          insertTextRules: Rule.InsertAsSnippet,
          range,
        }));
        return { suggestions: [...cmds, ...envs] };
      }
      return { suggestions: [] };
    },
  });

  monaco.languages.registerFoldingRangeProvider("latex", {
    provideFoldingRanges(model) {
      return foldingRanges(model.getValue()).map((r) => ({ start: r.start, end: r.end, kind: monaco.languages.FoldingRangeKind.Region }));
    },
  });

  return monaco;
}

/** Column just after an auto-inserted closing brace, so \begin{ completions replace it. */
function closingBraceEnd(model: monaco.editor.ITextModel, pos: monaco.Position): number {
  const rest = model.getLineContent(pos.lineNumber).slice(pos.column - 1);
  return rest.startsWith("}") ? pos.column + 1 : pos.column;
}

export { monaco };
