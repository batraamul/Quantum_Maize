import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assetRefs, parseStory, PRESETS } from "../../src/story/schema";
import { renderStory } from "../../src/story/render";

const DIR = join(__dirname, "../../src-tauri/assets/story-templates");
const ids = readdirSync(DIR);

describe("bundled story templates", () => {
  it("has the format layouts and the long topic templates", () => {
    expect(ids.filter((i) => i.startsWith("format-")).length).toBe(6);
    expect(ids.filter((i) => !i.startsWith("format-")).length).toBeGreaterThanOrEqual(20);
  });

  it.each(ids)("%s loads, renders and ships its media", (id) => {
    const raw = readFileSync(join(DIR, id, "story.json"), "utf8");
    const info = JSON.parse(readFileSync(join(DIR, id, "template.json"), "utf8"));
    const story = parseStory(raw);
    // No block was dropped as an unknown type.
    expect(story.blocks.length).toBe(JSON.parse(raw).blocks.length);
    expect(story.blocks.length).toBe(info.sections);
    expect(story.blocks[0].type).toBe("hero");
    expect(Object.keys(PRESETS)).toContain(story.theme.preset);
    for (const a of assetRefs(story)) expect(existsSync(join(DIR, id, a)), `${id}: ${a}`).toBe(true);
    for (const b of story.blocks) {
      if (b.type === "quiz") {
        const opts = b.options as string[];
        expect(b.answer as number).toBeGreaterThanOrEqual(0);
        expect(b.answer as number).toBeLessThan(opts.length);
      }
      if (b.type === "chart") expect((b.labels as string[]).length).toBe((b.values as number[]).length);
      if (b.type === "hotspots") for (const p of b.points as { x: number; y: number }[]) expect(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100).toBe(true);
    }
    const html = renderStory(story, (p) => `{{qm-asset:${p}}}`);
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // nothing loaded from the network
    expect(html.slice(html.indexOf("<body"), html.lastIndexOf("<script")), "rendered markup").not.toContain("undefined");
  });
});
