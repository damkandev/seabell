export type LawType = "ley" | "dl" | "dfl" | "dto";

export type LawReference = {
  id: string;
  pageNumber: number;
  type: LawType;
  number: string;
  label: string;
  context: string;
  /** Offsets in the indexed text of its PDF page. */
  start: number;
  end: number;
};

type LawPattern = {
  type: LawType;
  label: string;
  expression: RegExp;
};

// Kept deliberately conservative: a false positive in a legal document is
// worse than leaving an uncommon citation for a later iteration.
const LAW_PATTERNS: LawPattern[] = [
  { type: "ley", label: "Ley", expression: /\bLey\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})+)\b/giu },
  { type: "dfl", label: "DFL", expression: /\b(?:Decreto\s+con\s+Fuerza\s+de\s+Ley|DFL)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "dl", label: "DL", expression: /\b(?:Decreto\s+Ley|DL)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "dto", label: "Decreto", expression: /\bDecreto\s+(?:Supremo\s+)?(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
];

function normalizeNumber(value: string): string {
  return value.replace(/\D/gu, "");
}

function compactContext(text: string, start: number, end: number): string {
  const padding = 90;
  const before = text.slice(Math.max(0, start - padding), start).replace(/\s+/gu, " ").trim();
  const match = text.slice(start, end).replace(/\s+/gu, " ").trim();
  const after = text.slice(end, end + padding).replace(/\s+/gu, " ").trim();
  return `${before ? `…${before} ` : ""}${match}${after ? ` ${after}…` : ""}`;
}

export function findLawReferences(text: string, pageNumber: number): LawReference[] {
  const found: LawReference[] = [];
  const seen = new Set<string>();

  for (const pattern of LAW_PATTERNS) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const number = normalizeNumber(match[1] ?? "");
      if (!number || match.index === undefined) continue;
      // Do not turn the "Ley" portion of "Decreto Ley" into a separate law.
      if (pattern.type === "ley" && /decreto\s+$/iu.test(text.slice(Math.max(0, match.index - 12), match.index))) continue;
      const key = `${pattern.type}-${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        id: `${pageNumber}-${key}`,
        pageNumber,
        type: pattern.type,
        number,
        label: `${pattern.label} ${number.replace(/(\d)(?=(\d{3})+$)/gu, "$1.")}`,
        context: compactContext(text, match.index, match.index + match[0].length),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return found.sort((left, right) => left.id.localeCompare(right.id));
}
