"""Original vector artwork for the bundled story templates.

Everything here is drawn by code (no photographs, no third-party artwork), so the
templates can be copied, changed and published freely. Output is deterministic:
the same seed always gives the same picture.
"""
import math
import random
from xml.sax.saxutils import escape

FONT = "Helvetica, Arial, sans-serif"


def _svg(w, h, body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f"<defs>{defs}</defs>{body}</svg>")


def _bg(w, h, pal, rnd, uid):
    c1, c2, a, a2 = pal
    gx, gy = rnd.randint(15, 85), rnd.randint(15, 60)
    hx, hy = rnd.randint(15, 85), rnd.randint(40, 90)
    defs = (f'<linearGradient id="g{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'
            f'<radialGradient id="r{uid}" cx="{gx}%" cy="{gy}%" r="55%"><stop offset="0" stop-color="{a}" stop-opacity=".55"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="s{uid}" cx="{hx}%" cy="{hy}%" r="50%"><stop offset="0" stop-color="{a2}" stop-opacity=".45"/><stop offset="1" stop-color="{a2}" stop-opacity="0"/></radialGradient>')
    body = (f'<rect width="{w}" height="{h}" fill="url(#g{uid})"/><rect width="{w}" height="{h}" fill="url(#r{uid})"/>'
            f'<rect width="{w}" height="{h}" fill="url(#s{uid})"/>')
    return defs, body


# ---- motifs: each returns SVG markup drawn in the accent colours -----------------

def m_circuit(w, h, pal, rnd, n=34):
    a, a2 = pal[2], pal[3]
    out = []
    step = 50
    for i in range(n):
        x, y = rnd.randrange(0, w, step), rnd.randrange(0, h, step)
        pts = [(x, y)]
        for _ in range(rnd.randint(2, 4)):
            if rnd.random() < .5:
                x = max(0, min(w, x + rnd.choice([-1, 1]) * step * rnd.randint(1, 5)))
            else:
                y = max(0, min(h, y + rnd.choice([-1, 1]) * step * rnd.randint(1, 4)))
            pts.append((x, y))
        col = a if i % 3 else a2
        d = "M" + " L".join(f"{px} {py}" for px, py in pts)
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="3" stroke-opacity=".7" stroke-linejoin="round"/>')
        out.append(f'<circle cx="{pts[0][0]}" cy="{pts[0][1]}" r="7" fill="{col}"/>')
        out.append(f'<circle cx="{pts[-1][0]}" cy="{pts[-1][1]}" r="9" fill="none" stroke="{col}" stroke-width="3"/>')
    for _ in range(5):
        x, y = rnd.randrange(100, w - 250, step), rnd.randrange(100, h - 200, step)
        out.append(f'<rect x="{x}" y="{y}" width="150" height="100" rx="10" fill="{pal[0]}" fill-opacity=".85" stroke="{a}" stroke-width="3"/>')
        for k in range(5):
            out.append(f'<rect x="{x + 15 + k * 26}" y="{y - 12}" width="10" height="12" fill="{a}"/><rect x="{x + 15 + k * 26}" y="{y + 100}" width="10" height="12" fill="{a}"/>')
    return "".join(out)


def m_waves(w, h, pal, rnd, n=9):
    out = []
    for i in range(n):
        amp = rnd.uniform(20, 110)
        freq = rnd.uniform(1.5, 7)
        ph = rnd.uniform(0, 6.28)
        y0 = h * (0.15 + 0.7 * i / max(1, n - 1))
        pts = " ".join(f"{x},{y0 + amp * math.sin(freq * x / w * 6.283 + ph) * math.exp(-((x / w - .5) * 1.6) ** 2):.1f}" for x in range(0, w + 1, 16))
        col = pal[2] if i % 2 else pal[3]
        out.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="{rnd.choice([2, 3, 5])}" stroke-opacity="{rnd.uniform(.35, .9):.2f}"/>')
    return "".join(out)


