import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import { ActivityBar, Sidebar } from "../projects/Sidebar";
import { EditorArea } from "../editor/EditorArea";
import { PdfViewer } from "../pdf/PdfViewer";
import { BottomPanel } from "../compiler/BottomPanel";
import { StoryWorkbench } from "../story/StoryWorkbench";

/**
 * Main editing layout: activity bar | sidebar | (editor | pdf) / bottom panel.
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
            <Panel id="sidebar" order={1} defaultSize={17} minSize={11} maxSize={40}>
              <Sidebar />
            </Panel>
            <PanelResizeHandle className="resize-handle" />
          </>
        )}
        <Panel id="center" order={2} minSize={30}>
          <PanelGroup direction="vertical" autoSaveId="pf-center">
            <Panel id="top" order={1} minSize={25}>
              <PanelGroup direction="horizontal" autoSaveId="pf-editor-pdf">
                <Panel id="editor" order={1} minSize={20} defaultSize={52}>
                  <EditorArea />
                </Panel>
                {preview && (
                  <>
                    <PanelResizeHandle className="resize-handle" />
                    <Panel id="pdf" order={2} minSize={18} defaultSize={48}>
                      <PdfViewer />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>
            {bottom && (
              <>
                <PanelResizeHandle className="resize-handle vertical" />
                <Panel id="bottom" order={2} defaultSize={28} minSize={10} maxSize={70}>
                  <BottomPanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
