import re

# Fix expediente-view
with open("src/components/expediente-view.tsx", "r") as f:
    ev_content = f.read()
ev_content = ev_content.replace('import { ExpedienteTab } from "./pdf-importer";', '')
ev_content = ev_content.replace('findNode(state.tree, state.activeNodeId)', 'findNode(state.tree, state.activeNodeId as string)')
with open("src/components/expediente-view.tsx", "w") as f:
    f.write(ev_content)

# Fix new-expediente-dialog
with open("src/components/new-expediente-dialog.tsx", "r") as f:
    dialog_content = f.read()
dialog_content = dialog_content.replace('import * as Dialog from "@base-ui/react/dialog";', 'import { Dialog } from "@base-ui/react/dialog";')
dialog_content = dialog_content.replace('onOpenChange={(isOpen) =>', 'onOpenChange={(isOpen: boolean) =>')
with open("src/components/new-expediente-dialog.tsx", "w") as f:
    f.write(dialog_content)

# Fix pdf-importer
with open("src/components/pdf-importer.tsx", "r") as f:
    pi_content = f.read()

# import ExpedienteNode
pi_content = pi_content.replace('import { type ExpedienteColor, type ExpedienteState, createExpedienteState, EXPEDIENTE_COLORS, addPdfNode, findNode } from "@/lib/expediente";',
'import { type ExpedienteColor, type ExpedienteState, type ExpedienteNode, createExpedienteState, EXPEDIENTE_COLORS, addPdfNode, findNode } from "@/lib/expediente";')

# fix documentId in closeTab? wait openRecentDocument
pi_content = pi_content.replace('workspace.tabs.find((tab) => tab.kind === "pdf" && tab.documentId === documentId)',
'workspace.tabs.find((tab) => tab.kind === "pdf" && (tab as PdfTab).documentId === documentId)')

# fix EXPEDIENTE_COLORS text
pi_content = pi_content.replace('EXPEDIENTE_COLORS[tab.color]?.text || "text-blue-500"', 'EXPEDIENTE_COLORS[tab.color]?.dot.replace("bg-", "text-") || "text-blue-500"')

# fix EXPEDIENTE_COLORS[... color as any]
pi_content = pi_content.replace('EXPEDIENTE_COLORS[workspace.tabs.find(t => t.id === tab.expedienteId && t.kind === "expediente")?.color as any]?.dot',
'EXPEDIENTE_COLORS[(workspace.tabs.find(t => t.id === (tab as PdfTab).expedienteId && t.kind === "expediente") as ExpedienteTab)?.color || "blue"]?.dot')

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(pi_content)

