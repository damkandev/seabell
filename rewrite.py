import re

with open("src/components/pdf-importer.tsx", "r") as f:
    content = f.read()

# Fix types and imports
content = content.replace('import { getWorkspace, saveWorkspace } from "@/lib/workspace-storage";', '''import { getWorkspace, saveWorkspace } from "@/lib/workspace-storage";
import { type ExpedienteColor, type ExpedienteState, createExpedienteState, EXPEDIENTE_COLORS, addPdfNode, findNode } from "@/lib/expediente";
import { NewExpedienteDialog } from "@/components/new-expediente-dialog";
import { ExpedienteView } from "@/components/expediente-view";
import { Folder } from "lucide-react";
import { clsx } from "clsx";''')

content = content.replace('type PdfTab = { id: string; documentId: string; name: string };', '''export type PdfTab = { kind: "pdf"; id: string; documentId: string; name: string; expedienteId?: string };
export type ExpedienteTab = { kind: "expediente"; id: string; name: string; color: ExpedienteColor };
export type Tab = PdfTab | ExpedienteTab;''')

content = content.replace('tabs: PdfTab[];', 'tabs: Tab[];')

# State variables
content = content.replace('const [workspace, setWorkspace] = useState<AppWorkspace>(empty);', '''const [workspace, setWorkspace] = useState<AppWorkspace>(empty());
  const [expedienteStates, setExpedienteStates] = useState<Map<string, ExpedienteState>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const dragThreshold = useRef<{x: number, y: number} | null>(null);
  const pendingDragTab = useRef<string | null>(null);''')

# empty function
content = content.replace('const empty = (): AppWorkspace => ({ tabs: [], activeTabId: null });', 'const empty = (): AppWorkspace => ({ tabs: [], activeTabId: null });')

with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(content)
