import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BLOCKS, assetRefs, defaultStory, newBlock, parseStory, type BlockType } from "../../src/story/schema";
import { md, renderStory } from "../../src/story/render";

const sample = readFileSync(new URL("../../src-tauri/assets/story/story.json", import.meta.url), "utf8");
const url = (p: string) => `{{qm-asset:${p}}}`;

describe("story schema", () => {
  it("parses the bundled sample and keeps every block", () => {
    const s = parseStory(sample);
    expect(s.blocks.length).toBe(14);
    expect(new Set(s.blocks.map((b) => b.type)).size).toBeGreaterThanOrEqual(13);
  });
  it("drops unknown blocks, fills defaults and de-duplicates ids", () => {
    const s = parseStory(JSON.stringify({ blocks: [{ id: "x", type: "text" }, { id: "x", type: "quote" }, { type: "evil" }] }));
    expect(s.blocks.map((b) => b.type)).toEqual(["text", "quote"]);
    expect(s.blocks[0].id).not.toBe(s.blocks[1].id);
    expect(s.blocks[0].text).toBe("Write here.");
    expect(s.theme.preset).toBe("saffron");
  });
  it("reports invalid JSON clearly", () => {
    expect(() => parseStory("{")).toThrow(/not valid JSON/);
    expect(() => parseStory("{}")).toThrow(/blocks/);
  });
  it("collects asset references but not URLs", () => {
    const refs = assetRefs(parseStory(sample));
    expect(refs).toContain("assets/radar.gif");
    expect(refs).toContain("assets/before.jpg");
    const s = defaultStory();
    s.blocks.push({ ...newBlock("image"), src: "https://example.org/x.png" });
    expect(assetRefs(s)).toEqual([]);
  });
});

describe("story renderer", () => {
  it("renders every block type", () => {
    const s = defaultStory();
    s.blocks = (Object.keys(BLOCKS) as BlockType[]).map((t) => newBlock(t));
    const html = renderStory(s, url);
    for (const cls of ["hero", "scrolly", "stat-grid", "timeline", "quote", "carousel", "cards", "cmp", "chart", "hs", "qbox", "divider"]) {
      expect(html, cls).toMatch(new RegExp(`class="[^"]*\\b${cls}\\b`));
    }
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });
  it("escapes user text everywhere (no script injection)", () => {
    const s = defaultStory('<img src=x onerror=alert(1)>');
    s.blocks.push({ ...newBlock("quote"), text: "</blockquote><script>alert(1)</script>", by: '"><b>' });
    s.blocks.push({ ...newBlock("cards"), items: [{ icon: "<svg onload=alert(1)>", title: "t", text: "x", image: "" }] });
    const html = renderStory(s, url);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).not.toMatch(/<svg onload/);
    expect(html.match(/<script>/g)?.length).toBe(1); // only the runtime
  });
  it("maps assets through the resolver and leaves URLs alone", () => {
    const s = defaultStory();
    s.blocks = [{ ...newBlock("image"), src: "assets/a.png" }, { ...newBlock("image"), src: "https://x.org/b.png" }, { ...newBlock("video"), src: "assets/v.mp4" }];
    const html = renderStory(s, url);
    expect(html).toContain('src="{{qm-asset:assets/a.png}}"');
    expect(html).toContain('src="https://x.org/b.png"');
    expect(html).toMatch(/<video src="\{\{qm-asset:assets\/v.mp4\}\}" autoplay muted loop playsinline>/);
  });
  it("only includes the preview bridge in preview mode", () => {
    expect(renderStory(defaultStory(), url, { preview: true })).toContain("qmScroll");
    expect(renderStory(defaultStory(), url)).not.toContain("qmScroll");
  });
});

describe("mini markdown", () => {
  it("formats and sanitises links", () => {
    expect(md("a **b** *c*\n\nd")).toBe("<p>a <strong>b</strong> <em>c</em></p><p>d</p>");
    expect(md("[x](javascript:alert(1))")).toContain('href="#"');
    expect(md("[x](https://a.org/?q=1&r=2)")).toContain('href="https://a.org/?q=1&amp;r=2"');
  });
});
