import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import { ActivityBar, Sidebar } from "../projects/Sidebar";
import { EditorArea } from "../editor/EditorArea";
import { PdfViewer } from "../pdf/PdfViewer";
import { BottomPanel } from "../compiler/BottomPanel";
import { CompileBar } from "../compiler/CompileBar";
import { StoryWorkbench } from "../story/StoryWorkbench";

/**
 * Main editing layout: rail | file tree + outline | editor | PDF pane.
 * Compile controls sit at the top of the PDF pane and the logs open over the PDF.
 * All panels are resizable/collapsible; sizes persist via autoSaveId.
 */
export function Workbench() {
  const sidebar = useApp((s) => s.sidebarVisible);
  const preview = useApp((s) => s.previewVisible);
  const bottom = useApp((s) => s.bottomVisible);
  const kind = useApp((s) => s.project?.meta.kind);
  if (kind === "story")
    return (
      <div className="workbench">
        <StoryWorkbench />
      </div>
    );
  return (
    <div className="workbench">
      <ActivityBar />
      <PanelGroup direction="horizontal" autoSaveId="pf-main" style={{ flex: 1 }}>
        {sidebar && (
          <>
            <Panel id="sidebar" order={1} defaultSize={16} minSize={11} maxSize={40}>
              <Sidebar />
            </Panel>
            <PanelResizeHandle className="resize-handle" />
          </>
        )}
        <Panel id="center" order={2} minSize={30}>
          <PanelGroup direction="horizontal" autoSaveId="pf-editor-pdf">
            <Panel id="editor" order={1} minSize={20} defaultSize={50}>
              <EditorArea />
            </Panel>
            {(preview || bottom) && (
              <>
                <PanelResizeHandle className="resize-handle" />
                <Panel id="pdf" order={2} minSize={22} defaultSize={50}>
                  {/* Logs open over the PDF, in the same pane, and close back to it. */}
                  <PdfViewer leading={<CompileBar />} overlay={bottom ? <BottomPanel /> : undefined} />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