def m_network(w, h, pal, rnd, n=46):
    nodes = [(rnd.uniform(40, w - 40), rnd.uniform(40, h - 40)) for _ in range(n)]
    out = []
    lim = (w * 0.17) ** 2
    for i, (x1, y1) in enumerate(nodes):
        for x2, y2 in nodes[i + 1:]:
            if (x1 - x2) ** 2 + (y1 - y2) ** 2 < lim:
                out.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{pal[2]}" stroke-width="2" stroke-opacity=".45"/>')
    for i, (x, y) in enumerate(nodes):
        r = rnd.choice([6, 8, 8, 12, 18])
        col = pal[3] if i % 5 == 0 else pal[2]
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * 2}" fill="{col}" fill-opacity=".15"/><circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{col}"/>')
    return "".join(out)


def m_orbits(w, h, pal, rnd, n=7):
    cx, cy = w * rnd.uniform(.4, .6), h * rnd.uniform(.42, .58)
    out = [f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{h * .07:.0f}" fill="{pal[3]}"/><circle cx="{cx:.0f}" cy="{cy:.0f}" r="{h * .13:.0f}" fill="{pal[3]}" fill-opacity=".2"/>']
    for i in range(n):
        rx, ry = h * (.2 + i * .1), h * (.08 + i * .045)
        rot = rnd.uniform(-35, 35)
        out.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" transform="rotate({rot:.0f} {cx:.0f} {cy:.0f})" fill="none" stroke="{pal[2]}" stroke-width="2.5" stroke-opacity=".6"/>')
        t = rnd.uniform(0, 6.28)
        px, py = rx * math.cos(t), ry * math.sin(t)
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        out.append(f'<circle cx="{cx + px * c - py * s:.0f}" cy="{cy + px * s + py * c:.0f}" r="{rnd.choice([8, 11, 14])}" fill="{pal[2]}"/>')
    return "".join(out)


def m_radar(w, h, pal, rnd, n=7):
    cx, cy = w * rnd.uniform(.35, .65), h * rnd.uniform(.45, .6)
    out = []
    for i in range(1, n + 1):
        out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{i * h * .1:.0f}" fill="none" stroke="{pal[2]}" stroke-width="2" stroke-opacity="{.75 - i * .07:.2f}"/>')
    for k in range(12):
        ang = k * math.pi / 6
        out.append(f'<line x1="{cx:.0f}" y1="{cy:.0f}" x2="{cx + math.cos(ang) * h:.0f}" y2="{cy + math.sin(ang) * h:.0f}" stroke="{pal[2]}" stroke-opacity=".18" stroke-width="2"/>')
    a0 = rnd.uniform(0, 6.28)
    r = h * .7
    out.append(f'<path d="M{cx:.0f} {cy:.0f} L{cx + r * math.cos(a0):.0f} {cy + r * math.sin(a0):.0f} A{r:.0f} {r:.0f} 0 0 1 {cx + r * math.cos(a0 + .7):.0f} {cy + r * math.sin(a0 + .7):.0f} Z" fill="{pal[3]}" fill-opacity=".28"/>')
    for _ in range(9):
        t, d = rnd.uniform(0, 6.28), rnd.uniform(.1, .65) * h
        out.append(f'<circle cx="{cx + d * math.cos(t):.0f}" cy="{cy + d * math.sin(t):.0f}" r="9" fill="{pal[3]}"/>')
    return "".join(out)


def m_grid(w, h, pal, rnd, n=0):
    out = []
    hy = h * .46
    for i in range(-14, 15):
        out.append(f'<line x1="{w / 2 + i * 26:.0f}" y1="{hy:.0f}" x2="{w / 2 + i * 330:.0f}" y2="{h}" stroke="{pal[2]}" stroke-width="2" stroke-opacity=".55"/>')
    y, dy = hy, 9.0
    while y < h:
        out.append(f'<line x1="0" y1="{y:.0f}" x2="{w}" y2="{y:.0f}" stroke="{pal[2]}" stroke-width="2" stroke-opacity="{min(.8, .2 + (y - hy) / h):.2f}"/>')
        y += dy
        dy *= 1.32
    out.append(f'<circle cx="{w * rnd.uniform(.3, .7):.0f}" cy="{hy - h * .08:.0f}" r="{h * .17:.0f}" fill="{pal[3]}" fill-opacity=".85"/>')
    for _ in range(40):
        out.append(f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, hy * .9):.0f}" r="{rnd.choice([1.5, 2, 3])}" fill="#fff" fill-opacity=".7"/>')
    return "".join(out)


