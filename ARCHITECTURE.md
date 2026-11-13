# Quantum Maze architecture

Quantum Maze is a Tauri 2 desktop application: a React + TypeScript UI in the system webview, and a Rust backend that owns the filesystem, the SQLite database and every external process. The UI can only reach the system through the IPC commands in `src-tauri/src/commands/`.

## Module boundaries

```
src/                         React + TypeScript (webview)
  app/store.ts               Central state and every user action (zustand)
  app/commands.ts            Command registry shared by menus, toolbar, shortcuts
  services/api.ts            Typed wrappers around the Rust IPC commands
  editor/                    Monaco setup, LaTeX/BibTeX languages, completion,
                             project index (labels, bib keys, outline, folding)
  pdf/PdfViewer.tsx          PDF.js preview, search, thumbnails, SyncTeX
  compiler/BottomPanel.tsx   Errors / warnings / messages / output / diagnostics
  projects/                  Welcome, New Project, sidebar panels
  journal-library/           Journal library, template and project import dialogs
  authoring/                 Table designer, equation editor, figure dialog
  presentation/              Beamer frame parser, slide panel, presenter, PPTX dialog
  story/                     Story schema, HTML renderer, studio, export dialog
  conversion/                Conversion Centre (Word ⇄ LaTeX) and report view
  validation/                Submission checks (pure functions) and panel
  settings/                  Settings dialog, setup wizard, owner profile
  layouts/Workbench.tsx      Resizable panel layout; switches on project kind
  types/                     Types mirroring the backend's serialised structs

src-tauri/src/               Rust backend
  commands/                  IPC surface (the only entry point from the UI)
  security/                  Path containment, name validation
  filesystem/                Projects, file ops, snapshots, trash, recovery, ZIP export
  database/                  SQLite + ordered migrations
  settings.rs                Settings incl. owner profile and the online-services switch
  compiler/                  detect.rs, proc.rs, mod.rs, log_parser.rs, synctex.rs
  templates/
    mod.rs                   Starter documents; journal skeletons per document class
    registry.rs              Bundled journal registry → SQLite; indexing notes
    importer.rs              Safe ZIP extraction and template/project analysis
  converter/                 Pandoc DOCX ⇄ LaTeX with conversion reports
  presentation/              Minimal OOXML (.pptx) writer
  story/                     qmstory:// preview protocol, story export, asset import
  submission.rs              Submission ZIP with manifest
  online.rs                  DOI lookup (the only network code; gated by a setting)

src-tauri/assets/journals/registry.json   Journal metadata (no publisher files)
```

Rules that keep the modules independent:

- UI components do not call `invoke` directly; they call `store.ts` actions, which call `services/api.ts`.
- `editor/projectIndex.ts` has no Monaco or Tauri imports, so it is unit-tested in Node.
- The backend never trusts a path from the UI. Every file command takes a project root plus a relative path, checks the root is one the user opened this session, and resolves the path with traversal and symlink-escape protection (`security::resolve_in_root`).
- External programs (TeX tools, Pandoc, kpsewhich) are started only through `compiler::proc::hidden_command` with an absolute executable path and an argument array. No shell is involved anywhere.
- `validation/checks.ts`, `presentation/beamer.ts`, `story/schema.ts` and `story/render.ts` are pure TypeScript with no Monaco or Tauri imports, so they are unit-tested in Node.
- Journal-specific behaviour comes from registry data (`JournalEntry`), not from conditions in UI components. The one exception is the per-class starter text in `templates::journal_skeleton`, because author blocks differ between classes.

## Data model

### Project (on disk)

A project is an ordinary folder. Quantum Maze adds one hidden directory:

```
MyPaper/
  main.tex, sections/, figures/, references/ …   user files, untouched
  output/                                        build output (aux, log, pdf)
  .qmaze/
    project.json        metadata, formatVersion 1
    build/<main>.pdf    last successful PDF (+ .synctex.gz) used by the preview
    history/<file>/     timestamped snapshots taken before overwrites
    trash/<timestamp>/  deleted files (recoverable)
    recovery.json       unsaved buffers, written every few seconds while dirty
```

