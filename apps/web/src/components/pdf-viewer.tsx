"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer as PDFViewerController,
} from "pdfjs-dist/web/pdf_viewer.mjs";

import type { ImportedPdf } from "@/lib/pdf-import";
import { loadPdfJs } from "@/lib/pdfjs";
import { withViewTransition } from "@/lib/utils";
import { PdfSearchIndex } from "@/lib/pdf-search";
import type { PdfSelectionController } from "@/lib/pdf-selection/controller";
import { DEFAULT_HIGHLIGHT_COLOR } from "@/lib/pdf-selection/types";
import type {
  ActiveHighlightPopoverState,
  PdfHighlight,
  SelectionPopoverState,
  SelectionStatus,
} from "@/lib/pdf-selection/types";
import { HighlightPopover } from "./highlight-popover";
import { Icon } from "./icon";
import { PdfAnnotations, PdfDates } from "./pdf-panels";
import { SelectionPopover } from "./selection-popover";

import styles from "./pdf-viewer.module.css";

const RANGE_CHUNK_SIZE = 64 * 1024;
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.25;

type ViewerSession = {
  dispose: () => void;
  eventBus: EventBus;
  findController: PDFFindController;
  linkService: PDFLinkService;
  searchIndex: PdfSearchIndex;
  selectionController: PdfSelectionController;
  viewer: PDFViewerController;
};
type PageChangingEvent = { pageNumber: number };
type ScaleChangingEvent = { scale: number; presetValue?: string };

export type PdfViewState = {
  highlights: PdfHighlight[];
  currentPage: number;
  /** Zoom manual; sin él la página se ajusta al ancho. */
  scale?: number;
  pageCount?: number;
  openedAt?: number;
};
export type PanelTab = "anot" | "fechas";
/** Petición de mostrar un punto del documento; `nonce` permite repetirla. */
export type PdfReveal = { pageNumber: number; verticalRatio: number; nonce: number };

