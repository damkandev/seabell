export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextRun = {
  id: number;
  sourceIndex: number;
  text: string;
  graphemes: string[];
  graphemeOffsets: number[];
  rect: NormalizedRect;
  angle: number;
  hasEOL: boolean;
  markedContentId: string | null;
  lineId: number;
  order: number;
  separatorBefore: string;
};

export type TextLine = {
  id: number;
  runIds: number[];
  rect: NormalizedRect;
  physicalRow: number;
  column: number;
};

export type PageTextModel = {
  pageNumber: number;
  width: number;
  height: number;
  runs: TextRun[];
  orderedRuns: TextRun[];
  lines: TextLine[];
  medianHeight: number;
};

export type SelectionPosition = {
  pageNumber: number;
  runId: number;
  offset: number;
};

export type SelectionRange = {
  anchor: SelectionPosition;
  focus: SelectionPosition;
};

export type SelectionStatus =
  | { kind: "idle" }
  | { kind: "indexing"; message: string }
  | { kind: "error"; message: string };

export type PdfHighlight = {
  id: string;
  range: SelectionRange;
  text: string;
  color?: string;
  createdAt: number;
};

export type SelectionPopoverState = {
  range: SelectionRange;
  text: string;
  position: {
    x: number;
    y: number;
    placement: "top" | "bottom";
  };
} | null;

export type ActiveHighlightPopoverState = {
  highlight: PdfHighlight;
  position: {
    x: number;
    y: number;
  };
} | null;

