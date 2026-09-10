import type { PDFDocumentProxy } from "pdfjs-dist";
import { findLawReferences, type LawReference } from "@/lib/law-references";

export type PdfSearchResult = {
  id: string;
  pageNumber: number;
  verticalRatio: number;
  before: string;
  match: string;
  after: string;
};

type IndexedPage = {
  text: string;
  normalized: string;
  /** Maps each normalized character back to its original UTF-16 offset. */
  originalOffsets: number[];
  sourcePositions: Array<{ start: number; end: number; verticalRatio: number }>;
};

const WORD = /[\p{L}\p{N}]/u;
const TOKEN = /[\p{L}\p{N}]+/gu;
const CONTEXT_WORDS = 12;
const MAX_RESULTS = 100;

function normalizeCharacter(character: string): string {
  return character.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function normalizeWithOffsets(text: string): Pick<IndexedPage, "normalized" | "originalOffsets"> {
  let normalized = "";
  const originalOffsets: number[] = [];
  for (let offset = 0; offset < text.length;) {
    const character = String.fromCodePoint(text.codePointAt(offset)!);
    const canonical = normalizeCharacter(character);
    if (/\s/u.test(canonical)) {
      if (!normalized.endsWith(" ")) {
        normalized += " ";
        originalOffsets.push(offset);
      }
    } else {
      normalized += canonical;
      originalOffsets.push(...Array.from({ length: canonical.length }, () => offset));
    }
    offset += character.length;
  }
  return { normalized, originalOffsets };
}

function queryTokens(query: string): string[] {
  return normalizeCharacter(query).match(TOKEN) ?? [];
}

function contextStart(text: string, matchStart: number): number {
  let start = matchStart;
  let words = 0;
  while (start > 0 && words < CONTEXT_WORDS) {
    while (start > 0 && /\s/.test(text[start - 1])) start--;
    const wordEnd = start;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    if (wordEnd > start) words++;
  }
  return start;
}

function contextEnd(text: string, matchEnd: number): number {
  let end = matchEnd;
  let words = 0;
  while (end < text.length && words < CONTEXT_WORDS) {
    while (end < text.length && /\s/.test(text[end])) end++;
    const wordStart = end;
    while (end < text.length && !/\s/.test(text[end])) end++;
    if (end > wordStart) words++;
  }
  return end;
}

/**
 * Per-document, in-memory inverted index. Searching intersects token posting
 * lists before scanning text, so queries do not walk every PDF page.
 */
export class PdfSearchIndex {
  readonly #document: PDFDocumentProxy;
  readonly #pages = new Map<number, IndexedPage>();
  readonly #postings = new Map<string, Set<number>>();
  readonly #onProgress: () => void;
  #aborted = false;

  constructor(document: PDFDocumentProxy, onProgress: () => void) {
    this.#document = document;
    this.#onProgress = onProgress;
  }

  get indexedPageCount(): number {
    return this.#pages.size;
  }

  get pageCount(): number {
    return this.#document.numPages;
  }

  /** Exposes already-indexed page text for the timeline extractor. Zero extra cost. */
  getPageText(pageNumber: number): { text: string; sourcePositions: IndexedPage["sourcePositions"] } | undefined {
    const page = this.#pages.get(pageNumber);
    if (!page) return undefined;
    return { text: page.text, sourcePositions: page.sourcePositions };
  }

  /** References are extracted from text already read for the search index. */
  getLawReferences(): LawReference[] {
    return [...this.#pages.entries()]
      .flatMap(([pageNumber, page]) => findLawReferences(page.text, pageNumber))
      .sort((left, right) => left.pageNumber - right.pageNumber || left.id.localeCompare(right.id));
  }

  start(): void {
    let pageNumber = 1;
    const schedule = () => {
      if (this.#aborted || pageNumber > this.#document.numPages) return;
      const currentPage = pageNumber++;
      void this.#indexPage(currentPage).finally(() => {
        this.#onProgress();
        if ("requestIdleCallback" in window) window.requestIdleCallback(schedule, { timeout: 700 });
        else globalThis.setTimeout(schedule, 12);
      });
    };
    schedule();
  }

  dispose(): void {
    this.#aborted = true;
    this.#pages.clear();
    this.#postings.clear();
  }

  search(query: string): PdfSearchResult[] {
    const normalizedQuery = normalizeCharacter(query).trim().replace(/\s+/g, " ");
    const tokens = queryTokens(query);
    if (!normalizedQuery || !tokens.length) return [];

    const candidates = tokens
      .map((token) => this.#postings.get(token))
      .sort((left, right) => (left?.size ?? 0) - (right?.size ?? 0))[0];
    if (!candidates) return [];
    const candidatePages = [...candidates].filter((page) =>
      tokens.every((token) => this.#postings.get(token)?.has(page)),
    );

    const results: PdfSearchResult[] = [];
    for (const pageNumber of candidatePages) {
      const page = this.#pages.get(pageNumber);
      if (!page) continue;
      let index = 0;
      while (results.length < MAX_RESULTS) {
        const matchAt = page.normalized.indexOf(normalizedQuery, index);
        if (matchAt < 0) break;
        const matchEnd = matchAt + normalizedQuery.length;
        const beforeCharacter = page.normalized[matchAt - 1];
        const afterCharacter = page.normalized[matchEnd];
        if ((!beforeCharacter || !WORD.test(beforeCharacter)) && (!afterCharacter || !WORD.test(afterCharacter))) {
          const originalStart = page.originalOffsets[matchAt];
          const originalEnd = matchEnd < page.originalOffsets.length
            ? page.originalOffsets[matchEnd]
            : page.text.length;
          const start = contextStart(page.text, originalStart);
          const end = contextEnd(page.text, originalEnd);
          const sourcePosition = page.sourcePositions.find(
            (position) => originalStart >= position.start && originalStart < position.end,
          );
          results.push({
            id: `${pageNumber}-${matchAt}`,
            pageNumber,
            verticalRatio: sourcePosition?.verticalRatio ?? 0.5,
            before: page.text.slice(start, originalStart).trimStart(),
            match: page.text.slice(originalStart, originalEnd),
            after: page.text.slice(originalEnd, end).trimEnd(),
          });
        }
        index = matchAt + Math.max(normalizedQuery.length, 1);
      }
      if (results.length === MAX_RESULTS) break;
    }
    return results;
  }

  async #indexPage(pageNumber: number): Promise<void> {
    const page = await this.#document.getPage(pageNumber);
    if (this.#aborted) return;
    const content = await page.getTextContent();
    if (this.#aborted) return;
    const viewport = page.getViewport({ scale: 1 });
    let text = "";
    const sourcePositions: IndexedPage["sourcePositions"] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      if (text) text += " ";
      const start = text.length;
      text += item.str;
      const y = "transform" in item && Array.isArray(item.transform) ? item.transform[5] : 0;
      sourcePositions.push({
        start,
        end: text.length,
        verticalRatio: Math.max(0, Math.min(1, 1 - y / viewport.height)),
      });
    }
    const indexed = { text, sourcePositions, ...normalizeWithOffsets(text) };
    this.#pages.set(pageNumber, indexed);
    for (const token of indexed.normalized.match(TOKEN) ?? []) {
      const pages = this.#postings.get(token) ?? new Set<number>();
      pages.add(pageNumber);
      this.#postings.set(token, pages);
    }
  }
}
