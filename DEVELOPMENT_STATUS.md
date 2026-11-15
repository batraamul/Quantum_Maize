# Development status

Last updated: 2026-11-15 · version 0.6.0

All seven phases of the product brief have working implementations on Linux, plus the two additions requested later (presentations with PowerPoint export, interactive stories) and the rename to Quantum Maze with a user-defined owner line. Everything in the "Verified" column below was exercised in the running application or by an automated test on Linux x86-64. Windows and macOS builds are configured but have **never been built or run**.

## What is implemented and how it was verified

| Phase | Feature | Verified by |
| --- | --- | --- |
| 1 | Projects, explorer, Monaco editor, settings, auto-save, recovery, snapshots, trash, ZIP export | GUI walkthrough; unit tests |
| 1 | External-change detection for open files (reload or ask; never a silent overwrite) | GUI: edited a file on disk in both clean and unsaved states |
| 2 | TeX detection, setup wizard, pdfLaTeX/XeLaTeX/LuaLaTeX, latexmk or direct passes, BibTeX/Biber, cancel, time limit, log parser, PDF preview, SyncTeX both ways | 11 integration tests against real TeX; GUI |
| 3 | Journal library: 26 entries, search and filters, readiness from `kpsewhich`, installed class version, user-recorded indexing notes | GUI; registry consistency tests |
| 3 | Project from an official class (IEEEtran, elsarticle, acmart, revtex4-2, llncs, spie) or community profile (DSJ, DLSJ) | Integration test compiles every such entry; GUI created and compiled an IEEE Transactions paper |
| 3 | Import publisher template ZIP or class file into the library; create projects from it | GUI with a self-made class; importer unit tests |
| 3 | Import Overleaf/ZIP project or folder with dependency report | GUI: imported, compiled; build script listed and not run |
| 4 | Table designer, equation editor (KaTeX preview), figure/sub-figure dialog with "add image from computer" | GUI: inserted each and compiled |
| 4 | References: list, search, cited-but-missing and uncited lists, add by DOI (opt-in; creates `references.bib` if absent) | GUI: fetched a real record from doi.org |
| 5 | LaTeX → DOCX and DOCX → LaTeX project with conversion reports | Integration round-trip test; GUI both directions, converted project compiled |
| 6 | Submission checklist against the journal profile; submission ZIP with `.bbl`, final PDF, SHA-256 manifest | Unit tests for checks; integration test; GUI produced and inspected a package |
| 7 | Linux `.deb`, `.rpm` and AppImage; CI workflow for Windows/macOS | See "Release build" below |
| + | Beamer presentations: starter with themes/colours, slide panel, presenter mode, PPTX export (exact and editable) | Integration test compiles 4 theme/colour combinations; PPTX opened in LibreOffice by test and by hand |
| + | Interactive stories: 15 block types, 6 presets, live preview, export as single HTML or web folder | GUI: every block type operated; exported file inspected (no external URLs); unit tests for schema and renderer |
| + | Story template library: 26 bundled templates (6 layouts, 20 topic explainers of 20 sections each), gallery with search and categories, save as template, export/import as ZIP | GUI: created stories from three templates, saved and exported a template; unit tests check every template loads, renders offline and ships exactly the media it uses; import rejects non-template ZIPs and drops scripts |
| + | Presentation formats: 8 structured decks, 6 added modern themes, 4 added colour palettes, protective-marking line | Integration test compiles every format with a different theme and the marking set; GUI created and compiled the selection-board deck |
| + | Notebooks: shelf, 30 covers, page styles, block editor with tables and embedded images, autosave with backup, trash | GUI: created a notebook, added every block type and an image, changed style, switched folder; Rust and frontend unit tests |
| + | Slide designs and infographics (`qmdesign.sty`, written into each presentation project): 9 designs, 19 infographic commands, design picker with previews, design switcher in the Slides panel, infographics placed in the deck formats, gallery deck | Integration tests compile every format with a classic theme and again with a design (both aspect ratios), and the gallery with all 10 design settings. GUI on Linux: created a selection-board deck with a design, compiled it (17 pages, matching the slide list), switched design from the panel. Every design's slides were rendered and looked at; only pdfLaTeX was used |
| + | Notebook page rework: baseline of writing measured per font so it rests on the rules, block margins removed, text size and alignment per block, drag-and-drop reordering, picture resize by corner handle, floating block toolbar, click on empty page to continue writing | GUI on Linux with a ruled cream page and the serif font: checked all block types against the rules, changed size and alignment, dragged a picture to a new position, resized it, confirmed the saved JSON. Unit tests for parsing, resizing and moving. Other fonts, page styles, macOS and Windows not looked at |
| + | Owner profile (name, rank, organization) shown as "Quantum Maze by …" and used as default author | GUI |

