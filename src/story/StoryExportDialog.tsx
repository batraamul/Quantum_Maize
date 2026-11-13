import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { FileCode2, FolderOutput, Globe } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { toast, ui, useApp } from "../app/store";
import { Modal } from "../components/Common";
import { renderStory } from "./render";
import { storyRef } from "./StoryWorkbench";

export function StoryExportDialog() {
  const project = useApp((s) => s.project)!;
  const [single, setSingle] = useState(true);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const story = storyRef.current;
    if (!story) return;
    const slug = (story.meta.title || project.meta.name).replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "story";
    const dest = single
      ? await saveDialog({ title: "Export story as a single web page", defaultPath: `${slug}.html`, filters: [{ name: "Web page", extensions: ["html"] }] })
      : await openDialog({ directory: true, title: "Choose an empty folder for the web export" });
    if (typeof dest !== "string") return;
    setBusy(true);
    try {
      const html = renderStory(story, (p) => `{{qm-asset:${p}}}`);
      const missing = await api.exportStory(project.root, html, dest, single);
      if (missing.length) toast("warning", "Exported with missing media", missing.join(", "));
      else toast("success", "Story exported", dest);
      ui.closeDialog();
      openPath(single ? dest : `${dest}${dest.includes("\\") ? "\\" : "/"}index.html`).catch(() => {});
    } catch (e) {
      toast("error", "Export failed", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Export interactive story" icon={<Globe size={20} color="var(--accent)" />} onClose={ui.closeDialog}
      footer={<><button className="btn" onClick={ui.closeDialog}>Cancel</button><button className="btn primary" onClick={run} disabled={busy}>{busy ? "Exporting…" : "Export…"}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button className={"choice-card" + (single ? " selected" : "")} onClick={() => setSingle(true)}>
          <FileCode2 size={22} color="var(--accent)" />
          <span><div className="ct">Single HTML file</div><div className="cd">Images, GIFs and video embedded. One file to e-mail, archive or attach. Larger size.</div></span>
        </button>
        <button className={"choice-card" + (!single ? " selected" : "")} onClick={() => setSingle(false)}>
          <FolderOutput size={22} color="var(--accent)" />
          <span><div className="ct">Web folder</div><div className="cd">index.html plus an assets folder — ready to upload to any web server or intranet.</div></span>
        </button>
      </div>
      <div className="hint">The page works offline in any modern browser: no tracking, no external scripts or fonts. Animations respect the reader's “reduce motion” setting.</div>
    </Modal>
  );
}
