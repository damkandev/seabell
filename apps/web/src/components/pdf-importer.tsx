"use client";

import { Download, FileText, LogOut, Plus, Settings, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";


import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HomeScreen } from "@/components/home-screen";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { PdfViewer, type PdfViewState } from "@/components/pdf-viewer";
import { exportAbn, importAbn, type AbnSerializableValue } from "@/lib/abn";
import { importLocalPdf, type ImportedPdf } from "@/lib/pdf-import";
import { getWorkspace, saveWorkspace, WORKSPACE_STORAGE_VERSION } from "@/lib/workspace-storage";
import { type ExpedienteColor, type ExpedienteState, type ExpedienteNode, createExpedienteState, EXPEDIENTE_COLORS, addPdfNode, movePdfNode, removePdfNode, renameNode } from "@/lib/expediente";
import { NewExpedienteDialog } from "@/components/new-expediente-dialog";
import { ExpedienteView } from "@/components/expediente-view";
import { Button } from "@/components/ui/button";
import { Folder } from "lucide-react";
import { clsx } from "clsx";
import { createLocalId } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth-api";
import { DEFAULT_HIGHLIGHT_COLOR, isHighlightColor } from "@/lib/pdf-selection/types";

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
type ArchiveWorkspace = AppWorkspace & {
  expedientes: Record<string, ExpedienteState>;
  pdfViewStates: Record<string, PdfViewState>;
};
type AutosaveContext = { kind: "workspace" } | { kind: "expediente"; id: string };
type AutosaveFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};
type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options?: unknown) => Promise<AutosaveFileHandle>;
};
const STORAGE_KEY = "default";
const HIGHLIGHT_COLOR_STORAGE_KEY = "seabell.highlight-color";
const HIGHLIGHT_COLORS = [
  { name: "Amarillo pastel", value: "#fde68a" },
  { name: "Verde pastel", value: "#bbf7d0" },
  { name: "Azul pastel", value: "#bae6fd" },
  { name: "Rosa pastel", value: "#fbcfe8" },
  { name: "Lila pastel", value: "#ddd6fe" },
] as const;
const empty = (): AppWorkspace => ({ tabs: [], activeTabId: null });
function readHighlightColor(): string {
  if (typeof window === "undefined") return DEFAULT_HIGHLIGHT_COLOR;
  try {
    const value = localStorage.getItem(HIGHLIGHT_COLOR_STORAGE_KEY);
    return isHighlightColor(value) && HIGHLIGHT_COLORS.some((color) => color.value === value)
      ? value
      : DEFAULT_HIGHLIGHT_COLOR;
  } catch {
    return DEFAULT_HIGHLIGHT_COLOR;
  }
}
function sameAutosaveContext(a: AutosaveContext, b: AutosaveContext): boolean {
  return a.kind === "workspace" && b.kind === "workspace"
    || a.kind === "expediente" && b.kind === "expediente" && a.id === b.id;
}