## Tests

- Rust unit tests: 41 (security, filesystem, database, settings, log parser, SyncTeX, detection, registry, importer, converter, PPTX writer, story protocol and export, DOI validation).
- Rust integration tests: 18. `compile_integration.rs` (11) drives the real TeX toolchain; `features_integration.rs` (7) compiles every journal skeleton and the Beamer starter, round-trips DOCX through Pandoc, builds a submission package and opens a generated PPTX in LibreOffice. Tests skip themselves when a tool is missing.
- Frontend unit tests (vitest): 62 (project index, story schema and renderer, Beamer parser, submission checks, story templates, notebooks, slide designs).
- Manual GUI walkthrough under Xvfb; screenshots in `docs/screenshots/`.

Run: `cd src-tauri && cargo test` and `npm test`.

## Release build

| Artifact | State |
| --- | --- |
| `.deb` (7.6 MB) | Built; installed with `dpkg -i`, launched, opened a project and compiled |
| AppImage (82.6 MB) | Built; launched with `APPIMAGE_EXTRACT_AND_RUN=1` (no FUSE in the build environment), opened a project and compiled. Normal FUSE launch is untested. Video blocks in the story preview need GStreamer plugins from the host system |
| `.rpm` (7.6 MB) | Built; not installed (no RPM-based system available) |
| Windows `.exe`/`.msi`, macOS `.dmg` | CI matrix in `.github/workflows/build.yml`; never run. Platform code paths (process groups, `taskkill`, MiKTeX paths, the `http://qmstory.localhost` preview origin used on Windows) are untested |
| Code signing, notarization | Not configured; needs certificates and an Apple developer account. Unsigned installers trigger SmartScreen/Gatekeeper warnings |
| Auto-update | Not implemented; needs a signing key and a release endpoint |

## Known limitations — read before relying on a feature

**Journal library**

- The registry was written on 2026-11-13. Publisher pages move; treat every link and requirement as a starting point and confirm on the journal's own site. Entries whose links could not be checked are labelled "unverified" (the generic Wiley, IOP, RSC, Frontiers and SAGE entries).
- Indexing status (SCI/SCIE, Scopus, UGC-CARE…) is **not** shipped for any journal except where the publisher's own page states it, and then it is labelled as publisher-stated with a date. Record your own verification in the library.
- Starter files for official classes are written by Quantum Maze, not by the publisher. They use the publisher's class but are not the publisher's sample document.
- No publisher template is bundled or downloaded automatically. "Needs download" entries require you to fetch the ZIP in your browser.
- The Defence Science Journal and Defence Life Science Journal profiles are drafts from the published author guidelines; those journals take Word submissions.

**Word conversion**

- Conversion is done by Pandoc and is never lossless. TikZ, algorithms, custom macros, merged cells, cross-reference styles and publisher-class layout do not survive LaTeX → Word; the report says which of these your document contains.
- Word → LaTeX keeps Pandoc's preamble, produces plain-text references (no `\cite`), and cannot convert EMF/WMF images. Greek letters and common symbols typed as plain characters are rewritten as LaTeX commands; other non-Latin text needs XeLaTeX/LuaLaTeX and a suitable font.
- Tracked changes are accepted as-is and Word comments are dropped.

**PowerPoint export**

- *Exact* slides are pictures: pixel-faithful but not editable.
- *Editable* slides contain titles, bullets, simple tables as text rows and PNG/JPEG/GIF images. Equations become plain text, TikZ and PDF figures are omitted, columns and overlays (`\pause`, `\only`) are flattened, and the Beamer theme is replaced by a plain layout with an accent colour.
- Only the `.pptx` format is written (not legacy `.ppt`); PowerPoint, Keynote, Google Slides and LibreOffice open it. Checked in LibreOffice only.

