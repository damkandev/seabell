"use client";

import { Download, FileText, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";


import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HomeScreen } from "@/components/home-screen";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { PdfViewer } from "@/components/pdf-viewer";
import { exportAbn, importAbn, type AbnSerializableValue } from "@/lib/abn";
import { importLocalPdf, type ImportedPdf } from "@/lib/pdf-import";
import { getWorkspace, saveWorkspace, WORKSPACE_STORAGE_VERSION } from "@/lib/workspace-storage";
import { type ExpedienteColor, type ExpedienteState, type ExpedienteNode, createExpedienteState, EXPEDIENTE_COLORS, addPdfNode, movePdfNode, removePdfNode, renameNode } from "@/lib/expediente";
import { NewExpedienteDialog } from "@/components/new-expediente-dialog";
import { ExpedienteView } from "@/components/expediente-view";
import { Folder } from "lucide-react";
import { clsx } from "clsx";
import { createLocalId } from "@/lib/utils";

type ImportStatus = "idle" | "validating" | "error" | "ready";
type OpenPdf = ImportedPdf & { id: string };
export type PdfTab = { kind: "pdf"; id: string; documentId: string; name: string; expedienteId?: string };
export type ExpedienteTab = { kind: "expediente"; id: string; name: string; color: ExpedienteColor };
export type Tab = PdfTab | ExpedienteTab;
/** State saved locally and embedded in portable .abn archives. */
type AppWorkspace = {
  tabs: Tab[];
  activeTabId: string | null;
};
const STORAGE_KEY = "default";
const empty = (): AppWorkspace => ({ tabs: [], activeTabId: null });