export function PdfImporter({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const pdfInput = useRef<HTMLInputElement>(null);
  const fileInputMode = useRef<"pdf" | "archive">("pdf");
  const hydrated = useRef(false);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<OpenPdf[]>([]);
  const [workspace, setWorkspace] = useState<AppWorkspace>(empty());
  const [expedienteStates, setExpedienteStates] = useState<Map<string, ExpedienteState>>(new Map());
  const [pdfViewStates, setPdfViewStates] = useState<Record<string, PdfViewState>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"off" | "saving" | "saved" | "error">("off");
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightColor, setHighlightColor] = useState(readHighlightColor);
  const dragThreshold = useRef<{x: number, y: number} | null>(null);
  const pendingDragTab = useRef<string | null>(null);
  const autosaveRef = useRef<{ handle: AutosaveFileHandle; context: AutosaveContext } | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const autosaveWriting = useRef(false);
  const autosaveQueued = useRef(false);
  const writeAutosaveRef = useRef<() => void>(() => undefined);

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
    const autosave = autosaveRef.current;
    if (autosave && sameAutosaveContext(autosave.context, contextForWorkspace(workspace))) {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => writeAutosaveRef.current(), 1000);
    }
  }, [documents, workspace, expedienteStates, pdfViewStates]);

  function contextForWorkspace(currentWorkspace: AppWorkspace): AutosaveContext {
    const current = currentWorkspace.tabs.find((tab) => tab.id === currentWorkspace.activeTabId);
    return current?.kind === "expediente" ? { kind: "expediente", id: current.id } : { kind: "workspace" };
  }

  function archiveFor(context: AutosaveContext) {
    if (context.kind === "expediente") {
      const state = expedienteStates.get(context.id);
      if (!state) throw new Error("Expediente no encontrado");
      const ids = new Set(collectDocumentIds(state.tree));
      return exportAbn({
        state: { ...state, pdfViewStates: Object.fromEntries([...ids].filter((id) => pdfViewStates[id]).map((id) => [id, pdfViewStates[id]])) } as unknown as AbnSerializableValue,
        pdfs: documents.filter((pdf) => ids.has(pdf.id)),
        fileName: `${state.name}.abn`,
      });
    }
    return exportAbn({
      state: { ...workspace, expedientes: Object.fromEntries(expedienteStates), pdfViewStates } as unknown as AbnSerializableValue,
      pdfs: documents,
      fileName: "seabell.abn",
    });
  }

  async function writeAutosave() {
    const autosave = autosaveRef.current;
    if (!autosave) return;
    if (autosaveWriting.current) {
      autosaveQueued.current = true;
      return;
    }
    autosaveWriting.current = true;
    setAutosaveStatus("saving");
    try {
      const archive = await archiveFor(autosave.context);
      const writable = await autosave.handle.createWritable();
      await writable.write(archive);
      await writable.close();
      setAutosaveSavedAt(Date.now());
      setAutosaveStatus("saved");
    } catch {
      setAutosaveStatus("error");
    } finally {
      autosaveWriting.current = false;
      if (autosaveQueued.current) {
        autosaveQueued.current = false;
        void writeAutosave();
      }
    }
  }
  writeAutosaveRef.current = () => void writeAutosave();

  async function activateAutosave() {
    const picker = window as WindowWithSavePicker;
    if (!picker.showSaveFilePicker) {
      setAutosaveStatus("error");
      setError("Este navegador no permite autoguardar directamente en un archivo.");
      return;
    }
    const context = contextForWorkspace(workspace);
    const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeTabId);
    try {
      const handle = await picker.showSaveFilePicker({
        suggestedName: context.kind === "expediente" ? `${activeTab?.name || "expediente"}.abn` : "seabell.abn",
        types: [{ description: "Archivo Seabell", accept: { "application/x-abn+json": [".abn"] } }],
      });
      autosaveRef.current = { handle, context };
      setError(null);
      void writeAutosave();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setAutosaveStatus("error");
      setError("No se pudo activar el autoguardado.");
    }
  }

  function deactivateAutosave() {
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    autosaveRef.current = null;
    autosaveQueued.current = false;
    setAutosaveStatus("off");
    setAutosaveSavedAt(null);
  }

  function collectDocumentIds(tree: ExpedienteNode[]): string[] {
    return tree.flatMap((node) => node.kind === "pdf" ? [node.documentId] : collectDocumentIds(node.children));
  }
  
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
        const importedViewStates = validPdfViewStates((archive.state as { pdfViewStates?: unknown }).pdfViewStates);
        const expedienteState = { ...(archive.state as unknown as ExpedienteState & { pdfViewStates?: unknown }) };
        delete expedienteState.pdfViewStates;
        setExpedienteStates(prev => {
          const next = new Map(prev);
          next.set(expId, expedienteState);
          return next;
        });
        setPdfViewStates((current) => ({ ...current, ...importedViewStates }));
        const expTab: ExpedienteTab = { kind: "expediente", id: expId, name: archive.state.name as string, color: (archive.state.color as ExpedienteColor) || "blue" };
        setWorkspace(current => ({ ...current, tabs: [...current.tabs, expTab], activeTabId: expId }));
        
        setDocuments(current => {
          const docMap = new Map(current.map(d => [d.id, d]));
          for (const d of archive.pdfs) docMap.set(d.id, { id: d.id, file: d.file, name: d.file.name, size: d.file.size, lastModified: d.file.lastModified });
          return Array.from(docMap.values());
        });
      } else {
        // Normal workspace
        const importedWorkspace = archive.state as Partial<ArchiveWorkspace>;
        setWorkspace(validWorkspace(importedWorkspace));
        setExpedienteStates(new Map(Object.entries(importedWorkspace.expedientes ?? {}).filter(([, value]) => isExpedienteState(value))));
        setPdfViewStates(validPdfViewStates(importedWorkspace.pdfViewStates));
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
      const archive = await archiveFor(contextForWorkspace(workspace));
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

  const autosaveLabel = autosaveStatus === "saving" ? "Guardando…" : autosaveStatus === "error" ? "Autoguardado: error" : autosaveStatus === "saved" && autosaveSavedAt ? `Guardado a las ${new Date(autosaveSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Autoguardado activo";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  function updateHighlightColor(nextColor: string) {
    setHighlightColor(nextColor);
    try {
      localStorage.setItem(HIGHLIGHT_COLOR_STORAGE_KEY, nextColor);
    } catch {
      // Ignore storage errors; the setting still applies for this session.
    }
  }

  function closeSettings() {
    setSettingsOpen(false);
  }

  return <div className={active && !settingsOpen ? "h-svh pt-[96px] overflow-hidden bg-background text-foreground" : "min-h-svh bg-background text-foreground"}>
    <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center border-b border-border/70 bg-background/95 px-4"><Menubar className="w-fit border-0 bg-transparent shadow-none"><MenubarMenu><MenubarTrigger>Archivo</MenubarTrigger><MenubarContent><MenubarItem onClick={openPdfs}>Abrir PDF</MenubarItem><MenubarItem onClick={openArchive}><Upload /> Abrir .abn</MenubarItem><MenubarItem onClick={() => setDialogOpen(true)}><Folder /> Crear expediente</MenubarItem><MenubarItem onClick={saveArchive}><Download /> {active?.kind === "expediente" ? "Guardar expediente como .abn" : "Guardar .abn"}</MenubarItem><MenubarItem onClick={activateAutosave}>Activar autoguardado</MenubarItem>{autosaveRef.current && <><MenubarItem onClick={() => void writeAutosave()}>Guardar ahora</MenubarItem><MenubarItem onClick={deactivateAutosave}>Desactivar autoguardado</MenubarItem></>}</MenubarContent></MenubarMenu></Menubar>{autosaveRef.current && <span className="ml-4 text-xs text-muted-foreground" role="status">{autosaveLabel}</span>}<div className="ml-auto flex items-center gap-2 pl-3"><Button variant={settingsOpen ? "secondary" : "ghost"} size="sm" className="max-w-64" title={user.email} aria-label="Abrir configuración de cuenta" aria-pressed={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings /><span className="max-w-48 truncate">{user.email}</span></Button><Button variant="ghost" size="sm" disabled={loggingOut} onClick={() => void handleLogout()}><LogOut /> Salir</Button></div></header>
    {(workspace.tabs.length > 0 || settingsOpen) && <nav className="fixed inset-x-0 top-12 z-20 flex h-12 border-b bg-muted/40" aria-label="Documentos abiertos"><div className="flex min-w-0 flex-1 items-end overflow-x-auto px-2 pt-2" role="tablist">{workspace.tabs.map((tab) => (
  <div 
    key={tab.id} 
    role="tab" 
    aria-selected={!settingsOpen && tab.id === workspace.activeTabId} 
    tabIndex={!settingsOpen && tab.id === workspace.activeTabId ? 0 : -1} 
    onClick={() => { setSettingsOpen(false); setWorkspace((current) => ({ ...current, activeTabId: tab.id })); }}
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
      "flex h-9 min-w-44 max-w-64 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-px motion-reduce:transition-none",
      !settingsOpen && tab.id === workspace.activeTabId ? "bg-background" : "border-transparent text-muted-foreground"
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
    <button type="button" aria-label={`Cerrar ${tab.name}`} className="cursor-pointer rounded p-0.5 opacity-60 transition-[background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X className="size-3.5" /></button>
  </div>
))}{settingsOpen && <div role="tab" aria-selected={settingsOpen} tabIndex={settingsOpen ? 0 : -1} onClick={() => setSettingsOpen(true)} className={clsx("flex h-9 min-w-44 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-px motion-reduce:transition-none", settingsOpen ? "bg-background" : "border-transparent text-muted-foreground")}><Settings className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">Configuración</span><button type="button" aria-label="Cerrar Configuración" className="cursor-pointer rounded p-0.5 opacity-60 transition-[background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); closeSettings(); }}><X className="size-3.5" /></button></div>}<DropdownMenu><DropdownMenuTrigger className="mb-1 ml-1 grid size-7 place-items-center"><Plus className="size-4" /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={openPdfs}><FileText /> Abrir PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></nav>}
    {settingsOpen
      ? <main className="mx-auto w-full max-w-2xl px-6 pb-16 pt-28">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
            <p className="mt-2 text-sm text-muted-foreground">Personaliza tu espacio de trabajo.</p>
          </div>
          <section className="mt-8 rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h2 className="font-medium">Color del destacado</h2>
                <p className="mt-1 text-sm text-muted-foreground">Se aplicará a los nuevos textos destacados.</p>
              </div>
              <div className="flex shrink-0 gap-2" role="radiogroup" aria-label="Colores del destacado">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    role="radio"
                    aria-label={color.name}
                    aria-checked={highlightColor === color.value}
                    title={color.name}
                    onClick={() => updateHighlightColor(color.value)}
                    className={clsx(
                      "size-8 rounded-full border-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      highlightColor === color.value ? "border-foreground ring-2 ring-ring/40" : "border-border",
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
          </section>
        </main>
      : active?.kind === "expediente" 
      ? <ExpedienteView
          key={active.id}
          tab={active}
          state={expedienteStates.get(active.id) || createExpedienteState(active.name, 0)}
          documents={documents}
          pdfViewStates={pdfViewStates}
          onPdfViewStateChange={(documentId, viewState) => setPdfViewStates((current) => ({ ...current, [documentId]: viewState }))}
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
      ? <PdfViewer
          key={activePdf.id}
          importedPdf={activePdf}
          highlightColor={highlightColor}
          initialState={pdfViewStates[activePdf.id]}
          onStateChange={(viewState) => setPdfViewStates((current) => ({ ...current, [activePdf.id]: viewState }))}
        />
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
    <input ref={pdfInput} className="sr-only" type="file" accept="application/pdf,.pdf,.abn,application/x-abn+json" multiple aria-label="Seleccionar PDF o archivo .abn" onChange={(event) => { void (fileInputMode.current === "archive" ? selectArchive(event) : selectPdfs(event)); }} />
  </div>;
}

function documentId(pdf: ImportedPdf) { return `document:${pdf.name}-${pdf.lastModified}-${pdf.size}`; }
function validWorkspace(value: unknown): AppWorkspace { if (!value || typeof value !== "object") return empty(); const candidate = value as Partial<AppWorkspace>; if (!Array.isArray(candidate.tabs)) return empty(); return { tabs: candidate.tabs.filter((item): item is Tab => !!item && typeof item.id === "string" && ((item.kind === "pdf" && typeof item.documentId === "string") || (item.kind === "expediente" && typeof item.name === "string"))), activeTabId: typeof candidate.activeTabId === "string" ? candidate.activeTabId : null }; }
function isExpedienteState(value: unknown): value is ExpedienteState { return !!value && typeof value === "object" && typeof (value as ExpedienteState).name === "string" && Array.isArray((value as ExpedienteState).tree); }
function validPdfViewStates(value: unknown): Record<string, PdfViewState> { if (!value || typeof value !== "object") return {}; return Object.fromEntries(Object.entries(value).filter(([, state]) => !!state && typeof state === "object" && Array.isArray((state as PdfViewState).highlights) && typeof (state as PdfViewState).currentPage === "number" && typeof (state as PdfViewState).scale === "number" && typeof (state as PdfViewState).searchQuery === "string")); }