`project.json`: `formatVersion`, `id`, `name`, `kind` (latex | presentation | story; default latex), `journalId` (optional), `mainFile`, `engine` (pdflatex | xelatex | lualatex), `bibTool` (auto | bibtex | biber), `shellEscape` (default false), `createdAt`, `createdWith`. A story project keeps its content in `story.json` and media in `assets/`. Projects created by the earlier "PaperForge" builds (`.paperforge/`) are renamed to `.qmaze/` when opened. Unknown future fields are ignored; a project with a newer `formatVersion` is refused with a clear message.

### SQLite (application data directory)

| Table | Purpose |
| --- | --- |
| `schema_migrations` | Applied migration versions |
| `settings` | Key → JSON value (`app` holds the Settings struct) |
| `projects` | Registry of opened projects (recent list) |
| `compile_history` | Per-project build records, capped at 200 |

| `journals` | Journal registry: bundled entries (replaced on start-up from `registry.json`) and custom imported templates |
| `journal_indexing_notes` | Indexing status the user verified themselves, with source and date |

Migrations are an append-only list in `database/mod.rs` (currently version 2). Imported template files live in `<data dir>/templates/custom-<uuid>/`; archives being inspected live in `<data dir>/staging/`.

### Journal registry entry

`templateType` decides how a project is created:

| Type | Meaning | Project creation |
| --- | --- | --- |
| `ctan-class` | The publisher's class ships with TeX distributions | Skeleton `main.tex` generated by Quantum Maze; class found with `kpsewhich` |
| `publisher-download` | The publisher distributes a ZIP | User downloads it, then imports; nothing is bundled |
| `community-profile` | No LaTeX template exists | Draft layout from the author guidelines; never marked official |
| `custom` | Imported by the user | Copy of the imported files |

Every entry carries `official`, `lastVerified` and `verificationNote`. Unit tests enforce that community profiles are never official and that any indexing claim has a source and date.

## Data flows

**Compile.** `store.compile()` saves dirty buffers → `compile` command reads project metadata and settings → `CompileManager` mirrors source subfolders into `output/`, runs latexmk (`-norc`, engine flag, `-interaction=nonstopmode`, `-file-line-error`, `-synctex=1`, `-outdir=output`, `-latexoption=-no-shell-escape`), or falls back to direct engine → BibTeX/Biber → engine passes. Output lines stream to the UI as `compile-output` events. Afterwards the `.log` and `.blg` are parsed into diagnostics. On success the PDF and SyncTeX file are copied to `.qmaze/build/`; on failure that copy is left alone, so the preview keeps the last good PDF and the UI shows a "last successful build" banner.

**Preview.** The UI fetches the PDF bytes over binary IPC and renders with PDF.js. A new document is swapped in only once loaded, and the scroll position is restored.

**Diagnostics.** Each diagnostic carries severity, project-relative file, line, message, source context and a suggested fix. The UI lists them, sets Monaco markers, and navigates on click.

**SyncTeX.** Forward: editor position → `synctex view` → page rectangle highlighted in the preview. Inverse: double-click in the preview → `synctex edit` → file and line opened in the editor.

**Saving.** Writes are atomic (temp file + rename). Before an overwrite the previous content is snapshotted (at most one per 5 minutes, 30 per file). Delete moves to the project trash.

**Journal project.** Library → `create_journal_project` → `registry::get` → `templates::journal_skeleton` (or a copy of the imported template) → `filesystem::create_project_with`.

**Import.** `stage_import` extracts the archive into the staging directory with `importer::safe_extract` (rejects absolute paths and `..`, skips symlinks and special files, enforces entry-count, per-file, total-size and compression-ratio limits), then `importer::analyze` reports the main file, class, bibliography tool, engine and whether each class/style resolves with `kpsewhich`. Nothing is copied into a project or the template store until the user confirms; build scripts are listed in the report and never run.

