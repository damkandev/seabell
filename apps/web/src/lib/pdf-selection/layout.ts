import type {
  PDFPageProxy,
} from "pdfjs-dist";

import type {
  NormalizedRect,
  PageTextModel,
  SelectionPosition,
  TextLine,
  TextRun,
} from "./types";

type Matrix = [number, number, number, number, number, number];
type TextItem = {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
};
type TextMarkedContent = {
  type: string;
  id: string;
};
type TextContent = {
  items: Array<TextItem | TextMarkedContent>;
  styles: Record<string, { ascent?: number; descent?: number; vertical?: boolean }>;
};
type DraftRun = Omit<TextRun, "lineId" | "order" | "separatorBefore">;
type DraftLine = TextLine & { centerY: number };
type StructNode = { type?: string; id?: string; children?: StructNode[] };

const graphemeSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function segmentGraphemes(text: string): { graphemes: string[]; offsets: number[] } {
  if (!graphemeSegmenter) {
    const graphemes = Array.from(text);
    const offsets = [0];
    let offset = 0;
    for (const grapheme of graphemes) {
      offset += grapheme.length;
      offsets.push(offset);
    }
    return { graphemes, offsets };
  }

  const segments = Array.from(graphemeSegmenter.segment(text));
  return {
    graphemes: segments.map((segment) => segment.segment),
    offsets: [...segments.map((segment) => segment.index), text.length],
  };
}

function multiply(left: number[], right: number[]): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function unionRects(rects: NormalizedRect[]): NormalizedRect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item;
}

function collectSemanticOrder(node: StructNode | null, order: Map<string, number>): void {
  if (!node) return;
  if (node.type === "content" && node.id && !order.has(node.id)) {
    order.set(node.id, order.size);
  }
  for (const child of node.children ?? []) collectSemanticOrder(child, order);
}

function createDraftRuns(
  textContent: TextContent,
  viewport: ReturnType<PDFPageProxy["getViewport"]>,
): DraftRun[] {
  const result: DraftRun[] = [];
  const markedContentStack: Array<string | null> = [];
  let sourceIndex = 0;

  for (const item of textContent.items) {
    if (!isTextItem(item)) {
      if (item.type === "beginMarkedContentProps") {
        markedContentStack.push(item.id ?? null);
      } else if (item.type === "beginMarkedContent") {
        markedContentStack.push(null);
      } else if (item.type === "endMarkedContent") {
        markedContentStack.pop();
      }
      continue;
    }

    const currentSourceIndex = sourceIndex++;
    if (!item.str) continue;

    const transform = multiply(viewport.transform, item.transform);
    const style = textContent.styles[item.fontName];
    const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]));
    const ascent = style?.ascent
      ? style.ascent * fontHeight
      : style?.descent
        ? (1 + style.descent) * fontHeight
        : fontHeight;
    let angle = Math.atan2(transform[1], transform[0]);
    if (style?.vertical) angle += Math.PI / 2;

    const baselineX = transform[4];
    const baselineY = transform[5];
    const alongX = Math.cos(angle);
    const alongY = Math.sin(angle);
    const downX = -alongY;
    const downY = alongX;
    const advance = Math.max(1, item.width * viewport.scale);
    const topLeftX = baselineX - downX * ascent;
    const topLeftY = baselineY - downY * ascent;
    const points = [
      [topLeftX, topLeftY],
      [topLeftX + alongX * advance, topLeftY + alongY * advance],
      [topLeftX + downX * fontHeight, topLeftY + downY * fontHeight],
      [
        topLeftX + alongX * advance + downX * fontHeight,
        topLeftY + alongY * advance + downY * fontHeight,
      ],
    ];
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    const { graphemes, offsets } = segmentGraphemes(item.str);

    result.push({
      id: result.length,
      sourceIndex: currentSourceIndex,
      text: item.str,
      graphemes,
      graphemeOffsets: offsets,
      rect: {
        x: left / viewport.width,
        y: top / viewport.height,
        width: Math.max(1, right - left) / viewport.width,
        height: Math.max(1, bottom - top) / viewport.height,
      },
      angle,
      hasEOL: item.hasEOL,
      markedContentId: markedContentStack.findLast((id) => id !== null) ?? null,
    });
  }

  return result;
}

