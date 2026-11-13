import { useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChevronRight, Columns2, FileCode2, Locate, X } from "lucide-react";
import { monaco } from "./monacoSetup";
import { getModel, isDirty } from "./models";
import { setActiveEditor, wrapSelection } from "./activeEditor";
import { closeFile, compile, saveFile, syncForward, ui, useApp } from "../app/store";
import { sc } from "../components/Common";

function MonacoPane({ path, onFocus }: { path: string | null; onFocus?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const settings = useApp((s) => s.settings);
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      model: null,
      automaticLayout: true,
      fontSize: settings?.editorFontSize ?? 14,
      fontFamily: settings?.editorFontFamily,
      fontLigatures: false,
      lineHeight: 1.6,
      wordWrap: settings?.wordWrap ? "on" : "off",
      minimap: { enabled: settings?.minimap ?? false },
      tabSize: settings?.tabSize ?? 2,
      renderWhitespace: "selection",
      smoothScrolling: true,
      cursorSmoothCaretAnimation: "on",
      cursorBlinking: "smooth",
      scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 },
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: "active", indentation: true },
      folding: true,
      foldingStrategy: "auto",
      showFoldingControls: "mouseover",
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      snippetSuggestions: "top",
      suggestLineHeight: 24,
      suggestFontSize: 13,
      wordBasedSuggestions: "currentDocument",
      unicodeHighlight: { ambiguousCharacters: false },
      stickyScroll: { enabled: true },
      fixedOverflowWidgets: true,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      overviewRulerBorder: false,
    });
    editor.current = ed;
    const K = monaco.KeyMod;
    const C = monaco.KeyCode;
    ed.addCommand(K.CtrlCmd | C.KeyS, () => {
      const m = ed.getModel();
      const p = m && m.uri.scheme === "pf" ? m.uri.path.slice(1) : null;
      if (p) void saveFile(p);
    });
    ed.addCommand(K.CtrlCmd | C.Enter, () => void compile());
    ed.addCommand(K.CtrlCmd | C.KeyB, () => wrapSelection("\\textbf{", "}"));
    ed.addCommand(K.CtrlCmd | C.KeyI, () => wrapSelection("\\textit{", "}"));
    ed.addCommand(K.CtrlCmd | K.Alt | C.KeyJ, () => void syncForward());
    ed.onDidFocusEditorText(() => {
      setActiveEditor(ed);
      focusRef.current?.();
    });
    ed.onDidChangeCursorPosition((e) => ui.setCursor(e.position.lineNumber, e.position.column));
    setActiveEditor(ed);
    return () => {
      ed.dispose();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    editor.current?.updateOptions({
      fontSize: settings?.editorFontSize,
      fontFamily: settings?.editorFontFamily,
      wordWrap: settings?.wordWrap ? "on" : "off",
      minimap: { enabled: settings?.minimap ?? false },
      tabSize: settings?.tabSize,
    });
  }, [settings?.editorFontSize, settings?.editorFontFamily, settings?.wordWrap, settings?.minimap, settings?.tabSize]);

  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    const m = path ? getModel(path) : null;
    if (ed.getModel() !== m) {
      ed.setModel(m);
      if (m) setActiveEditor(ed);
    }
  }, [path, useApp((s) => s.openFiles.length)]);

  return <div ref={host} style={{ position: "absolute", inset: 0 }} />;
}

function Tabs() {
  const files = useApp((s) => s.openFiles);
  const active = useApp((s) => s.activePath);
  const split = useApp((s) => s.splitEditor);
  useApp((s) => s.dirtyTick);
  return (
    <div className="tabs" role="tablist">
      {files.map((f) => {
        const dirty = f.kind === "text" && isDirty(f.path);
        return (
          <div
            key={f.path}
            role="tab"
            aria-selected={active === f.path}
            className={"tab" + (active === f.path ? " active" : "")}
            title={f.path}
            onClick={() => ui.setActive(f.path)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                void closeFile(f.path);
              }
            }}
          >
            <FileCode2 size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
            <span className="tab-name">{f.path.split("/").pop()}</span>
            {dirty && <span className="tab-dirty has-close" />}
            <button
              className="tab-close"
              aria-label={`Close ${f.path}`}
              onClick={(e) => {
                e.stopPropagation();
                void closeFile(f.path);
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
      <div className="tabs-actions">
        <button className="icon-btn" title={`Show cursor position in PDF (${sc("Ctrl+Alt+J")})`} disabled={!active?.endsWith(".tex")} onClick={() => syncForward()}>
          <Locate size={16} />
        </button>
        <button className={"icon-btn" + (split ? " active" : "")} title={`Split editor (${sc("Ctrl+\\")})`} disabled={!active} onClick={ui.toggleSplit}>
          <Columns2 size={16} />
        </button>
      </div>
    </div>
  );
}

function PaneContent({ path, secondary }: { path: string | null; secondary?: boolean }) {
  const file = useApp((s) => s.openFiles.find((f) => f.path === path));
  const cursor = useApp((s) => s.cursor);
  if (!path || !file) {
    return (
      <div className="empty-editor">
        <FileCode2 size={40} strokeWidth={1.2} />
        <div>{secondary ? "Choose a file for the split view" : "Open a file from the Project Explorer"}</div>
      </div>
    );
  }
  if (file.kind === "image") {
    return (
      <div className="image-preview">
        <img src={file.imageUrl} alt={path} />
      </div>
    );
  }
  return (
    <>
      {!secondary && (
        <div className="breadcrumb">
          {path.split("/").map((seg, i, a) => (
            <span key={i} className="row" style={{ gap: 6 }}>
              {i > 0 && <ChevronRight size={12} />}
              <span style={{ color: i === a.length - 1 ? "var(--text-2)" : undefined }}>{seg}</span>
            </span>
          ))}
          <span style={{ marginLeft: "auto" }} className="mono">
            Ln {cursor.line}, Col {cursor.column}
          </span>
        </div>
      )}
      <div className="editor-host">
        <MonacoPane path={path} onFocus={secondary ? undefined : () => undefined} />
      </div>
    </>
  );
}

export function EditorArea() {
  const active = useApp((s) => s.activePath);
  const split = useApp((s) => s.splitEditor);
  const secondary = useApp((s) => s.secondaryPath);
  const files = useApp((s) => s.openFiles);
  const textFiles = files.filter((f) => f.kind === "text");
  return (
    <div className="editor-area">
      <Tabs />
      <div style={{ flex: 1, minHeight: 0 }}>
        {split ? (
          <PanelGroup direction="horizontal" autoSaveId="pf-split">
            <Panel minSize={20} defaultSize={50}>
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <PaneContent path={active} />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel minSize={20} defaultSize={50}>
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div className="breadcrumb">
                  <span>Split view:</span>
                  <select className="select" style={{ height: 22, fontSize: ".85rem" }} value={secondary ?? ""} onChange={(e) => ui.setSecondary(e.target.value)}>
                    {!secondary && <option value="">Choose…</option>}
                    {textFiles.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path}
                      </option>
                    ))}
                  </select>
                  <button className="icon-btn" style={{ marginLeft: "auto", width: 22, height: 22 }} title="Close split" onClick={ui.toggleSplit}>
                    <X size={13} />
                  </button>
                </div>
                <PaneContent path={secondary} secondary />
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <PaneContent path={active} />
          </div>
        )}
      </div>
    </div>
  );
}
