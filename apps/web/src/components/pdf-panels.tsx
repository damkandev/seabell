"use client";

import { useMemo } from "react";

import type { PdfSearchIndex } from "@/lib/pdf-search";
import type { PdfHighlight } from "@/lib/pdf-selection/types";
import { extractTimeline, type TimelineEntry } from "@/lib/pdf-timeline";
import { Icon } from "./icon";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

export function firstPage(highlight: PdfHighlight): number {
  return Math.min(highlight.range.anchor.pageNumber, highlight.range.focus.pageNumber);
}

const empty = "m-0 px-0.5 py-4 leading-normal text-ink-3";

/** Resaltes y notas del documento del panel activo. */
export function PdfAnnotations({ title, highlights, editingId, onEdit, onOpen, onRemove, onNote }: {
  title: string;
  highlights: PdfHighlight[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onOpen: (highlight: PdfHighlight) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
}) {
  return (
    <section aria-label="Anotaciones del documento" className="sb-enter flex flex-col gap-2">
      <h3 className="m-0 px-0.5 pb-1 font-serif text-sm text-ink-2">{title}</h3>
      {highlights.length === 0 && <p className={empty}>Selecciona texto en el documento para resaltarlo o anotarlo.</p>}
      {highlights.map((highlight) => (
        <article key={highlight.id} className="card sb-item">
          <button type="button" className="block w-full cursor-pointer px-3.5 pt-3 pb-1 text-left" onClick={() => onOpen(highlight)}>
            <span className="font-serif text-sm leading-[1.55]">
              <span className="marker" style={highlight.color ? { "--mark": highlight.color } as React.CSSProperties : undefined}>{highlight.text}</span>
            </span>
            {highlight.note && editingId !== highlight.id && <span className="mt-2 block leading-normal whitespace-pre-wrap">{highlight.note}</span>}
            <span className="mt-1.5 block font-mono text-[11px] text-ink-3">pág. {firstPage(highlight)}</span>
          </button>
          {editingId === highlight.id && (
            <textarea
              aria-label="Nota"
              autoFocus
              defaultValue={highlight.note}
              placeholder="Escribe una nota"
              rows={3}
              className="mx-3.5 mt-1 block w-[calc(100%-28px)] resize-none rounded-[3px] bg-surface-2 p-2 leading-normal outline-none focus:shadow-[inset_0_0_0_1px_var(--ink)]"
              onBlur={(event) => { onNote(highlight.id, event.target.value); onEdit(null); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") onEdit(null);
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
              }}
            />
          )}
          <div className="flex justify-end gap-0.5 px-1.5 pb-1.5">
            <button type="button" className="ib text-xs" onClick={() => onEdit(highlight.id)}>{highlight.note ? "Editar nota" : "Agregar nota"}</button>
            <button type="button" className="ib" aria-label="Eliminar destacado" title="Eliminar" onClick={() => onRemove(highlight.id)}><Icon name="close" className="!size-3.5" /></button>
          </div>
        </article>
      ))}
    </section>
  );
}

/** Línea de tiempo con las fechas que aparecen en el documento del panel activo. */
export function PdfDates({ searchIndex, indexedPages, pageCount, onOpen }: {
  searchIndex: PdfSearchIndex | null;
  indexedPages: number;
  pageCount: number;
  onOpen: (entry: TimelineEntry) => void;
}) {
  const entries = useMemo(
    () => (searchIndex && indexedPages ? extractTimeline(searchIndex).entries : []),
    [searchIndex, indexedPages],
  );
  const indexing = indexedPages < pageCount;

  return (
    <section aria-label="Fechas del documento" className="sb-enter">
      {indexing && <p className="m-0 mb-3 px-0.5 font-mono text-[11px] text-ink-3" role="status">Analizando {indexedPages} de {pageCount} páginas…</p>}
      {!indexing && entries.length === 0 && <p className={empty}>No se encontraron fechas en este documento.</p>}
      <ol className="m-0 mt-1 list-none border-l border-line-2 p-0 pl-3.5">
        {entries.map((entry) => (
          <li key={entry.id} className="relative pb-5 pl-2.5">
            <span aria-hidden="true" className="absolute -left-[19px] top-[5px] size-[9px] rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--ink)]" />
            <button type="button" className="block w-full cursor-pointer rounded-[3px] text-left hover:bg-surface-3" onClick={() => onOpen(entry)}>
              <span className="block font-mono text-[11px] text-ink-3">{formatDate(entry)}</span>
              <span className="block font-serif text-[15px] leading-snug">{entry.context}</span>
              <span className="block text-ink-2">pág. {entry.pageNumber}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatDate(entry: TimelineEntry): string {
  // Una coincidencia de solo mes y año queda en el día 1 sin que el texto lo diga.
  const monthOnly = entry.date.getDate() === 1 && !/\b0?1\b/.test(entry.rawText);
  return `${monthOnly ? "" : `${entry.date.getDate()} `}${MONTHS[entry.month]} ${entry.year}`;
}
