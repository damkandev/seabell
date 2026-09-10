import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

import {
  comparePositions,
  computeRangeRects,
  createPageTextModel,
  selectedText,
} from "./layout";
import type {
  NormalizedRect,
  PageTextModel,
  PdfHighlight,
  SelectionPopoverState,
  SelectionPosition,
  SelectionRange,
  SelectionStatus,
} from "./types";

type TextLayerRenderedEvent = { pageNumber: number; error?: unknown };
type ControllerOptions = {
  container: HTMLElement;
  viewerElement: HTMLElement;
  viewer: PDFViewer;
  eventBus: EventBus;
  pdfDocument: PDFDocumentProxy;
  canCopy: boolean;
  onStatus: (status: SelectionStatus) => void;
  initialHighlights?: PdfHighlight[];
  onSelectionChange?: (state: SelectionPopoverState) => void;
  onHighlightsChange?: (highlights: PdfHighlight[]) => void;
  onActiveHighlightClick?: (highlight: PdfHighlight | null, position?: { x: number; y: number }) => void;
};
type DragState = {
  pointerId: number;
  anchor: SelectionPosition;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  moved: boolean;
};

const EDGE_SCROLL_ZONE = 56;
const MAX_SCROLL_SPEED = 22;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function distanceToRect(x: number, y: number, rect: NormalizedRect): number {
  const dx = Math.max(rect.x - x, 0, x - rect.x - rect.width);
  const dy = Math.max(rect.y - y, 0, y - rect.y - rect.height);
  return Math.hypot(dx, dy * 2.4);
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isLinkTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("a, button, input, [role='button']"));
}

function isPopoverTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-selection-popover], [data-highlight-popover]"))
  );
}

export class PdfSelectionController {
  readonly #container: HTMLElement;
  readonly #viewerElement: HTMLElement;
  readonly #viewer: PDFViewer;
  readonly #eventBus: EventBus;
  readonly #pdfDocument: PDFDocumentProxy;
  readonly #canCopy: boolean;
  readonly #onStatus: (status: SelectionStatus) => void;
  readonly #onSelectionChange?: (state: SelectionPopoverState) => void;
  readonly #onHighlightsChange?: (highlights: PdfHighlight[]) => void;
  readonly #onActiveHighlightClick?: (highlight: PdfHighlight | null, position?: { x: number; y: number }) => void;
  readonly #abortController = new AbortController();
  readonly #pageModels = new Map<number, PageTextModel>();
  readonly #pagePromises = new Map<number, Promise<PageTextModel>>();
  #highlights: PdfHighlight[] = [];
  #selection: SelectionRange | null = null;
  #drag: DragState | null = null;
  #rangeReady = true;
  #scrollFrame: number | null = null;
  #backgroundIndex = 1;

