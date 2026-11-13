// Manuscript checklist against a journal profile. Pure; unit-tested.
// Statuses: verified (checked automatically and OK), warning (needs manual
// attention), missing (required and not found), not-checked (cannot be
// verified automatically). Passing these checks does NOT guarantee
// compliance or acceptance.

import type { Diagnostic, Requirements } from "../types";
import { readGroup, stripComments } from "../editor/projectIndex";

export type CheckStatus = "verified" | "warning" | "missing" | "not-checked";

export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  file?: string;
  line?: number;
}

export interface CheckInput {
  /** All .tex sources reachable from the main file, keyed by path, in order. */
  sources: { path: string; text: string }[];
  bibKeys: string[];
  duplicateBibKeys: string[];
  diagnostics: Diagnostic[];
  compiled: boolean | null; // null = never compiled
  pdfPages: number | null;
  requirements: Requirements | null;
  journalName: string | null;
}

function findAll(sources: CheckInput["sources"], re: RegExp) {
  const hits: { path: string; line: number; m: RegExpExecArray }[] = [];
  for (const s of sources) {
    const t = stripComments(s.text);
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = r.exec(t))) hits.push({ path: s.path, line: t.slice(0, m.index).split("\n").length, m });
  }
  return hits;
}

function envBodies(sources: CheckInput["sources"], env: string) {
  const out: { path: string; line: number; body: string }[] = [];
  for (const s of sources) {
    const t = stripComments(s.text);
    const re = new RegExp(`\\\\begin\\{${env}\\*?\\}([\\s\\S]*?)\\\\end\\{${env}\\*?\\}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) out.push({ path: s.path, line: t.slice(0, m.index).split("\n").length, body: m[1] });
  }
  return out;
}

export function wordCount(tex: string): number {
  const t = stripComments(tex)
    .replace(/\$[^$]*\$/g, " x ")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/[{}~\\]/g, " ");
  return t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

const SECTION_ALIASES: Record<string, RegExp> = {
  introduction: /introduction|background/i,
  conclusion: /conclusion|concluding|summary/i,
  "author contributions": /author(s|'s)?\W*contribution|contribution of (the )?authors|credit author/i,
  funding: /funding|acknowledg/i,
  "conflicts of interest": /conflicts? of interest|competing interest|declaration of interest/i,
  "data availability": /data availability|availability of data/i,
  biographies: /biograph/i,
  methods: /method|materials/i,
  results: /result/i,
};

export function runChecks(inp: CheckInput): CheckItem[] {
  const items: CheckItem[] = [];
  const add = (i: CheckItem) => items.push(i);
  const all = inp.sources.map((s) => s.text).join("\n");
  const req = inp.requirements;

  // 1. Build
  add(
    inp.compiled === null
      ? { id: "build", label: "Document compiles", status: "warning", detail: "Not compiled in this session — compile to check." }
      : inp.compiled
        ? { id: "build", label: "Document compiles", status: "verified", detail: "Last compilation succeeded." }
        : { id: "build", label: "Document compiles", status: "missing", detail: "The last compilation failed — see the Errors panel." },
  );

  // 2. Title, authors, affiliations
  const title = findAll(inp.sources, /\\title\s*(?:\[[^\]]*\])?\s*\{/)[0];
  add(title ? { id: "title", label: "Title", status: "verified", detail: "\\title found.", file: title.path, line: title.line } : { id: "title", label: "Title", status: "missing", detail: "No \\title command found." });
  const authors = findAll(inp.sources, /\\author\s*(?:\[[^\]]*\])?\s*\{/);
  add(authors.length ? { id: "authors", label: "Authors", status: "verified", detail: `${authors.length} \\author command(s).`, file: authors[0].path, line: authors[0].line } : { id: "authors", label: "Authors", status: "missing", detail: "No \\author command found." });
  const aff = findAll(inp.sources, /\\(affiliation|affil|institute|IEEEauthorblockA|address|thanks|orgname)\b/);
  add(aff.length ? { id: "affil", label: "Author affiliations", status: "verified", detail: "Affiliation information found." } : { id: "affil", label: "Author affiliations", status: "warning", detail: "No affiliation command found (\\affiliation, \\institute, \\thanks …). Check the title block." });

  // 3. Abstract + word limit
  const abs = envBodies(inp.sources, "abstract")[0];
  if (!abs) add({ id: "abstract", label: "Abstract", status: "missing", detail: "No abstract environment found." });
  else {
    const wc = wordCount(abs.body);
    const max = req?.abstractMaxWords;
    if (max && wc > max) add({ id: "abstract", label: "Abstract", status: "warning", detail: `${wc} words — the profile's limit is ${max}.`, file: abs.path, line: abs.line });
    else add({ id: "abstract", label: "Abstract", status: "verified", detail: `${wc} words${max ? ` (limit ${max})` : ""}.`, file: abs.path, line: abs.line });
  }

  // 4. Keywords
  const kw = findAll(inp.sources, /\\begin\{(keywords?|IEEEkeywords)\}|\\keywords\s*\{|\\kwd\b|Keywords?\s*[:}]|Index Terms/i)[0];
  const needKw = !req || req.sections.includes("keywords");
  add(kw ? { id: "keywords", label: "Keywords", status: "verified", detail: "Keywords found.", file: kw.path, line: kw.line } : { id: "keywords", label: "Keywords", status: needKw ? "missing" : "warning", detail: "No keywords found." });

  // 5. Required sections and statements
  const heads = findAll(inp.sources, /\\(?:section|section\*|subsection\*?)\s*(?:\[[^\]]*\])?\s*\{/).map((h) => {
    const t = stripComments(inp.sources.find((s) => s.path === h.path)!.text);
    const idx = t.split("\n").slice(0, h.line - 1).join("\n").length + (h.line > 1 ? 1 : 0);
    const brace = t.indexOf("{", t.indexOf("\\", idx));
    return { ...h, title: readGroup(t, brace)?.text ?? "" };
  });
  const sectionNames = (req?.sections ?? ["introduction", "conclusion", "references"]).filter((s) => !["abstract", "keywords"].includes(s));
  for (const s of sectionNames) {
    if (s === "references") {
      const bib = findAll(inp.sources, /\\bibliography\s*\{|\\printbibliography|\\begin\{thebibliography\}/)[0];
      add(bib ? { id: "sec-references", label: "References section", status: "verified", detail: "Bibliography is printed.", file: bib.path, line: bib.line } : { id: "sec-references", label: "References section", status: "missing", detail: "No \\bibliography, \\printbibliography or thebibliography found." });
      continue;
    }
    const re = SECTION_ALIASES[s] ?? new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const h = heads.find((x) => re.test(x.title));
    add(h ? { id: `sec-${s}`, label: `Section: ${s}`, status: "verified", detail: `“${h.title}”`, file: h.path, line: h.line } : { id: `sec-${s}`, label: `Section: ${s}`, status: "missing", detail: `No section titled like “${s}”.` });
  }
  for (const st of req?.statements ?? []) {
    const re = SECTION_ALIASES[st.toLowerCase()] ?? new RegExp(st.split(/\s+/)[0].replace(/[^A-Za-z]/g, ""), "i");
    const h = heads.find((x) => re.test(x.title));
    add(h ? { id: `st-${st}`, label: `Statement: ${st}`, status: "verified", detail: `“${h.title}”`, file: h.path, line: h.line } : { id: `st-${st}`, label: `Statement: ${st}`, status: "warning", detail: "Not found as a section — it may be required as a separate document; check the author instructions." });
  }

  // 6. Floats: captions, labels, cross-references
  const figs = envBodies(inp.sources, "figure");
  const tabs = envBodies(inp.sources, "table");
  const noCap = [...figs, ...tabs].filter((f) => !/\\caption/.test(f.body));
  add(noCap.length ? { id: "captions", label: "Figure & table captions", status: "missing", detail: `${noCap.length} float(s) without \\caption.`, file: noCap[0].path, line: noCap[0].line } : { id: "captions", label: "Figure & table captions", status: figs.length + tabs.length ? "verified" : "not-checked", detail: figs.length + tabs.length ? `${figs.length} figure(s), ${tabs.length} table(s), all captioned.` : "No figures or tables." });
  const refs = new Set([...all.matchAll(/\\(?:[cC]?ref|eqref|autoref|pageref)\s*\{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((x) => x.trim())));
  const unrefd = [...figs, ...tabs].flatMap((f) => [...f.body.matchAll(/\\label\{([^}]+)\}/g)].map((m) => ({ f, l: m[1] }))).filter((x) => !refs.has(x.l));
  add(unrefd.length ? { id: "floatrefs", label: "Figures/tables referenced in text", status: "warning", detail: `Not referenced: ${unrefd.map((u) => u.l).join(", ")}`, file: unrefd[0].f.path, line: unrefd[0].f.line } : { id: "floatrefs", label: "Figures/tables referenced in text", status: figs.length + tabs.length ? "verified" : "not-checked", detail: "All labelled floats are referenced." });

  // 7. Bibliography completeness
  const cited = new Set([...all.matchAll(/\\(?:no)?cite[a-zA-Z]*\*?\s*(?:\[[^\]]*\]){0,2}\s*\{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((x) => x.trim())).filter((k) => k && k !== "*"));
  const bib = new Set(inp.bibKeys);
  const missing = [...cited].filter((k) => !bib.has(k));
  const uncited = /\\nocite\{\*\}/.test(all) ? [] : [...bib].filter((k) => !cited.has(k));
  add(missing.length ? { id: "cites", label: "Every citation has a bibliography entry", status: "missing", detail: `Missing in .bib: ${missing.join(", ")}` } : { id: "cites", label: "Every citation has a bibliography entry", status: cited.size ? "verified" : "warning", detail: cited.size ? `${cited.size} cited key(s) found in .bib files.` : "No citations found." });
  add(uncited.length ? { id: "uncited", label: "Bibliography entries are cited", status: "warning", detail: `Never cited: ${uncited.slice(0, 12).join(", ")}${uncited.length > 12 ? " …" : ""}` } : { id: "uncited", label: "Bibliography entries are cited", status: bib.size ? "verified" : "not-checked", detail: bib.size ? "All entries are cited." : "No .bib entries." });
  add(inp.duplicateBibKeys.length ? { id: "dupkeys", label: "No duplicate bibliography keys", status: "missing", detail: inp.duplicateBibKeys.join(", ") } : { id: "dupkeys", label: "No duplicate bibliography keys", status: bib.size ? "verified" : "not-checked", detail: "No duplicates." });
  const unresolved = inp.diagnostics.filter((d) => d.category === "citation" || d.category === "reference");
  add(unresolved.length ? { id: "unresolved", label: "References resolve in the PDF", status: "missing", detail: `${unresolved.length} unresolved reference/citation warning(s) in the last build.`, file: unresolved[0].file ?? undefined, line: unresolved[0].line ?? undefined } : { id: "unresolved", label: "References resolve in the PDF", status: inp.compiled ? "verified" : "not-checked", detail: inp.compiled ? "No undefined references in the last build." : "Compile to check." });

  // 8. Length
  if (req?.maxPages) {
    add(inp.pdfPages == null ? { id: "pages", label: `Page limit (${req.maxPages})`, status: "not-checked", detail: "Compile to count pages." } : inp.pdfPages > req.maxPages ? { id: "pages", label: `Page limit (${req.maxPages})`, status: "missing", detail: `${inp.pdfPages} pages.` } : { id: "pages", label: `Page limit (${req.maxPages})`, status: "verified", detail: `${inp.pdfPages} pages.` });
  } else if (inp.pdfPages != null) add({ id: "pages", label: "Page count", status: "not-checked", detail: `${inp.pdfPages} pages — no limit recorded in this profile; check the author instructions.` });

  // 9. Things that cannot be verified automatically
  for (const n of req?.notes ?? []) add({ id: `note-${n.slice(0, 24)}`, label: n, status: "not-checked", detail: "Check manually." });
  add({ id: "guidelines", label: "Current author instructions reviewed", status: "not-checked", detail: inp.journalName ? `Re-read ${inp.journalName}'s latest instructions before submitting; requirements change.` : "No journal selected for this project." });
  return items;
}

export function summary(items: CheckItem[]) {
  const c = { verified: 0, warning: 0, missing: 0, "not-checked": 0 } as Record<CheckStatus, number>;
  items.forEach((i) => c[i.status]++);
  return c;
}
