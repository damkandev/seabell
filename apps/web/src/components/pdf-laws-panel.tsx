"use client";

import { ArrowLeft, BookOpen, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LawReference } from "@/lib/law-references";

type Props = {
  open: boolean;
  references: LawReference[];
  activeReference: LawReference | null;
  onClose: () => void;
  onReferenceClick: (reference: LawReference | null) => void;
};

function lawUrl(reference: LawReference): string {
  return `/api/laws/${reference.type}/${encodeURIComponent(reference.number)}`;
}

type LawResponse = {
  kind: "law" | "official" | "search";
  sourceUrl: string;
  candidates?: Array<{ id: string; title: string; label: string; sourceUrl: string }>;
  law?: { titulo: string; organismo: string; fecha_publicacion: string; articles: Array<{ label: string; body: string }> };
};

function articleHeading(label: string): string | null {
  if (label === "__preamble__") return null;
  return label.replace(/^art[ií]culo\b/iu, "Artículo");
}

function legalInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/gu).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="text-foreground">{part.slice(2, -2)}</strong> : part);
}

function legalParagraph(text: string, key: number) {
  const quote = /^>\s?/u.test(text);
  const content = text.replace(/^>\s?/u, "");
  const heading = /^(#{1,6})\s+(.+)$/u.exec(content.trim());
  if (heading) return <h5 key={key} className="pt-2 text-sm font-semibold text-foreground">{legalInlineText(heading[2])}</h5>;

  return <p key={key} className={`whitespace-pre-wrap ${quote ? "border-l-2 border-border pl-3 text-muted-foreground" : ""}`}>{legalInlineText(content)}</p>;
}

export function PdfLawsPanel({ open, references, activeReference, onClose, onReferenceClick }: Props) {
  const [result, setResult] = useState<{ id: string; response?: LawResponse; error?: string } | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const requestId = activeReference ? `${activeReference.id}-${candidateId ?? ""}` : null;
  const response = result?.id === requestId ? result?.response ?? null : null;
  const error = result?.id === requestId ? result?.error ?? null : null;
  const loading = Boolean(activeReference) && !response && !error;

  useEffect(() => {
    if (!activeReference) return;
    const controller = new AbortController();
    const url = candidateId ? `${lawUrl(activeReference)}?id=${candidateId}` : lawUrl(activeReference);
    void fetch(url, { signal: controller.signal })
      .then(async (result) => {
        if (!result.ok) throw new Error();
        setResult({ id: `${activeReference.id}-${candidateId ?? ""}`, response: await result.json() as LawResponse });
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setResult({ id: `${activeReference.id}-${candidateId ?? ""}`, error: "No se pudo cargar esta norma." });
      });
    return () => controller.abort();
  }, [activeReference, candidateId]);

  if (!open) return null;

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-full max-w-sm flex-col border-l bg-background shadow-xl sm:w-96" aria-label="Leyes citadas en el documento">
      <div className="flex items-center gap-2 border-b p-3">
        <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-medium">Leyes citadas</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar leyes"><X /></Button>
      </div>

      {activeReference ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onReferenceClick(null)} aria-label="Volver a las leyes citadas">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Volver a las leyes citadas</span>
            </Button>
            {response && <a className="ml-auto text-muted-foreground hover:text-foreground" href={response.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${activeReference.label} en LeyChile`}>
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading && <p className="text-sm text-muted-foreground">Cargando norma…</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {response?.kind === "official" && <section className="rounded-lg border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fuente oficial</p><h3 className="mt-2 text-base font-semibold">{activeReference.label}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">La BCN confirmó esta norma. Su servicio público no permite a Seabell descargar el texto íntegro sin credencial, pero puedes abrir la ficha vigente oficial.</p><a href={response.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Abrir ficha oficial BCN <ExternalLink className="size-4" aria-hidden="true" /></a></section>}
            {response?.kind === "search" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Selecciona la norma que corresponde a esta cita.</p>{response.candidates?.length ? <ul className="space-y-2">{response.candidates.map((candidate) => <li key={candidate.id}><button type="button" onClick={() => setCandidateId(candidate.id)} className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted"><span className="block text-xs text-muted-foreground">{candidate.label}</span><span className="mt-1 block font-medium">{candidate.title}</span></button></li>)}</ul> : <p className="text-sm text-muted-foreground">No encontramos una coincidencia exacta en el corpus disponible.</p>}</div>}
            {response?.law && <article className="space-y-5"><header><h3 className="text-sm font-semibold leading-5">{response.law.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{response.law.organismo} · Publicada el {response.law.fecha_publicacion}</p></header><div className="space-y-5 text-sm leading-6 text-foreground">{response.law.articles.map((article, index) => <section key={`${article.label}-${index}`} className="space-y-2">{articleHeading(article.label) && <h4 className="text-sm font-semibold text-foreground">{articleHeading(article.label)}</h4>}{article.body.split(/\n{2,}/u).filter(Boolean).map((paragraph, paragraphIndex) => legalParagraph(paragraph.trim(), paragraphIndex))}</section>)}</div></article>}
          </div>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">Texto provisto por LeyChile. Para efectos legales, consulta la fuente oficial BCN.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          {references.length === 0 ? <p className="px-1 pt-2 text-sm text-muted-foreground">Aún no se detectan citas legales. El documento se revisa página por página en segundo plano.</p> : (
            <ul className="space-y-2">
              {references.map((reference) => (
                <li key={reference.id}>
                  <button type="button" onClick={() => onReferenceClick(reference)} className="w-full rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block text-sm font-medium">{reference.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Página {reference.pageNumber}</span>
                    <span className="mt-2 line-clamp-3 block text-xs leading-5 text-muted-foreground">{reference.context}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