**Word conversion.** `converter::docx_to_latex` runs Pandoc with media extraction, unwraps heading targets, maps plain-Unicode Greek letters and symbols to LaTeX commands, splits the body into `sections/NN-title.tex` and writes `CONVERSION_REPORT.md`. `latex_to_docx` runs Pandoc with citeproc and scans the sources for constructs known not to survive (TikZ, algorithms, custom macros, `\multirow`…). Both return a `ConversionReport`; neither modifies its input.

**Presentation → PowerPoint.** *Exact* mode renders each PDF page with PDF.js to a PNG and places it as a full-slide picture. *Editable* mode parses Beamer frames (`presentation/beamer.ts`) into titles, bullets and images. Both send a `DeckSpec` to `presentation::write_pptx`, which writes the OOXML package directly.

**Story preview and export.** `story/render.ts` turns `story.json` into a single HTML document with inline CSS and JavaScript and `{{qm-asset:path}}` tokens. For the live preview the HTML is registered with the backend and served on the `qmstory://` scheme inside an `<iframe sandbox="allow-scripts">` with its own strict CSP; asset requests are resolved inside the project root. For export the tokens become data URIs (single file) or relative paths (web folder).

**Submission.** `validation/checks.ts` evaluates the sources against the journal's `requirements` and returns items with status verified / warning / missing / not-checked (things only a human can confirm stay "not checked"). `submission::build` requires a successful build and writes the ZIP with a SHA-256 manifest.

**External changes.** The store remembers the text each open buffer was loaded from or saved as. On window focus, before a manual compile and before every save it compares that with the file on disk: unchanged buffers are reloaded (undoable), changed ones prompt the user.

## Security model

- Shell escape is off unless enabled per project after an explicit warning.
- `latexmk -norc`: a `latexmkrc` inside a project (Perl code) is never executed.
- `openout_any=p`: TeX may only write inside the working tree.
- Builds have a time limit and can be cancelled; the whole process group is killed.
- Content-Security-Policy restricts the webview to bundled assets; no remote code or fonts. The story preview runs in a sandboxed iframe on its own scheme with `default-src 'none'`, so story content cannot reach the application's IPC.
- The only network code is `online.rs` (DOI lookup). The command refuses to run unless `allowOnline` is set, which is off by default and asked for at first use. Links open in the system browser; the opener permission is limited to `http(s)` and `mailto` URLs and to document file types.
- Imported archives are untrusted: see **Import** above. Extracted files lose their executable bits because they are written fresh.
- Story text goes through an escaping mini-Markdown renderer; link URLs are restricted to `http(s)`, `mailto` and in-page anchors.

These are covered by `src-tauri/tests/compile_integration.rs` (`test13_shell_escape_and_latexmkrc_are_blocked`, `timeout_kills_runaway_build`, `cancel_stops_build`) and the unit tests in `security/`, `templates/importer.rs` (traversal, absolute paths, size and ratio limits) and `story/` (asset containment).

## Extending

- **New engine or build tool:** `compiler/mod.rs` (`engine_flag`, `engine_args`) and `detect::TOOLS`.
- **New diagnostics or hints:** `log_parser::suggestion_for` and the parser's message branches.
- **New completions or snippets:** `src/editor/latexData.ts` (data only).
- **New menu or shortcut:** add a command to `src/app/commands.ts`; menus and shortcuts pick it up.
- **New journal:** add an entry to `src-tauri/assets/journals/registry.json` with a `lastVerified` date and note. For a class with an unusual author block, add a branch to `templates::journal_skeleton`; the integration test compiles every `ctan-class` and `community-profile` entry.
- **New story block:** add it to `BLOCKS` in `src/story/schema.ts` (fields and defaults) and a renderer in `src/story/render.ts`. The property form is generated from the field list.
- **New submission check:** add a function to `src/validation/checks.ts` and, if it is journal-specific, a field to `Requirements`.
