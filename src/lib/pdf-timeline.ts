import type { PdfSearchIndex } from "./pdf-search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineEntry = {
  /** Unique id for React keys */
  id: string;
  /** Normalized Date used for chronological sorting */
  date: Date;
  /** Exact text as it appears in the PDF */
  rawText: string;
  /** Page where the date was found (1-based) */
  pageNumber: number;
  /** Vertical position 0–1, used to scroll to the match in the viewer */
  verticalRatio: number;
  /** ~10-word fragment surrounding the date for context */
  context: string;
  /** Year for grouping in the UI */
  year: number;
  /** Month (0-based) for sorting within a year */
  month: number;
};

export type Timeline = {
  entries: TimelineEntry[];
};

// ---------------------------------------------------------------------------
// Month tables
// ---------------------------------------------------------------------------

const MESES_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

const MESES_EN: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const MESES_ES_PATTERN = Object.keys(MESES_ES).join("|");
const MESES_EN_PATTERN = Object.keys(MESES_EN).join("|");

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

type DatePattern = {
  re: RegExp;
  parse: (match: RegExpExecArray) => { day: number; month: number; year: number } | null;
};

const DATE_PATTERNS: DatePattern[] = [
  // ISO: 2024-03-15
  {
    re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    parse: (m) => numericParts(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  },
  // DD/MM/AAAA · DD-MM-AAAA · DD.MM.AAAA (only when year is 4 digits)
  {
    re: /\b(\d{1,2})[/\-.·](\d{1,2})[/\-.·](\d{4})\b/g,
    parse: (m) => numericParts(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
  },
  // "15 de marzo de 2024" / "15 de marzo del 2024"
  {
    re: new RegExp(
      `\\b(?<day>\\d{1,2})\\s+de\\s+(?<month>${MESES_ES_PATTERN})\\s+del?\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => spanishParts(m.groups!.day, m.groups!.month, m.groups!.year),
  },
  // "15 marzo 2024" (sin "de") – variante común en documentos escaneados
  {
    re: new RegExp(
      `\\b(?<day>\\d{1,2})\\s+(?<month>${MESES_ES_PATTERN})\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => spanishParts(m.groups!.day, m.groups!.month, m.groups!.year),
  },
  // "marzo de 2024" / "marzo del 2024" (sin día → día 1)
  {
    re: new RegExp(
      `\\b(?<month>${MESES_ES_PATTERN})\\s+del?\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => spanishParts("1", m.groups!.month, m.groups!.year),
  },
  // "March 15, 2024" / "March 15 2024"
  {
    re: new RegExp(
      `\\b(?<month>${MESES_EN_PATTERN})\\s+(?<day>\\d{1,2}),?\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => englishParts(m.groups!.month, m.groups!.day, m.groups!.year),
  },
  // "15 March 2024"
  {
    re: new RegExp(
      `\\b(?<day>\\d{1,2})\\s+(?<month>${MESES_EN_PATTERN})\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => englishParts(m.groups!.month, m.groups!.day, m.groups!.year),
  },
  // "January 2024" (month + year, no day)
  {
    re: new RegExp(
      `\\b(?<month>${MESES_EN_PATTERN})\\s+(?<year>\\d{4})\\b`,
      "gi",
    ),
    parse: (m) => englishParts(m.groups!.month, "1", m.groups!.year),
  },
];

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function numericParts(year: number, month: number, day: number) {
  if (!isValidDate(year, month, day)) return null;
  return { year, month, day };
}

function spanishParts(dayStr: string, monthStr: string, yearStr: string) {
  const month = MESES_ES[monthStr.toLowerCase()];
  if (month === undefined) return null;
  return numericParts(Number(yearStr), month, Number(dayStr));
}

function englishParts(monthStr: string, dayStr: string, yearStr: string) {
  const month = MESES_EN[monthStr.toLowerCase()];
  if (month === undefined) return null;
  return numericParts(Number(yearStr), month, Number(dayStr));
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 2200) return false;
  if (month < 0 || month > 11) return false;
  if (day < 1 || day > 31) return false;
  // Validates calendar correctness (catches Feb 31, Apr 31, etc.)
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

// ---------------------------------------------------------------------------
// Context extraction (~10 words around the match)
// ---------------------------------------------------------------------------

const CONTEXT_WORDS = 10;

function extractContext(text: string, matchStart: number, matchEnd: number): string {
  // Walk back CONTEXT_WORDS words before the match
  let start = matchStart;
  let wordCount = 0;
  while (start > 0 && wordCount < CONTEXT_WORDS) {
    start--;
    if (/\s/.test(text[start])) {
      while (start > 0 && /\s/.test(text[start - 1])) start--;
    } else {
      while (start > 0 && !/\s/.test(text[start - 1])) start--;
      wordCount++;
    }
  }

  // Walk forward CONTEXT_WORDS words after the match
  let end = matchEnd;
  wordCount = 0;
  while (end < text.length && wordCount < CONTEXT_WORDS) {
    if (/\s/.test(text[end])) {
      end++;
    } else {
      while (end < text.length && !/\s/.test(text[end])) end++;
      wordCount++;
    }
  }

  const before = text.slice(start, matchStart).trimStart();
  const match = text.slice(matchStart, matchEnd);
  const after = text.slice(matchEnd, end).trimEnd();
  return `${start > 0 ? "\u2026" : ""}${before}${match}${after}${end < text.length ? "\u2026" : ""}`.trim();
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Scans all already-indexed pages in `searchIndex` and returns a chronologically
 * sorted list of date occurrences found in the document. Each occurrence is a
 * separate entry with surrounding context so the reader can tell why the date matters.
 *
 * Runs fully in the client – zero network, zero AI, zero new dependencies.
 */
export function extractTimeline(searchIndex: PdfSearchIndex): Timeline {
  const entries: TimelineEntry[] = [];
  const indexedPages = searchIndex.indexedPageCount;
  const totalPages = searchIndex.pageCount;

  for (let pageNumber = 1; pageNumber <= Math.min(indexedPages, totalPages); pageNumber++) {
    const pageData = searchIndex.getPageText(pageNumber);
    if (!pageData) continue;
    const { text, sourcePositions } = pageData;

    // Track spans already matched to prevent two patterns from reporting the same text
    const seenRanges = new Set<string>();

    for (const { re, parse } of DATE_PATTERNS) {
      re.lastIndex = 0; // reset stateful regex before each page
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const parts = parse(match);
        if (!parts) continue;

        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        const rangeKey = `${matchStart}-${matchEnd}`;
        if (seenRanges.has(rangeKey)) continue;
        seenRanges.add(rangeKey);

        const { year, month, day } = parts;
        const date = new Date(year, month, day);

        // Find vertical position of this match for scrolling
        const sourcePos = sourcePositions.find(
          (pos) => matchStart >= pos.start && matchStart < pos.end,
        );
        const verticalRatio = sourcePos?.verticalRatio ?? 0.5;

        const context = extractContext(text, matchStart, matchEnd);

        entries.push({
          id: `${pageNumber}-${matchStart}`,
          date,
          rawText: match[0],
          pageNumber,
          verticalRatio,
          context,
          year,
          month,
        });
      }
    }
  }

  // Sort chronologically; ties broken by document order (page number)
  entries.sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.pageNumber - b.pageNumber;
  });

  return { entries };
}