def m_hex(w, h, pal, rnd, n=0):
    out = []
    r = 62
    dx, dy = r * 1.5, r * math.sqrt(3)
    col = 0
    x = 0.0
    while x < w + r:
        y = (dy / 2 if col % 2 else 0)
        while y < h + r:
            if rnd.random() < .62:
                pts = " ".join(f"{x + r * .92 * math.cos(k * math.pi / 3):.0f},{y + r * .92 * math.sin(k * math.pi / 3):.0f}" for k in range(6))
                if rnd.random() < .22:
                    out.append(f'<polygon points="{pts}" fill="{rnd.choice([pal[2], pal[3]])}" fill-opacity="{rnd.uniform(.25, .8):.2f}"/>')
                else:
                    out.append(f'<polygon points="{pts}" fill="none" stroke="{pal[2]}" stroke-width="2.5" stroke-opacity=".5"/>')
            y += dy
        x += dx
        col += 1
    return "".join(out)


def m_flight(w, h, pal, rnd, n=6):
    out = [f'<path d="M0 {h * .78:.0f} Q{w * .25:.0f} {h * .66:.0f} {w * .5:.0f} {h * .76:.0f} T{w} {h * .7:.0f} V{h} H0Z" fill="{pal[0]}" fill-opacity=".55"/>',
           f'<path d="M0 {h * .88:.0f} Q{w * .3:.0f} {h * .78:.0f} {w * .6:.0f} {h * .87:.0f} T{w} {h * .84:.0f} V{h} H0Z" fill="{pal[0]}" fill-opacity=".8"/>']
    for i in range(n):
        y0, y1 = rnd.uniform(.15, .7) * h, rnd.uniform(.05, .5) * h
        x1 = rnd.uniform(.55, .95) * w
        col = pal[2] if i % 2 else pal[3]
        out.append(f'<path d="M-20 {y0:.0f} Q{x1 * .5:.0f} {y0 - 40:.0f} {x1:.0f} {y1:.0f}" fill="none" stroke="{col}" stroke-width="{rnd.choice([3, 5, 8])}" stroke-opacity=".6" stroke-linecap="round" stroke-dasharray="{rnd.choice(['', '26 16', '4 14'])}"/>')
        ang = math.degrees(math.atan2(y1 - (y0 - 40), x1 * .5))
        out.append(f'<g transform="translate({x1:.0f} {y1:.0f}) rotate({ang:.0f}) scale({rnd.uniform(1.1, 2.2):.1f})"><path d="M22 0 L-10 -5 L-18 -16 L-22 -16 L-17 -4 L-24 -3 L-28 -9 L-31 -9 L-29 0 L-31 9 L-28 9 L-24 3 L-17 4 L-22 16 L-18 16 L-10 5 Z" fill="#fff" fill-opacity=".92"/></g>')
    return "".join(out)


def m_matrix(w, h, pal, rnd, n=34):
    out = []
    for i in range(n):
        x = 20 + i * (w - 40) / n
        y = rnd.uniform(-200, h * .5)
        for k in range(rnd.randint(6, 18)):
            op = max(.08, 1 - k * .07)
            ch = rnd.choice("01")
            col = "#fff" if k == 0 else (pal[2] if i % 4 else pal[3])
            out.append(f'<text x="{x:.0f}" y="{y + k * 34:.0f}" font-family="monospace" font-size="28" font-weight="700" fill="{col}" fill-opacity="{op:.2f}">{ch}</text>')
    return "".join(out)


