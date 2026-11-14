// Notebook covers, drawn as SVG. Each theme has its own colours and emblem; the title,
// subject and owner are printed on a label. All artwork is original line art.

export interface CoverTheme { id: string; label: string; a: string; b: string; ink: string; emblem: string }

const S = (d: string, w = 5) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (x: number, y: number, r: number, fill = false, w = 5) => `<circle cx="${x}" cy="${y}" r="${r}" ${fill ? 'fill="currentColor"' : `fill="none" stroke="currentColor" stroke-width="${w}"`}/>`;
const R = (x: number, y: number, w: number, h: number, rx = 6, sw = 5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="currentColor" stroke-width="${sw}"/>`;

// Emblems are drawn in a 200×200 box centred on (100,100).
const E: Record<string, string> = {
  aviation: `<path d="M100 22 L112 88 L182 122 L182 136 L112 120 L108 160 L128 174 L128 184 L100 178 L72 184 L72 174 L92 160 L88 120 L18 136 L18 122 L88 88 Z" fill="currentColor"/>`,
  drones: [C(40, 40, 24), C(160, 40, 24), C(40, 160, 24), C(160, 160, 24), S("M56 56 L80 80 M144 56 L120 80 M56 144 L80 120 M144 144 L120 120", 8), `<rect x="76" y="76" width="48" height="48" rx="12" fill="currentColor"/>`].join(""),
  weapons: [C(100, 100, 70), C(100, 100, 38), C(100, 100, 7, true), S("M100 10 V52 M100 148 V190 M10 100 H52 M148 100 H190")].join(""),
  missiles: [`<path d="M100 14 C122 44 126 80 126 128 L74 128 C74 80 78 44 100 14 Z" fill="currentColor"/>`, S("M74 112 L46 150 L74 142 M126 112 L154 150 L126 142", 6), S("M88 140 L82 182 M100 140 V190 M112 140 L118 182", 6)].join(""),
  radar: [S("M22 132 A80 80 0 0 1 178 132"), S("M52 132 A50 50 0 0 1 148 132"), S("M100 132 L150 62", 7), C(100, 132, 9, true), C(64, 86, 6, true), S("M60 170 H140 M100 132 V170")].join(""),
  communication: [S("M100 92 V186 M70 186 H130 M100 120 L72 186 M100 120 L128 186", 6), C(100, 80, 11, true), S("M66 52 A46 46 0 0 0 66 108 M134 52 A46 46 0 0 1 134 108"), S("M44 30 A76 76 0 0 0 44 130 M156 30 A76 76 0 0 1 156 130")].join(""),
  security: [S("M100 16 L170 42 V98 C170 144 138 172 100 186 C62 172 30 144 30 98 V42 Z", 7), R(72, 96, 56, 44, 8, 6), S("M82 96 V80 A18 18 0 0 1 118 80 V96", 6), C(100, 118, 6, true)].join(""),
  hacking: [R(18, 36, 164, 128, 12, 6), S("M18 64 H182", 5), S("M46 92 L72 112 L46 132", 8), S("M88 134 H134", 8), C(36, 50, 4, true), C(52, 50, 4, true), C(68, 50, 4, true)].join(""),
  cryptography: [C(62, 100, 36, false, 9), C(62, 100, 9, true), S("M98 100 H184 M150 100 V128 M174 100 V122", 9)].join(""),
  forensics: [C(84, 84, 54, false, 8), S("M124 124 L180 180", 14), S("M60 84 A24 24 0 0 1 108 84 M66 100 A18 26 0 0 1 102 100 M84 70 V112", 4)].join(""),
  iot: [C(100, 100, 20, true), ...[[100, 26], [170, 66], [170, 138], [100, 176], [30, 138], [30, 66]].map(([x, y]) => C(x, y, 13) + S(`M100 100 L${x} ${y}`, 4))].join(""),
  networks: [...[[40, 50], [160, 44], [104, 104], [44, 160], [164, 156]].map(([x, y]) => C(x, y, 14, true)), S("M40 50 L104 104 L160 44 M104 104 L44 160 M104 104 L164 156 M40 50 L160 44 M44 160 L164 156", 4)].join(""),
  sdr: [S("M12 100 C28 30 44 30 60 100 S92 170 108 100 S140 30 156 100 S180 150 190 100", 7), S("M12 178 H190", 4), ...[30, 62, 94, 126, 158].map((x, i) => `<rect x="${x}" y="${178 - [26, 58, 40, 70, 30][i]}" width="16" height="${[26, 58, 40, 70, 30][i]}" fill="currentColor" opacity=".55"/>`)].join(""),
  electronics: [R(56, 56, 88, 88, 10, 7), R(80, 80, 40, 40, 4, 5), S("M76 56 V26 M100 56 V26 M124 56 V26 M76 144 V174 M100 144 V174 M124 144 V174 M56 76 H26 M56 100 H26 M56 124 H26 M144 76 H174 M144 100 H174 M144 124 H174", 6)].join(""),
  embedded: [R(22, 50, 156, 100, 10, 6), R(44, 72, 50, 56, 4, 5), C(128, 82, 9), C(156, 82, 9), S("M118 112 H166 M118 128 H150", 6), S("M40 50 V32 M64 50 V32 M88 50 V32 M112 50 V32 M136 50 V32 M160 50 V32", 5)].join(""),
  ai: [...[[36, 50], [36, 100], [36, 150]].map(([x, y]) => C(x, y, 12, true)), ...[[100, 34], [100, 78], [100, 122], [100, 166]].map(([x, y]) => C(x, y, 12)), ...[[164, 76], [164, 124]].map(([x, y]) => C(x, y, 12, true)), S([[36, 50], [36, 100], [36, 150]].flatMap(([x, y]) => [34, 78, 122, 166].map((t) => `M${x} ${y} L100 ${t}`)).join(" ") + [34, 78, 122, 166].flatMap((t) => [76, 124].map((u) => ` M100 ${t} L164 ${u}`)).join(""), 2)].join(""),
  vision: [S("M14 100 C50 44 150 44 186 100 C150 156 50 156 14 100 Z", 7), C(100, 100, 30, false, 7), C(100, 100, 11, true), S("M20 30 H44 M20 30 V54 M180 30 H156 M180 30 V54 M20 170 H44 M20 170 V146 M180 170 H156 M180 170 V146", 6)].join(""),
  quantum: [C(100, 100, 12, true), `<ellipse cx="100" cy="100" rx="84" ry="30" fill="none" stroke="currentColor" stroke-width="5"/>`, `<ellipse cx="100" cy="100" rx="84" ry="30" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(60 100 100)"/>`, `<ellipse cx="100" cy="100" rx="84" ry="30" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(120 100 100)"/>`].join(""),
  space: [C(100, 108, 40, false, 7), S("M36 130 C70 96 130 96 164 130", 4), R(84, 22, 32, 22, 4, 5), S("M84 33 H52 M116 33 H148 M52 22 V44 M148 22 V44 M100 44 V68", 5), C(40, 60, 3, true), C(166, 78, 3, true), C(150, 170, 3, true)].join(""),
  navigation: [C(100, 100, 78, false, 6), `<path d="M100 34 L118 100 L100 166 L82 100 Z" fill="currentColor"/>`, S("M22 100 H44 M156 100 H178 M100 22 V30 M100 170 V178", 6), C(100, 100, 6, false, 4)].join(""),
  naval: [C(100, 34, 14, false, 7), S("M100 48 V170 M66 78 H134", 8), S("M32 118 C32 168 80 176 100 170 C120 176 168 168 168 118 M32 118 L22 138 M32 118 L50 132 M168 118 L178 138 M168 118 L150 132", 7)].join(""),
  armour: [S("M40 28 H160 L174 70 L160 150 L100 184 L40 150 L26 70 Z", 7), S("M100 52 L112 88 H150 L120 110 L132 146 L100 124 L68 146 L80 110 L50 88 H88 Z", 5)].join(""),
  meteorology: [S("M52 120 A30 30 0 0 1 62 62 A40 40 0 0 1 138 58 A32 32 0 0 1 150 120 Z", 7), S("M66 142 L56 168 M100 142 L90 176 M134 142 L124 168", 7)].join(""),
  instruments: [S("M22 132 A78 78 0 0 1 178 132", 8), S("M100 132 L138 70", 8), C(100, 132, 10, true), S("M40 132 L52 126 M58 78 L68 88 M100 56 V70 M142 78 L132 88 M160 132 L148 126", 5), S("M30 164 H170", 6)].join(""),
  robotics: [C(100, 100, 30, false, 8), C(100, 100, 9, true), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return S(`M${(100 + 44 * Math.cos(a)).toFixed(0)} ${(100 + 44 * Math.sin(a)).toFixed(0)} L${(100 + 66 * Math.cos(a)).toFixed(0)} ${(100 + 66 * Math.sin(a)).toFixed(0)}`, 16); })].join(""),
  linux: [R(20, 30, 160, 110, 10, 6), S("M44 66 L64 84 L44 102 M76 104 H112", 7), S("M70 170 H130 M100 140 V170", 7)].join(""),
  mathematics: [S("M150 40 H56 L104 100 L56 160 H150", 10), S("M150 40 V58 M150 160 V142", 10)].join(""),
  research: [S("M78 22 V84 L34 164 A12 12 0 0 0 44 182 H156 A12 12 0 0 0 166 164 L122 84 V22", 7), S("M66 22 H134 M56 128 H144", 7), C(88, 152, 6, true), C(116, 144, 4, true)].join(""),
  management: [R(26, 40, 148, 130, 8, 6), S("M26 76 H174 M62 24 V52 M138 24 V52", 6), S("M52 108 L68 124 L96 96 M112 108 H152 M52 146 H152", 6)].join(""),
  general: [R(46, 24, 108, 152, 8, 7), S("M70 24 V176 M88 62 H134 M88 90 H134 M88 118 H118", 6)].join(""),
};

const T = (id: string, label: string, a: string, b: string, ink = "#ffffff"): CoverTheme => ({ id, label, a, b, ink, emblem: E[id] });

export const COVER_THEMES: CoverTheme[] = [
  T("aviation", "Aviation", "#0b3a6b", "#1d74c4"), T("drones", "Drones & UAVs", "#22313f", "#f39c12"), T("weapons", "Weapon systems", "#2f3a22", "#8a9a5b"),
  T("missiles", "Missiles & guidance", "#3a1414", "#b3261e"), T("radar", "Radar & EW", "#062a2a", "#12b886"), T("communication", "Communication", "#1a1f5c", "#5b6cff"),
  T("sdr", "Software-defined radio", "#10243d", "#00b8d9"), T("networks", "Sensor networks", "#123524", "#2f9e44"), T("iot", "Internet of Things", "#07323a", "#15aabf"),
  T("security", "Data security", "#1b1f2a", "#3b5bdb"), T("cryptography", "Cryptography", "#2a1a3e", "#9c6ade"), T("hacking", "Ethical hacking", "#050806", "#1f8f3a", "#7dff9b"),
  T("forensics", "Digital forensics", "#2b2118", "#a86f32"), T("electronics", "Electronics & VLSI", "#0f2a1c", "#c99a2e"), T("embedded", "Embedded systems", "#14321f", "#37b24d"),
  T("ai", "AI & machine learning", "#2a0f3a", "#d6336c"), T("vision", "Computer vision", "#102a43", "#f76707"), T("quantum", "Quantum computing", "#12103a", "#7048e8"),
  T("space", "Space systems", "#05070f", "#364fc7"), T("navigation", "Navigation & control", "#172b4d", "#e8a317"), T("naval", "Naval systems", "#062743", "#1c7ed6"),
  T("armour", "Land systems", "#33301f", "#7a6a35"), T("meteorology", "Meteorology", "#0c3552", "#4dabf7"), T("instruments", "Instrumentation", "#28231d", "#e67700"),
  T("robotics", "Robotics", "#1f2933", "#868e96"), T("linux", "Linux & systems", "#17191c", "#f2a900"), T("mathematics", "Mathematics", "#1c2541", "#5bc0be"),
  T("research", "Research log", "#3b0d2e", "#c2255c"), T("management", "Projects & admin", "#22303c", "#748ffc"), T("general", "Classic notebook", "#3a2415", "#8b5a2b"),
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].slice(0, max - 1) + "…"; }
  return out;
}

export function themeById(id: string): CoverTheme {
  return COVER_THEMES.find((t) => t.id === id) ?? COVER_THEMES[COVER_THEMES.length - 1];
}

/** SVG markup for a notebook cover (300×400). `color` overrides the theme's main colour. */
export function coverSvg(themeId: string, title: string, subject: string, owner = "", color = ""): string {
  const t = themeById(themeId);
  const a = /^#[0-9a-fA-F]{6}$/.test(color) ? color : t.a;
  const id = `${t.id}${a.slice(1)}`;
  const lines = wrap(title || "Untitled notebook", 17, 3);
  const pattern = Array.from({ length: 9 }, (_, i) => `<path d="M${-40 + i * 50} 400 L${160 + i * 50} 0" stroke="#fff" stroke-opacity=".05" stroke-width="18"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient>
<clipPath id="c${id}"><rect width="300" height="400" rx="14"/></clipPath></defs>
<g clip-path="url(#c${id})"><rect width="300" height="400" fill="url(#g${id})"/>${pattern}
<rect width="30" height="400" fill="#000" fill-opacity=".28"/><rect x="30" width="3" height="400" fill="#fff" fill-opacity=".18"/>
${[60, 130, 200, 270, 340].map((y) => `<rect x="9" y="${y}" width="12" height="5" rx="2.5" fill="#fff" fill-opacity=".35"/>`).join("")}
<g transform="translate(96 26) scale(.72)" color="${t.ink}" opacity=".92">${t.emblem}</g>
<rect x="50" y="196" width="232" height="${52 + lines.length * 26 + (subject ? 22 : 0)}" rx="8" fill="#fff" fill-opacity=".94"/>
<text x="64" y="218" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="${a}">${esc(t.label.toUpperCase())}</text>
${lines.map((l, i) => `<text x="64" y="${244 + i * 26}" font-family="Georgia, serif" font-size="19" font-weight="700" fill="#1a1a1a">${esc(l)}</text>`).join("")}
${subject ? `<text x="64" y="${246 + lines.length * 26}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#444">${esc(wrap(subject, 30, 1)[0])}</text>` : ""}
${owner ? `<text x="166" y="380" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${t.ink}" fill-opacity=".85">${esc(wrap(owner, 40, 1)[0])}</text>` : ""}
</g></svg>`;
}

export const coverUri = (themeId: string, title: string, subject: string, owner = "", color = "") => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coverSvg(themeId, title, subject, owner, color))}`;
