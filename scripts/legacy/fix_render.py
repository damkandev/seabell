import re

with open("src/components/pdf-importer.tsx", "r") as f:
    content = f.read()

# fix activePdf
content = content.replace('const activePdf = active ? documents.find((pdf) => pdf.id === active.documentId) : undefined;', 
'const activePdf = active?.kind === "pdf" ? documents.find((pdf) => pdf.id === active.documentId) : undefined;')

# Replace Menubar items
content = content.replace('<MenubarItem onClick={openArchive}><Upload /> Abrir .abn</MenubarItem><MenubarItem onClick={saveArchive}><Download /> Guardar .abn</MenubarItem>',
'<MenubarItem onClick={openArchive}><Upload /> Abrir .abn</MenubarItem><MenubarItem onClick={() => setDialogOpen(true)}><Folder /> Crear expediente</MenubarItem><MenubarItem onClick={saveArchive}><Download /> {active?.kind === "expediente" ? "Guardar expediente como .abn" : "Guardar .abn"}</MenubarItem>')

# Update Tabs render
old_tab_map = '''{workspace.tabs.map((tab) => <div key={tab.id} role="tab" aria-selected={tab.id === workspace.activeTabId} tabIndex={tab.id === workspace.activeTabId ? 0 : -1} onClick={() => setWorkspace((current) => ({ ...current, activeTabId: tab.id }))} className={`flex h-9 min-w-44 max-w-64 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm ${tab.id === workspace.activeTabId ? "bg-background" : "border-transparent text-muted-foreground"}`}><FileText className="size-4" /><span className="min-w-0 flex-1 truncate">{tab.name}</span><button type="button" aria-label={`Cerrar ${tab.name}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X className="size-3.5" /></button></div>)}'''
new_tab_map = '''{workspace.tabs.map((tab) => (
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
      <Folder className={clsx("size-4 shrink-0", EXPEDIENTE_COLORS[tab.color]?.text || "text-blue-500")} />
    ) : (
      tab.expedienteId ? (
        <div className={clsx("size-2 rounded-full shrink-0", EXPEDIENTE_COLORS[workspace.tabs.find(t => t.id === tab.expedienteId && t.kind === "expediente")?.color as any]?.dot || "bg-blue-500")} />
      ) : (
        <FileText className="size-4 shrink-0" />
      )
    )}
    <span className="min-w-0 flex-1 truncate">{tab.name}</span>
    {tab.kind === "expediente" && <div className={clsx("size-2 rounded-full shrink-0", EXPEDIENTE_COLORS[tab.color]?.dot)} />}
    <button type="button" aria-label={`Cerrar ${tab.name}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X className="size-3.5" /></button>
  </div>
))}'''
content = content.replace(old_tab_map, new_tab_map)

# Replace activePdf render with generic active render
old_render = '''{activePdf
      ? <PdfViewer key={activePdf.id} importedPdf={activePdf} />
      : <HomeScreen
          onOpenPdf={openPdfs}
          onOpenArchive={openArchive}
          onOpenRecentDocument={openRecentDocument}
          status={status}
          error={error}
        />
    }'''

new_render = '''{active?.kind === "expediente" 
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
              addDocuments(pdfs);
              setStatus("ready");
              // Add to tree
              setExpedienteStates(prev => {
                const state = prev.get(active.id);
                if (!state) return prev;
                let newTree = state.tree;
                for (const pdf of pdfs) {
                  newTree = addPdfNode(newTree, folderId, { kind: "pdf", id: crypto.randomUUID(), name: pdf.name, documentId: pdf.id });
                }
                const next = new Map(prev);
                next.set(active.id, { ...state, tree: newTree });
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
              const newTree = addPdfNode(state.tree, folderId, { kind: "pdf", id: crypto.randomUUID(), name: doc.name, documentId: doc.id });
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
    />'''

content = content.replace(old_render, new_render)

# add padding to the top of the container when a tab is open
content = content.replace('className={activePdf ? "h-svh overflow-hidden bg-background text-foreground" : "min-h-svh bg-background text-foreground"}',
'className={active ? "h-svh pt-[96px] overflow-hidden bg-background text-foreground" : "min-h-svh bg-background text-foreground"}')

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(content)
