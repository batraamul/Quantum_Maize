// Renders a Story to one self-contained HTML document (inline CSS + JS, no
// network). Used for the live preview and for export; assets are referenced
// through `assetUrl`, which the caller maps to preview URLs or export tokens.

import { PRESETS, type Block, type Story } from "./schema";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function safeUrl(u: string): string {
  const t = u.trim();
  return /^(https?:|mailto:|#)/i.test(t) ? t : "#";
}

/** Minimal, safe inline markdown: paragraphs, **bold**, *italic*, [link](url). */
export function md(text: unknown): string {
  return String(text ?? "")
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => {
      let h = esc(p.trim());
      h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${esc(safeUrl(u.replace(/&amp;/g, "&")))}" target="_blank" rel="noopener">${t}</a>`);
      h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return `<p>${h.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

const isVideo = (p: string) => /\.(mp4|webm)(\?|$)/i.test(p);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : Number(v) || d);

type AssetUrl = (path: string) => string;

function media(src: string, url: AssetUrl, cls = "", alt = ""): string {
  if (!src) return `<div class="ph ${cls}">Add an image</div>`;
  const u = /^(https?:|data:)/.test(src) ? src : url(src);
  return isVideo(src)
    ? `<video class="${cls}" src="${esc(u)}" autoplay muted loop playsinline></video>`
    : `<img class="${cls}" src="${esc(u)}" alt="${esc(alt)}" loading="lazy">`;
}

function block(b: Block, url: AssetUrl): string {
  const id = esc(b.id);
  switch (b.type) {
    case "hero": {
      const img = str(b.image);
      const al = str(b.align) || "center";
      return `<header class="hero al-${esc(al)}" id="${id}" data-nav="${esc(b.title)}">
  <div class="hero-bg fx-${esc(str(b.effect) || "none")}">${img ? media(img, url, "", str(b.title)) : ""}</div>
  <div class="hero-shade" style="opacity:${Math.min(0.9, Math.max(0, num(b.overlay, 0.4)))}"></div>
  <div class="hero-text">${b.kicker ? `<div class="kicker">${esc(b.kicker)}</div>` : ""}<h1>${esc(b.title)}</h1>${b.subtitle ? `<p class="sub">${esc(b.subtitle)}</p>` : ""}</div>
  <div class="scroll-cue" aria-hidden="true"><span></span></div>
</header>`;
    }
    case "text":
      return `<section class="blk text${b.dropcap ? " dropcap" : ""}" id="${id}"${b.heading ? ` data-nav="${esc(b.heading)}"` : ""}><div class="col rv">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}${md(b.text)}</div></section>`;
    case "image":
      return `<figure class="blk img w-${esc(str(b.width) || "wide")} rv" id="${id}"><div class="frame fx-${esc(str(b.effect) || "none")}">${media(str(b.src), url, "", str(b.caption))}</div>${b.caption || b.credit ? `<figcaption>${esc(b.caption)}${b.credit ? ` <span class="credit">${esc(b.credit)}</span>` : ""}</figcaption>` : ""}</figure>`;
    case "scrolly": {
      const steps = arr<{ image?: string; text?: string }>(b.steps);
      return `<section class="blk scrolly side-${esc(str(b.side) || "right")}" id="${id}">
  <div class="sticky">${steps.map((s, i) => `<div class="layer${i === 0 ? " on" : ""}" data-i="${i}">${media(str(s.image), url)}</div>`).join("")}</div>
  <div class="steps">${steps.map((s, i) => `<div class="step" data-i="${i}"><div class="card">${md(s.text)}</div></div>`).join("")}</div>
</section>`;
    }
    case "stats":
      return `<section class="blk stats" id="${id}"><div class="stat-grid">${arr<Record<string, unknown>>(b.items)
        .map((s) => `<div class="stat rv"><div class="n"><span>${esc(s.prefix)}</span><b data-to="${num(s.value)}">0</b><span>${esc(s.suffix)}</span></div><div class="l">${esc(s.label)}</div></div>`)
        .join("")}</div></section>`;
    case "timeline":
      return `<section class="blk timeline" id="${id}"><ol>${arr<Record<string, unknown>>(b.items)
        .map((t, i) => `<li class="rv ${i % 2 ? "r" : "l"}"><div class="dot"></div><div class="tcard"><time>${esc(t.date)}</time><h3>${esc(t.title)}</h3>${md(t.text)}${t.image ? media(str(t.image), url) : ""}</div></li>`)
        .join("")}</ol></section>`;
    case "quote":
      return `<section class="blk quote" id="${id}"><blockquote class="rv"><p>${esc(b.text)}</p>${b.by ? `<cite>— ${esc(b.by)}</cite>` : ""}</blockquote></section>`;
    case "gallery": {
      const imgs = arr<{ src?: string; caption?: string }>(b.images);
      if (b.mode === "grid")
        return `<section class="blk gallery grid" id="${id}">${imgs.map((g) => `<figure class="rv">${media(str(g.src), url)}<figcaption>${esc(g.caption)}</figcaption></figure>`).join("")}</section>`;
      return `<section class="blk gallery carousel" id="${id}"><div class="track">${imgs
        .map((g) => `<figure>${media(str(g.src), url)}<figcaption>${esc(g.caption)}</figcaption></figure>`)
        .join("")}</div><button class="nav prev" aria-label="Previous">‹</button><button class="nav next" aria-label="Next">›</button><div class="pips">${imgs.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div></section>`;
    }
    case "cards":
      return `<section class="blk cards${b.flip ? " flip" : ""}" id="${id}">${arr<Record<string, unknown>>(b.items)
        .map((c) => {
          const front = `${c.image ? media(str(c.image), url, "cimg") : `<div class="icon">${esc(c.icon)}</div>`}<h3>${esc(c.title)}</h3>`;
          return b.flip
            ? `<div class="fcard rv" tabindex="0"><div class="inner"><div class="face front">${front}<span class="hint">Tap to flip</span></div><div class="face back">${md(c.text)}</div></div></div>`
            : `<div class="fcard plain rv"><div class="face">${front}${md(c.text)}</div></div>`;
        })
        .join("")}</section>`;
    case "compare":
      return `<figure class="blk compare rv" id="${id}"><div class="cmp" style="--p:50%">${media(str(b.after), url, "after")}<div class="beforewrap">${media(str(b.before), url, "before")}</div><div class="handle"><span>⟷</span></div><input type="range" min="0" max="100" value="50" aria-label="Comparison slider"><em class="lb a">${esc(b.beforeLabel)}</em><em class="lb b">${esc(b.afterLabel)}</em></div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    case "chart": {
      const labels = arr<string>(b.labels);
      const values = arr<number>(b.values).map((v) => num(v));
      const max = Math.max(1, ...values);
      return `<section class="blk chart" id="${id}"><div class="col"><h3>${esc(b.title)}</h3>${labels
        .map((l, i) => `<div class="bar"><span class="bl">${esc(l)}</span><div class="track"><div class="fill" style="--w:${((values[i] ?? 0) / max) * 100}%"></div></div><span class="bv">${esc((values[i] ?? 0).toLocaleString())}${esc(b.unit)}</span></div>`)
        .join("")}</div></section>`;
    }
    case "hotspots":
      return `<figure class="blk hotspots rv" id="${id}"><div class="hs">${media(str(b.image), url)}${arr<Record<string, unknown>>(b.points)
        .map((p, i) => `<button class="pin" style="left:${Math.min(100, Math.max(0, num(p.x)))}%;top:${Math.min(100, Math.max(0, num(p.y)))}%" aria-label="${esc(p.title)}"><span>${i + 1}</span></button><div class="pop" style="left:${Math.min(100, Math.max(0, num(p.x)))}%;top:${Math.min(100, Math.max(0, num(p.y)))}%"><b>${esc(p.title)}</b>${md(p.text)}</div>`)
        .join("")}</div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    case "quiz":
      return `<section class="blk quiz" id="${id}"><div class="col rv qbox" data-answer="${num(b.answer)}"><div class="qlabel">Quick check</div><h3>${esc(b.question)}</h3>${arr<string>(b.options)
        .map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`)
        .join("")}<div class="explain" hidden>${md(b.explanation)}</div></div></section>`;
    case "video": {
      const s = str(b.src);
      const u = /^(https?:|data:)/.test(s) ? s : url(s);
      return `<figure class="blk img w-wide rv" id="${id}">${s ? `<video src="${esc(u)}" ${b.autoplay ? "autoplay muted loop playsinline" : "controls"}></video>` : '<div class="ph">Add a video</div>'}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    }
    case "divider":
      return b.style === "wave"
        ? `<div class="divider wave" id="${id}"><svg viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 20 Q 150 0 300 20 T 600 20 T 900 20 T 1200 20" /></svg></div>`
        : `<div class="divider ${esc(b.style)}" id="${id}"><span></span><span></span><span></span></div>`;
    default:
      return "";
  }
}

const FONTS = {
  serif: { body: `Georgia, "Iowan Old Style", "Palatino Linotype", "Noto Serif", serif`, head: `Georgia, "Iowan Old Style", "Noto Serif", serif` },
  sans: { body: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`, head: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` },
  display: { body: `Georgia, "Noto Serif", serif`, head: `"Avenir Next", "Futura", "Trebuchet MS", system-ui, sans-serif` },
};

export function renderStory(story: Story, assetUrl: AssetUrl, opts: { preview?: boolean } = {}): string {
  const p = PRESETS[story.theme.preset] ?? PRESETS.saffron;
  const accent = /^#[0-9a-f]{3,8}$/i.test(story.theme.accent) ? story.theme.accent : p.accent;
  const f = FONTS[story.theme.font] ?? FONTS.serif;
  const anim = story.theme.animation;
  const css = `
:root{--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--accent:${accent};--accent2:${p.accent2};--hero:${p.heroText};--fb:${f.body};--fh:${f.head}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:19px/1.75 var(--fb);-webkit-font-smoothing:antialiased;overflow-x:hidden}
img,video{max-width:100%;display:block}a{color:var(--accent)}h1,h2,h3{font-family:var(--fh);line-height:1.15;letter-spacing:-.01em}
.progress{position:fixed;top:0;left:0;height:4px;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2));z-index:50}
.dots{position:fixed;right:18px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px;z-index:40}
.dots a{width:11px;height:11px;border-radius:50%;border:2px solid var(--accent);background:transparent;display:block;position:relative;transition:.3s}
.dots a.on{background:var(--accent);transform:scale(1.25)}.dots a:hover::after{content:attr(title);position:absolute;right:20px;top:50%;transform:translateY(-50%);white-space:nowrap;background:var(--surface);color:var(--text);padding:3px 9px;border-radius:6px;font:13px var(--fh);box-shadow:0 4px 14px #0003}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--hero)}
.hero-bg,.hero-bg img,.hero-bg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fx-kenburns img,.fx-kenburns video{animation:kb 22s ease-in-out infinite alternate}@keyframes kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.18) translate(-2%,-3%)}}
.hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,#000a 0%,#0006 40%,#000c 100%)}
.hero-text{position:relative;max-width:920px;padding:0 28px;text-align:center;animation:rise 1.4s cubic-bezier(.2,.7,.2,1) both}
.al-left .hero-text{text-align:left;margin-right:auto;margin-left:6vw}.al-bottom-left{align-items:flex-end}.al-bottom-left .hero-text{text-align:left;margin:0 auto 12vh 6vw}
.hero h1{font-size:clamp(42px,8vw,96px);margin:.15em 0;text-shadow:0 4px 30px #0008}
.kicker{display:inline-block;font:600 14px/1 var(--fh);letter-spacing:.22em;text-transform:uppercase;padding:8px 14px;border:1px solid #fff8;border-radius:40px;background:#fff1;backdrop-filter:blur(6px)}
.sub{font-size:clamp(18px,2.4vw,26px);opacity:.92;max-width:720px;margin:0 auto}.al-left .sub,.al-bottom-left .sub{margin:0}
.scroll-cue{position:absolute;bottom:28px;left:50%;width:26px;height:42px;border:2px solid #fffb;border-radius:20px;transform:translateX(-50%)}.scroll-cue span{position:absolute;left:50%;top:8px;width:4px;height:8px;border-radius:2px;background:#fff;transform:translateX(-50%);animation:cue 1.8s infinite}
@keyframes cue{0%{opacity:0;top:6px}40%{opacity:1}100%{opacity:0;top:22px}}@keyframes rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.byline{max-width:720px;margin:48px auto 0;padding:0 24px;color:var(--muted);font:15px var(--fh);display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid color-mix(in srgb,var(--muted) 30%,transparent);padding-bottom:18px}
.byline b{color:var(--text)}
.blk{margin:72px auto;padding:0 24px}.col{max-width:720px;margin:0 auto}
.text h2{font-size:clamp(28px,4vw,44px);margin:0 0 .5em;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.dropcap .col>p:first-of-type::first-letter{float:left;font:700 4.2em/0.82 var(--fh);margin:.06em .1em 0 0;color:var(--accent)}
figure{margin:0}figcaption{color:var(--muted);font:15px/1.5 var(--fh);margin-top:12px;text-align:center}.credit{opacity:.7;font-size:13px}
.img{max-width:720px}.img.w-wide{max-width:1100px}.img.w-full{max-width:none;padding:0}.img .frame{overflow:hidden;border-radius:14px;box-shadow:0 20px 50px #0002}.img.w-full .frame{border-radius:0}
.img .frame img,.img .frame video{width:100%}
.fx-zoom-in img{transform:scale(1.15);transition:transform 2.4s cubic-bezier(.2,.7,.2,1)}.in .fx-zoom-in img{transform:scale(1)}
.fx-float img{animation:float 6s ease-in-out infinite}@keyframes float{50%{transform:translateY(-12px)}}
.ph{display:flex;align-items:center;justify-content:center;min-height:240px;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--muted) 12%,transparent) 0 12px,transparent 12px 24px);color:var(--muted);border-radius:12px;font:15px var(--fh)}
.scrolly{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:1240px}.scrolly.side-left .sticky{order:-1}.scrolly.side-right .sticky{order:2}
.sticky{position:sticky;top:10vh;height:80vh;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px #0003;background:#000}
.layer{position:absolute;inset:0;opacity:0;transform:scale(1.06);transition:opacity .9s,transform 1.6s}.layer.on{opacity:1;transform:none}.layer img,.layer video,.layer .ph{width:100%;height:100%;object-fit:cover;border-radius:0}
.step{min-height:85vh;display:flex;align-items:center}.step .card{background:var(--surface);padding:26px 30px;border-radius:16px;box-shadow:0 12px 40px #0002;border-left:5px solid var(--accent);opacity:.45;transition:.5s}.step.on .card{opacity:1;transform:translateX(0)}
.stat-grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px}
.stat{background:var(--surface);border-radius:18px;padding:30px 24px;text-align:center;box-shadow:0 10px 30px #0001;border-top:4px solid var(--accent)}
.stat .n{font:700 clamp(40px,6vw,64px)/1 var(--fh);color:var(--accent)}.stat .l{color:var(--muted);margin-top:10px;font:16px/1.4 var(--fh)}
.timeline ol{list-style:none;max-width:980px;margin:0 auto;padding:0;position:relative}.timeline ol::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;background:linear-gradient(var(--accent),var(--accent2));transform:translateX(-50%)}
.timeline li{position:relative;width:50%;padding:0 40px 40px}.timeline li.l{left:0;text-align:right}.timeline li.r{left:50%}
.timeline .dot{position:absolute;top:8px;width:18px;height:18px;border-radius:50%;background:var(--surface);border:4px solid var(--accent)}.timeline li.l .dot{right:-9px}.timeline li.r .dot{left:-9px}
.tcard{background:var(--surface);padding:18px 22px;border-radius:14px;box-shadow:0 8px 28px #0001;text-align:left}.tcard time{font:700 13px var(--fh);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}.tcard h3{margin:.2em 0}.tcard p{margin:.3em 0;font-size:17px}.tcard img{border-radius:10px;margin-top:10px}
.quote blockquote{max-width:900px;margin:0 auto;text-align:center;position:relative;padding:20px}.quote p{font:italic 600 clamp(26px,4vw,40px)/1.3 var(--fh);margin:0}.quote blockquote::before{content:"\\201C";font:700 140px/1 var(--fh);color:var(--accent);opacity:.25;position:absolute;left:-10px;top:-40px}.quote cite{display:block;margin-top:16px;color:var(--muted);font:normal 16px var(--fh)}
.carousel{position:relative;max-width:1100px;overflow:hidden;border-radius:16px;padding:0}.track{display:flex;transition:transform .6s cubic-bezier(.2,.7,.2,1)}.track figure{flex:0 0 100%;position:relative}.track img,.track video,.track .ph{width:100%;height:62vh;object-fit:cover;border-radius:0}
.track figcaption{position:absolute;left:0;right:0;bottom:0;margin:0;padding:40px 20px 16px;color:#fff;background:linear-gradient(transparent,#000b)}
.carousel .nav{position:absolute;top:45%;width:46px;height:46px;border-radius:50%;border:0;background:#fffd;color:#111;font-size:28px;cursor:pointer;box-shadow:0 6px 20px #0004}.prev{left:14px}.next{right:14px}
.pips{position:absolute;bottom:12px;right:16px;display:flex;gap:6px}.pips i{width:8px;height:8px;border-radius:50%;background:#fff6}.pips i.on{background:#fff}
.gallery.grid{max-width:1100px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.gallery.grid img{border-radius:12px;width:100%;aspect-ratio:4/3;object-fit:cover}
.cards{max-width:1100px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}
.fcard{perspective:1000px;min-height:260px;cursor:pointer;outline:none}.fcard .inner{position:relative;height:100%;min-height:260px;transition:transform .8s cubic-bezier(.2,.7,.2,1);-webkit-transform-style:preserve-3d;transform-style:preserve-3d}
.cards.flip .fcard:hover .inner,.fcard.flipped .inner,.fcard:focus .inner{transform:rotateY(180deg)}
.face{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:18px;padding:26px;background:var(--surface);box-shadow:0 12px 34px #0002;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.face.back{transform:rotateY(180deg);background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}.fcard:not(.plain) .face{transition:opacity 0s .4s}.fcard:not(.plain) .face.back{opacity:0}.cards.flip .fcard:hover .face.front,.fcard.flipped .face.front,.fcard:focus .face.front{opacity:0}.cards.flip .fcard:hover .face.back,.fcard.flipped .face.back,.fcard:focus .face.back{opacity:1}.face.back p{font-size:17px}
.fcard.plain{cursor:default}.fcard.plain .face{position:relative}.icon{font-size:52px}.cimg{width:100%;height:120px;object-fit:cover;border-radius:12px}.hint{font:12px var(--fh);color:var(--muted);margin-top:8px}
.compare{max-width:1100px}.cmp{position:relative;overflow:hidden;border-radius:16px;box-shadow:0 18px 50px #0003;user-select:none}.cmp img,.cmp .ph{width:100%;display:block}
.beforewrap{position:absolute;inset:0;width:var(--p);overflow:hidden;border-right:3px solid #fff}.beforewrap img{width:auto;height:100%;max-width:none}
.handle{position:absolute;top:50%;left:var(--p);transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px #0006;pointer-events:none;font-weight:700}
.cmp input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0}.lb{position:absolute;top:14px;font:600 13px var(--fh);background:#000a;color:#fff;padding:5px 10px;border-radius:20px;font-style:normal}.lb.a{left:14px}.lb.b{right:14px}
.chart h3{margin:0 0 18px}.bar{display:grid;grid-template-columns:110px 1fr 90px;align-items:center;gap:12px;margin:10px 0;font:15px var(--fh)}.bar .track{height:22px;background:color-mix(in srgb,var(--muted) 15%,transparent);border-radius:11px;overflow:hidden;display:block}
.fill{height:100%;width:0;border-radius:11px;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width 1.6s cubic-bezier(.2,.7,.2,1)}.chart.in .fill{width:var(--w)}.bv{color:var(--muted)}
.hotspots{max-width:1100px}.hs{position:relative;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px #0003}.hs>img{width:100%}
.pin{position:absolute;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;border:3px solid #fff;background:var(--accent);color:#fff;font:700 14px var(--fh);cursor:pointer;box-shadow:0 0 0 0 var(--accent);animation:pulse 2.2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 16px transparent}100%{box-shadow:0 0 0 0 transparent}}
.pop{position:absolute;transform:translate(-50%,22px);width:min(300px,70vw);background:var(--surface);color:var(--text);padding:14px 16px;border-radius:12px;box-shadow:0 14px 40px #0005;font-size:15px;line-height:1.5;opacity:0;pointer-events:none;transition:.25s;z-index:3}.pop.on{opacity:1;pointer-events:auto}.pop p{margin:.3em 0 0}
.qbox{background:var(--surface);border-radius:18px;padding:28px;box-shadow:0 12px 34px #0002}.qlabel{font:700 12px var(--fh);letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}.qbox h3{margin:.3em 0 .8em}
.opt{display:block;width:100%;text-align:left;margin:8px 0;padding:14px 18px;border-radius:12px;border:2px solid color-mix(in srgb,var(--muted) 30%,transparent);background:transparent;color:var(--text);font:17px var(--fb);cursor:pointer;transition:.2s}.opt:hover{border-color:var(--accent)}
.opt.ok{border-color:#1f9d55;background:#1f9d5522}.opt.bad{border-color:#d64545;background:#d6454522}.explain{margin-top:14px;padding:14px 18px;border-radius:12px;background:color-mix(in srgb,var(--accent) 12%,transparent)}
.divider{max-width:720px;margin:60px auto;display:flex;justify-content:center;gap:12px}.divider.dots span{width:8px;height:8px;border-radius:50%;background:var(--accent)}.divider.line span{flex:1;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}.divider.line span+span{display:none}
.divider.wave svg{width:100%;height:40px}.divider.wave path{fill:none;stroke:var(--accent);stroke-width:3;stroke-dasharray:1400;stroke-dashoffset:1400;transition:stroke-dashoffset 2.5s}.divider.wave.in path{stroke-dashoffset:0}
.foot{text-align:center;color:var(--muted);font:14px var(--fh);padding:60px 20px 80px}
${anim === "none" ? "" : `.rv{opacity:0;transition:opacity 1s cubic-bezier(.2,.7,.2,1),transform 1s cubic-bezier(.2,.7,.2,1);${anim === "zoom" ? "transform:scale(.94)" : anim === "slide" ? "transform:translateX(-40px)" : "transform:translateY(40px)"}}.rv.in,.in .rv{opacity:1;transform:none}`}
@media (max-width:700px){.scrolly{grid-template-columns:1fr}.sticky{top:0;height:55vh;order:0!important;z-index:0}.steps{position:relative;z-index:1}.step{min-height:70vh}.step .card{opacity:1;box-shadow:0 10px 40px #0006}.timeline ol::before{left:12px}.timeline li,.timeline li.r{width:100%;left:0;text-align:left;padding:0 0 30px 40px}.timeline li .dot{left:3px!important;right:auto!important}.dots{display:none}.bar{grid-template-columns:80px 1fr 70px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
`;
  const js = `
(function(){
var $=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var bar=document.querySelector('.progress');
var dots=$('.dots a');var targets=dots.map(function(d){return document.getElementById(d.getAttribute('href').slice(1))});
var par=$('.fx-parallax img, .fx-parallax video');
function onScroll(){var h=document.documentElement;var y=h.scrollTop;var p=y/Math.max(1,h.scrollHeight-h.clientHeight);if(bar)bar.style.width=(p*100)+'%';
var cur=-1;targets.forEach(function(t,i){if(t&&t.getBoundingClientRect().top<innerHeight*0.45)cur=i});dots.forEach(function(d,i){d.classList.toggle('on',i===cur)});
par.forEach(function(el){var r=el.parentElement.getBoundingClientRect();el.style.transform='translateY('+(r.top*-0.25)+'px) scale(1.15)'});
${opts.preview ? "try{parent.postMessage({qmScroll:y},'*')}catch(e){}" : ""}}
addEventListener('scroll',onScroll,{passive:true});onScroll();
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');
$('b[data-to]',e.target).forEach(count);if(e.target.matches('b[data-to]'))count(e.target);}})},{threshold:0.18});
$('.rv,.chart,.divider,.stat').forEach(function(el){io.observe(el)});
function count(el){if(el.dataset.done)return;el.dataset.done=1;var to=parseFloat(el.dataset.to)||0;var dec=(String(to).split('.')[1]||'').length;var t0=performance.now();
(function step(t){var k=Math.min(1,(t-t0)/1600);var v=to*(1-Math.pow(1-k,3));el.textContent=v.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});if(k<1)requestAnimationFrame(step)})(t0)}
var scr=$('.scrolly').map(function(s){return{layers:$('.layer',s),steps:$('.step',s),cur:-1}});
function scrolly(){var mid=innerHeight/2;scr.forEach(function(o){var best=0,bd=1e9;o.steps.forEach(function(st,i){var r=st.querySelector('.card').getBoundingClientRect();var d=Math.abs((r.top+r.bottom)/2-mid);if(d<bd){bd=d;best=i}});if(best!==o.cur){o.cur=best;o.steps.forEach(function(x,i){x.classList.toggle('on',i===best)});o.layers.forEach(function(l,i){l.classList.toggle('on',i===best)})}})}
addEventListener('scroll',scrolly,{passive:true});addEventListener('resize',scrolly);scrolly();
$('.carousel').forEach(function(c){var tr=c.querySelector('.track');var n=tr.children.length;var i=0;var pips=$('.pips i',c);function go(k){i=(k+n)%n;tr.style.transform='translateX('+(-100*i)+'%)';pips.forEach(function(p,j){p.classList.toggle('on',j===i)})}
c.querySelector('.prev').onclick=function(){go(i-1)};c.querySelector('.next').onclick=function(){go(i+1)};var x0=null;tr.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});tr.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)go(i+(dx<0?1:-1));x0=null})});
$('.fcard:not(.plain)').forEach(function(c){c.addEventListener('click',function(){c.classList.toggle('flipped')})});
$('.cmp').forEach(function(c){var r=c.querySelector('input');var b=c.querySelector('.beforewrap img');function fit(){if(b)b.style.width=c.clientWidth+'px'}fit();addEventListener('resize',fit);r.addEventListener('input',function(){c.style.setProperty('--p',r.value+'%')})});
$('.hs').forEach(function(h){var pins=$('.pin',h),pops=$('.pop',h);pins.forEach(function(p,i){p.onclick=function(ev){ev.stopPropagation();var on=pops[i].classList.contains('on');pops.forEach(function(x){x.classList.remove('on')});if(!on)pops[i].classList.add('on')}});document.addEventListener('click',function(){pops.forEach(function(x){x.classList.remove('on')})})});
$('.qbox').forEach(function(q){var a=parseInt(q.dataset.answer,10);var done=false;$('.opt',q).forEach(function(o){o.onclick=function(){if(done)return;done=true;var i=parseInt(o.dataset.i,10);o.classList.add(i===a?'ok':'bad');var right=q.querySelector('.opt[data-i="'+a+'"]');if(right)right.classList.add('ok');var ex=q.querySelector('.explain');if(ex&&ex.textContent.trim())ex.hidden=false}})});
${opts.preview ? `addEventListener('message',function(e){var d=e.data||{};if(d.qmGoto){var el=document.getElementById(d.qmGoto);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}});
var m=/[?&]y=(\\d+)/.exec(location.search);if(m){document.documentElement.style.scrollBehavior='auto';scrollTo(0,parseInt(m[1],10));setTimeout(function(){document.documentElement.style.scrollBehavior=''},50)}` : ""}
})();`;
  const nav = story.blocks.filter((b) => b.type === "hero" || (b.type === "text" && b.heading));
  const firstHero = story.blocks[0]?.type === "hero";
  const byline = story.meta.author || story.meta.date
    ? `<div class="byline">${story.meta.author ? `<span>By <b>${esc(story.meta.author)}</b></span>` : ""}${story.meta.date ? `<span>${esc(story.meta.date)}</span>` : ""}</div>`
    : "";
  const body = story.blocks.map((b, i) => block(b, assetUrl) + (i === 0 && firstHero ? byline : "")).join("\n");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(story.meta.title)}</title><meta name="description" content="${esc(story.meta.description || story.meta.subtitle)}">
<meta name="generator" content="Quantum Maze"><style>${css}</style></head>
<body>${story.theme.progressBar ? '<div class="progress"></div>' : ""}${
    story.theme.navDots && nav.length > 1 ? `<nav class="dots">${nav.map((b) => `<a href="#${esc(b.id)}" title="${esc(b.type === "hero" ? b.title : b.heading)}"></a>`).join("")}</nav>` : ""
  }
${firstHero ? "" : byline}${body}
<footer class="foot">${esc(story.meta.title)}${story.meta.author ? ` · ${esc(story.meta.author)}` : ""}<br>Made with Quantum Maze</footer>
<script>${js}</script></body></html>`;
}