export function PdfViewer({ importedPdf, name, initialState, onStateChange, highlightColor, searchQuery = "", reveal, panel, onShowAnnotations }: {
  importedPdf: ImportedPdf;
  name: string;
  initialState?: Partial<PdfViewState>;
  /** Recibe solo los campos que cambiaron. */
  onStateChange?: (patch: Partial<PdfViewState>) => void;
  highlightColor?: string;
  searchQuery?: string;
  reveal?: PdfReveal | null;
  /** Destino del panel derecho cuando este visor es el panel activo. */
  panel?: { target: HTMLElement; tab: PanelTab } | null;
  onShowAnnotations?: () => void;
}) {
  const pageInputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerElementRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ViewerSession | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialState?.currentPage ?? 1);
  const [scale, setScale] = useState(initialState?.scale ?? DEFAULT_SCALE);
  const [error, setError] = useState<string | null>(null);
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus>({ kind: "idle" });
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState>(null);
  const [highlightPopover, setHighlightPopover] = useState<ActiveHighlightPopoverState>(null);
  const [highlights, setHighlights] = useState<PdfHighlight[]>(initialState?.highlights ?? []);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [, setSearchRevision] = useState(0);
  const searchIndexRef = useRef<PdfSearchIndex | null>(null);
  const initialStateRef = useRef(initialState);
  const highlightColorRef = useRef(highlightColor ?? DEFAULT_HIGHLIGHT_COLOR);
  highlightColorRef.current = highlightColor ?? DEFAULT_HIGHLIGHT_COLOR;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  const saveViewState = useCallback((patch: Partial<PdfViewState>) => {
    onStateChangeRef.current?.(patch);
  }, []);

  /** Lleva la página al centro del panel, a la altura relativa indicada. */
  const scrollTo = useCallback((pageNumber: number, verticalRatio = 0.5) => {
    const session = sessionRef.current;
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!session || !container || !viewerElement) return;
    session.viewer.currentPageNumber = pageNumber;
    let attempts = 0;
    const center = () => {
      const page = viewerElement.querySelector<HTMLElement>(`.page[data-page-number="${pageNumber}"]`);
      if (!page) {
        if (attempts++ < 30) window.requestAnimationFrame(center);
        return;
      }
      const y = page.offsetTop + page.offsetHeight * verticalRatio;
      container.scrollTo({ top: Math.max(0, y - container.clientHeight / 2), behavior: "smooth" });
    };
    window.requestAnimationFrame(center);
  }, []);

  const find = useCallback((query: string) => {
    sessionRef.current?.eventBus.dispatch("find", {
      query,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: true,
      highlightAll: Boolean(query),
      findPrevious: false,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!container || !viewerElement) return;

    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let transport: { abort: () => void } | null = null;
    let openingPhase: "modules" | "document" | "viewer" = "modules";
    const viewerAbortController = new AbortController();

    const startSession = async () => {
      // PDF.js 6 expone `pdfjsLib` al evaluar el módulo principal. Su capa web
      // lo consume durante su propia evaluación, por lo que el orden importa.
      const pdfjs = await loadPdfJs();
      const viewerModule = await import("pdfjs-dist/web/pdf_viewer.mjs");
      const { PdfSelectionController } = await import("@/lib/pdf-selection/controller");
      if (!active) return;
      openingPhase = "document";

      const initialData = new Uint8Array(
        await importedPdf.file.slice(0, RANGE_CHUNK_SIZE).arrayBuffer(),
      );
      if (!active) return;

      let rangeRequestsCancelled = false;
      class LocalFileRangeTransport extends pdfjs.PDFDataRangeTransport {
        requestDataRange(begin: number, end: number) {
          void importedPdf.file.slice(begin, end).arrayBuffer().then((buffer) => {
            if (!rangeRequestsCancelled) this.onDataRange(begin, new Uint8Array(buffer));
          });
        }

        abort() {
          rangeRequestsCancelled = true;
          super.abort();
        }
      }

      const localTransport = new LocalFileRangeTransport(
        importedPdf.file.size,
        initialData,
        true,
        importedPdf.file.name,
      );
      transport = localTransport;
      loadingTask = pdfjs.getDocument({
        range: localTransport,
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: RANGE_CHUNK_SIZE,
        useWorkerFetch: false,
      });
      const pdfDocument = await loadingTask.promise;
      if (!active) {
        await loadingTask.destroy();
        return;
      }
      openingPhase = "viewer";
      const searchIndex = new PdfSearchIndex(pdfDocument, () => {
        if (!active) return;
        setSearchRevision((revision) => revision + 1);
      });
      searchIndexRef.current = searchIndex;

      const eventBus = new viewerModule.EventBus();
      const linkService = new viewerModule.PDFLinkService({
        eventBus,
        externalLinkTarget: viewerModule.LinkTarget.BLANK,
        externalLinkRel: "noopener noreferrer nofollow",
      });
      const findController = new viewerModule.PDFFindController({ eventBus, linkService });
      const viewerOptions: ConstructorParameters<typeof viewerModule.PDFViewer>[0] & {
        abortSignal: AbortSignal;
      } = {
        container,
        viewer: viewerElement,
        eventBus,
        linkService,
        findController,
        annotationMode: pdfjs.AnnotationMode.ENABLE,
        annotationEditorMode: pdfjs.AnnotationEditorType.NONE,
        enablePermissions: true,
        enableSelectionRendering: false,
        enableDetailCanvas: true,
        imagesRightClickMinSize: -1,
        abortSignal: viewerAbortController.signal,
      };
      const viewer = new viewerModule.PDFViewer(viewerOptions);

      const handlePagesInit = () => {
        viewer.currentPageNumber = initialStateRef.current?.currentPage ?? 1;
        // Sin zoom propio, la página se ajusta al ancho del panel.
        if (initialStateRef.current?.scale) viewer.currentScale = initialStateRef.current.scale;
        else viewer.currentScaleValue = "page-width";
        setPageCount(viewer.pagesCount);
        setCurrentPage(viewer.currentPageNumber);
        setScale(viewer.currentScale);
        saveViewState({ pageCount: viewer.pagesCount, openedAt: Date.now() });
        if (searchQueryRef.current) find(searchQueryRef.current);
        const pending = revealRef.current;
        if (pending) scrollTo(pending.pageNumber, pending.verticalRatio);
      };
      const handlePageChanging = ({ pageNumber }: PageChangingEvent) => { setCurrentPage(pageNumber); saveViewState({ currentPage: pageNumber }); };
      const handleScaleChanging = ({ scale: nextScale, presetValue }: ScaleChangingEvent) => {
        setScale(nextScale);
        if (!presetValue) saveViewState({ scale: nextScale });
      };
      // Reajusta el ancho cuando el panel cambia de tamaño, salvo con zoom manual.
      const resizeObserver = new ResizeObserver(() => {
        if (viewer.currentScaleValue === "page-width") viewer.currentScaleValue = "page-width";
      });
      resizeObserver.observe(container);
      eventBus.on("pagesinit", handlePagesInit);
      eventBus.on("pagechanging", handlePageChanging);
      eventBus.on("scalechanging", handleScaleChanging);

      const permissions = await pdfDocument.getPermissions();
      const storageKey = `seabell_highlights_${importedPdf.file.name}_${importedPdf.file.size}`;
      let initialHighlights: PdfHighlight[] = initialStateRef.current?.highlights ?? [];
      try {
        if (!initialStateRef.current?.highlights) {
          const stored = localStorage.getItem(storageKey);
          if (stored) initialHighlights = JSON.parse(stored) as PdfHighlight[];
        }
      } catch {
        // Ignore storage errors
      }
      setHighlights(initialHighlights);

      const selectionController = new PdfSelectionController({
        container,
        viewerElement,
        viewer,
        eventBus,
        pdfDocument,
        canCopy: !permissions || permissions.has(pdfjs.PermissionFlag.COPY),
        onStatus: setSelectionStatus,
        initialHighlights,
        onSelectionChange: setSelectionPopover,
        onHighlightsChange: (nextHighlights) => {
          setHighlights(nextHighlights);
          saveViewState({ highlights: nextHighlights });
          try {
            localStorage.setItem(storageKey, JSON.stringify(nextHighlights));
          } catch {
            // Ignore storage errors
          }
        },
        onActiveHighlightClick: (highlight, position) => {
          if (highlight && position) {
            const containerRect = container.getBoundingClientRect();
            const x = Math.round(position.x - containerRect.left + container.scrollLeft);
            const y = Math.round(position.y - containerRect.top + container.scrollTop);
            setHighlightPopover({ highlight, position: { x, y } });
          } else {
            setHighlightPopover(null);
          }
        },
      });

      linkService.setViewer(viewer);
      linkService.setDocument(pdfDocument);
      findController.setDocument(pdfDocument);
      viewer.setDocument(pdfDocument);
      sessionRef.current = {
        dispose: () => {
          resizeObserver.disconnect();
          eventBus.off("pagesinit", handlePagesInit);
          eventBus.off("pagechanging", handlePageChanging);
          eventBus.off("scalechanging", handleScaleChanging);
        },
        eventBus,
        findController,
        linkService,
        searchIndex,
        selectionController,
        viewer,
      };
      selectionController.startBackgroundIndexing();
      searchIndex.start();
    };

    void startSession().catch((cause: unknown) => {
      if (!active) return;
      console.error(`No se pudo abrir el visor PDF durante la fase ${openingPhase}.`, cause);
      if (cause instanceof Error && cause.name === "PasswordException") {
        setError("Este PDF está protegido con contraseña.");
      } else if (openingPhase === "modules") {
        setError("El visor se actualizó. Recarga la página y vuelve a abrir el PDF.");
      } else if (openingPhase === "document") {
        setError("No se pudo interpretar este PDF.");
      } else {
        setError("No se pudo iniciar el visor PDF.");
      }
    });

    return () => {
      active = false;
      viewerAbortController.abort();
      transport?.abort();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) {
        session.selectionController.dispose();
        session.searchIndex.dispose();
        session.dispose();
        session.viewer.setDocument(null as never);
        session.findController.setDocument(null as never);
        session.linkService.setDocument(null);
        session.viewer.cleanup();
      }
      searchIndexRef.current = null;
      if (loadingTask) void loadingTask.destroy();
      viewerElement.replaceChildren();
    };
  }, [importedPdf, saveViewState, scrollTo, find]);

  useEffect(() => { find(searchQuery); }, [searchQuery, find]);
  useEffect(() => { if (reveal) scrollTo(reveal.pageNumber, reveal.verticalRatio); }, [reveal, scrollTo]);

  const goToPage = useCallback((requestedPage: number) => {
    const viewer = sessionRef.current?.viewer;
    if (!viewer || !Number.isFinite(requestedPage)) return;
    viewer.currentPageNumber = Math.max(1, Math.min(requestedPage, viewer.pagesCount));
  }, []);

  const changeScale = useCallback((delta: number) => {
    const viewer = sessionRef.current?.viewer;
    if (!viewer) return;
    viewer.currentScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.round((viewer.currentScale + delta) * 100) / 100),
    );
  }, []);

  const openHighlight = useCallback((highlight: PdfHighlight) => {
    setHighlightPopover(null);
    scrollTo(Math.min(highlight.range.anchor.pageNumber, highlight.range.focus.pageNumber));
  }, [scrollTo]);

  const removeHighlight = useCallback((id: string) => withViewTransition(() => {
    sessionRef.current?.selectionController.removeHighlight(id);
    setHighlightPopover(null);
  }), []);

  const searchIndex = searchIndexRef.current;

  return (
    <div className="relative h-full min-h-0 bg-surface-3">
      {error ? <p className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center text-destructive" role="alert">{error}</p> : !pageCount && <p className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center text-ink-3" role="status">Preparando PDF…</p>}
      {selectionStatus.kind !== "idle" && (
        <p
          className={`pointer-events-none absolute bottom-14 right-3 z-20 rounded-[3px] bg-paper px-3 py-2 text-xs shadow-[0_0_0_1px_var(--line)] ${selectionStatus.kind === "error" ? "text-destructive" : "text-ink-3"}`}
          role={selectionStatus.kind === "error" ? "alert" : "status"}
        >
          {selectionStatus.message}
        </p>
      )}
      <div ref={containerRef} className={`${styles.container} absolute inset-0 overflow-auto outline-none`} aria-label="Documento PDF" tabIndex={0}>
        <div ref={viewerElementRef} className={`${styles.viewer} pdfViewer`} />
        {selectionPopover && (
          <SelectionPopover
            state={selectionPopover}
            onCopy={async () => await sessionRef.current?.selectionController.copySelection() ?? false}
            onHighlight={() => {
              sessionRef.current?.selectionController.highlightSelection(highlightColorRef.current);
              setSelectionPopover(null);
            }}
            onNote={() => {
              const highlight = sessionRef.current?.selectionController.highlightSelection(highlightColorRef.current);
              setSelectionPopover(null);
              if (!highlight) return;
              setEditingNote(highlight.id);
              onShowAnnotations?.();
            }}
          />
        )}
        {highlightPopover && (
          <HighlightPopover
            state={highlightPopover}
            onCopy={copyText}
            onRemove={removeHighlight}
            onClose={() => setHighlightPopover(null)}
          />
        )}
      </div>

      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[3px] bg-paper p-0.5 font-mono text-[11px] text-ink-3 shadow-[0_0_0_1px_var(--line),0_8px_24px_-12px_rgb(21_23_26/35%)]">
        <button type="button" className="ib" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Página anterior"><Icon name="back" /></button>
        <label className="sr-only" htmlFor={pageInputId}>Página</label>
        <input id={pageInputId} className="h-6 w-9 rounded-[3px] bg-surface-2 text-center text-ink tabular-nums outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--ink)]" type="number" min="1" max={pageCount ?? undefined} value={currentPage} onChange={(event) => goToPage(Number(event.target.value))} />
        <span className="px-1 whitespace-nowrap tabular-nums">/ {pageCount ?? "…"}</span>
        <button type="button" className="ib" onClick={() => goToPage(currentPage + 1)} disabled={!pageCount || currentPage >= pageCount} aria-label="Página siguiente"><Icon name="chevron" /></button>
        <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />
        <button type="button" className="ib" onClick={() => changeScale(-SCALE_STEP)} disabled={!pageCount || scale <= MIN_SCALE} aria-label="Alejar"><Icon name="minus" /></button>
        <span className="w-9 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" className="ib" onClick={() => changeScale(SCALE_STEP)} disabled={!pageCount || scale >= MAX_SCALE} aria-label="Acercar"><Icon name="plus" /></button>
      </div>

      {panel && createPortal(
        panel.tab === "anot"
          ? <PdfAnnotations
              title={name}
              highlights={highlights}
              editingId={editingNote}
              onEdit={setEditingNote}
              onOpen={openHighlight}
              onRemove={removeHighlight}
              onNote={(id, note) => sessionRef.current?.selectionController.setHighlightNote(id, note)}
            />
          : <PdfDates
              searchIndex={searchIndex}
              indexedPages={searchIndex?.indexedPageCount ?? 0}
              pageCount={searchIndex?.pageCount ?? pageCount ?? 0}
              onOpen={(entry) => scrollTo(entry.pageNumber, entry.verticalRatio)}
            />,
        panel.target,
      )}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // WebKit puede negar el portapapeles asíncrono; se recurre a execCommand.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  textarea.remove();
  return success;
}
