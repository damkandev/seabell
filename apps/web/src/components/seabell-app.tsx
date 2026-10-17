"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { exportAbn, importAbn, type AbnSerializableValue } from "@/lib/abn";
import { addPdfNode, collectDocumentIds, createExpedienteState, removePdfNode, type ExpedienteNode, type ExpedienteState } from "@/lib/expediente";
import { importLocalPdf, type ImportedPdf } from "@/lib/pdf-import";
import { DEFAULT_HIGHLIGHT_COLOR, isHighlightColor } from "@/lib/pdf-selection/types";
import { createLocalId, withViewTransition } from "@/lib/utils";
import { createWordDocument, isWordDocument, type WordDocument } from "@/lib/word-document";
import { deleteWorkspace, getWorkspace, saveWorkspace, WORKSPACE_STORAGE_VERSION, type RestoredWorkspaceDocument } from "@/lib/workspace-storage";
import { CommandPalette, type PaletteItem } from "./command-palette";
import { Icon } from "./icon";
import { Inicio, type ExpedienteSummary, type RecentDoc, type RecentNote } from "./inicio";
import { ConfirmDialog, NewExpedienteDialog } from "./new-expediente-dialog";
import { firstPage } from "./pdf-panels";
import type { PdfViewState } from "./pdf-viewer";
import { WordEditor } from "./word-editor";
import { Workspace, type OpenPdf } from "./workspace";

/** Estado local que también viaja en los .abn de todo el espacio. */
type AppWorkspace = { wordDocuments: Record<string, WordDocument>; pdfViewStates: Record<string, PdfViewState> };
type ArchiveWorkspace = AppWorkspace & { expedientes?: Record<string, unknown> };
type Screen =
  | { kind: "inicio" }
  | { kind: "expediente"; id: string; openDoc?: string; nonce: number }
  | { kind: "escrito"; id: string };
type PickTarget = { mode: "pdf"; expediente: string | null; folder: string | null } | { mode: "abn" };

let openCount = 0;
const STORAGE_KEY = "default";
const EMPTY_VIEW: PdfViewState = { highlights: [], currentPage: 1 };
/** Expediente donde caen los PDFs abiertos desde Inicio. */
const LOOSE_ID = "exp-sueltos";
const HIGHLIGHT_COLOR_STORAGE_KEY = "seabell.highlight-color";
const HIGHLIGHT_COLORS = [
  { name: "Amarillo resaltador", value: DEFAULT_HIGHLIGHT_COLOR },
  { name: "Verde", value: "#bbf7d0" },
  { name: "Azul", value: "#bae6fd" },
  { name: "Rosa", value: "#fbcfe8" },
  { name: "Lila", value: "#ddd6fe" },
] as const;

