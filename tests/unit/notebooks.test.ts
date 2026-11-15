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

import { blockSize, moveBlock, newBlock, resized, TEXT_SIZES } from "../../src/notebooks/model";

describe("notebook block layout", () => {
  it("keeps valid alignment and text size and drops invalid ones", () => {
    const nb = parseNotebook(JSON.stringify({ pages: [{ title: "p", blocks: [
      { type: "text", text: "a", align: "right", size: 3 },
      { type: "text", text: "b", align: "diagonal", size: 99 },
      { type: "image", src: "", align: "justify" },
      { type: "code", text: "c", align: "center", size: 2 },
    ] }] }));
    const b = nb.pages[0].blocks;
    expect([b[0].align, b[0].size]).toEqual(["right", 3]);
    expect([b[1].align, b[1].size, b[2].align, b[3].align, b[3].size]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it("resizes text, headings and pictures within limits", () => {
    let t = newBlock("text");
    for (let i = 0; i < 10; i++) t = resized(t, 1);
    expect(t.size).toBe(TEXT_SIZES.length - 1);
    expect(blockSize(t)!.lines).toBe(2);
    for (let i = 0; i < 10; i++) t = resized(t, -1);
    expect(t.size).toBe(0);
    expect(resized({ ...newBlock("heading"), level: 2 }, 1).level).toBe(1);
    expect(resized({ ...newBlock("heading"), level: 3 }, -1).level).toBe(3);
    expect(resized({ ...newBlock("image"), width: 95 }, 1).width).toBe(100);
    expect(resized({ ...newBlock("image"), width: 12 }, -1).width).toBe(10);
    expect(blockSize(newBlock("image"))).toBeNull();
  });

  it("moves a block to a drop position", () => {
    const bs = ["a", "b", "c", "d"].map((id) => ({ ...newBlock("text"), id }));
    const ids = (x: typeof bs) => x.map((b) => b.id).join("");
    expect(ids(moveBlock(bs, "a", 4))).toBe("bcda");
    expect(ids(moveBlock(bs, "d", 0))).toBe("dabc");
    expect(ids(moveBlock(bs, "b", 3))).toBe("acbd");
    expect(moveBlock(bs, "b", 1)).toBe(bs);
    expect(moveBlock(bs, "b", 2)).toBe(bs);
    expect(moveBlock(bs, "zz", 0)).toBe(bs);
  });
});