def m_bloch(w, h, pal, rnd, n=5):
    out = []
    for i in range(n):
        cx = w * (i + .5) / n + rnd.uniform(-30, 30)
        cy = h * rnd.uniform(.3, .7)
        r = h * rnd.uniform(.1, .17)
        t = rnd.uniform(-2.6, -.5)
        out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="{pal[2]}" fill-opacity=".12" stroke="{pal[2]}" stroke-width="3"/>'
                   f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{r:.0f}" ry="{r * .3:.0f}" fill="none" stroke="{pal[2]}" stroke-width="2" stroke-opacity=".6" stroke-dasharray="8 8"/>'
                   f'<line x1="{cx:.0f}" y1="{cy - r:.0f}" x2="{cx:.0f}" y2="{cy + r:.0f}" stroke="{pal[2]}" stroke-opacity=".4" stroke-width="2"/>'
                   f'<line x1="{cx:.0f}" y1="{cy:.0f}" x2="{cx + r * .92 * math.cos(t):.0f}" y2="{cy + r * .92 * math.sin(t):.0f}" stroke="{pal[3]}" stroke-width="6" stroke-linecap="round"/>'
                   f'<circle cx="{cx + r * .92 * math.cos(t):.0f}" cy="{cy + r * .92 * math.sin(t):.0f}" r="12" fill="{pal[3]}"/>')
        if i:
            out.append(f'<path d="M{w * (i - .5) / n:.0f} {h * .5:.0f} Q{w * i / n:.0f} {h * rnd.uniform(.1, .9):.0f} {cx:.0f} {cy:.0f}" fill="none" stroke="{pal[3]}" stroke-opacity=".35" stroke-width="2.5" stroke-dasharray="3 10"/>')
    return "".join(out)


MOTIFS = {"circuit": m_circuit, "waves": m_waves, "network": m_network, "orbits": m_orbits, "radar": m_radar,
          "grid": m_grid, "hex": m_hex, "flight": m_flight, "matrix": m_matrix, "bloch": m_bloch}


def hero(pal, motif, seed, w=1600, h=900):
    rnd = random.Random(seed)
    defs, body = _bg(w, h, pal, rnd, "h")
    defs += '<radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>'
    return _svg(w, h, body + MOTIFS[motif](w, h, pal, rnd) + f'<rect width="{w}" height="{h}" fill="url(#v)"/>', defs)


def panel(pal, motif, seed, number, label, w=1200, h=900):
    """Scrollytelling step image: motif plus a large step number and a label."""
    rnd = random.Random(seed)
    defs, body = _bg(w, h, pal, rnd, "p")
    art = f'<g opacity=".55">{MOTIFS[motif](w, h, pal, rnd)}</g>'
    txt = (f'<text x="{w / 2}" y="{h * .56:.0f}" text-anchor="middle" font-family="{FONT}" font-size="420" font-weight="800" fill="#fff" fill-opacity=".16">{number}</text>'
           f'<rect x="{w / 2 - 330}" y="{h * .62:.0f}" width="660" height="92" rx="46" fill="{pal[0]}" fill-opacity=".82" stroke="{pal[2]}" stroke-width="3"/>'
           f'<text x="{w / 2}" y="{h * .62 + 60:.0f}" text-anchor="middle" font-family="{FONT}" font-size="40" font-weight="700" fill="#fff">{escape(label)}</text>')
    return _svg(w, h, body + art + txt, defs)


