"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RecentDocCard } from "@/components/recent-doc-card";
import { WORKSPACE_STORAGE_VERSION } from "@/lib/workspace-storage";

type DocMetadata = {
  id: string;
  name: string;
  size: number;
  lastModified: number;
};

type HomeScreenProps = {
  onOpenPdf: () => void;
  onOpenArchive: () => void;
  status: "idle" | "validating" | "error" | "ready";
  error: string | null;
  /** Llamada cuando el usuario hace click en un documento reciente. */
  onOpenRecentDocument: (documentId: string) => void;
  onCreateExpediente: () => void;
};

function readRecentDocs(): DocMetadata[] {
  if (typeof window === "undefined") return [];
  try {
    const KEY_PREFIX = `seabell.workspace.v${WORKSPACE_STORAGE_VERSION}`;
    const key = `${KEY_PREFIX}:default`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      documents?: unknown[];
      version?: number;
    };
    if (!Array.isArray(parsed.documents)) return [];
    return parsed.documents
      .filter(
        (d): d is DocMetadata =>
          !!d &&
          typeof d === "object" &&
          typeof (d as DocMetadata).id === "string" &&
          typeof (d as DocMetadata).name === "string" &&
          typeof (d as DocMetadata).size === "number" &&
          typeof (d as DocMetadata).lastModified === "number",
      )
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch {
    return [];
  }
}

export function HomeScreen({ onOpenPdf, onOpenArchive, status, error, onOpenRecentDocument, onCreateExpediente }: HomeScreenProps) {
  // Lazy initializer reads localStorage once on mount — no useEffect needed
  const [recentDocs] = useState<DocMetadata[]>(readRecentDocs);

  const isValidating = status === "validating";

  return (
    <main className="sb-paper min-h-svh overflow-y-auto px-6 pb-16 pt-12 md:px-10">
      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center justify-center py-16 text-center md:py-24">
        <Image src="/logo.svg" alt="" width={72} height={72} unoptimized className="mb-7 size-16 md:size-[72px]" aria-hidden="true" />
        <h1 className="sb-heading max-w-4xl text-5xl leading-[0.95] md:text-6xl">Revisa tus documentos con claridad.</h1>
        <p className="mt-5 mb-9 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Un espacio local para leer, ordenar y anotar expedientes PDF sin sacar tus archivos de este navegador.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onOpenPdf} disabled={isValidating}>
            {isValidating ? "Verificando PDF…" : "Abrir PDF"}
          </Button>
          <Button variant="outline" size="lg" onClick={onOpenArchive} disabled={isValidating}>
            <Upload className="size-4" aria-hidden />
            Abrir .abn
          </Button>
          <Button variant="outline" size="lg" onClick={onCreateExpediente} disabled={isValidating}>
            Crear expediente
          </Button>
        </div>
        {error && (
          <p className="mt-5 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Recientes */}
      {recentDocs.length > 0 && (
        <section className="mx-auto w-full max-w-3xl border-t border-[var(--sb-color-border-strong)] pt-7">
          <h2 className="sb-label mb-4 text-[var(--sb-color-heading)]">
            Recientes
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            {recentDocs.map((doc) => (
              <li key={doc.id}>
                <RecentDocCard
                  name={doc.name}
                  size={doc.size}
                  lastModified={doc.lastModified}
                  onClick={() => onOpenRecentDocument(doc.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
