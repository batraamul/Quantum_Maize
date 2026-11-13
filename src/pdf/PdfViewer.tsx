import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FileWarning,
  Loader2,
  PanelLeft,
  Play,
  Printer,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { compile, syncInverse, toast, ui, useApp } from "../app/store";
import { sc } from "../components/Common";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type ZoomMode = "width" | "page" | number;
interface Size {
  w: number;
  h: number;
}

const PAGE_GAP = 14;
const PAD_TOP = 18;

export function PdfViewer() {
  const data = useApp((s) => s.pdfData);
  const version = useApp((s) => s.pdfVersion);
  const stale = useApp((s) => s.pdfStale);
  const fromPrev = useApp((s) => s.pdfFromPreviousSession);
  const project = useApp((s) => s.project);
  const tex = useApp((s) => s.tex);
  const compiling = useApp((s) => s.compiling);
  const syncTarget = useApp((s) => s.syncTarget);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [zoom, setZoom] = useState<ZoomMode>("width");
  const [box, setBox] = useState<Size>({ w: 600, h: 800 });
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [thumbs, setThumbs] = useState(false);
  const [visible, setVisible] = useState<Set<number>>(new Set([1, 2]));
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [matches, setMatches] = useState<number[]>([]); // page numbers, one per occurrence
  const [matchIdx, setMatchIdx] = useState(0);
  const [mark, setMark] = useState<{ page: number; x: number; y: number; w: number; h: number; nonce: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissPrev, setDismissPrev] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const restore = useRef<{ top: number; left: number } | null>(null);
  const textCache = useRef<Map<number, string>>(new Map());

  // ---- load document (keep old one on screen until the new one is ready) ----
  useEffect(() => {
    if (!data) {
      setDoc(null);
      setSizes([]);
      return;
    }
    let cancelled = false;
    const el = scroller.current;
    if (el && doc) restore.current = { top: el.scrollTop / Math.max(1, el.scrollHeight), left: el.scrollLeft };
    setLoading(true);
    const task = pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false, enableXfa: false });
    task.promise
      .then(async (d) => {
        const sz: Size[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          const vp = p.getViewport({ scale: 1 });
          sz.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return void d.destroy();
        textCache.current = new Map();
        setDoc((old) => {
          if (old) setTimeout(() => old.destroy(), 1500);
          return d;
        });
        setSizes(sz);
        ui.setPdfPages(sz.length);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false);
          toast("error", "Could not display the PDF", String(e?.message ?? e));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // ---- container size ----
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [!!doc]);

  const maxW = useMemo(() => Math.max(1, ...sizes.map((s) => s.w)), [sizes]);
  const maxH = useMemo(() => Math.max(1, ...sizes.map((s) => s.h)), [sizes]);
  const scale = useMemo(() => {
    if (typeof zoom === "number") return zoom;
    const fitW = (box.w - 36) / maxW;
    if (zoom === "width") return Math.max(0.2, fitW);
    return Math.max(0.2, Math.min(fitW, (box.h - PAD_TOP * 2) / maxH));
  }, [zoom, box, maxW, maxH]);

  const offsets = useMemo(() => {
    const o: number[] = [];
    let y = PAD_TOP;
    for (const s of sizes) {
      o.push(y);
      y += s.h * scale + PAGE_GAP;
    }
    return o;
  }, [sizes, scale]);

  // Restore scroll position after a rebuild.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && restore.current && sizes.length) {
      el.scrollTop = restore.current.top * el.scrollHeight;
      el.scrollLeft = restore.current.left;
      restore.current = null;
    }
  }, [sizes, scale]);

  // ---- visible pages & current page ----
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !sizes.length) return;
    const top = el.scrollTop;
    const bottom = top + el.clientHeight;
    const vis = new Set<number>();
    let cur = 1;
    for (let i = 0; i < sizes.length; i++) {
      const a = offsets[i];
      const b = a + sizes[i].h * scale;
      if (b >= top - el.clientHeight && a <= bottom + el.clientHeight) vis.add(i + 1);
      if (a <= top + el.clientHeight / 3) cur = i + 1;
    }
    setVisible((prev) => (prev.size === vis.size && [...vis].every((v) => prev.has(v)) ? prev : vis));
    setPage(cur);
  }, [sizes, offsets, scale]);
  useEffect(onScroll, [onScroll]);
  useEffect(() => setPageInput(String(page)), [page]);

  const goTo = (n: number, yWithin = 0) => {
    const el = scroller.current;
    if (!el || !sizes.length) return;
    const p = Math.min(Math.max(1, n), sizes.length);
    el.scrollTo({ top: offsets[p - 1] - PAD_TOP + yWithin, behavior: "smooth" });
  };

  // Ctrl + wheel zoom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(() => Math.min(5, Math.max(0.25, +(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3))));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [scale, !!doc]);

  // ---- SyncTeX forward highlight ----
  useEffect(() => {
    if (!syncTarget || !sizes.length) return;
    const l = syncTarget.locations[0];
    const h = Math.max(l.height, 10);
    setMark({ page: l.page, x: l.h, y: l.v - h, w: Math.max(l.width, 40), h: h + 4, nonce: syncTarget.nonce });
    const el = scroller.current;
    if (el) el.scrollTo({ top: offsets[l.page - 1] + (l.v - h) * scale - el.clientHeight / 3, behavior: "smooth" });
  }, [syncTarget?.nonce, sizes.length]);

  // ---- search ----
  const runSearch = async (q: string) => {
    if (!doc || !q.trim()) {
      setMatches([]);
      return;
    }
    const needle = q.toLowerCase();
    const found: number[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      let t = textCache.current.get(i);
      if (t === undefined) {
        const tc = await (await doc.getPage(i)).getTextContent();
        t = tc.items.map((it) => ("str" in it ? it.str : "")).join(" ").toLowerCase();
        textCache.current.set(i, t);
      }
      let from = 0;
      for (;;) {
        const k = t.indexOf(needle, from);
        if (k < 0) break;
        found.push(i);
        from = k + needle.length;
      }
    }
    setMatches(found);
    setMatchIdx(0);
    if (found.length) goTo(found[0]);
    else toast("info", `No matches for “${q}”`);
  };
  const stepMatch = (d: number) => {
    if (!matches.length) return;
    const n = (matchIdx + d + matches.length) % matches.length;
    setMatchIdx(n);
    goTo(matches[n]);
  };

  // ---- print / external ----
  const print = async () => {
    if (!doc) return;
    const root = document.getElementById("print-root")!;
    root.innerHTML = "";
    toast("info", "Preparing pages for printing…");
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const vp = p.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      const img = document.createElement("img");
      img.src = c.toDataURL("image/png");
      root.appendChild(img);
    }
    const cleanup = () => {
      root.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };
  const openExternal = async () => {
    if (!project) return;
    const stem = project.meta.mainFile.split("/").pop()!.replace(/\.tex$/, "");
    const sep = project.root.includes("\\") ? "\\" : "/";
    try {
      await openPath([project.root, ".qmaze", "build", `${stem}.pdf`].join(sep));
    } catch (e) {
      toast("error", "Could not open the system PDF viewer", String(e));
    }
  };

  const onDouble = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    void syncInverse(pageNum, (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  };

  // ---------------------------------------------------------------------------
  if (!project) return null;

  const zoomLabel = typeof zoom === "number" ? `${Math.round(zoom * 100)}%` : zoom;
  const empty = !data;

  return (
    <div className="pdf-panel">
      <div className="pdf-toolbar">
        <button className={"icon-btn" + (thumbs ? " active" : "")} title="Page thumbnails" onClick={() => setThumbs((v) => !v)} disabled={!doc}>
          <PanelLeft size={16} />
        </button>
        <button className="icon-btn" title="Previous page" onClick={() => goTo(page - 1)} disabled={!doc || page <= 1}>
          <ChevronLeft size={16} />
        </button>
        <input
          className="input page-input"
          value={pageInput}
          disabled={!doc}
          aria-label="Page number"
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goTo(parseInt(pageInput, 10) || 1)}
        />
        <span className="muted" style={{ fontSize: ".85rem", padding: "0 4px" }}>
          / {sizes.length || "–"}
        </span>
        <button className="icon-btn" title="Next page" onClick={() => goTo(page + 1)} disabled={!doc || page >= sizes.length}>
          <ChevronRight size={16} />
        </button>
        <span style={{ width: 8 }} />
        <button className="icon-btn" title="Zoom out" onClick={() => setZoom(Math.max(0.25, +(scale / 1.15).toFixed(3)))} disabled={!doc}>
          <ZoomOut size={16} />
        </button>
        <select
          className="select zoom-select"
          aria-label="Zoom"
          value={typeof zoom === "number" ? "custom" : zoom}
          disabled={!doc}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "width" || v === "page") setZoom(v);
            else if (v !== "custom") setZoom(parseFloat(v));
          }}
        >
          <option value="width">Fit width</option>
          <option value="page">Fit page</option>
          {typeof zoom === "number" && <option value="custom">{zoomLabel}</option>}
          {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((z) => (
            <option key={z} value={z}>
              {z * 100}%
            </option>
          ))}
        </select>
        <button className="icon-btn" title="Zoom in" onClick={() => setZoom(Math.min(5, +(scale * 1.15).toFixed(3)))} disabled={!doc}>
          <ZoomIn size={16} />
        </button>
        <div className="pdf-search">
          {searchOpen ? (
            <>
              <input
                className="input"
                autoFocus
                placeholder="Search PDF"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (matches.length && !e.shiftKey) stepMatch(1);
                    else if (matches.length && e.shiftKey) stepMatch(-1);
                    else void runSearch(query);
                  }
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setMatches([]);
                  }
                }}
                onBlur={() => !matches.length && void runSearch(query)}
              />
              <span className="muted" style={{ fontSize: ".8rem", minWidth: 44, textAlign: "center" }}>
                {matches.length ? `${matchIdx + 1}/${matches.length}` : ""}
              </span>
              <button className="icon-btn" title="Previous match" onClick={() => stepMatch(-1)} disabled={!matches.length}>
                <ChevronUp size={15} />
              </button>
              <button className="icon-btn" title="Next match" onClick={() => stepMatch(1)} disabled={!matches.length}>
                <ChevronDown size={15} />
              </button>
              <button
                className="icon-btn"
                title="Close search"
                onClick={() => {
                  setSearchOpen(false);
                  setMatches([]);
                  setQuery("");
                }}
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <button className="icon-btn" title="Search in PDF" onClick={() => setSearchOpen(true)} disabled={!doc}>
              <Search size={16} />
            </button>
          )}
          <button className="icon-btn" title="Print" onClick={print} disabled={!doc}>
            <Printer size={16} />
          </button>
          <button className="icon-btn" title="Open in system PDF viewer" onClick={openExternal} disabled={!doc}>
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {stale && (
        <div className="pdf-banner stale" role="status">
          <AlertTriangle size={15} />
          <span className="grow">Showing the last successful build — the latest compilation failed.</span>
          <button className="btn" style={{ height: 24 }} onClick={() => ui.showBottom("errors")}>
            View errors
          </button>
        </div>
      )}
      {!stale && fromPrev && !dismissPrev && data && (
        <div className="pdf-banner info">
          <span className="grow">Last successful build from a previous session.</span>
          <button className="btn" style={{ height: 24 }} onClick={() => compile()} disabled={compiling}>
            Recompile
          </button>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setDismissPrev(true)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {empty ? (
        <div className="pdf-empty">
          {tex && !tex.ready ? (
            <>
              <FileWarning size={42} strokeWidth={1.2} />
              <div className="big">No LaTeX distribution detected</div>
              <div className="hint" style={{ maxWidth: 320 }}>
                Quantum Maze compiles locally with TeX Live, MacTeX or MiKTeX. The setup wizard explains how to install one.
              </div>
              <button className="btn primary" onClick={() => ui.openDialog("setup")}>
                Open TeX Setup Wizard
              </button>
            </>
          ) : (
            <>
              {compiling ? <Loader2 size={38} className="spin" /> : <Play size={38} strokeWidth={1.2} />}
              <div className="big">{compiling ? "Compiling…" : "No PDF yet"}</div>
              {!compiling && (
                <>
                  <div className="hint">Compile the project to see the PDF here.</div>
                  <button className="btn primary" onClick={() => compile()}>
                    Compile now <span className="kbd" style={{ color: "#fff9" }}>{sc("Ctrl+Enter")}</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="pdf-body">
          {thumbs && doc && (
            <div className="pdf-thumbs">
              {sizes.map((_, i) => (
                <Thumb key={`${version}-${i}`} doc={doc} n={i + 1} current={page === i + 1} onClick={() => goTo(i + 1)} />
              ))}
            </div>
          )}
          <div className="pdf-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="PDF preview">
            {loading && !doc && (
              <div className="pdf-empty">
                <Loader2 className="spin" />
              </div>
            )}
            {doc && (
              <div className="pdf-pages" style={{ paddingTop: PAD_TOP }}>
                {sizes.map((s, i) => (
                  <div
                    key={i}
                    className="pdf-page"
                    style={{ width: Math.floor(s.w * scale), height: Math.floor(s.h * scale) }}
                    onDoubleClick={(e) => onDouble(i + 1, e)}
                    title={i === 0 ? "Double-click to jump to the source" : undefined}
                  >
                    {visible.has(i + 1) && <PageCanvas doc={doc} n={i + 1} scale={scale} query={searchOpen ? query : ""} />}
                    {mark && mark.page === i + 1 && (
                      <div key={mark.nonce} className="sync-mark" style={{ left: mark.x * scale - 3, top: mark.y * scale - 2, width: mark.w * scale + 6, height: mark.h * scale }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders one page into a fresh canvas and swaps it in when done (no flicker). */
const PageCanvas = memo(function PageCanvas({ doc, n, scale, query }: { doc: PDFDocumentProxy; n: number; scale: number; query: string }) {
  const host = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const [textReady, setTextReady] = useState(0);

  useEffect(() => {
    let task: RenderTask | null = null;
    let cancelled = false;
    let textLayer: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${Math.floor(vp.width)}px`;
      canvas.style.height = `${Math.floor(vp.height)}px`;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      task = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      try {
        await task.promise;
      } catch (e) {
        if ((e as Error)?.name !== "RenderingCancelledException") console.error(`PDF page ${n} render failed`, e);
        return;
      }
      if (cancelled || !host.current) return;
      host.current.replaceChildren(canvas);
      // Text layer (selection + search highlighting).
      const tl = textHost.current;
      if (tl) {
        tl.replaceChildren();
        tl.style.setProperty("--scale-factor", String(scale));
        const layer = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp });
        textLayer = layer;
        try {
          await layer.render();
          if (!cancelled) setTextReady((x) => x + 1);
        } catch (e) {
          if (!cancelled) console.warn(`PDF text layer ${n} failed`, e);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [doc, n, scale]);

  useEffect(() => {
    const tl = textHost.current;
    if (!tl) return;
    const q = query.trim().toLowerCase();
    tl.querySelectorAll("span").forEach((s) => {
      const hit = q.length > 0 && (s.textContent ?? "").toLowerCase().includes(q);
      s.classList.toggle("hl", hit);
    });
  }, [query, textReady]);

  return (
    <>
      <div ref={host} />
      <div ref={textHost} className="textLayer" />
    </>
  );
});

const Thumb = memo(function Thumb({ doc, n, current, onClick }: { doc: PDFDocumentProxy; n: number; current: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled || !ref.current) return;
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 192 / vp1.width });
      ref.current.width = vp.width;
      ref.current.height = vp.height;
      task = page.render({ canvasContext: ref.current.getContext("2d")!, viewport: vp });
      task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, n]);
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: "nearest" });
  }, [current]);
  return (
    <div className={"pdf-thumb" + (current ? " current" : "")} onClick={onClick}>
      <canvas ref={ref} />
      {n}
    </div>
  );
});
