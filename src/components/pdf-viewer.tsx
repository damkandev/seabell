"use client";

import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Highlighter, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer as PDFViewerController,
} from "pdfjs-dist/web/pdf_viewer.mjs";

import { Button } from "@/components/ui/button";
import type { ImportedPdf } from "@/lib/pdf-import";
import type { LawReference } from "@/lib/law-references";
import { PdfSearchIndex, type PdfSearchResult } from "@/lib/pdf-search";
import type { PdfSelectionController } from "@/lib/pdf-selection/controller";
import type {
  ActiveHighlightPopoverState,
  PdfHighlight,
  SelectionPopoverState,
  SelectionStatus,
} from "@/lib/pdf-selection/types";
import { HighlightPopover } from "./highlight-popover";
import { PdfHighlightsPanel } from "./pdf-highlights-panel";
import { PdfLawsPanel } from "./pdf-laws-panel";
import { PdfSearchPanel } from "./pdf-search-panel";
import { PdfTimelinePanel } from "./pdf-timeline-panel";
import { SelectionPopover } from "./selection-popover";

import styles from "./pdf-viewer.module.css";

const RANGE_CHUNK_SIZE = 64 * 1024;
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.25;

type PdfJs = typeof import("pdfjs-dist");
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
type ScaleChangingEvent = { scale: number };
type TextLayerRenderedEvent = { pageNumber: number };

