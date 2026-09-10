import re

# 1. expediente-view.tsx
with open("src/components/expediente-view.tsx", "r") as f:
    ev_content = f.read()

ev_content = ev_content.replace('(findNode(state.tree, state.activeNodeId as string) as any).documentId', 
'(findNode(state.tree, state.activeNodeId as string) as Extract<ExpedienteNode, { kind: "pdf" }>).documentId')
ev_content = ev_content.replace('onSelectPdf={(nodeId, documentId) =>', 'onSelectPdf={(nodeId) =>')

with open("src/components/expediente-view.tsx", "w") as f:
    f.write(ev_content)

# 2. file-tree.tsx
with open("src/components/file-tree.tsx", "r") as f:
    ft_content = f.read()

ft_content = ft_content.replace('Folder, FolderOpen, FileText, Plus, FilePlus', 'Folder, FolderOpen, FileText, FilePlus')
ft_content = ft_content.replace('expedienteId,\n  state,', 'state,')

with open("src/components/file-tree.tsx", "w") as f:
    f.write(ft_content)

# 3. new-expediente-dialog.tsx
with open("src/components/new-expediente-dialog.tsx", "r") as f:
    dialog_content = f.read()

dialog_content = dialog_content.replace('setName("");\n      setTimeout(() => inputRef.current?.focus(), 0);', 'setTimeout(() => inputRef.current?.focus(), 0);')
dialog_content = dialog_content.replace('onClose();', 'setName("");\n      onClose();')
dialog_content = dialog_content.replace('onOpenChange={(isOpen: boolean) => !isOpen && onClose()}', 'onOpenChange={(isOpen: boolean) => { if (!isOpen) { setName(""); onClose(); } }}')
dialog_content = dialog_content.replace('<Button variant="outline" type="button" onClick={onClose}>', '<Button variant="outline" type="button" onClick={() => { setName(""); onClose(); }}>')

with open("src/components/new-expediente-dialog.tsx", "w") as f:
    f.write(dialog_content)

# 4. pdf-importer.tsx
with open("src/components/pdf-importer.tsx", "r") as f:
    pi_content = f.read()

pi_content = pi_content.replace(', addPdfNode, findNode }', ', addPdfNode }')
pi_content = pi_content.replace('const archive = await importAbn<any>(file);', 'const archive = await importAbn<AbnSerializableValue | any>(file);')
pi_content = pi_content.replace('let stateToSave: any;', 'let stateToSave: unknown;')
pi_content = pi_content.replace('let pdfsToSave: any[] = [];', 'let pdfsToSave: { id: string; file: File; name: string; lastModified: number }[] = [];')

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(pi_content)