def diagram(pal, parts, seed, title="", w=1600, h=900):
    """Block diagram with up to five labelled stages. Returns (svg, hotspot positions in %)."""
    rnd = random.Random(seed)
    defs, body = _bg(w, h, pal, rnd, "d")
    defs += f'<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{pal[3]}"/></marker>'
    n = len(parts)
    bw, bh = 236, 150
    xs = [w * (i + .5) / n for i in range(n)]
    ys = [h * (.40 if i % 2 == 0 else .66) for i in range(n)]
    out = [f'<g opacity=".18">{m_circuit(w, h, pal, rnd, 16)}</g>']
    if title:
        out.append(f'<text x="{w / 2}" y="120" text-anchor="middle" font-family="{FONT}" font-size="50" font-weight="800" fill="#fff">{escape(title)}</text>')
    for i in range(n - 1):
        x1, y1, x2, y2 = xs[i] + bw / 2, ys[i], xs[i + 1] - bw / 2, ys[i + 1]
        out.append(f'<path d="M{x1:.0f} {y1:.0f} C{(x1 + x2) / 2:.0f} {y1:.0f} {(x1 + x2) / 2:.0f} {y2:.0f} {x2 - 6:.0f} {y2:.0f}" fill="none" stroke="{pal[3]}" stroke-width="5" marker-end="url(#ar)"/>')
    pts = []
    for i, name in enumerate(parts):
        x, y = xs[i] - bw / 2, ys[i] - bh / 2
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{bw}" height="{bh}" rx="22" fill="{pal[0]}" fill-opacity=".9" stroke="{pal[2]}" stroke-width="4"/>')
        out.append(f'<text x="{x + 24:.0f}" y="{y + 44:.0f}" font-family="{FONT}" font-size="26" font-weight="800" fill="{pal[2]}">{i + 1:02d}</text>')
        words, lines, cur = name.split(), [], ""
        for wd in words:
            if len(cur) + len(wd) + 1 > 13 and cur:
                lines.append(cur)
                cur = wd
            else:
                cur = (cur + " " + wd).strip()
        lines.append(cur)
        for k, ln in enumerate(lines[:2]):
            out.append(f'<text x="{xs[i]:.0f}" y="{ys[i] + 16 + (k - (len(lines[:2]) - 1) / 2) * 31:.0f}" text-anchor="middle" font-family="{FONT}" font-size="25" font-weight="700" fill="#fff">{escape(ln)}</text>')
        pts.append((round((xs[i] + bw / 2 - 18) / w * 100, 1), round((ys[i] - bh / 2 + 8) / h * 100, 1)))
    return _svg(w, h, body + "".join(out), defs), pts


