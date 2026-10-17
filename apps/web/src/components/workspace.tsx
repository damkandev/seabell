"use client";

import { Fragment, useEffect, useReducer, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";

import { addPdfNode, moveNode, renameNode, type ExpedienteNode, type ExpedienteState } from "@/lib/expediente";
import { allPanes, insertPane, MAX_PANES, movePane, newPane, openIn, resizePair, restoreLayout, withoutPane, zoneAt, type DropZone, type PaneLayout } from "@/lib/pane-layout";
import type { ImportedPdf } from "@/lib/pdf-import";
import { loadPdfJs } from "@/lib/pdfjs";
import { PdfSearchIndex, type PdfSearchResult } from "@/lib/pdf-search";
import { createLocalId } from "@/lib/utils";
import { Icon } from "./icon";
import { PdfViewer, type PanelTab, type PdfReveal, type PdfViewState } from "./pdf-viewer";

export type OpenPdf = ImportedPdf & { id: string };

const DOC_TYPE = "application/x-seabell-doc";
const PANE_TYPE = "application/x-seabell-pane";
const MIN_COL_PX = 240;
const MIN_ROW_PX = 140;
let revealCount = 0;

const DROP_CLASS: Record<DropZone, string> = {
  center: "top-11 inset-x-1 bottom-1",
  left: "top-11 left-1 bottom-1 w-[calc(50%-6px)]",
  right: "top-11 right-1 bottom-1 w-[calc(50%-6px)]",
  top: "top-11 inset-x-1 h-[calc(50%-26px)]",
  bottom: "inset-x-1 bottom-1 h-[calc(50%-26px)]",
};

type WorkspaceProps = {
  state: ExpedienteState;
  /** Documentos del expediente, por id. */
  documents: Map<string, OpenPdf>;
  viewStates: Record<string, PdfViewState>;
  highlightColor: string;
  openDoc?: string;
  onPatch: (patch: Partial<ExpedienteState>) => void;
  onViewState: (documentId: string, patch: Partial<PdfViewState>) => void;
  onAddPdfs: (folderId: string | null) => void;
  onDropFiles: (files: File[], folderId: string | null) => void;
  onExport: () => void;
  onHome: () => void;
};

export function Workspace({ state, documents, viewStates, highlightColor, openDoc, onPatch, onViewState, onAddPdfs, onDropFiles, onExport, onHome }: WorkspaceProps) {
  const docNodes = pdfNodes(state.tree).filter((node) => documents.has(node.documentId));
  const docName = (doc: string) => displayName(docNodes.find((node) => node.documentId === doc)?.name ?? documents.get(doc)?.name ?? "Documento");

  const [layout, setLayout] = useState(() => restoreLayout(state.layout, docNodes.map((node) => node.documentId), openDoc));
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<PanelTab>("anot");
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ key: string; zone: DropZone } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ pane: string; at: PdfReveal } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; pos: number; start: number[]; perPx: number; min: number } | null>(null);

  const panes = allPanes(layout.cols);
  const focused = panes.find((pane) => pane.key === layout.focus) ?? panes[0];
  const searching = query.trim().length >= 2;
  const results = useExpedienteSearch(docNodes.map((node) => documents.get(node.documentId)!), searching ? query : "");
  const hitCount = results?.reduce((sum, group) => sum + group.results.length, 0) ?? 0;

  const commit = (next: PaneLayout) => {
    setLayout(next);
    onPatch({ layout: next });
  };
  const focusPane = (key: string) => { if (key !== layout.focus) commit({ ...layout, focus: key }); };

  /** Abre `doc` junto al panel `target`; con el máximo de paneles, lo reemplaza. */
  function openSide(doc: string, target: string, zone: Exclude<DropZone, "center">): PaneLayout {
    if (panes.length >= MAX_PANES) {
      return { cols: layout.cols.map((col) => ({ ...col, panes: col.panes.map((p) => (p.key === target ? { ...p, doc } : p)) })), focus: target };
    }
    const pane = newPane(doc);
    return { cols: insertPane(layout.cols, pane, target, zone), focus: pane.key };
  }
  const open = (doc: string, side = false, at?: Omit<PdfReveal, "nonce">) => {
    const next = side && focused ? openSide(doc, focused.key, "right") : openIn(layout, doc);
    commit(next);
    if (at && next.focus) setReveal({ pane: next.focus, at: { ...at, nonce: ++revealCount } });
  };
  const closePane = (key: string) => {
    const cols = withoutPane(layout.cols, key);
    commit({ cols, focus: key === layout.focus ? allPanes(cols)[0]?.key ?? null : layout.focus });
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "\\" && focused) {
        event.preventDefault();
        commit(openSide(focused.doc, focused.key, event.altKey ? "bottom" : "right"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- Carpetas y documentos ---------------------------------------------
  const patchTree = (tree: ExpedienteNode[]) => onPatch({ tree });
  const addFolder = () => {
    const folder: ExpedienteNode = { kind: "folder", id: createLocalId(), name: "Nueva carpeta", children: [] };
    patchTree(addPdfNode(state.tree, null, folder));
    setEditingFolder(folder.id);
  };
  const toggleFolder = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const dropOnFolder = (event: DragEvent, folderId: string | null) => {
    const files = pdfFiles(event);
    const payload = event.dataTransfer.getData(DOC_TYPE);
    if (!files.length && !payload) return;
    event.preventDefault();
    event.stopPropagation();
    if (files.length) onDropFiles(files, folderId);
    else patchTree(moveNode(state.tree, (JSON.parse(payload) as { node: string }).node, folderId));
  };
  const acceptsTreeDrop = (event: DragEvent) => {
    if (event.dataTransfer.types.includes(DOC_TYPE) || event.dataTransfer.types.includes("Files")) event.preventDefault();
  };

  function renderTree(nodes: ExpedienteNode[], depth: number): React.ReactNode {
    const indent = { paddingLeft: 10 + depth * 20 };
    return nodes.map((node) => {
      if (node.kind === "folder") {
        const isOpen = !collapsed.has(node.id);
        const count = pdfNodes(node.children).length;
        return (
          <li key={node.id} onDragOver={acceptsTreeDrop} onDrop={(event) => dropOnFolder(event, node.id)}>
            {editingFolder === node.id ? (
              <div className="node h-[34px] bg-paper shadow-[inset_0_0_0_1px_var(--ink)]" style={indent}>
                <Icon name="folder" strokeWidth={1.75} />
                <input
                  aria-label="Nombre de la carpeta"
                  defaultValue={node.name}
                  autoFocus
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1 bg-transparent text-ink outline-none"
                  onBlur={(event) => { patchTree(renameNode(state.tree, node.id, event.target.value.trim() || "Nueva carpeta")); setEditingFolder(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }}
                />
              </div>
            ) : (
              <button type="button" className="node h-[34px] text-ink" style={indent} aria-expanded={isOpen} onClick={() => toggleFolder(node.id)} onDoubleClick={() => setEditingFolder(node.id)} title="Doble clic para renombrar">
                <Icon name="chevron" className={`!size-3 transition-transform duration-100 ${isOpen ? "rotate-90" : ""}`} />
                <Icon name="folder" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                <span className="font-mono text-[11px] text-ink-3">{count}</span>
              </button>
            )}
            {isOpen && (
              <ul className="m-0 list-none p-0">
                {renderTree(node.children, depth + 1)}
                {!node.children.length && <li className="pt-1 pr-2.5 pb-2 text-xs text-ink-3" style={{ paddingLeft: 30 + depth * 20 }}>Arrastra documentos aquí</li>}
              </ul>
            )}
          </li>
        );
      }
      if (!documents.has(node.documentId)) return null;
      const doc = node.documentId;
      const isFocused = focused?.doc === doc;
      const isOpen = panes.some((pane) => pane.doc === doc);
      return (
        <li key={node.id} className="group relative" draggable onDragStart={(event) => {
          event.dataTransfer.setData(DOC_TYPE, JSON.stringify({ doc, node: node.id }));
          event.dataTransfer.effectAllowed = "copyMove";
        }}>
          <button type="button" className={`node h-[34px] pr-8 ${isFocused ? "is-focused" : isOpen ? "text-ink" : ""}`} style={indent} onClick={(event) => open(doc, event.altKey)} aria-current={isFocused ? "true" : undefined}>
            <Icon name="pdf" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{displayName(node.name)}</span>
            {isOpen && !isFocused && <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-ink-3" />}
            <span className="font-mono text-[11px] text-ink-3 group-hover:invisible">{viewStates[doc]?.pageCount ?? ""}</span>
          </button>
          <button type="button" className="ib absolute top-[5px] right-1 !h-6 !min-w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Abrir ${displayName(node.name)} a la derecha`} title="Abrir a la derecha (⌥ clic)" onClick={() => open(doc, true)}>
            <Icon name="openRight" />
          </button>
        </li>
      );
    });
  }

  // --- Paneles -----------------------------------------------------------
  const dropOnPane = (event: DragEvent<HTMLElement>, target: string) => {
    event.preventDefault();
    const zone = drop?.key === target ? drop.zone : zoneOf(event);
    setDrop(null);
    setMoving(null);
    const files = pdfFiles(event);
    if (files.length) return onDropFiles(files, null);
    const source = event.dataTransfer.getData(PANE_TYPE);
    if (source) return commit({ cols: movePane(layout.cols, source, target, zone), focus: source });
    const payload = event.dataTransfer.getData(DOC_TYPE);
    if (!payload) return;
    const { doc } = JSON.parse(payload) as { doc: string };
    if (zone === "center") commit({ cols: layout.cols.map((col) => ({ ...col, panes: col.panes.map((p) => (p.key === target ? { ...p, doc } : p)) })), focus: target });
    else commit(openSide(doc, target, zone));
  };

  function divider(id: string, axis: "x" | "y", sizes: number[], index: number, apply: (sizes: number[]) => PaneLayout) {
    const x = axis === "x";
    const pair = sizes[index - 1] + sizes[index];
    return (
      <div
        role="separator"
        aria-orientation={x ? "vertical" : "horizontal"}
        aria-label={x ? "Redimensionar columnas" : "Redimensionar paneles"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((sizes[index - 1] / pair) * 100)}
        tabIndex={0}
        title="Arrastra para redimensionar · doble clic para igualar"
        className={`relative z-[1] flex-none touch-none bg-line outline-none transition-colors delay-100 duration-75 before:absolute before:content-[''] hover:bg-ink-2 focus-visible:bg-ink-2 ${x ? "w-px cursor-col-resize before:inset-y-0 before:-inset-x-1" : "h-px cursor-row-resize before:inset-x-0 before:-inset-y-1"} ${dragging === id ? "bg-ink-2 delay-0" : ""}`}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.parentElement!.getBoundingClientRect();
          const px = x ? rect.width : rect.height;
          const total = sizes.reduce((sum, size) => sum + size, 0);
          dragRef.current = { id, pos: x ? event.clientX : event.clientY, start: sizes, perPx: total / px, min: (total * (x ? MIN_COL_PX : MIN_ROW_PX)) / px };
          setDragging(id);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag?.id !== id) return;
          setLayout(apply(resizePair(drag.start, index, ((x ? event.clientX : event.clientY) - drag.pos) * drag.perPx, drag.min)));
        }}
        onPointerUp={() => {
          if (dragRef.current?.id !== id) return;
          dragRef.current = null;
          setDragging(null);
          commit(layout);
        }}
        onPointerCancel={() => { dragRef.current = null; setDragging(null); }}
        onDoubleClick={() => commit(apply(sizes.map(() => 1)))}
        onKeyDown={(event: KeyboardEvent) => {
          const step = (x ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]).indexOf(event.key);
          if (step < 0) return;
          event.preventDefault();
          commit(apply(resizePair(sizes, index, pair * 0.05 * (step ? 1 : -1), pair * 0.2)));
        }}
      />
    );
  }

  const colSizes = layout.cols.map((col) => col.size);
  const withColSizes = (sizes: number[]): PaneLayout => ({ ...layout, cols: layout.cols.map((col, i) => ({ ...col, size: sizes[i] })) });
  const withRowSizes = (ci: number) => (sizes: number[]): PaneLayout => ({
    ...layout,
    cols: layout.cols.map((col, i) => (i !== ci ? col : { ...col, panes: col.panes.map((pane, j) => ({ ...pane, size: sizes[j] })) })),
  });

  return (
    <div className="flex h-svh overflow-hidden bg-surface">
      <nav aria-label="Documentos del expediente" className="flex w-[232px] flex-none flex-col border-r border-line bg-surface-2">
        <div className="titlebar flex items-center gap-0.5 pr-2 pl-[78px]" data-tauri-drag-region>
          <button type="button" className="ib ml-auto" aria-label="Guardar expediente como .abn" title="Guardar como .abn" onClick={onExport}><Icon name="export" /></button>
          <button type="button" className="ib" aria-label="Volver a Inicio" title="Volver a Inicio" onClick={onHome}><Icon name="back" /></button>
        </div>
        <div className="px-5 pt-3 pb-4">
          <h1 className="m-0 font-serif text-[19px] leading-tight tracking-[-0.015em]">{state.name}</h1>
          <p className="m-0 mt-0.5 text-ink-2">{docNodes.length === 1 ? "1 documento" : `${docNodes.length} documentos`}</p>
        </div>
        <div className="flex items-center gap-0.5 border-t border-line pt-2.5 pr-2 pb-1 pl-5">
          <span className="flex-1 text-ink-2">Documentos</span>
          <button type="button" className="ib" aria-label="Nueva carpeta" title="Nueva carpeta" onClick={addFolder}><Icon name="addFolder" /></button>
          <button type="button" className="ib" aria-label="Agregar PDF" title="Agregar PDF" onClick={() => onAddPdfs(null)}><Icon name="addPdf" /></button>
        </div>
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-px overflow-y-auto px-2.5 pt-0 pb-4" onDragOver={acceptsTreeDrop} onDrop={(event) => dropOnFolder(event, null)}>
          {renderTree(state.tree, 0)}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="titlebar flex items-center gap-1.5 border-b border-line pr-2.5 pl-4" data-tauri-drag-region>
          <label className="flex h-[30px] w-[300px] max-w-full items-center gap-2 rounded-[3px] bg-paper px-2.5 text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <Icon name="search" className="size-3.5 flex-none" />
            <input
              ref={searchRef}
              aria-label="Buscar en el expediente"
              placeholder="Buscar en el expediente"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPanelOpen(true); }}
              onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
              className="min-w-0 flex-1 bg-transparent text-ink outline-none"
            />
            {query ? (
              <button type="button" className="ib !h-5 !min-w-5 !p-0" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}><Icon name="close" className="!size-3" /></button>
            ) : <kbd>⌘F</kbd>}
          </label>
          <button type="button" className="ib ml-auto" aria-label={panelOpen ? "Ocultar panel" : "Mostrar panel"} aria-pressed={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><Icon name="panel" /></button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-x-auto">
          {!panes.length && (
            <div className="m-auto flex flex-col items-center gap-3 text-ink-3" onDragOver={acceptsTreeDrop} onDrop={(event) => dropOnFolder(event, null)}>
              <p className="m-0">Este expediente aún no tiene documentos.</p>
              <button type="button" className="card flex h-9 cursor-pointer items-center gap-2 px-3 text-ink" onClick={() => onAddPdfs(null)}><Icon name="addPdf" className="size-4" />Agregar PDF</button>
            </div>
          )}
          {layout.cols.map((col, ci) => (
            <Fragment key={col.key}>
              {ci > 0 && divider(col.key, "x", colSizes, ci, withColSizes)}
              <div className="flex min-h-0 min-w-[240px] flex-col" style={{ flex: `${col.size} 1 0` }}>
                {col.panes.map((pane, pi) => {
                  const pdf = documents.get(pane.doc);
                  const isFocused = pane.key === focused?.key;
                  const view = viewStates[pane.doc];
                  return (
                    <Fragment key={pane.key}>
                      {pi > 0 && divider(pane.key, "y", col.panes.map((p) => p.size), pi, withRowSizes(ci))}
                      <section
                        aria-label={docName(pane.doc)}
                        className={`relative flex min-h-[140px] flex-col transition-opacity duration-100 ${moving === pane.key ? "opacity-45" : ""}`}
                        style={{ flex: `${pane.size} 1 0` }}
                        onPointerDownCapture={() => focusPane(pane.key)}
                        onDragOver={(event) => {
                          const types = event.dataTransfer.types;
                          if (!types.includes(PANE_TYPE) && !types.includes(DOC_TYPE) && !types.includes("Files")) return;
                          event.preventDefault();
                          const zone = zoneOf(event);
                          if (drop?.key !== pane.key || drop.zone !== zone) setDrop({ key: pane.key, zone });
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && drop?.key === pane.key) setDrop(null);
                        }}
                        onDrop={(event) => dropOnPane(event, pane.key)}
                      >
                        <div
                          draggable
                          title="Arrastra para mover el panel"
                          onDragStart={(event) => {
                            event.dataTransfer.setData(PANE_TYPE, pane.key);
                            event.dataTransfer.effectAllowed = "move";
                            setMoving(pane.key);
                          }}
                          onDragEnd={() => { setMoving(null); setDrop(null); }}
                          className={`flex h-10 flex-none cursor-grab items-center gap-1 border-b border-line pr-1.5 pl-3.5 transition-colors duration-75 ${isFocused ? "bg-surface text-ink shadow-[inset_0_2px_0_var(--ink)]" : "bg-surface-2 text-ink-2"}`}
                        >
                          <h2 className="m-0 min-w-0 flex-1 truncate font-serif text-sm">{docName(pane.doc)}</h2>
                          <span className="px-1.5 font-mono text-[11px] text-ink-3">{view?.currentPage ?? 1} / {view?.pageCount ?? "…"}</span>
                          <button type="button" className="ib" aria-label="Dividir a la derecha" title="Dividir a la derecha (⌘\) · ⌥ clic: abajo" onClick={(event) => commit(openSide(pane.doc, pane.key, event.altKey ? "bottom" : "right"))}><Icon name="split" /></button>
                          {panes.length > 1 && <button type="button" className="ib" aria-label="Cerrar panel" title="Cerrar panel" onClick={() => closePane(pane.key)}><Icon name="close" /></button>}
                        </div>
                        <div className="relative min-h-0 flex-1">
                          {pdf ? (
                            <PdfViewer
                              key={pane.doc}
                              importedPdf={pdf}
                              name={docName(pane.doc)}
                              initialState={view}
                              onStateChange={(patch) => onViewState(pane.doc, patch)}
                              highlightColor={highlightColor}
                              searchQuery={searching ? query : ""}
                              reveal={reveal?.pane === pane.key ? reveal.at : null}
                              panel={isFocused && panelEl ? { target: panelEl, tab } : null}
                              onShowAnnotations={() => { setTab("anot"); setPanelOpen(true); }}
                            />
                          ) : <p className="p-6 text-ink-3">Documento no disponible.</p>}
                        </div>
                        {drop?.key === pane.key && moving !== pane.key && (
                          <div aria-hidden="true" className={`pointer-events-none absolute z-[3] rounded-[3px] bg-[rgb(21_23_26/8%)] shadow-[inset_0_0_0_2px_var(--ink)] transition-all duration-150 ease-[cubic-bezier(.16,1,.3,1)] ${DROP_CLASS[drop.zone]}`} />
                        )}
                      </section>
                    </Fragment>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {panelOpen && (
        <aside aria-label="Panel del documento" className="flex w-[320px] flex-none flex-col border-l border-line bg-surface">
          <div className="titlebar flex items-center border-b border-line px-3">
            {searching ? (
              <>
                <h2 className="m-0 flex-1 font-serif text-[15px]">Resultados</h2>
                <span className="mr-1 font-mono text-[11px] text-ink-3">{hitCount} {hitCount === 1 ? "coincidencia" : "coincidencias"}</span>
                <button type="button" className="ib" aria-label="Cerrar búsqueda" onClick={() => setQuery("")}><Icon name="close" /></button>
              </>
            ) : (
              <div role="tablist" aria-label="Panel" className="grid flex-1 grid-cols-2 gap-0.5 rounded-[4px] bg-surface-3 p-[3px]">
                {([["anot", "Anotaciones"], ["fechas", "Fechas"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className="h-7 cursor-pointer rounded-[3px] text-ink-2 transition-colors duration-75 hover:text-ink aria-selected:bg-paper aria-selected:text-ink aria-selected:shadow-[0_0_0_1px_var(--line)]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3.5">
            {searching ? (
              <>
                {results?.map(({ doc, results: hits }) => (
                  <section key={doc.id} aria-label={`Resultados en ${docName(doc.id)}`} className="pb-1.5">
                    <div className="flex items-baseline gap-2 px-2.5 pt-1.5 pb-1">
                      <h3 className="m-0 flex-1 font-sans text-[13px] font-medium">{docName(doc.id)}</h3>
                      <span className="font-mono text-[11px] text-ink-3">{hits.length}</span>
                    </div>
                    {hits.map((hit) => (
                      <SearchHit key={hit.id} hit={hit} onOpen={(side) => open(doc.id, side, hit)} />
                    ))}
                  </section>
                ))}
                {results && !results.length && <p className="m-0 px-0.5 py-4 leading-normal text-ink-3">Sin coincidencias en este expediente.</p>}
              </>
            ) : focused ? (
              <div ref={setPanelEl} />
            ) : (
              <p className="m-0 px-0.5 py-4 leading-normal text-ink-3">Abre un documento para ver sus anotaciones y fechas.</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function SearchHit({ hit, onOpen }: { hit: PdfSearchResult; onOpen: (side: boolean) => void }) {
  return (
    <button type="button" title="Abrir (⌥ clic: a la derecha)" onClick={(event) => onOpen(event.altKey)} className="block w-full cursor-pointer rounded-[3px] px-2.5 py-2 text-left font-serif text-[13px] leading-normal text-[#2a2d31] transition-colors duration-75 hover:bg-surface-3 focus-visible:bg-surface-3">
      <span>{hit.before} </span>
      <mark className="bg-[#e9e5ff] text-inherit shadow-[inset_0_-2px_0_#5b4bd6]">{hit.match}</mark>
      <span> {hit.after}</span>
      <span className="mt-0.5 block font-mono text-[11px] text-ink-3">pág. {hit.pageNumber}</span>
    </button>
  );
}

/**
 * Índice de búsqueda por documento del expediente, creado al buscar por primera vez.
 * ponytail: reindexa también los documentos ya abiertos en un panel; compartir el
 * índice del visor si la memoria con expedientes grandes llega a importar.
 */
type SearchEntry = { closed: boolean; index?: PdfSearchIndex; destroy?: () => void };

function useExpedienteSearch(docs: OpenPdf[], query: string) {
  // Un Map estable en estado: se llena desde el efecto y se lee al renderizar.
  const [indexes] = useState(() => new Map<string, SearchEntry>());
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const active = Boolean(query);

  useEffect(() => {
    if (!active) return;
    for (const doc of docs) {
      if (indexes.has(doc.id)) continue;
      const entry: SearchEntry = { closed: false };
      indexes.set(doc.id, entry);
      void (async () => {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ data: new Uint8Array(await doc.file.arrayBuffer()) });
        entry.destroy = () => void task.destroy();
        const pdf = await task.promise;
        if (entry.closed) return entry.destroy();
        entry.index = new PdfSearchIndex(pdf, bump);
        entry.index.start();
      })().catch(() => undefined);
    }
  }, [active, docs, indexes]);

  useEffect(() => () => {
    for (const entry of indexes.values()) {
      entry.closed = true;
      entry.index?.dispose();
      entry.destroy?.();
    }
  }, [indexes]);

  if (!active) return null;
  return docs
    .map((doc) => ({ doc, results: indexes.get(doc.id)?.index?.search(query) ?? [] }))
    .filter((group) => group.results.length);
}

const displayName = (name: string) => name.replace(/\.pdf$/i, "");

function pdfNodes(tree: ExpedienteNode[]): Extract<ExpedienteNode, { kind: "pdf" }>[] {
  return tree.flatMap((node) => (node.kind === "pdf" ? [node] : pdfNodes(node.children)));
}

function pdfFiles(event: DragEvent): File[] {
  return Array.from(event.dataTransfer.files).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
}

function zoneOf(event: DragEvent<HTMLElement>): DropZone {
  const rect = event.currentTarget.getBoundingClientRect();
  return zoneAt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
}