  constructor(options: ControllerOptions) {
    this.#container = options.container;
    this.#viewerElement = options.viewerElement;
    this.#viewer = options.viewer;
    this.#eventBus = options.eventBus;
    this.#pdfDocument = options.pdfDocument;
    this.#canCopy = options.canCopy;
    this.#onStatus = options.onStatus;
    this.#highlights = options.initialHighlights ? [...options.initialHighlights] : [];
    this.#onSelectionChange = options.onSelectionChange;
    this.#onHighlightsChange = options.onHighlightsChange;
    this.#onActiveHighlightClick = options.onActiveHighlightClick;

    const listenerOptions = { signal: this.#abortController.signal };
    this.#container.addEventListener("pointerdown", this.#handlePointerDown, listenerOptions);
    this.#container.addEventListener("dblclick", this.#handleDoubleClick, listenerOptions);
    window.addEventListener("keydown", this.#handleKeyDown, listenerOptions);
    window.addEventListener("pointermove", this.#handlePointerMove, listenerOptions);
    window.addEventListener("pointerup", this.#handlePointerUp, listenerOptions);
    window.addEventListener("pointercancel", this.#handlePointerCancel, listenerOptions);
    document.addEventListener("copy", this.#handleCopy, {
      capture: true,
      signal: this.#abortController.signal,
    });
    this.#eventBus.on("textlayerrendered", this.#handleTextLayerRendered);
    this.#eventBus.on("scalechanging", this.#handleScaleChanging);
  }

  startBackgroundIndexing(): void {
    const schedule = () => {
      if (this.#abortController.signal.aborted || this.#backgroundIndex > this.#pdfDocument.numPages) {
        return;
      }
      const pageNumber = this.#backgroundIndex++;
      void this.#ensurePage(pageNumber).finally(() => {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(schedule, { timeout: 800 });
        } else {
          globalThis.setTimeout(schedule, 16);
        }
      });
    };
    schedule();
  }

  dispose(): void {
    this.#stopAutoScroll();
    this.#abortController.abort();
    this.#eventBus.off("textlayerrendered", this.#handleTextLayerRendered);
    this.#eventBus.off("scalechanging", this.#handleScaleChanging);
    this.clear();
    this.#pageModels.clear();
    this.#pagePromises.clear();
  }

  clear(): void {
    this.#selection = null;
    this.#rangeReady = true;
    this.#viewerElement.querySelectorAll(".selectionLayer").forEach((layer) => layer.remove());
    this.#onSelectionChange?.(null);
    this.#onActiveHighlightClick?.(null);
    this.#onStatus({ kind: "idle" });
  }

  readonly #handleTextLayerRendered = ({ pageNumber, error }: TextLayerRenderedEvent) => {
    if (error) return;
    void this.#ensurePage(pageNumber).then((model) => {
      this.#calibratePage(model);
      this.#renderPage(pageNumber);
      this.#renderPageHighlights(pageNumber);
    });
  };

  readonly #handleScaleChanging = () => {
    window.requestAnimationFrame(() => {
      this.#renderSelection();
      this.#renderHighlights();
      this.#notifySelectionPopover();
    });
  };


  readonly #handlePointerDown = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      event.pointerType === "touch" ||
      isLinkTarget(event.target) ||
      isPopoverTarget(event.target)
    ) {
      return;
    }
    this.#onSelectionChange?.(null);

    // Resolve an existing highlight synchronously. Waiting for a page model here
    // can let a quick click reach pointerup before a drag has been initialized.
    const clickedHighlight = this.#findHighlightAtPoint(event.clientX, event.clientY);
    if (clickedHighlight) {
      event.preventDefault();
      this.clear();
      this.#onActiveHighlightClick?.(clickedHighlight, {
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }

    this.#onActiveHighlightClick?.(null);

    const pageNumber = this.#pageNumberAt(event.clientX, event.clientY);
    if (!pageNumber) return;

    event.preventDefault();
    this.#container.focus({ preventScroll: true });
    if (event.detail >= 2) {
      this.#drag = null;
    }

    void this.#ensurePage(pageNumber).then((model) => {
      if (this.#abortController.signal.aborted) return;
      this.#calibratePage(model);
      const position = this.#positionAt(model, event.clientX, event.clientY);
      if (!position) {
        this.clear();
        return;
      }

      if (event.detail >= 3) {
        this.#drag = null;
        this.#selectLine(position);
        return;
      }
      if (event.detail === 2) {
        this.#drag = null;
        this.#selectWord(position);
        return;
      }

      const anchor = event.shiftKey && this.#selection ? this.#selection.anchor : position;
      this.#selection = { anchor, focus: position };
      this.#drag = {
        pointerId: event.pointerId,
        anchor,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: event.shiftKey,
      };
      this.#renderSelection();
    });
  };

  readonly #handlePointerMove = (event: PointerEvent) => {
    const drag = this.#drag;
    if (!drag || drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) {
      return;
    }
    drag.moved = true;
    event.preventDefault();
    this.#updateDragAt(event.clientX, event.clientY);
    this.#startAutoScroll();
  };

  readonly #handleDoubleClick = (event: MouseEvent) => {
    if (isLinkTarget(event.target) || isPopoverTarget(event.target)) return;
    const pageNumber = this.#pageNumberAt(event.clientX, event.clientY);
    if (!pageNumber) return;

    event.preventDefault();
    this.#drag = null;
    this.#stopAutoScroll();
    this.#onActiveHighlightClick?.(null);
    void this.#ensurePage(pageNumber).then((model) => {
      if (this.#abortController.signal.aborted) return;
      this.#calibratePage(model);
      const position = this.#positionAt(model, event.clientX, event.clientY);
      if (position) this.#selectWord(position);
    });
  };

  readonly #handlePointerUp = (event: PointerEvent) => {
    if (event.detail >= 2) {
      this.#drag = null;
      this.#stopAutoScroll();
      return;
    }
    if (!this.#drag || this.#drag.pointerId !== event.pointerId) return;
    const moved = this.#drag.moved;
    this.#drag = null;
    this.#stopAutoScroll();
    if (!moved) {
      const clickedHighlight = this.#findHighlightAtPoint(event.clientX, event.clientY);
      if (clickedHighlight) {
        this.clear();
        this.#onActiveHighlightClick?.(clickedHighlight, {
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      this.clear();
      return;
    }
    void this.#prepareSelectedRange().then(() => {
      this.#notifySelectionPopover();
    });
  };

  readonly #handlePointerCancel = (event: PointerEvent) => {
    if (this.#drag?.pointerId !== event.pointerId) return;
    this.#drag = null;
    this.#stopAutoScroll();
  };

  readonly #handleKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.key === "Escape") {
      this.clear();
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key.toLowerCase() === "a") {
      event.preventDefault();
      void this.#selectAll();
      return;
    }
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      void this.copySelection();
      return;
    }
  };

  readonly #handleCopy = (event: ClipboardEvent) => {
    if (!this.#selection || isEditableTarget(document.activeElement)) return;
    event.preventDefault();
    if (!this.#canCopy) {
      this.#onStatus({ kind: "error", message: "Este PDF no permite copiar texto." });
      return;
    }
    if (!this.#rangeReady) {
      const first = Math.min(this.#selection.anchor.pageNumber, this.#selection.focus.pageNumber);
      const last = Math.max(this.#selection.anchor.pageNumber, this.#selection.focus.pageNumber);
      const allPagesReady = Array.from(
        { length: last - first + 1 },
        (_, index) => first + index,
      ).every((pageNumber) => this.#pageModels.has(pageNumber));
      if (allPagesReady) {
        this.#rangeReady = true;
      } else {
        this.#onStatus({ kind: "indexing", message: "Preparando texto para copiar…" });
        void this.#prepareSelectedRange();
        return;
      }
    }
    const [start, end] = this.#orderedSelection();
    const text = selectedText(start, end, this.#pageModels);
    event.clipboardData?.setData("text/plain", text);
    this.#onStatus({ kind: "idle" });
  };

  async #ensurePage(pageNumber: number): Promise<PageTextModel> {
    const cached = this.#pageModels.get(pageNumber);
    if (cached) return cached;
    const pending = this.#pagePromises.get(pageNumber);
    if (pending) return pending;

    const promise = this.#pdfDocument
      .getPage(pageNumber)
      .then((page: PDFPageProxy) => createPageTextModel(page, pageNumber))
      .then((model) => {
        if (!this.#abortController.signal.aborted) this.#pageModels.set(pageNumber, model);
        return model;
      })
      .finally(() => this.#pagePromises.delete(pageNumber));
    this.#pagePromises.set(pageNumber, promise);
    return promise;
  }

  async #ensurePageRange(first: number, last: number): Promise<void> {
    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      if (this.#abortController.signal.aborted) return;
      await this.#ensurePage(pageNumber);
    }
  }

  #pageElement(pageNumber: number): HTMLElement | null {
    return this.#viewerElement.querySelector<HTMLElement>(`.page[data-page-number="${pageNumber}"]`);
  }

  #pageNumberAt(clientX: number, clientY: number): number | null {
    const direct = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".page");
    if (direct?.dataset.pageNumber) return Number(direct.dataset.pageNumber);

    let closest: { pageNumber: number; distance: number } | null = null;
    for (const page of this.#viewerElement.querySelectorAll<HTMLElement>(".page")) {
      const rect = page.getBoundingClientRect();
      const distance = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      if (clientX < rect.left - 80 || clientX > rect.right + 80) continue;
      if (!closest || distance < closest.distance) {
        closest = { pageNumber: Number(page.dataset.pageNumber), distance };
      }
    }
    return closest?.pageNumber ?? null;
  }

  #positionAt(model: PageTextModel, clientX: number, clientY: number): SelectionPosition | null {
    const page = this.#pageElement(model.pageNumber);
    if (!page || !model.runs.length) return null;
    const bounds = page.getBoundingClientRect();
    const x = clamp((clientX - bounds.left) / bounds.width, 0, 1);
    const y = clamp((clientY - bounds.top) / bounds.height, 0, 1);
    let best = model.runs[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const run of model.runs) {
      const distance = distanceToRect(x, y, run.rect);
      if (distance < bestDistance) {
        best = run;
        bestDistance = distance;
      }
    }
    const progress = clamp((x - best.rect.x) / Math.max(best.rect.width, 0.0001), 0, 1);
    return {
      pageNumber: model.pageNumber,
      runId: best.id,
      offset: Math.round(progress * best.graphemes.length),
    };
  }

  #updateDragAt(clientX: number, clientY: number): void {
    const drag = this.#drag;
    const pageNumber = this.#pageNumberAt(clientX, clientY);
    if (!drag || !pageNumber) return;
    void this.#ensurePage(pageNumber).then((model) => {
      if (!this.#drag || this.#drag.pointerId !== drag.pointerId) return;
      const focus = this.#positionAt(model, clientX, clientY);
      if (!focus) return;
      this.#selection = { anchor: drag.anchor, focus };
      this.#rangeReady = false;
      this.#renderSelection();
    });
  }

  #selectWord(position: SelectionPosition): void {
    const model = this.#pageModels.get(position.pageNumber);
    const run = model?.runs[position.runId];
    if (!model || !run) return;
    const codeUnitOffset = run.graphemeOffsets[position.offset] ?? run.text.length;
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    const segments = Array.from(segmenter.segment(run.text));
    const word =
      segments.find(
        (segment) =>
          segment.isWordLike &&
          codeUnitOffset >= segment.index &&
          codeUnitOffset <= segment.index + segment.segment.length,
      ) ?? segments.find((segment) => segment.isWordLike);
    if (!word) return;
    const startOffset = run.graphemeOffsets.findIndex((offset) => offset >= word.index);
    const endCodeUnit = word.index + word.segment.length;
    const endOffset = run.graphemeOffsets.findIndex((offset) => offset >= endCodeUnit);
    this.#selection = {
      anchor: { ...position, offset: Math.max(0, startOffset) },
      focus: {
        ...position,
        offset: endOffset < 0 ? run.graphemes.length : endOffset,
      },
    };
    this.#rangeReady = true;
    this.#renderSelection();
    window.requestAnimationFrame(() => this.#notifySelectionPopover());
  }

  #selectLine(position: SelectionPosition): void {
    const model = this.#pageModels.get(position.pageNumber);
    const run = model?.runs[position.runId];
    const line = model?.lines.find((candidate) => candidate.id === run?.lineId);
    if (!model || !line || !line.runIds.length) return;
    const lineRuns = line.runIds.map((id) => model.runs[id]).sort((a, b) => a.order - b.order);
    const first = lineRuns[0];
    const last = lineRuns.at(-1)!;
    this.#selection = {
      anchor: { pageNumber: model.pageNumber, runId: first.id, offset: 0 },
      focus: {
        pageNumber: model.pageNumber,
        runId: last.id,
        offset: last.graphemes.length,
      },
    };
    this.#rangeReady = true;
    this.#renderSelection();
    window.requestAnimationFrame(() => this.#notifySelectionPopover());
  }

  async #selectAll(): Promise<void> {
    this.#onStatus({ kind: "indexing", message: "Preparando selección completa…" });
    await this.#ensurePageRange(1, this.#pdfDocument.numPages);
    const firstPage = Array.from(this.#pageModels.values())
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .find((page) => page.orderedRuns.length);
    const lastPage = Array.from(this.#pageModels.values())
      .sort((a, b) => b.pageNumber - a.pageNumber)
      .find((page) => page.orderedRuns.length);
    if (!firstPage || !lastPage) {
      this.clear();
      return;
    }
    const first = firstPage.orderedRuns[0];
    const last = lastPage.orderedRuns.at(-1)!;
    this.#selection = {
      anchor: { pageNumber: firstPage.pageNumber, runId: first.id, offset: 0 },
      focus: {
        pageNumber: lastPage.pageNumber,
        runId: last.id,
        offset: last.graphemes.length,
      },
    };
    this.#rangeReady = true;
    this.#onStatus({ kind: "idle" });
    this.#renderSelection();
    window.requestAnimationFrame(() => this.#notifySelectionPopover());
  }

  async #prepareSelectedRange(): Promise<void> {
    if (!this.#selection) return;
    const first = Math.min(this.#selection.anchor.pageNumber, this.#selection.focus.pageNumber);
    const last = Math.max(this.#selection.anchor.pageNumber, this.#selection.focus.pageNumber);
    this.#rangeReady = false;
    this.#onStatus({ kind: "indexing", message: "Preparando texto seleccionado…" });
    await this.#ensurePageRange(first, last);
    if (this.#abortController.signal.aborted) return;
    this.#rangeReady = true;
    this.#onStatus({ kind: "idle" });
  }

  #orderedSelection(): [SelectionPosition, SelectionPosition] {
    const selection = this.#selection!;
    return comparePositions(selection.anchor, selection.focus, this.#pageModels) <= 0
      ? [selection.anchor, selection.focus]
      : [selection.focus, selection.anchor];
  }

  #calibratePage(model: PageTextModel): void {
    const page = this.#pageElement(model.pageNumber);
    const textLayer = page?.querySelector<HTMLElement>(".textLayer");
    if (!page || !textLayer) return;
    const pageBounds = page.getBoundingClientRect();
    const spans = Array.from(textLayer.querySelectorAll<HTMLElement>("span")).filter(
      (span) => span.getAttribute("role") !== "img" && Boolean(span.textContent),
    );
    let runCursor = 0;
    for (const span of spans) {
      const text = span.textContent ?? "";
      let match = -1;
      for (let index = runCursor; index < Math.min(model.runs.length, runCursor + 8); index++) {
        if (model.runs[index].text === text) {
          match = index;
          break;
        }
      }
      if (match < 0) continue;
      const run = model.runs[match];
      const bounds = span.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        run.rect = {
          x: (bounds.left - pageBounds.left) / pageBounds.width,
          y: (bounds.top - pageBounds.top) / pageBounds.height,
          width: bounds.width / pageBounds.width,
          height: bounds.height / pageBounds.height,
        };
      }
      span.dataset.selectionRun = String(run.id);
      runCursor = match + 1;
    }
  }

  #renderSelection(): void {
    for (const page of this.#viewerElement.querySelectorAll<HTMLElement>(".page")) {
      this.#renderPage(Number(page.dataset.pageNumber));
    }
  }

  #renderPage(pageNumber: number): void {
    const page = this.#pageElement(pageNumber);
    const model = this.#pageModels.get(pageNumber);
    page?.querySelector(".selectionLayer")?.remove();
    if (!page || !model || !this.#selection) return;
    const [start, end] = this.#orderedSelection();
    if (pageNumber < start.pageNumber || pageNumber > end.pageNumber) return;

    const selectedRects = computeRangeRects(start, end, pageNumber, model);
    if (!selectedRects.length) return;

    const layer = document.createElement("div");
    layer.className = "selectionLayer";
    layer.setAttribute("aria-hidden", "true");
    for (const rect of selectedRects) {
      const highlight = document.createElement("div");
      highlight.className = "selectionHighlight";
      Object.assign(highlight.style, {
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      });
      layer.append(highlight);
    }
    page.append(layer);
  }

  #renderHighlights(): void {
    for (const page of this.#viewerElement.querySelectorAll<HTMLElement>(".page")) {
      this.#renderPageHighlights(Number(page.dataset.pageNumber));
    }
  }

  #renderPageHighlights(pageNumber: number): void {
    const page = this.#pageElement(pageNumber);
    const model = this.#pageModels.get(pageNumber);
    page?.querySelector(".pdfHighlightLayer")?.remove();
    if (!page || !model) return;

    const pageHighlights = this.#highlights.filter((h) => {
      const [start, end] =
        comparePositions(h.range.anchor, h.range.focus, this.#pageModels) <= 0
          ? [h.range.anchor, h.range.focus]
          : [h.range.focus, h.range.anchor];
      return pageNumber >= start.pageNumber && pageNumber <= end.pageNumber;
    });

    if (!pageHighlights.length) return;

    const layer = document.createElement("div");
    layer.className = "pdfHighlightLayer";
    layer.setAttribute("aria-hidden", "true");

    for (const highlight of pageHighlights) {
      const [start, end] =
        comparePositions(highlight.range.anchor, highlight.range.focus, this.#pageModels) <= 0
          ? [highlight.range.anchor, highlight.range.focus]
          : [highlight.range.focus, highlight.range.anchor];
      const rects = computeRangeRects(start, end, pageNumber, model);

      for (const rect of rects) {
        const el = document.createElement("div");
        el.className = "pdfHighlight";
        el.dataset.highlightId = highlight.id;
        Object.assign(el.style, {
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
        });
        layer.append(el);
      }
    }
    page.append(layer);
  }

  #findHighlightAtPoint(clientX: number, clientY: number): PdfHighlight | null {
    if (typeof document !== "undefined" && typeof document.elementsFromPoint === "function") {
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        if (el instanceof HTMLElement && el.classList.contains("pdfHighlight")) {
          const id = el.dataset.highlightId;
          const match = this.#highlights.find((h) => h.id === id);
          if (match) return match;
        }
      }
    }

    const pageNumber = this.#pageNumberAt(clientX, clientY);
    if (!pageNumber) return null;
    const model = this.#pageModels.get(pageNumber);
    if (!model) return null;
    const position = this.#positionAt(model, clientX, clientY);
    if (!position) return null;

    for (const highlight of this.#highlights) {
      const [start, end] =
        comparePositions(highlight.range.anchor, highlight.range.focus, this.#pageModels) <= 0
          ? [highlight.range.anchor, highlight.range.focus]
          : [highlight.range.focus, highlight.range.anchor];
      if (
        comparePositions(start, position, this.#pageModels) <= 0 &&
        comparePositions(position, end, this.#pageModels) <= 0
      ) {
        return highlight;
      }
    }
    return null;
  }

  #calculatePopoverPosition(): { x: number; y: number; placement: "top" | "bottom" } | null {
    const highlightEls = Array.from(
      this.#viewerElement.querySelectorAll<HTMLElement>(".selectionHighlight"),
    );
    if (!highlightEls.length) return null;

    const containerRect = this.#container.getBoundingClientRect();
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const el of highlightEls) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) continue;
      if (rect.left < minX) minX = rect.left;
      if (rect.right > maxX) maxX = rect.right;
      if (rect.top < minY) minY = rect.top;
      if (rect.bottom > maxY) maxY = rect.bottom;
    }

    if (!Number.isFinite(minX)) return null;

    const centerX = (minX + maxX) / 2;
    const topSpace = minY - containerRect.top;
    const placement: "top" | "bottom" = topSpace >= 54 ? "top" : "bottom";

    const popoverX = centerX - containerRect.left + this.#container.scrollLeft;
    const popoverY =
      placement === "top"
        ? minY - containerRect.top + this.#container.scrollTop
        : maxY - containerRect.top + this.#container.scrollTop;

    return {
      x: Math.round(popoverX),
      y: Math.round(popoverY),
      placement,
    };
  }

  #notifySelectionPopover(): void {
    if (!this.#selection || !this.#onSelectionChange) return;
    const [start, end] = this.#orderedSelection();
    const text = selectedText(start, end, this.#pageModels);
    if (!text || !text.trim()) {
      this.#onSelectionChange(null);
      return;
    }
    const position = this.#calculatePopoverPosition();
    if (!position) {
      this.#onSelectionChange(null);
      return;
    }
    this.#onSelectionChange({
      range: this.#selection,
      text,
      position,
    });
  }

  async copySelection(): Promise<boolean> {
    if (!this.#selection || !this.#canCopy) return false;
    const [start, end] = this.#orderedSelection();
    const text = selectedText(start, end, this.#pageModels);
    if (!text) return false;

    if (typeof window !== "undefined") {
      (window as unknown as { __copiedPdfText?: string }).__copiedPdfText = text;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Fallback
    }

    try {
      document.execCommand("copy");
    } catch {
      // Fallback
    }

    this.#onStatus({ kind: "idle" });
    return true;
  }

  getSelectedText(): string {
    if (!this.#selection) return "";
    const [start, end] = this.#orderedSelection();
    return selectedText(start, end, this.#pageModels);
  }

  highlightSelection(color: string = "yellow"): PdfHighlight | null {
    if (!this.#selection) return null;
    const [start, end] = this.#orderedSelection();
    const text = selectedText(start, end, this.#pageModels);
    if (!text || !text.trim()) return null;

    const highlight: PdfHighlight = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      range: { anchor: start, focus: end },
      text,
      color,
      createdAt: Date.now(),
    };

    this.#highlights.push(highlight);
    this.#onHighlightsChange?.(this.#highlights);
    this.clear();
    this.#renderHighlights();
    return highlight;
  }

  removeHighlight(id: string): void {
    this.#highlights = this.#highlights.filter((h) => h.id !== id);
    this.#onHighlightsChange?.(this.#highlights);
    this.#renderHighlights();
  }

  setHighlights(highlights: PdfHighlight[]): void {
    this.#highlights = [...highlights];
    this.#renderHighlights();
  }

  #startAutoScroll(): void {
    if (this.#scrollFrame !== null) return;
    const tick = () => {
      const drag = this.#drag;
      if (!drag) {
        this.#scrollFrame = null;
        return;
      }
      const bounds = this.#container.getBoundingClientRect();
      let speed = 0;
      if (drag.clientY < bounds.top + EDGE_SCROLL_ZONE) {
        speed = -MAX_SCROLL_SPEED * (1 - (drag.clientY - bounds.top) / EDGE_SCROLL_ZONE);
      } else if (drag.clientY > bounds.bottom - EDGE_SCROLL_ZONE) {
        speed = MAX_SCROLL_SPEED * (1 - (bounds.bottom - drag.clientY) / EDGE_SCROLL_ZONE);
      }
      if (speed) {
        this.#container.scrollTop += speed;
        this.#updateDragAt(drag.clientX, drag.clientY);
      }
      this.#scrollFrame = window.requestAnimationFrame(tick);
    };
    this.#scrollFrame = window.requestAnimationFrame(tick);
  }

  #stopAutoScroll(): void {
    if (this.#scrollFrame !== null) window.cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = null;
  }
}
