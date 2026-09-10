"use client";

import { Upload } from "lucide-react";
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
    <main className="flex min-h-svh flex-col pt-12">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Seabell</h1>
        <p className="mb-8 max-w-sm text-sm text-muted-foreground">
          Tu espacio de trabajo para revisar y anotar documentos PDF.
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
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Recientes */}
      {recentDocs.length > 0 && (
        <section className="mx-auto w-full max-w-2xl px-6 pb-16">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