**Interactive stories**

- Stories are a separate project type, not LaTeX. Exported pages need a modern browser with JavaScript.
- The single-file export embeds all media as data URIs, so large videos make very large files; use the web-folder export for those.
- The chart block draws animated bar charts from typed numbers; there is no line chart, map or 3-D block.
- Flip-card animation falls back to a cross-fade where the webview lacks `backface-visibility` support (seen in the Linux test environment without GPU compositing).

**Presentations**

- The deck formats are structures with guidance text, written from common briefing practice (decision first, one message per slide). They are not an official format of any organisation; follow your own organisation's template and marking rules where they exist.
- moloch, SimplePlus, SimpleDarkBlue, Nord and Verona are third-party themes that ship with full TeX Live/MacTeX. If one is missing the deck falls back to Madrid. Themes that need extra fonts (focus, trigon, Arguelles) are left out.
- The slide designs are original TikZ drawings in `qmdesign.sty`. They are not copies of any commercial template; they follow the same general ideas (restrained palette, one accent colour, section dividers). Checked with pdfLaTeX only; XeLaTeX and LuaLaTeX should work but were not run with the designs.
- Infographics are drawn from the numbers and words you type. They do not read data files, and long labels are not shrunk to fit: shorten the text or reduce the number of items if a label overflows.
- In a list given to an infographic, an item that contains a comma must be wrapped in braces.
- With a design, the editable PowerPoint export carries slide titles, bullets and pictures but not the backgrounds or infographics. Use the exact (picture) export to keep the look.
- Changing a design in the Slides panel edits one line of `main.tex`; projects created before 0.6.0 have no such line and keep their Beamer theme controls.

**Notebooks**

- Notes are plain text in blocks; size and alignment apply to a whole block, there is no bold/italic inside a paragraph, no freehand drawing, no equations, and no export to PDF or Word yet.
- Text does not flow around a picture: a picture sits on its own lines, aligned left, centre or right.
- Blocks no longer have a blank line between them (as on paper); notebooks made in 0.5.0 open with their blocks closer together. Press Enter for an empty line.
- Images are stored inside the JSON file (downscaled to 1600 px), so notebooks with many pictures become large files.
- The "Handwritten" writing style uses a handwriting font already on the computer (present on macOS and Windows; many Linux systems fall back to a serif font).
- Notebooks are not encrypted. Do not keep classified or sensitive material in them unless the folder itself is protected.

**Story templates**

- The six layout templates follow formats common in immersive news features; they are original layouts with placeholder text, not copies of any publisher's pages or artwork.
- Topic templates are introductory explainers written for this release. Dates and figures were checked from general knowledge, not against live sources; verify before publishing.
- Bundled artwork is abstract, code-generated SVG. It is meant to be replaced with real photographs and diagrams.

**Submission checks**

- Checks read the LaTeX sources with pattern matching. They can miss content produced by custom macros and cannot judge anything that needs a human (ethics approval, originality, permissions) — those items are shown as "not checked", never as passed.
- Word counts are estimates. Page limits are checked against the compiled PDF's page count only.

**General**

- GUI tests are hand-driven scripts, not a WebDriver suite.
- No version-history browser (snapshots are written to `.qmaze/history/` but there is no restore UI), no Git integration, no file comparison.
- PDF text search highlights whole text spans; a phrase split across spans is found but not highlighted exactly.
- MakeIndex/MakeGlossaries run only when latexmk decides to; direct-pass mode does not run them.
- External changes are checked when the window regains focus, before a manual compile and before each save — not continuously.
- The DOI lookup depends on doi.org/Crossref, which rate-limits; one automatic retry is made.

## Environment notes

- Debian/Ubuntu split TeX Live into packages. Journal classes need `texlive-publishers`; LuaLaTeX with `fontspec` needs `texlive-luatex`; Biber needs `biber`. Quantum Maze reports what is missing and does not install packages.
- Word conversion needs Pandoc on the PATH.
