import { describe, expect, it } from "vitest";
import { COVER_THEMES, coverSvg } from "../../src/notebooks/covers";
import { fileNameFor, newNotebook, pageText, parseNotebook } from "../../src/notebooks/model";

const make = () => newNotebook({ title: "Radar: Notes / Vol 1", subject: "EW", owner: "A", theme: "radar", color: "", style: "grid", paper: "cream", font: "hand" });

describe("notebook model", () => {
  it("round-trips through JSON", () => {
    const nb = make();
    const back = parseNotebook(JSON.stringify(nb));
    expect(back).toEqual(nb);
    expect(fileNameFor(nb)).toMatch(/^Radar-Notes-Vol-1-[a-z0-9]{6}\.qmnote\.json$/);
  });

  it("rejects files that are not notebooks", () => {
    expect(() => parseNotebook("[1,2]")).toThrow();
    expect(() => parseNotebook('{"title":"x"}')).toThrow();
    expect(() => parseNotebook("not json")).toThrow();
  });

  it("repairs damaged content and drops unsafe images and unknown blocks", () => {
    const nb = parseNotebook(JSON.stringify({
      pages: [{ title: 5, blocks: [
        { type: "script", text: "x" },
        { type: "image", src: "https://example.com/a.png", width: 900 },
        { type: "image", src: "data:image/svg+xml;base64,PHN2Zz4=" },
        { type: "image", src: "data:image/png;base64,iVBORw0KGgo=" },
        { type: "table", rows: [["a"], ["b", "c"]] },
        { type: "heading", text: "T", level: 9 },
        { type: "checklist", items: [{ text: "do", done: 1 }, null] },
      ] }],
      paper: { style: "nope", color: "x", font: "y" },
    }));
    const b = nb.pages[0].blocks;
    expect(b.map((x) => x.type)).toEqual(["image", "image", "image", "table", "heading", "checklist"]);
    expect([b[0].src, b[0].width, b[1].src]).toEqual(["", 100, ""]);
    expect(b[2].src).toContain("data:image/png");
    expect(b[3].rows).toEqual([["a", ""], ["b", "c"]]);
    expect(b[4].level).toBe(2);
    expect(b[5].items).toEqual([{ text: "do", done: true }, { text: "", done: false }]);
    expect(nb.paper).toEqual({ style: "ruled", color: "white", font: "sans" });
    expect(nb.pages[0].title).toBe("Untitled page");
  });

  it("searches page text", () => {
    const nb = make();
    nb.pages[0].blocks.push({ id: "t", type: "table", rows: [["Monopulse"]] });
    expect(pageText(nb.pages[0])).toContain("monopulse");
  });
});

describe("covers", () => {
  it("has many themes, each with an emblem, and escapes titles", () => {
    expect(COVER_THEMES.length).toBeGreaterThanOrEqual(30);
    for (const t of COVER_THEMES) expect(t.emblem, t.id).toBeTruthy();
    for (const need of ["aviation", "drones", "weapons", "communication", "security", "hacking", "iot"]) expect(COVER_THEMES.some((t) => t.id === need)).toBe(true);
    const svg = coverSvg("hacking", "<script>alert(1)</script> & more", "S");
    expect(svg).not.toContain("<script>");
    expect(coverSvg("no-such-theme", "x", "")).toContain("CLASSIC NOTEBOOK");
  });
});