export function PdfImporter() {
  const pdfInput = useRef<HTMLInputElement>(null);
  const fileInputMode = useRef<"pdf" | "archive">("pdf");
  const hydrated = useRef(false);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<OpenPdf[]>([]);
  const [workspace, setWorkspace] = useState<AppWorkspace>(empty());
  const [expedienteStates, setExpedienteStates] = useState<Map<string, ExpedienteState>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const dragThreshold = useRef<{x: number, y: number} | null>(null);
  const pendingDragTab = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await getWorkspace<AppWorkspace>(STORAGE_KEY);
        
        // Scan for expedientes
        const expPrefix = `seabell.workspace.v${WORKSPACE_STORAGE_VERSION}:exp-`;
        const expKeys = Object.keys(localStorage).filter(k => k.startsWith(expPrefix));
        const newExpStates = new Map<string, ExpedienteState>();
        const expDocs: OpenPdf[] = [];
        
        for (const k of expKeys) {
          const tabId = k.replace(expPrefix, "exp-");
          const expSaved = await getWorkspace<ExpedienteState>(tabId);
          if (expSaved && expSaved.workspace) {
            newExpStates.set(tabId, expSaved.workspace);
            expDocs.push(...expSaved.documents.map(({ metadata, file }) => ({
              id: metadata.id,
              file,
              name: metadata.name,
              size: metadata.size,
              lastModified: metadata.lastModified,
            })));
          }
        }
        setExpedienteStates(newExpStates);
        
        let allDocs: OpenPdf[] = expDocs;
        if (saved) {
          setWorkspace(validWorkspace(saved.workspace));
          allDocs = [...allDocs, ...saved.documents.map(({ metadata, file }) => ({
            id: metadata.id,
            file,
            name: metadata.name,
            size: metadata.size,
            lastModified: metadata.lastModified,
          }))];
          if (saved.missingDocumentIds.length) setError("Algunos PDFs locales no pudieron restaurarse.");
        }
        
        // deduplicate allDocs
        const docMap = new Map<string, OpenPdf>();
        for (const d of allDocs) {
          if (!docMap.has(d.id)) docMap.set(d.id, d);
        }
        setDocuments(Array.from(docMap.values()));

      } catch {
        setError("No se pudo restaurar el espacio local.");
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void saveWorkspace(STORAGE_KEY, workspace, documents.map((pdf) => ({ id: pdf.id, file: pdf.file, name: pdf.name, lastModified: pdf.lastModified }))).catch(() => setError("No se pudo guardar el espacio local."));
    
    // Save each expediente state
    for (const [expId, expState] of expedienteStates.entries()) {
      // Find all documentIds referenced in this expediente
      const collectIds = (tree: ExpedienteNode[]): string[] => {
        const ids: string[] = [];
        for (const n of tree) {
          if (n.kind === "pdf") ids.push(n.documentId);
          else if (n.kind === "folder") ids.push(...collectIds(n.children));
        }
        return ids;
      };
      const docIds = new Set(collectIds(expState.tree));
      const expPdfs = documents.filter(d => docIds.has(d.id)).map(pdf => ({ id: pdf.id, file: pdf.file, name: pdf.name, lastModified: pdf.lastModified }));
      void saveWorkspace(expId, expState, expPdfs).catch(() => console.error("No se pudo guardar expediente", expId));
    }
  }, [documents, workspace, expedienteStates]);
  
  function createExpediente(name: string) {
    const id = `exp-${createLocalId()}`;
    const colorIndex = Array.from(expedienteStates.values()).length;
    const newState = createExpedienteState(name, colorIndex);
    
    setExpedienteStates(prev => {
      const next = new Map(prev);
      next.set(id, newState);
      return next;
    });
    
    setWorkspace(current => ({
      ...current,
      tabs: [...current.tabs, { kind: "expediente", id, name, color: newState.color }],
      activeTabId: id,
    }));
  }
  function openPdfs() {
    fileInputMode.current = "pdf";
    pdfInput.current?.click();
  }

  function openArchive() {
    fileInputMode.current = "archive";
    pdfInput.current?.click();
  }

  async function selectPdfs(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    await importPdfFiles(files);
  }

  async function importPdfFiles(files: File[]) {
    setStatus("validating"); setError(null);
    try {
      const pdfs = (await Promise.all(files.map(importLocalPdf))).map((pdf) => ({
        ...pdf,
        id: documentId(pdf),
      }));
      addDocuments(pdfs);
      setStatus("ready");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el PDF.");
    }
  }

  async function selectArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("validating"); setError(null);
    try {
      const archive = await importAbn<AbnSerializableValue & Record<string, unknown>>(file);
      if (archive.state && typeof archive.state.name === "string" && Array.isArray(archive.state.tree)) {
        // It's an expediente
        const expId = `exp-${createLocalId()}`;
        setExpedienteStates(prev => {
          const next = new Map(prev);
          next.set(expId, archive.state as unknown as ExpedienteState);
          return next;
        });
        const expTab: ExpedienteTab = { kind: "expediente", id: expId, name: archive.state.name as string, color: (archive.state.color as ExpedienteColor) || "blue" };
        setWorkspace(current => ({ ...current, tabs: [...current.tabs, expTab], activeTabId: expId }));
        
        setDocuments(current => {
          const docMap = new Map(current.map(d => [d.id, d]));
          for (const d of archive.pdfs) docMap.set(d.id, { id: d.id, file: d.file, name: d.file.name, size: d.file.size, lastModified: d.file.lastModified });
          return Array.from(docMap.values());
        });
      } else {
        // Normal workspace
        setWorkspace(validWorkspace(archive.state));
        setDocuments(archive.pdfs.map(({ id, file: pdf }) => ({
          id,
          file: pdf,
          name: pdf.name,
          size: pdf.size,
          lastModified: pdf.lastModified,
        })));
      }
      setStatus("ready");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el .abn.");
    }
  }  function addDocuments(pdfs: OpenPdf[], options?: { activate?: boolean; expedienteId?: string }) {
    setDocuments((current) => [...current, ...pdfs.filter((pdf) => !current.some((item) => item.id === pdf.id))]);
    setWorkspace((current) => {
      const tabs = [
        ...current.tabs,
        ...pdfs
          .filter((pdf) => !current.tabs.some((tab) => tab.kind === "pdf" && (tab as PdfTab).documentId === pdf.id))
          .map((pdf): PdfTab => ({
            kind: "pdf",
            id: `pdf-${pdf.id}`,
            documentId: pdf.id,
            name: pdf.name,
            expedienteId: options?.expedienteId,
          })),
      ];
      const shouldActivate = options?.activate ?? true;
      return {
        ...current,
        tabs,
        activeTabId: shouldActivate ? `pdf-${pdfs.at(-1)?.id ?? ""}` : current.activeTabId,
      };
    });
  }

  function closeTab(id: string) {
    setWorkspace((current) => {
      const index = current.tabs.findIndex((tab) => tab.id === id);
      const tabs = current.tabs.filter((tab) => tab.id !== id);
      return {
        ...current,
        tabs,
        activeTabId: current.activeTabId === id ? tabs[index]?.id ?? tabs[index - 1]?.id ?? null : current.activeTabId,
      };
    });
  }

  async function saveArchive() {
    try {
      const activeTab = workspace.tabs.find(t => t.id === workspace.activeTabId);
      const isExpediente = activeTab?.kind === "expediente";
      
      let stateToSave: unknown;
      let pdfsToSave: { id: string; file: File; name: string; lastModified: number }[] = [];
      let fileName = "seabell.abn";
      
      if (isExpediente && activeTab) {
        const expState = expedienteStates.get(activeTab.id);
        if (!expState) throw new Error("Expediente no encontrado");
        stateToSave = expState;
        
        const collectIds = (tree: ExpedienteNode[]): string[] => {
          const ids: string[] = [];
          for (const n of tree) {
            if (n.kind === "pdf") ids.push(n.documentId);
            else if (n.kind === "folder") ids.push(...collectIds(n.children));
          }
          return ids;
        };
        const docIds = new Set(collectIds(expState.tree));
        pdfsToSave = documents.filter(d => docIds.has(d.id)).map((pdf) => ({
          id: pdf.id,
          file: pdf.file,
          name: pdf.name,
          lastModified: pdf.lastModified,
        }));
        fileName = `${expState.name}.abn`;
      } else {
        stateToSave = workspace;
        pdfsToSave = documents.map((pdf) => ({
          id: pdf.id,
          file: pdf.file,
          name: pdf.name,
          lastModified: pdf.lastModified,
        }));
      }

      const archive = await exportAbn({
        state: stateToSave as unknown as AbnSerializableValue,
        pdfs: pdfsToSave,
        fileName,
      });
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = archive.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el .abn."); }
  }  function openRecentDocument(documentId: string) {
    // If the document is already loaded, just activate the matching tab
    const existingTab = workspace.tabs.find((tab) => tab.kind === "pdf" && (tab as PdfTab).documentId === documentId);
    if (existingTab) {
      setWorkspace((current) => ({ ...current, activeTabId: existingTab.id }));
      return;
    }
    // If the file is available in memory (e.g. same session), open it
    const doc = documents.find((pdf) => pdf.id === documentId);
    if (doc) {
      addDocuments([doc]);
      return;
    }
    // The file is not in memory (e.g. after reload) — ask the user to re-open it
    openPdfs();
  }

  const active = workspace.tabs.find((tab) => tab.id === workspace.activeTabId);
  const activePdf = active?.kind === "pdf" ? documents.find((pdf) => pdf.id === active.documentId) : undefined;

  return <div className={active ? "h-svh pt-[96px] overflow-hidden bg-background text-foreground" : "min-h-svh bg-background text-foreground"}>
    <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center border-b border-border/70 bg-background/95 px-4"><Menubar className="w-fit border-0 bg-transparent shadow-none"><MenubarMenu><MenubarTrigger>Archivo</MenubarTrigger><MenubarContent><MenubarItem onClick={openPdfs}>Abrir PDF</MenubarItem><MenubarItem onClick={openArchive}><Upload /> Abrir .abn</MenubarItem><MenubarItem onClick={() => setDialogOpen(true)}><Folder /> Crear expediente</MenubarItem><MenubarItem onClick={saveArchive}><Download /> {active?.kind === "expediente" ? "Guardar expediente como .abn" : "Guardar .abn"}</MenubarItem></MenubarContent></MenubarMenu></Menubar></header>
    {workspace.tabs.length > 0 && <nav className="fixed inset-x-0 top-12 z-20 flex h-12 border-b bg-muted/40" aria-label="Documentos abiertos"><div className="flex min-w-0 flex-1 items-end overflow-x-auto px-2 pt-2" role="tablist">{workspace.tabs.map((tab) => (
  <div 
    key={tab.id} 
    role="tab" 
    aria-selected={tab.id === workspace.activeTabId} 
    tabIndex={tab.id === workspace.activeTabId ? 0 : -1} 
    onClick={() => setWorkspace((current) => ({ ...current, activeTabId: tab.id }))}
    draggable={tab.kind === "pdf"}
    onDragStart={(e) => {
      if (tab.kind === "pdf") {
        e.dataTransfer.setData("text/x-seabell-document-id", tab.documentId);
      }
    }}
    onMouseDown={(e) => {
      if (tab.kind === "pdf") {
        pendingDragTab.current = tab.id;
        dragThreshold.current = { x: e.clientX, y: e.clientY };
      }
    }}
    onMouseMove={(e) => {
      if (pendingDragTab.current === tab.id && dragThreshold.current) {
        const dx = e.clientX - dragThreshold.current.x;
        const dy = e.clientY - dragThreshold.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          // let HTML5 drag take over
          dragThreshold.current = null;
        }
      }
    }}
    onMouseUp={() => { pendingDragTab.current = null; dragThreshold.current = null; }}
    className={clsx(
      "flex h-9 min-w-44 max-w-64 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm",
      tab.id === workspace.activeTabId ? "bg-background" : "border-transparent text-muted-foreground"
    )}
  >
    {tab.kind === "expediente" ? (
      <Folder className={clsx("size-4 shrink-0", EXPEDIENTE_COLORS[(tab as ExpedienteTab).color]?.dot.replace("bg-", "text-") || "text-blue-500")} />
    ) : (
      tab.expedienteId ? (
        <div className={clsx("size-2 rounded-full shrink-0", EXPEDIENTE_COLORS[(workspace.tabs.find(t => t.id === (tab as PdfTab).expedienteId && t.kind === "expediente") as ExpedienteTab)?.color || "blue"]?.dot || "bg-blue-500")} />
      ) : (
        <FileText className="size-4 shrink-0" />
      )
    )}
    <span className="min-w-0 flex-1 truncate">{tab.name}</span>
    {tab.kind === "expediente" && <div className={clsx("size-2 rounded-full shrink-0", EXPEDIENTE_COLORS[(tab as ExpedienteTab).color]?.dot)} />}
    <button type="button" aria-label={`Cerrar ${tab.name}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X className="size-3.5" /></button>
  </div>
))}<DropdownMenu><DropdownMenuTrigger className="mb-1 ml-1 grid size-7 place-items-center"><Plus className="size-4" /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={openPdfs}><FileText /> Abrir PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></nav>}
    {active?.kind === "expediente" 
      ? <ExpedienteView
          key={active.id}
          tab={active}
          state={expedienteStates.get(active.id) || createExpedienteState(active.name, 0)}
          documents={documents}
          onStateChange={(newState) => {
            setExpedienteStates(prev => {
              const next = new Map(prev);
              next.set(active.id, newState);
              return next;
            });
          }}
          onAddPdfs={async (files, folderId) => {
            setStatus("validating"); setError(null);
            try {
              const pdfs = (await Promise.all(files.map(importLocalPdf))).map((pdf) => ({
                ...pdf,
                id: documentId(pdf),
              }));
              addDocuments(pdfs, { activate: false, expedienteId: active.id });
              setStatus("ready");
              // Add to tree
              setExpedienteStates(prev => {
                const state = prev.get(active.id);
                if (!state) return prev;
                let newTree = state.tree;
                let firstNewNodeId: string | null = null;
                for (const pdf of pdfs) {
                  const newNodeId = createLocalId();
                  if (!firstNewNodeId) firstNewNodeId = newNodeId;
                  newTree = addPdfNode(newTree, folderId, { kind: "pdf", id: newNodeId, name: pdf.name, documentId: pdf.id });
                }
                const newActive = state.activeNodeId || firstNewNodeId;
                const next = new Map(prev);
                next.set(active.id, { ...state, tree: newTree, activeNodeId: newActive });
                return next;
              });
            } catch (cause) {
              setStatus("error");
              setError(cause instanceof Error ? cause.message : "No se pudo abrir el PDF.");
            }
          }}
          onDropDocumentFromTab={(documentId, folderId) => {
            const doc = documents.find(d => d.id === documentId);
            if (!doc) return;
            setExpedienteStates(prev => {
              const state = prev.get(active.id);
              if (!state) return prev;
              const newTree = addPdfNode(state.tree, folderId, { kind: "pdf", id: createLocalId(), name: doc.name, documentId: doc.id });
              const next = new Map(prev);
              next.set(active.id, { ...state, tree: newTree });
              return next;
            });
            // Update tab color
            setWorkspace(prev => ({
              ...prev,
              tabs: prev.tabs.map(t => t.kind === "pdf" && t.documentId === documentId ? { ...t, expedienteId: active.id } : t)
            }));
          }}
          onMoveNode={(nodeId, folderId) => {
            setExpedienteStates(prev => {
              const state = prev.get(active.id);
              if (!state) return prev;
              const newTree = movePdfNode(state.tree, nodeId, folderId);
              const next = new Map(prev);
              next.set(active.id, { ...state, tree: newTree });
              return next;
            });
          }}
          onRemoveNode={(nodeId) => {
            setExpedienteStates(prev => {
              const state = prev.get(active.id);
              if (!state) return prev;
              const { tree: newTree } = removePdfNode(state.tree, nodeId);
              // Si el nodo eliminado era el activo, limpiar selección
              const newActive = state.activeNodeId === nodeId ? null : state.activeNodeId;
              const next = new Map(prev);
              next.set(active.id, { ...state, tree: newTree, activeNodeId: newActive });
              return next;
            });
          }}
          onRenameNode={(nodeId, newName) => {
            setExpedienteStates(prev => {
              const state = prev.get(active.id);
              if (!state) return prev;
              const newTree = renameNode(state.tree, nodeId, newName);
              const next = new Map(prev);
              next.set(active.id, { ...state, tree: newTree });
              return next;
            });
          }}
        />
      : active?.kind === "pdf" && activePdf
      ? <PdfViewer key={activePdf.id} importedPdf={activePdf} />
      : <HomeScreen
          onOpenPdf={openPdfs}
          onOpenArchive={openArchive}
          onOpenRecentDocument={openRecentDocument}
          status={status}
          error={error}
          onCreateExpediente={() => setDialogOpen(true)}
        />
    }
    <NewExpedienteDialog 
      open={dialogOpen} 
      onClose={() => setDialogOpen(false)} 
      onConfirm={createExpediente} 
    />
    <input ref={pdfInput} className="sr-only" type="file" accept="application/pdf,.pdf,.abn,application/x-abn+json" multiple onChange={(event) => { void (fileInputMode.current === "archive" ? selectArchive(event) : selectPdfs(event)); }} />
  </div>;
}

function documentId(pdf: ImportedPdf) { return `document:${pdf.name}-${pdf.lastModified}-${pdf.size}`; }
function validWorkspace(value: unknown): AppWorkspace { if (!value || typeof value !== "object") return empty(); const candidate = value as Partial<AppWorkspace>; if (!Array.isArray(candidate.tabs)) return empty(); return { tabs: candidate.tabs.filter((item): item is Tab => !!item && typeof item.id === "string" && ((item.kind === "pdf" && typeof item.documentId === "string") || (item.kind === "expediente" && typeof item.name === "string"))), activeTabId: typeof candidate.activeTabId === "string" ? candidate.activeTabId : null }; }