export function PdfViewer({ importedPdf }: { importedPdf: ImportedPdf }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerElementRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ViewerSession | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [error, setError] = useState<string | null>(null);
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus>({ kind: "idle" });
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState>(null);
  const [highlightPopover, setHighlightPopover] = useState<ActiveHighlightPopoverState>(null);
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [lawsOpen, setLawsOpen] = useState(false);
  const [lawReferences, setLawReferences] = useState<LawReference[]>([]);
  const [activeLawReference, setActiveLawReference] = useState<LawReference | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setSearchRevision] = useState(0);
  const searchIndexRef = useRef<PdfSearchIndex | null>(null);
  const lawReferencesRef = useRef<LawReference[]>([]);
  // Background indexing schedules a render whenever more pages become searchable.
  const searchResults = searchIndexRef.current?.search(searchQuery) ?? [];

  useEffect(() => {
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!container || !viewerElement) return;

    setHighlights([]);
    setHighlightsOpen(false);
    setLawReferences([]);
    lawReferencesRef.current = [];
    setActiveLawReference(null);

    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let transport: { abort: () => void } | null = null;
    let openingPhase: "modules" | "document" | "viewer" = "modules";
    const viewerAbortController = new AbortController();

    const startSession = async () => {
      // PDF.js 6 expone `pdfjsLib` al evaluar el módulo principal. Su capa web
      // lo consume durante su propia evaluación, por lo que el orden importa
      // especialmente con el runtime de desarrollo de Turbopack.
      const pdfjs = (await import("pdfjs-dist")) as PdfJs;
      const viewerModule = await import("pdfjs-dist/web/pdf_viewer.mjs");
      const { PdfSelectionController } = await import("@/lib/pdf-selection/controller");
      if (!active) return;
      openingPhase = "document";

      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
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
      let decorateLawReferences: (pageNumber: number) => void = () => {};
      const searchIndex = new PdfSearchIndex(pdfDocument, () => {
        if (!active) return;
        setSearchRevision((revision) => revision + 1);
        const references = searchIndex.getLawReferences();
        lawReferencesRef.current = references;
        setLawReferences(references);
        for (const reference of references) decorateLawReferences(reference.pageNumber);
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
        viewer.currentScale = DEFAULT_SCALE;
        setPageCount(viewer.pagesCount);
        setCurrentPage(viewer.currentPageNumber);
        setScale(viewer.currentScale);
      };
      const handlePageChanging = ({ pageNumber }: PageChangingEvent) => setCurrentPage(pageNumber);
      const handleScaleChanging = ({ scale: nextScale }: ScaleChangingEvent) => setScale(nextScale);
      decorateLawReferences = (pageNumber) => {
        const indexedPage = searchIndex.getPageText(pageNumber);
        const page = viewerElement.querySelector<HTMLElement>(`.page[data-page-number="${pageNumber}"]`);
        if (!indexedPage || !page) return;
        const references = lawReferencesRef.current.filter((reference) => reference.pageNumber === pageNumber);
        if (!references.length) return;

        page.querySelector(".pdfLawLinks")?.remove();
        const sourceSpans = [...page.querySelectorAll<HTMLSpanElement>(".textLayer > span")];
        const layer = document.createElement("div");
        layer.className = "pdfLawLinks";
        layer.setAttribute("aria-label", "Leyes citadas");
        const pageRect = page.getBoundingClientRect();
        indexedPage.sourcePositions.forEach((position, index) => {
          const span = sourceSpans[index];
          const textNode = span?.firstChild;
          if (!span || !textNode || textNode.nodeType !== Node.TEXT_NODE) return;
          for (const reference of references) {
            const start = Math.max(reference.start, position.start);
            const end = Math.min(reference.end, position.end);
            if (start >= end) continue;
            const range = document.createRange();
            range.setStart(textNode, start - position.start);
            range.setEnd(textNode, end - position.start);
            const rectangles = [...range.getClientRects()];
            range.detach();
            rectangles.forEach((rectangle, rectangleIndex) => {
              const link = document.createElement("button");
              link.type = "button";
              link.className = "pdfLawLink";
              link.dataset.lawReference = reference.id;
              link.setAttribute("aria-label", `Consultar ${reference.label}`);
              link.tabIndex = rectangleIndex === 0 ? 0 : -1;
              link.style.left = `${rectangle.left - pageRect.left}px`;
              link.style.top = `${rectangle.top - pageRect.top}px`;
              link.style.width = `${rectangle.width}px`;
              link.style.height = `${rectangle.height}px`;
              layer.append(link);
            });
          }
        });
        if (layer.childElementCount) page.append(layer);
      };
      const handleTextLayerRendered = ({ pageNumber }: TextLayerRenderedEvent) => decorateLawReferences(pageNumber);
      eventBus.on("pagesinit", handlePagesInit);
      eventBus.on("pagechanging", handlePageChanging);
      eventBus.on("scalechanging", handleScaleChanging);
      eventBus.on("textlayerrendered", handleTextLayerRendered);

      const permissions = await pdfDocument.getPermissions();
      const storageKey = `seabell_highlights_${importedPdf.file.name}_${importedPdf.file.size}`;
      let initialHighlights: PdfHighlight[] = [];
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) initialHighlights = JSON.parse(stored) as PdfHighlight[];
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
            setHighlightPopover({
              highlight,
              position: { x, y },
            });
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
          eventBus.off("pagesinit", handlePagesInit);
          eventBus.off("pagechanging", handlePageChanging);
          eventBus.off("scalechanging", handleScaleChanging);
          eventBus.off("textlayerrendered", handleTextLayerRendered);
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
  }, [importedPdf]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const openReference = (target: EventTarget | null) => {
      const link = target instanceof Element ? target.closest<HTMLElement>("[data-law-reference]") : null;
      const reference = lawReferencesRef.current.find((item) => item.id === link?.dataset.lawReference);
      if (!reference) return false;
      setActiveLawReference(reference);
      setLawsOpen(true);
      setSearchOpen(false);
      setHighlightsOpen(false);
      return true;
    };
    const handleClick = (event: MouseEvent) => {
      if (openReference(event.target)) event.preventDefault();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && openReference(event.target)) event.preventDefault();
    };
    container.addEventListener("click", handleClick);
    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const findController = sessionRef.current?.findController;
    if (!findController) return;
    sessionRef.current?.eventBus.dispatch("find", {
      query: searchQuery,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: true,
      highlightAll: Boolean(searchQuery),
      findPrevious: false,
    });
  }, [searchQuery]);

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

  const openResult = useCallback((result: PdfSearchResult) => {
    const session = sessionRef.current;
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!session || !container || !viewerElement) return;
    session.viewer.currentPageNumber = result.pageNumber;
    session.eventBus.dispatch("find", {
      query: searchQuery,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: true,
      highlightAll: true,
      findPrevious: false,
    });

    let attempts = 0;
    const centerMatch = () => {
      const page = viewerElement.querySelector<HTMLElement>(
        `.page[data-page-number="${result.pageNumber}"]`,
      );
      if (!page) {
        if (attempts++ < 30) window.requestAnimationFrame(centerMatch);
        return;
      }
      const matchY = page.offsetTop + page.offsetHeight * result.verticalRatio;
      container.scrollTo({
        top: Math.max(0, matchY - container.clientHeight / 2),
        behavior: "smooth",
      });
    };
    window.requestAnimationFrame(centerMatch);
  }, [searchQuery]);

  const openHighlight = useCallback((highlight: PdfHighlight) => {
    const session = sessionRef.current;
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!session || !container || !viewerElement) return;

    const pageNumber = Math.min(
      highlight.range.anchor.pageNumber,
      highlight.range.focus.pageNumber,
    );
    session.viewer.currentPageNumber = pageNumber;
    setHighlightsOpen(false);
    setHighlightPopover(null);

    let attempts = 0;
    const centerPage = () => {
      const page = viewerElement.querySelector<HTMLElement>(`.page[data-page-number="${pageNumber}"]`);
      if (!page) {
        if (attempts++ < 30) window.requestAnimationFrame(centerPage);
        return;
      }
      container.scrollTo({
        top: Math.max(0, page.offsetTop - (container.clientHeight - page.offsetHeight) / 2),
        behavior: "smooth",
      });
    };
    window.requestAnimationFrame(centerPage);
  }, []);

  const removeHighlight = useCallback((id: string) => {
    sessionRef.current?.selectionController.removeHighlight(id);
    setHighlightPopover(null);
  }, []);

  const sidePanelOpen = searchOpen || highlightsOpen || lawsOpen || timelineOpen;

  return (
    <section className="relative flex h-full flex-col bg-muted/30">
      <div className={`pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4 sm:justify-end ${sidePanelOpen ? "sm:right-96" : "sm:px-6"}`}>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Página anterior"><ChevronLeft /></Button>
          <label className="sr-only" htmlFor="page-number">Página</label>
          <input id="page-number" className="h-8 w-14 rounded border bg-background px-2 text-center tabular-nums" type="number" min="1" max={pageCount ?? undefined} value={currentPage} onChange={(event) => goToPage(Number(event.target.value))} />
          <span className="px-1 text-muted-foreground tabular-nums">/ {pageCount ?? "…"}</span>
          <Button variant="ghost" size="icon" onClick={() => goToPage(currentPage + 1)} disabled={!pageCount || currentPage >= pageCount} aria-label="Página siguiente"><ChevronRight /></Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" onClick={() => changeScale(-SCALE_STEP)} disabled={!pageCount || scale <= MIN_SCALE} aria-label="Alejar"><ZoomOut /></Button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => changeScale(SCALE_STEP)} disabled={!pageCount || scale >= MAX_SCALE} aria-label="Acercar"><ZoomIn /></Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant={searchOpen ? "secondary" : "ghost"} size="icon" onClick={() => { setSearchOpen((open) => !open); setHighlightsOpen(false); setLawsOpen(false); setTimelineOpen(false); }} aria-label="Buscar en el PDF" aria-pressed={searchOpen}><Search /></Button>
          <Button variant={highlightsOpen ? "secondary" : "ghost"} size="icon" onClick={() => { setHighlightsOpen((open) => !open); setSearchOpen(false); setLawsOpen(false); setTimelineOpen(false); }} aria-label="Ver destacados" aria-pressed={highlightsOpen}><Highlighter /></Button>
          <Button variant={lawsOpen ? "secondary" : "ghost"} size="icon" onClick={() => { setLawsOpen((open) => !open); setSearchOpen(false); setHighlightsOpen(false); setTimelineOpen(false); if (lawsOpen) setActiveLawReference(null); }} aria-label="Ver leyes citadas" aria-pressed={lawsOpen}><BookOpen /></Button>
          <Button variant={timelineOpen ? "secondary" : "ghost"} size="icon" onClick={() => { setTimelineOpen((open) => !open); setSearchOpen(false); setHighlightsOpen(false); setLawsOpen(false); }} aria-label="Cronología del documento" aria-pressed={timelineOpen}><CalendarDays /></Button>
        </div>
      </div>
      {error ? <p className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center text-sm text-destructive" role="alert">{error}</p> : !pageCount && <p className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center text-sm text-muted-foreground" role="status">Preparando PDF…</p>}
      {selectionStatus.kind !== "idle" && (
        <p
          className={`pointer-events-none fixed bottom-16 right-6 z-20 rounded-md border bg-background/95 px-3 py-2 text-xs shadow ${selectionStatus.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role={selectionStatus.kind === "error" ? "alert" : "status"}
        >
          {selectionStatus.message}
        </p>
      )}
      <div ref={containerRef} className={`${styles.container} absolute bottom-0 left-0 top-0 overflow-auto outline-none ${sidePanelOpen ? "right-0 sm:right-96" : "right-0"}`} aria-label="Documento PDF" tabIndex={0}>
        <div ref={viewerElementRef} className={`${styles.viewer} pdfViewer`} />
        {selectionPopover && (
          <SelectionPopover
            state={selectionPopover}
            onCopy={async () => {
              const controller = sessionRef.current?.selectionController;
              if (!controller) return false;
              return await controller.copySelection();
            }}
            onHighlight={() => {
              const controller = sessionRef.current?.selectionController;
              controller?.highlightSelection();
              setSelectionPopover(null);
            }}
          />
        )}
        {highlightPopover && (
          <HighlightPopover
            state={highlightPopover}
            onCopy={async (text) => {
              try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                  await navigator.clipboard.writeText(text);
                  return true;
                }
              } catch {
                // Fallback
              }
              try {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                textarea.style.top = "0";
                textarea.setAttribute("readonly", "");
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand("copy");
                textarea.remove();
                return success;
              } catch {
                return false;
              }
            }}
            onRemove={removeHighlight}
            onClose={() => setHighlightPopover(null)}
          />
        )}
      </div>

      <PdfSearchPanel
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        indexedPages={searchIndexRef.current?.indexedPageCount ?? 0}
        pageCount={searchIndexRef.current?.pageCount ?? pageCount ?? 0}
        onClose={() => setSearchOpen(false)}
        onQueryChange={setSearchQuery}
        onResultClick={openResult}
      />
      <PdfHighlightsPanel
        open={highlightsOpen}
        highlights={highlights}
        onClose={() => setHighlightsOpen(false)}
        onHighlightClick={openHighlight}
        onRemove={removeHighlight}
      />
      <PdfLawsPanel
        open={lawsOpen}
        references={lawReferences}
        activeReference={activeLawReference}
        onClose={() => { setLawsOpen(false); setActiveLawReference(null); }}
        onReferenceClick={setActiveLawReference}
      />
      <PdfTimelinePanel
        open={timelineOpen}
        searchIndex={searchIndexRef.current}
        indexedPages={searchIndexRef.current?.indexedPageCount ?? 0}
        pageCount={searchIndexRef.current?.pageCount ?? pageCount ?? 0}
        onClose={() => setTimelineOpen(false)}
        onEntryClick={(entry) => {
          const session = sessionRef.current;
          const container = containerRef.current;
          const viewerElement = viewerElementRef.current;
          if (!session || !container || !viewerElement) return;
          session.viewer.currentPageNumber = entry.pageNumber;
          let attempts = 0;
          const scrollToEntry = () => {
            const page = viewerElement.querySelector<HTMLElement>(
              `.page[data-page-number="${entry.pageNumber}"]`,
            );
            if (!page) {
              if (attempts++ < 30) window.requestAnimationFrame(scrollToEntry);
              return;
            }
            const matchY = page.offsetTop + page.offsetHeight * entry.verticalRatio;
            container.scrollTo({
              top: Math.max(0, matchY - container.clientHeight / 2),
              behavior: "smooth",
            });
          };
          window.requestAnimationFrame(scrollToEntry);
        }}
      />
    </section>
  );
}