function makePhysicalLines(runs: DraftRun[], medianHeight: number): DraftLine[] {
  const rows: DraftRun[][] = [];
  const sorted = [...runs].sort((a, b) => {
    const ay = a.rect.y + a.rect.height * 0.8;
    const by = b.rect.y + b.rect.height * 0.8;
    return ay - by || a.rect.x - b.rect.x;
  });
  const tolerance = Math.max(0.002, medianHeight * 0.55);

  for (const run of sorted) {
    const centerY = run.rect.y + run.rect.height * 0.8;
    let closest: DraftRun[] | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const rowY = median(row.map((candidate) => candidate.rect.y + candidate.rect.height * 0.8));
      const distance = Math.abs(centerY - rowY);
      if (distance < tolerance && distance < closestDistance) {
        closest = row;
        closestDistance = distance;
      }
    }
    (closest ?? rows[rows.push([]) - 1]).push(run);
  }

  rows.sort((a, b) => a[0].rect.y - b[0].rect.y);
  const lines: DraftLine[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex].sort((a, b) => a.rect.x - b.rect.x);
    let chunk: DraftRun[] = [];
    const flush = () => {
      if (!chunk.length) return;
      const rect = unionRects(chunk.map((run) => run.rect));
      lines.push({
        id: lines.length,
        runIds: chunk.map((run) => run.id),
        rect,
        physicalRow: rowIndex,
        column: 0,
        centerY: rect.y + rect.height / 2,
      });
      chunk = [];
    };

    for (const run of row) {
      const previous = chunk.at(-1);
      if (previous) {
        const gap = run.rect.x - (previous.rect.x + previous.rect.width);
        const averageCharacterWidth = previous.rect.width / Math.max(1, previous.graphemes.length);
        if (gap > Math.max(medianHeight * 1.6, averageCharacterWidth * 4)) flush();
      }
      chunk.push(run);
    }
    flush();
  }
  return lines;
}

function orderGeometrically(
  lines: DraftLine[],
  runsById: DraftRun[],
): { lines: DraftLine[]; tableLike: boolean } {
  const candidates = lines.filter((line) => line.rect.width < 0.68);
  const columns: DraftLine[][] = [];

  for (const line of candidates.sort((a, b) => a.rect.x - b.rect.x)) {
    const match = columns.find((column) => {
      const bounds = unionRects(column.map((entry) => entry.rect));
      const overlap =
        Math.min(bounds.x + bounds.width, line.rect.x + line.rect.width) -
        Math.max(bounds.x, line.rect.x);
      return overlap > Math.min(bounds.width, line.rect.width) * 0.3;
    });
    (match ?? columns[columns.push([]) - 1]).push(line);
  }

  const stableColumns = columns.filter((column) => column.length >= 3);
  if (stableColumns.length < 2) {
    return {
      lines: [...lines].sort((a, b) => a.centerY - b.centerY || a.rect.x - b.rect.x),
      tableLike: false,
    };
  }

  stableColumns.sort((a, b) => {
    const aLeft = Math.min(...a.map((line) => line.rect.x));
    const bLeft = Math.min(...b.map((line) => line.rect.x));
    return aLeft - bLeft;
  });
  stableColumns.forEach((column, index) => column.forEach((line) => (line.column = index)));

  let alignedPairs = 0;
  let possiblePairs = 0;
  for (let index = 0; index < stableColumns.length - 1; index++) {
    for (const line of stableColumns[index]) {
      possiblePairs++;
      if (
        stableColumns[index + 1].some(
          (other) => Math.abs(other.centerY - line.centerY) < Math.max(line.rect.height, other.rect.height) * 0.55,
        )
      ) {
        alignedPairs++;
      }
    }
  }
  const medianTextLength = median(
    candidates.map((line) =>
      line.runIds.reduce((length, id) => length + runsById[id].text.length, 0),
    ),
  );
  const tableLike = possiblePairs > 0 && alignedPairs / possiblePairs > 0.72 && medianTextLength < 32;
  if (tableLike) {
    return {
      lines: [...lines].sort((a, b) => a.centerY - b.centerY || a.rect.x - b.rect.x),
      tableLike: true,
    };
  }

  const stableSet = new Set(stableColumns.flat());
  const top = Math.min(...stableColumns.flat().map((line) => line.rect.y));
  const bottom = Math.max(
    ...stableColumns.flat().map((line) => line.rect.y + line.rect.height),
  );
  const before = lines
    .filter((line) => !stableSet.has(line) && line.centerY < top)
    .sort((a, b) => a.centerY - b.centerY || a.rect.x - b.rect.x);
  const after = lines
    .filter((line) => !stableSet.has(line) && line.centerY >= bottom)
    .sort((a, b) => a.centerY - b.centerY || a.rect.x - b.rect.x);
  const spanning = lines
    .filter((line) => !stableSet.has(line) && line.centerY >= top && line.centerY < bottom)
    .sort((a, b) => a.centerY - b.centerY || a.rect.x - b.rect.x);
  const orderedColumns = stableColumns.flatMap((column) =>
    [...column].sort((a, b) => a.centerY - b.centerY),
  );

  return { lines: [...before, ...orderedColumns, ...spanning, ...after], tableLike: false };
}