def _cmp_blur(pal, rnd, sharp, w, h):
    defs = '<filter id="bl"><feGaussianBlur stdDeviation="14"/></filter>' if not sharp else ""
    shapes = []
    r2 = random.Random(rnd.random())
    for i in range(7):
        x, bw_, bh_ = 90 + i * 215, 150, r2.randint(180, 520)
        shapes.append(f'<rect x="{x}" y="{h - 150 - bh_}" width="{bw_}" height="{bh_}" fill="{pal[2] if i % 2 else pal[3]}" fill-opacity=".85"/>')
        for k in range(bh_ // 60):
            for j in range(3):
                shapes.append(f'<rect x="{x + 18 + j * 44}" y="{h - 170 - bh_ + 30 + k * 60}" width="26" height="30" fill="{pal[0]}"/>')
    shapes.append(f'<rect x="0" y="{h - 150}" width="{w}" height="150" fill="{pal[0]}"/>')
    for i in range(12):
        shapes.append(f'<rect x="{i * 140 + 20}" y="{h - 82}" width="80" height="10" fill="#fff" fill-opacity=".8"/>')
    scene = "".join(shapes)
    if not sharp:
        noise = "".join(f'<rect x="{r2.randrange(0, w, 40)}" y="{r2.randrange(0, h, 40)}" width="40" height="40" fill="#fff" fill-opacity="{r2.uniform(.03, .12):.2f}"/>' for _ in range(160))
        scene = f'<g filter="url(#bl)">{scene}</g>{noise}'
    return defs, scene


def _cmp_density(pal, rnd, sharp, w, h):
    r2 = random.Random(7)
    return "", m_network(w, h, pal, r2, 60 if sharp else 12)


def _cmp_cipher(pal, rnd, sharp, w, h):
    r2 = random.Random(11)
    words = "the quick brown fox jumps over the lazy dog while signals cross the open channel in clear text for anyone to read".split()
    out = []
    for row in range(11):
        x = 110
        y = 150 + row * 62
        while x < w - 200:
            wd = r2.choice(words)
            if sharp:
                wd = "".join(r2.choice("0123456789ABCDEF") for _ in wd)
            out.append(f'<text x="{x}" y="{y}" font-family="monospace" font-size="38" font-weight="700" fill="{pal[2] if sharp else "#ffffff"}" fill-opacity=".9">{wd}</text>')
            x += len(wd) * 23 + 30
    lock = (f'<g transform="translate({w - 250} {h - 280})"><rect x="0" y="80" width="160" height="130" rx="18" fill="{pal[3]}"/>'
            + (f'<path d="M30 80 V50 a50 50 0 0 1 100 0 V80" fill="none" stroke="{pal[3]}" stroke-width="22"/>' if sharp else f'<path d="M30 80 V50 a50 50 0 0 1 100 0" fill="none" stroke="{pal[3]}" stroke-width="22" transform="rotate(-28 30 80)"/>')
            + f'<circle cx="80" cy="140" r="16" fill="{pal[0]}"/></g>')
    return "", "".join(out) + lock


def _cmp_spectrum(pal, rnd, sharp, w, h):
    r2 = random.Random(5)
    out = [f'<line x1="80" y1="{h - 120}" x2="{w - 80}" y2="{h - 120}" stroke="#fff" stroke-width="4"/>']
    n = 36
    used = [r2.random() < .45 for _ in range(n)]
    for i in range(n):
        x = 100 + i * (w - 200) / n
        bw_ = (w - 200) / n - 8
        if used[i]:
            bh_ = r2.randint(240, 600)
            out.append(f'<rect x="{x:.0f}" y="{h - 120 - bh_}" width="{bw_:.0f}" height="{bh_}" rx="6" fill="{pal[2]}" fill-opacity=".9"/>')
        elif sharp:
            bh_ = r2.randint(200, 480)
            out.append(f'<rect x="{x:.0f}" y="{h - 120 - bh_}" width="{bw_:.0f}" height="{bh_}" rx="6" fill="{pal[3]}" fill-opacity=".95"/>')
        else:
            out.append(f'<rect x="{x:.0f}" y="{h - 150}" width="{bw_:.0f}" height="30" rx="6" fill="#fff" fill-opacity=".25"/>')
    return "", "".join(out)


CMP = {"blur": _cmp_blur, "density": _cmp_density, "cipher": _cmp_cipher, "spectrum": _cmp_spectrum}


def compare(pal, kind, seed, after, w=1600, h=900):
    rnd = random.Random(seed)
    defs, body = _bg(w, h, pal, rnd, "c")
    d2, scene = CMP[kind](pal, rnd, after, w, h)
    return _svg(w, h, body + scene, defs + d2)


def place_map(pal, names, seed, w=1600, h=900):
    """Stylised (fictional) map with numbered stops for travel/place templates."""
    rnd = random.Random(seed)
    defs, body = _bg(w, h, pal, rnd, "m")
    out = [f'<path d="M-20 {h * .7:.0f} C{w * .2:.0f} {h * .5:.0f} {w * .35:.0f} {h * .95:.0f} {w * .55:.0f} {h * .68:.0f} S{w * .9:.0f} {h * .4:.0f} {w + 20} {h * .55:.0f}" fill="none" stroke="{pal[3]}" stroke-width="46" stroke-opacity=".5" stroke-linecap="round"/>']
    for _ in range(26):
        x, y = rnd.uniform(40, w - 160), rnd.uniform(40, h - 120)
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{rnd.randint(50, 130)}" height="{rnd.randint(40, 90)}" rx="8" fill="#fff" fill-opacity="{rnd.uniform(.05, .14):.2f}"/>')
    n = len(names)
    pts = [(w * (0.1 + 0.8 * i / (n - 1)), h * (0.3 + 0.36 * ((i * 7) % 5) / 4)) for i in range(n)]
    d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts)
    out.append(f'<path d="{d}" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="4 18" stroke-linecap="round"/>')
    pos = []
    for i, ((x, y), name) in enumerate(zip(pts, names)):
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="34" fill="{pal[2]}" stroke="#fff" stroke-width="5"/>'
                   f'<text x="{x:.0f}" y="{y + 12:.0f}" text-anchor="middle" font-family="{FONT}" font-size="34" font-weight="800" fill="#fff">{i + 1}</text>'
                   f'<text x="{x:.0f}" y="{y + 84:.0f}" text-anchor="middle" font-family="{FONT}" font-size="30" font-weight="700" fill="#fff">{escape(name)}</text>')
        pos.append((round((x + 30) / w * 100, 1), round((y - 34) / h * 100, 1)))
    return _svg(w, h, body + "".join(out), defs), pos
