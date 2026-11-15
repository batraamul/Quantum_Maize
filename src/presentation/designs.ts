// Slide designs drawn by qmdesign.sty (written into every presentation project).
// `classic` keeps an ordinary Beamer theme; the infographics work with all of them.

export interface SlideDesign {
  id: string;
  label: string;
  desc: string;
  dark: boolean;
}

export const SLIDE_DESIGNS: SlideDesign[] = [
  { id: "elegant", label: "Elegant", desc: "Cream paper, serif type, navy and gold, fine border", dark: false },
  { id: "executive", label: "Executive", desc: "Dark navy with gold diagonals", dark: true },
  { id: "geometric", label: "Geometric", desc: "White with teal and orange angled shapes", dark: false },
  { id: "blueprint", label: "Blueprint", desc: "Engineering grid on deep blue, corner brackets", dark: true },
  { id: "wave", label: "Wave", desc: "Soft layered waves in green and sand", dark: false },
  { id: "minimal", label: "Minimal", desc: "White, one accent bar, plenty of space", dark: false },
  { id: "radar", label: "Radar", desc: "Dark with range rings and a sweep", dark: true },
  { id: "circuit", label: "Circuit", desc: "Light with circuit traces", dark: false },
  { id: "aurora", label: "Aurora", desc: "Dark with soft colour glows", dark: true },
  { id: "classic", label: "Classic Beamer", desc: "An ordinary Beamer theme (metropolis, Madrid ...)", dark: false },
];

const urls = import.meta.glob("./designs/*.jpg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** Preview picture of a design: `title` or `content` slide. Undefined for classic. */
export function designPreview(id: string, which: "title" | "content"): string | undefined {
  return urls[`./designs/${id}-${which}.jpg`];
}

/** The design named in a presentation's preamble, or null if the file does not use qmdesign. */
export function slideDesign(src: string): string | null {
  return /^[ \t]*\\newcommand\{\\qmDesign\}\{([A-Za-z]*)\}/m.exec(src)?.[1] ?? null;
}

/** Changes the design named in the preamble. Returns the source unchanged if there is none. */
export function setSlideDesign(src: string, design: string): string {
  if (!SLIDE_DESIGNS.some((d) => d.id === design)) return src;
  return src.replace(/^([ \t]*\\newcommand\{\\qmDesign\}\{)[A-Za-z]*(\})/m, `$1${design}$2`);
}