function separatorBetween(
  previous: DraftRun | undefined,
  current: DraftRun,
  previousLine: DraftLine | undefined,
  currentLine: DraftLine,
  tableLike: boolean,
  medianHeight: number,
): string {
  if (!previous || !previousLine) return "";
  if (previousLine.id === currentLine.id) {
    if (/\s$/u.test(previous.text) || /^\s/u.test(current.text)) return "";
    const gap = current.rect.x - (previous.rect.x + previous.rect.width);
    return gap > medianHeight * 0.12 ? " " : "";
  }
  if (tableLike && previousLine.physicalRow === currentLine.physicalRow) return "\t";
  if (tableLike) return "\n";
  if (previousLine.column !== currentLine.column) return "\n\n";

  const verticalGap = currentLine.rect.y - (previousLine.rect.y + previousLine.rect.height);
  const indent = Math.abs(currentLine.rect.x - previousLine.rect.x);
  if (verticalGap > medianHeight * 1.25 || indent > medianHeight * 1.5) return "\n\n";
  return " ";
}

export async function createPageTextModel(
  pdfPage: PDFPageProxy,
  pageNumber: number,
): Promise<PageTextModel> {
  const [textContent, structTree] = await Promise.all([
    pdfPage.getTextContent({ includeMarkedContent: true, disableNormalization: true }),
    pdfPage.getStructTree().catch(() => null),
  ]);
  const viewport = pdfPage.getViewport({ scale: 1 });
  const drafts = createDraftRuns(textContent, viewport);
  const medianHeight = median(drafts.map((run) => run.rect.height)) || 0.015;
  const physicalLines = makePhysicalLines(drafts, medianHeight);
  const lineByRun = new Map<number, DraftLine>();
  for (const line of physicalLines) {
    for (const runId of line.runIds) lineByRun.set(runId, line);
  }

  const semanticOrder = new Map<string, number>();
  collectSemanticOrder(structTree as StructNode | null, semanticOrder);
  const semanticallyCovered = drafts.filter(
    (run) => run.markedContentId && semanticOrder.has(run.markedContentId),
  ).length;
  const canUseSemanticOrder = drafts.length > 0 && semanticallyCovered / drafts.length >= 0.8;
  const geometric = orderGeometrically(physicalLines, drafts);
  let orderedLines = geometric.lines;

  if (canUseSemanticOrder) {
    orderedLines = [...physicalLines].sort((a, b) => {
      const aOrder = Math.min(
        ...a.runIds.map((id) => semanticOrder.get(drafts[id].markedContentId ?? "") ?? Number.MAX_SAFE_INTEGER),
      );
      const bOrder = Math.min(
        ...b.runIds.map((id) => semanticOrder.get(drafts[id].markedContentId ?? "") ?? Number.MAX_SAFE_INTEGER),
      );
      return aOrder - bOrder || a.centerY - b.centerY || a.rect.x - b.rect.x;
    });
  }

  const orderedDrafts: DraftRun[] = [];
  for (const line of orderedLines) {
    const lineRuns = line.runIds
      .map((id) => drafts[id])
      .sort((a, b) => a.rect.x - b.rect.x);
    orderedDrafts.push(...lineRuns);
  }

  const orderedRuns: TextRun[] = [];
  for (let index = 0; index < orderedDrafts.length; index++) {
    const draft = orderedDrafts[index];
    const currentLine = lineByRun.get(draft.id)!;
    const previous = orderedDrafts[index - 1];
    const previousLine = previous ? lineByRun.get(previous.id) : undefined;
    orderedRuns.push({
      ...draft,
      lineId: currentLine.id,
      order: index,
      separatorBefore: separatorBetween(
        previous,
        draft,
        previousLine,
        currentLine,
        geometric.tableLike,
        medianHeight,
      ),
    });
  }

  const runById = new Map(orderedRuns.map((run) => [run.id, run]));
  const lines: TextLine[] = physicalLines.map((line) => ({
    id: line.id,
    runIds: line.runIds,
    rect: line.rect,
    physicalRow: line.physicalRow,
    column: line.column,
  }));
  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    runs: drafts.map((draft) => runById.get(draft.id)!),
    orderedRuns,
    lines,
    medianHeight,
  };
}

