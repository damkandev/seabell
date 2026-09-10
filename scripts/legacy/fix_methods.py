with open("src/components/pdf-importer.tsx", "r") as f:
    content = f.read()

# fix addDocuments
content = content.replace('.map((pdf): PdfTab => ({ id: `pdf-${pdf.id}`, documentId: pdf.id, name: pdf.name }))', 
'.map((pdf): PdfTab => ({ kind: "pdf", id: `pdf-${pdf.id}`, documentId: pdf.id, name: pdf.name }))')

# fix validWorkspace
content = content.replace('item is PdfTab => !!item && typeof item.id === "string" && typeof item.documentId === "string"', 
'item is Tab => !!item && typeof item.id === "string" && ((item.kind === "pdf" && typeof item.documentId === "string") || (item.kind === "expediente" && typeof item.name === "string"))')

# update closeTab, selectArchive, saveArchive, openRecentDocument
select_archive = '''  async function selectArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("validating"); setError(null);
    try {
      const archive = await importAbn<any>(file);
      if (archive.state && typeof archive.state.name === "string" && Array.isArray(archive.state.tree)) {
        // It's an expediente
        const expId = `exp-${crypto.randomUUID()}`;
        setExpedienteStates(prev => {
          const next = new Map(prev);
          next.set(expId, archive.state);
          return next;
        });
        const expTab: ExpedienteTab = { kind: "expediente", id: expId, name: archive.state.name, color: archive.state.color || "blue" };
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
  }'''

save_archive = '''  async function saveArchive() {
    try {
      const activeTab = workspace.tabs.find(t => t.id === workspace.activeTabId);
      const isExpediente = activeTab?.kind === "expediente";
      
      let stateToSave: any;
      let pdfsToSave: any[] = [];
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
  }'''

content = content[:content.find('  async function selectArchive')] + select_archive + content[content.find('  function addDocuments'):]
content = content[:content.find('  async function saveArchive')] + save_archive + content[content.find('  function openRecentDocument'):]

# openRecentDocument fix finding matching tab
content = content.replace('workspace.tabs.find((tab) => tab.documentId === documentId)', 'workspace.tabs.find((tab) => tab.kind === "pdf" && tab.documentId === documentId)')

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(content)
