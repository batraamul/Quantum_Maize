// Mutable singleton read by the Monaco completion provider. Updated by the
// project store whenever files are (re)indexed.
import type { BibEntry, LabelEntry } from "./projectIndex";

export const indexState = {
  labels: [] as LabelEntry[],
  bib: [] as BibEntry[],
  texFiles: [] as string[],
  imageFiles: [] as string[],
  bibFiles: [] as string[],
  graphicsPaths: [] as string[],
};
