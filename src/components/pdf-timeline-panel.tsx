"use client";

import { CalendarDays, X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { extractTimeline, type TimelineEntry } from "@/lib/pdf-timeline";
import type { PdfSearchIndex } from "@/lib/pdf-search";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

function formatEntryDate(entry: TimelineEntry): string {
  const day = entry.date.getDate();
  const monthName = MONTH_NAMES_ES[entry.month];
  // If day is 1 and the raw text doesn't start with "1" it was a month-only match
  const isMonthOnly =
    day === 1 &&
    !/^0?1\b/.test(entry.rawText.trim()) &&
    !/\b(1|01)\b/.test(entry.rawText.slice(0, 4));
  return isMonthOnly
    ? `${monthName} de ${entry.year}`
    : `${day} de ${monthName} de ${entry.year}`;
}

// Highlight the rawText inside the context string
function ContextFragment({ context, rawText }: { context: string; rawText: string }) {
  const idx = context.indexOf(rawText);
  if (idx < 0) {
    return <span className="text-muted-foreground">{context}</span>;
  }
  return (
    <span className="text-muted-foreground">
      {context.slice(0, idx)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-500/30">
        {rawText}
      </mark>
      {context.slice(idx + rawText.length)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  open: boolean;
  searchIndex: PdfSearchIndex | null;
  indexedPages: number;
  pageCount: number;
  onClose: () => void;
  onEntryClick: (entry: TimelineEntry) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfTimelinePanel({
  open,
  searchIndex,
  indexedPages,
  pageCount,
  onClose,
  onEntryClick,
}: Props) {
  const timeline = useMemo(() => {
    if (!searchIndex || indexedPages === 0) return null;
    return extractTimeline(searchIndex);
  }, [searchIndex, indexedPages]);

  if (!open) return null;

  // Group entries by year for accordion display
  const byYear = new Map<number, TimelineEntry[]>();
  if (timeline) {
    for (const entry of timeline.entries) {
      const group = byYear.get(entry.year) ?? [];
      group.push(entry);
      byYear.set(entry.year, group);
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const totalEntries = timeline?.entries.length ?? 0;
  const isIndexing = indexedPages < pageCount;

  return (
    <aside
      className="absolute bottom-0 right-0 top-0 z-20 flex w-full max-w-sm flex-col border-l bg-background shadow-xl sm:w-96"
      aria-label="Cronología del documento"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-3">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium">Cronología</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar cronología">
          <X />
        </Button>
      </div>

      {/* Progress bar while indexing */}
      {isIndexing && (
        <div
          className="h-1 bg-muted transition-all"
          role="progressbar"
          aria-valuenow={indexedPages}
          aria-valuemin={0}
          aria-valuemax={pageCount}
          aria-label={`Indexando ${indexedPages} de ${pageCount} páginas`}
        >
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${Math.round((indexedPages / pageCount) * 100)}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Empty / loading state */}
        {indexedPages === 0 && (
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            Analizando el documento…
          </p>
        )}

        {indexedPages > 0 && totalEntries === 0 && !isIndexing && (
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            No se encontraron fechas en este documento.
          </p>
        )}

        {/* Summary line */}
        {totalEntries > 0 && (
          <p className="mb-3 px-1 text-xs text-muted-foreground">
            {totalEntries} fecha{totalEntries !== 1 ? "s" : ""} encontrada{totalEntries !== 1 ? "s" : ""}
            {isIndexing && ` · analizando ${indexedPages}/${pageCount} páginas`}
          </p>
        )}

        {/* Year groups using native <details> — zero JS overhead */}
        <ul className="space-y-2">
          {years.map((year) => {
            const entries = byYear.get(year)!;
            return (
              <li key={year}>
                <details open>
                  <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex-1">{year}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {entries.length} evento{entries.length !== 1 ? "s" : ""}
                    </span>
                  </summary>

                  <ul className="mt-1 space-y-1 pl-2">
                    {entries.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => onEntryClick(entry)}
                          className="w-full rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {/* Date label */}
                          <span className="block text-xs font-medium text-foreground">
                            {formatEntryDate(entry)}
                          </span>
                          {/* Context fragment */}
                          <span className="mt-0.5 block text-xs leading-5">
                            <ContextFragment context={entry.context} rawText={entry.rawText} />
                          </span>
                          {/* Page badge */}
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Pág. {entry.pageNumber}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