export function comparePositions(
  left: SelectionPosition,
  right: SelectionPosition,
  pages: Map<number, PageTextModel>,
): number {
  if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
  const model = pages.get(left.pageNumber);
  if (!model) return left.runId - right.runId || left.offset - right.offset;
  const leftRun = model.runs[left.runId];
  const rightRun = model.runs[right.runId];
  return leftRun.order - rightRun.order || left.offset - right.offset;
}

function normalizeCopiedText(text: string): string {
  return text
    .replace(/\u0000/gu, "")
    .replace(/\u00ad\s*/gu, "")
    .replace(/([\p{L}])[-‐]\s+([\p{Ll}])/gu, "$1$2")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .normalize("NFC");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function computeRangeRects(
  start: SelectionPosition,
  end: SelectionPosition,
  pageNumber: number,
  model: PageTextModel,
): NormalizedRect[] {
  if (pageNumber < start.pageNumber || pageNumber > end.pageNumber) return [];

  const rects: NormalizedRect[] = [];
  for (const run of model.orderedRuns) {
    const startsBeforeRun =
      pageNumber > start.pageNumber ||
      run.order > model.runs[start.runId]?.order ||
      run.id === start.runId;
    const endsAfterRun =
      pageNumber < end.pageNumber ||
      run.order < model.runs[end.runId]?.order ||
      run.id === end.runId;
    if (!startsBeforeRun || !endsAfterRun) continue;
    let from = run.id === start.runId && pageNumber === start.pageNumber ? start.offset : 0;
    let to =
      run.id === end.runId && pageNumber === end.pageNumber
        ? end.offset
        : run.graphemes.length;
    from = clamp(from, 0, run.graphemes.length);
    to = clamp(to, 0, run.graphemes.length);
    if (to <= from || !run.graphemes.length) continue;
    const startFraction = from / run.graphemes.length;
    const endFraction = to / run.graphemes.length;
    rects.push({
      x: run.rect.x + run.rect.width * startFraction,
      y: run.rect.y,
      width: run.rect.width * (endFraction - startFraction),
      height: run.rect.height,
    });
  }
  return rects;
}

export function selectedText(
  start: SelectionPosition,
  end: SelectionPosition,
  pages: Map<number, PageTextModel>,
): string {
  const chunks: string[] = [];
  for (let pageNumber = start.pageNumber; pageNumber <= end.pageNumber; pageNumber++) {
    const page = pages.get(pageNumber);
    if (!page) continue;
    let wroteOnPage = false;
    for (const run of page.orderedRuns) {
      const from = pageNumber === start.pageNumber && run.id === start.runId ? start.offset : 0;
      const to =
        pageNumber === end.pageNumber && run.id === end.runId
          ? end.offset
          : run.graphemes.length;
      const afterStart =
        pageNumber > start.pageNumber ||
        run.order > page.runs[start.runId]?.order ||
        (run.id === start.runId && to > from);
      const beforeEnd =
        pageNumber < end.pageNumber ||
        run.order < page.runs[end.runId]?.order ||
        run.id === end.runId;
      if (!afterStart || !beforeEnd || to <= from) continue;
      if (!wroteOnPage && chunks.length) chunks.push("\n\n");
      if (wroteOnPage) chunks.push(run.separatorBefore);
      chunks.push(run.graphemes.slice(from, to).join(""));
      wroteOnPage = true;
    }
  }
  return normalizeCopiedText(chunks.join(""));
}

