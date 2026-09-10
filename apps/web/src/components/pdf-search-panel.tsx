"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PdfSearchResult } from "@/lib/pdf-search";

type Props = {
  open: boolean;
  query: string;
  results: PdfSearchResult[];
  indexedPages: number;
  pageCount: number;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onResultClick: (result: PdfSearchResult) => void;
};

export function PdfSearchPanel({ open, query, results, indexedPages, pageCount, onClose, onQueryChange, onResultClick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (!open) return null;

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-full max-w-sm flex-col border-l bg-background shadow-xl sm:w-96" aria-label="Buscar en el documento">
      <div className="flex items-center gap-2 border-b p-3">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <Input ref={inputRef} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar en este PDF" aria-label="Buscar en este PDF" />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar buscador"><X /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!query.trim() ? <p className="px-1 pt-2 text-sm text-muted-foreground">Escribe una palabra o frase para buscar en este documento.</p> : (
          <>
            <p className="mb-3 px-1 text-xs text-muted-foreground">
              {results.length ? `${results.length}${results.length === 100 ? "+" : ""} resultado${results.length === 1 ? "" : "s"} para “${query.trim()}”` : `Sin resultados para “${query.trim()}”`}
              {indexedPages < pageCount && ` · buscando en ${indexedPages}/${pageCount} páginas`}
            </p>
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => onResultClick(result)} className="w-full rounded-lg border bg-card p-3 text-left text-sm leading-6 shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span>{result.before}<mark className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/50">{result.match}</mark>{result.after}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Página {result.pageNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
