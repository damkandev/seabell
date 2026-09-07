"use client";

import { Highlighter, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PdfHighlight } from "@/lib/pdf-selection/types";

type PdfHighlightsPanelProps = {
  highlights: PdfHighlight[];
  open: boolean;
  onClose: () => void;
  onHighlightClick: (highlight: PdfHighlight) => void;
  onRemove: (id: string) => void;
};

export function PdfHighlightsPanel({
  highlights,
  open,
  onClose,
  onHighlightClick,
  onRemove,
}: PdfHighlightsPanelProps) {
  if (!open) return null;

  return (
    <aside
      className="absolute bottom-0 right-0 top-0 z-20 flex w-full max-w-sm flex-col border-l bg-background shadow-xl sm:w-96"
      aria-label="Destacados del documento"
    >
      <div className="flex items-center gap-2 border-b p-3">
        <Highlighter className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-medium">Destacados</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar destacados">
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {highlights.length === 0 ? (
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            Aún no hay destacados en este documento.
          </p>
        ) : (
          <ul className="space-y-2">
            {highlights.map((highlight) => {
              const pageNumber = Math.min(
                highlight.range.anchor.pageNumber,
                highlight.range.focus.pageNumber,
              );
              return (
                <li key={highlight.id} className="rounded-lg border bg-card shadow-xs">
                  <button
                    type="button"
                    onClick={() => onHighlightClick(highlight)}
                    className="w-full rounded-t-lg p-3 text-left text-sm leading-6 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block whitespace-pre-wrap">{highlight.text}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Página {pageNumber}</span>
                  </button>
                  <div className="flex justify-end border-t px-2 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(highlight.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar destacado"
                    >
                      <Trash2 aria-hidden="true" />
                      Eliminar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
