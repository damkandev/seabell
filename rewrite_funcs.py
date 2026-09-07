import re

with open("src/components/pdf-importer.tsx", "r") as f:
    content = f.read()

content = content.replace('import { getWorkspace, saveWorkspace } from "@/lib/workspace-storage";', 
'import { getWorkspace, saveWorkspace, WORKSPACE_STORAGE_VERSION } from "@/lib/workspace-storage";')

effect_code = '''useEffect(() => {
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
    const id = `exp-${crypto.randomUUID()}`;
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
'''

content = content[:content.find('useEffect(() => {')] + effect_code + content[content.find('  function openPdfs()'):]

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(content)
