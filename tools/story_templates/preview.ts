// Renders every bundled story template to a self-contained HTML file for review:
//   npx esbuild tools/story_templates/preview.ts --bundle --platform=node --outfile=/tmp/preview.cjs && node /tmp/preview.cjs <out dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseStory } from "../../src/story/schema";
import { renderStory } from "../../src/story/render";

const src = join(process.cwd(), "src-tauri/assets/story-templates");
const out = process.argv[2] ?? "story-template-previews";
mkdirSync(out, { recursive: true });
const mime: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
for (const id of readdirSync(src)) {
  const story = parseStory(readFileSync(join(src, id, "story.json"), "utf8"));
  const html = renderStory(story, (p) => {
    const ext = p.split(".").pop()!.toLowerCase();
    return `data:${mime[ext] ?? "application/octet-stream"};base64,${readFileSync(join(src, id, p)).toString("base64")}`;
  });
  writeFileSync(join(out, `${id}.html`), html);
  console.log(`${id}.html  ${(html.length / 1024).toFixed(0)} KB`);
}