export function SeabellApp() {
  const fileInput = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<PickTarget>({ mode: "pdf", expediente: null, folder: null });
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<OpenPdf[]>([]);
  const [expedientes, setExpedientes] = useState<Map<string, ExpedienteState>>(new Map());
  const [viewStates, setViewStates] = useState<Record<string, PdfViewState>>({});
  const [wordDocuments, setWordDocuments] = useState<Record<string, WordDocument>>({});
  const [screen, setScreen] = useState<Screen>({ kind: "inicio" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);

  useEffect(() => {
    void (async () => {
      try {
        const docs = new Map<string, OpenPdf>();
        const addDocs = (restored: RestoredWorkspaceDocument[]) => {
          for (const { metadata, file } of restored) {
            if (!docs.has(metadata.id)) docs.set(metadata.id, { id: metadata.id, file, name: metadata.name, size: metadata.size, lastModified: metadata.lastModified });
          }
        };
        const prefix = `seabell.workspace.v${WORKSPACE_STORAGE_VERSION}:exp-`;
        const exps = new Map<string, ExpedienteState>();
        for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
          const id = key.replace(prefix, "exp-");
          const saved = await getWorkspace<ExpedienteState>(id);
          if (saved && isExpedienteState(saved.workspace)) {
            exps.set(id, saved.workspace);
            addDocs(saved.documents);
          }
        }
        const saved = await getWorkspace<AppWorkspace>(STORAGE_KEY);
        if (saved) {
          addDocs(saved.documents);
          setWordDocuments(validWordDocuments(saved.workspace.wordDocuments));
          setViewStates(validPdfViewStates(saved.workspace.pdfViewStates));
          if (saved.missingDocumentIds.length) setError("Algunos PDFs locales no pudieron restaurarse.");
        }
        // Las pestañas de PDF sueltas de versiones anteriores pasan a "Sin expediente".
        const referenced = new Set([...exps.values()].flatMap((state) => collectDocumentIds(state.tree)));
        const loose = [...docs.values()].filter((doc) => !referenced.has(doc.id));
        if (loose.length) exps.set(LOOSE_ID, withPdfs(exps.get(LOOSE_ID) ?? looseExpediente(), loose, null));
        setExpedientes(exps);
        setDocuments([...docs.values()]);
      } catch {
        setError("No se pudo restaurar el espacio local.");
      } finally {
        setHighlightColor(readHighlightColor());
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Agrupa ráfagas de cambios (scroll de páginas, arrastre de paneles) en una sola escritura.
    const timer = window.setTimeout(() => {
      const files = (list: OpenPdf[]) => list.map((pdf) => ({ id: pdf.id, file: pdf.file, name: pdf.name, lastModified: pdf.lastModified }));
      void saveWorkspace(STORAGE_KEY, { wordDocuments, pdfViewStates: viewStates }, files(documents))
        .catch(() => setError("No se pudo guardar el espacio local."));
      for (const [id, state] of expedientes) {
        const ids = new Set(collectDocumentIds(state.tree));
        void saveWorkspace(id, state, files(documents.filter((doc) => ids.has(doc.id))))
          .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el expediente."));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, documents, expedientes, viewStates, wordDocuments]);

  const current = screen.kind === "expediente" ? screen.id : null;

  function pick(target: PickTarget) {
    pickTarget.current = target;
    const input = fileInput.current;
    if (!input) return;
    input.accept = target.mode === "abn" ? ".abn,application/x-abn+json" : "application/pdf,.pdf";
    input.multiple = target.mode === "pdf";
    input.click();
  }
  const openPdfs = () => pick({ mode: "pdf", expediente: current, folder: null });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") setPaletteOpen(true);
      else if (key === "o" && event.shiftKey) pick({ mode: "abn" });
      else if (key === "o") openPdfs();
      else if (key === "n") setDialogOpen(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const openExpediente = (id: string, openDoc?: string) => setScreen({ kind: "expediente", id, openDoc, nonce: ++openCount });
  const patchExpediente = (id: string, patch: Partial<ExpedienteState>) => setExpedientes((prev) => {
    const state = prev.get(id);
    if (!state) return prev;
    return new Map(prev).set(id, { ...state, ...patch });
  });

  function createExpediente(name: string) {
    const id = `exp-${createLocalId()}`;
    setExpedientes((prev) => new Map(prev).set(id, createExpedienteState(name, prev.size)));
    openExpediente(id);
  }

  /** Quita de `documents` y de sus estados los PDFs que ya no figuran en ningún expediente. */
  function dropOrphans(next: Map<string, ExpedienteState>, candidates: string[]) {
    const referenced = new Set([...next.values()].flatMap((state) => collectDocumentIds(state.tree)));
    const orphans = new Set(candidates.filter((doc) => !referenced.has(doc)));
    if (!orphans.size) return;
    setDocuments((list) => list.filter((doc) => !orphans.has(doc.id)));
    setViewStates((states) => Object.fromEntries(Object.entries(states).filter(([doc]) => !orphans.has(doc))));
  }

  function removeDocument(id: string, nodeId: string) {
    const state = expedientes.get(id);
    if (!state) return;
    const { tree, removed } = removePdfNode(state.tree, nodeId);
    patchExpediente(id, { tree });
    if (removed?.kind === "pdf") dropOrphans(new Map(expedientes).set(id, { ...state, tree }), [removed.documentId]);
  }

  function deleteExpediente(id: string) {
    const state = expedientes.get(id);
    if (!state) return;
    const next = new Map(expedientes);
    next.delete(id);
    setExpedientes(next);
    dropOrphans(next, collectDocumentIds(state.tree));
    if (current === id) setScreen({ kind: "inicio" });
    void deleteWorkspace(id).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo eliminar el expediente."));
  }

  async function importPdfs(files: File[], expediente: string | null, folder: string | null) {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const pdfs = (await Promise.all(files.map(importLocalPdf))).map((pdf) => ({ ...pdf, id: documentId(pdf) }));
      const id = expediente ?? LOOSE_ID;
      setDocuments((list) => [...list, ...pdfs.filter((pdf) => !list.some((item) => item.id === pdf.id))]);
      setExpedientes((prev) => new Map(prev).set(id, withPdfs(prev.get(id) ?? looseExpediente(), pdfs, folder)));
      openExpediente(id, pdfs.at(-1)!.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function importArchive(file: File) {
    setBusy(true);
    setError(null);
    try {
      const archive = await importAbn<AbnSerializableValue & Record<string, unknown>>(file);
      const pdfs: OpenPdf[] = archive.pdfs.map(({ id, file: pdf }) => ({ id, file: pdf, name: pdf.name, size: pdf.size, lastModified: pdf.lastModified }));
      setDocuments((list) => [...list.filter((doc) => !pdfs.some((pdf) => pdf.id === doc.id)), ...pdfs]);
      if (isExpedienteState(archive.state)) {
        // Archivo de un expediente.
        const { pdfViewStates, ...state } = archive.state as ExpedienteState & { pdfViewStates?: unknown };
        const id = `exp-${createLocalId()}`;
        setViewStates((states) => ({ ...states, ...validPdfViewStates(pdfViewStates) }));
        setExpedientes((prev) => new Map(prev).set(id, state));
        openExpediente(id);
      } else {
        // Archivo de todo el espacio de trabajo.
        const workspace = archive.state as Partial<ArchiveWorkspace>;
        setWordDocuments(validWordDocuments(workspace.wordDocuments));
        setViewStates(validPdfViewStates(workspace.pdfViewStates));
        setExpedientes(new Map(Object.entries(workspace.expedientes ?? {}).filter((entry): entry is [string, ExpedienteState] => isExpedienteState(entry[1]))));
        setScreen({ kind: "inicio" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el .abn.");
    } finally {
      setBusy(false);
    }
  }

  async function exportExpediente(id: string) {
    const state = expedientes.get(id);
    if (!state) return;
    try {
      const ids = new Set(collectDocumentIds(state.tree));
      const archive = await exportAbn({
        state: { ...state, pdfViewStates: Object.fromEntries([...ids].filter((doc) => viewStates[doc]).map((doc) => [doc, viewStates[doc]])) } as unknown as AbnSerializableValue,
        pdfs: documents.filter((pdf) => ids.has(pdf.id)),
        fileName: `${state.name}.abn`,
      });
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = archive.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el .abn.");
    }
  }

  function newEscrito() {
    const escrito = createWordDocument();
    setWordDocuments((docs) => ({ ...docs, [escrito.id]: escrito }));
    setScreen({ kind: "escrito", id: escrito.id });
  }

  function updateHighlightColor(color: string) {
    setHighlightColor(color);
    try {
      localStorage.setItem(HIGHLIGHT_COLOR_STORAGE_KEY, color);
    } catch {
      // Sin almacenamiento, el color vale solo para esta sesión.
    }
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const target = pickTarget.current;
    pickTarget.current = { mode: "pdf", expediente: null, folder: null };
    if (target.mode === "abn") {
      if (files[0]) void importArchive(files[0]);
    } else {
      void importPdfs(files, target.expediente, target.folder);
    }
  }

  // --- Datos derivados ----------------------------------------------------
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const summaries: ExpedienteSummary[] = [...expedientes].map(([id, state]) => {
    const docs = collectDocumentIds(state.tree);
    return { id, name: state.name, docs: docs.length, highlights: docs.reduce((sum, doc) => sum + (viewStates[doc]?.highlights.length ?? 0), 0) };
  });
  const owner = new Map<string, { expediente: ExpedienteSummary; name: string }>();
  for (const summary of summaries) {
    for (const node of pdfNodes(expedientes.get(summary.id)!.tree)) {
      if (!owner.has(node.documentId)) owner.set(node.documentId, { expediente: summary, name: node.name });
    }
  }
  const recents: RecentDoc[] = Object.entries(viewStates)
    .filter(([doc, state]) => state.openedAt && owner.has(doc))
    .sort((a, b) => b[1].openedAt! - a[1].openedAt!)
    .slice(0, 6)
    .map(([doc, state]) => ({ doc, ...owner.get(doc)!, pages: state.pageCount, highlights: state.highlights.length, openedAt: state.openedAt! }));
  const notes: RecentNote[] = Object.entries(viewStates)
    .filter(([doc]) => owner.has(doc))
    .flatMap(([doc, state]) => state.highlights.filter((h) => h.note).map((h) => ({ h, doc })))
    .sort((a, b) => b.h.createdAt - a.h.createdAt)
    .slice(0, 4)
    .map(({ h, doc }) => ({ id: h.id, note: h.note!, doc, docName: owner.get(doc)!.name.replace(/\.pdf$/i, ""), page: firstPage(h), expediente: owner.get(doc)!.expediente }));
  const paletteItems: PaletteItem[] = [
    ...summaries.map((exp) => ({ id: exp.id, label: exp.name, hint: `${exp.docs} docs`, icon: "folder" as const, run: () => openExpediente(exp.id) })),
    ...[...owner].map(([doc, { name, expediente }]) => ({ id: doc, label: name, hint: expediente.name, icon: "pdf" as const, run: () => openExpediente(expediente.id, doc) })),
    ...Object.values(wordDocuments).map((escrito) => ({ id: escrito.id, label: escrito.title || "Sin título", hint: "Escrito", icon: "escrito" as const, run: () => setScreen({ kind: "escrito", id: escrito.id }) })),
  ];

  if (!hydrated) return <div className="h-svh bg-surface" />;

  const expediente = screen.kind === "expediente" ? expedientes.get(screen.id) : undefined;
  const escrito = screen.kind === "escrito" ? wordDocuments[screen.id] : undefined;
  const home = () => setScreen({ kind: "inicio" });

  return (
    <>
      {screen.kind === "expediente" && expediente ? (
        <Workspace
          key={`${screen.id}:${screen.nonce}`}
          state={expediente}
          documents={new Map(collectDocumentIds(expediente.tree).filter((id) => byId.has(id)).map((id) => [id, byId.get(id)!]))}
          viewStates={viewStates}
          highlightColor={highlightColor}
          openDoc={screen.openDoc}
          onPatch={(patch) => patchExpediente(screen.id, patch)}
          onViewState={(doc, patch) => setViewStates((states) => ({ ...states, [doc]: { ...EMPTY_VIEW, ...states[doc], ...patch } }))}
          onAddPdfs={(folder) => pick({ mode: "pdf", expediente: screen.id, folder })}
          onDropFiles={(files, folder) => void importPdfs(files, screen.id, folder)}
          onExport={() => void exportExpediente(screen.id)}
          onRemoveDocument={(nodeId) => removeDocument(screen.id, nodeId)}
          onDelete={() => setToDelete(screen.id)}
          onHome={home}
        />
      ) : screen.kind === "escrito" && escrito ? (
        <div className="flex h-svh flex-col bg-surface">
          <div className="titlebar flex items-center gap-1.5 border-b border-line pr-3 pl-[78px]" data-tauri-drag-region>
            <button type="button" className="ib" aria-label="Volver a Inicio" title="Volver a Inicio" onClick={home}><Icon name="back" /></button>
            <span className="truncate font-serif text-[15px]">{escrito.title || "Sin título"}</span>
          </div>
          <div className="min-h-0 flex-1">
            <WordEditor
              key={escrito.id}
              document={escrito}
              onChange={(next) => setWordDocuments((docs) => ({ ...docs, [next.id]: next }))}
            />
          </div>
        </div>
      ) : (
        <Inicio
          expedientes={summaries}
          escritos={Object.values(wordDocuments).sort((a, b) => b.updatedAt - a.updatedAt)}
          recents={recents}
          notes={notes}
          docCount={documents.length}
          busy={busy}
          error={error}
          highlightColor={highlightColor}
          highlightColors={HIGHLIGHT_COLORS}
          onHighlightColor={updateHighlightColor}
          onOpenPdf={openPdfs}
          onNewExpediente={() => setDialogOpen(true)}
          onImportAbn={() => pick({ mode: "abn" })}
          onSearch={() => setPaletteOpen(true)}
          onOpenExpediente={openExpediente}
          onDeleteExpediente={setToDelete}
          onNewEscrito={newEscrito}
          onOpenEscrito={(id) => setScreen({ kind: "escrito", id })}
          onDropFiles={(files) => void importPdfs(files.filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name)), null, null)}
        />
      )}
      {error && screen.kind !== "inicio" && (
        <p role="alert" className="sb-pop fixed bottom-4 left-1/2 z-50 m-0 -translate-x-1/2 rounded-[3px] bg-ink px-3 py-2 text-surface">
          {error} <button type="button" className="ml-2 cursor-pointer underline" onClick={() => setError(null)}>Cerrar</button>
        </p>
      )}
      <NewExpedienteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onConfirm={createExpediente} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar expediente"
        confirmLabel="Eliminar"
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) withViewTransition(() => deleteExpediente(toDelete)); }}
      >
        Se eliminará «{toDelete && expedientes.get(toDelete)?.name}» y, de este equipo, los PDFs y resaltes que no estén en otro expediente.
      </ConfirmDialog>
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
      <input ref={fileInput} className="sr-only" type="file" accept="application/pdf,.pdf" multiple aria-label="Seleccionar PDF o archivo .abn" tabIndex={-1} onChange={selectFiles} />
    </>
  );
}

function looseExpediente(): ExpedienteState {
  return { ...createExpedienteState("Sin expediente", 0) };
}

/** Agrega al árbol los PDFs que aún no están en el expediente. */
function withPdfs(state: ExpedienteState, pdfs: OpenPdf[], folder: string | null): ExpedienteState {
  const present = new Set(collectDocumentIds(state.tree));
  const tree = pdfs
    .filter((pdf) => !present.has(pdf.id))
    .reduce((nodes, pdf) => addPdfNode(nodes, folder, { kind: "pdf", id: createLocalId(), name: pdf.name, documentId: pdf.id }), state.tree);
  return { ...state, tree };
}

function pdfNodes(tree: ExpedienteNode[]): Extract<ExpedienteNode, { kind: "pdf" }>[] {
  return tree.flatMap((node) => (node.kind === "pdf" ? [node] : pdfNodes(node.children)));
}

function readHighlightColor(): string {
  try {
    const value = localStorage.getItem(HIGHLIGHT_COLOR_STORAGE_KEY);
    return isHighlightColor(value) && HIGHLIGHT_COLORS.some((color) => color.value === value) ? value : DEFAULT_HIGHLIGHT_COLOR;
  } catch {
    return DEFAULT_HIGHLIGHT_COLOR;
  }
}

function documentId(pdf: ImportedPdf) { return `document:${pdf.name}-${pdf.lastModified}-${pdf.size}`; }

function isExpedienteState(value: unknown): value is ExpedienteState {
  return !!value && typeof value === "object" && typeof (value as ExpedienteState).name === "string" && Array.isArray((value as ExpedienteState).tree);
}

function validWordDocuments(value: unknown): Record<string, WordDocument> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => isWordDocument(item))) as Record<string, WordDocument>;
}

function validPdfViewStates(value: unknown): Record<string, PdfViewState> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, state]) => !!state && typeof state === "object" && Array.isArray((state as PdfViewState).highlights) && typeof (state as PdfViewState).currentPage === "number"));
}
