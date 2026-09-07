import re

with open("src/components/new-expediente-dialog.tsx", "r") as f:
    dialog_content = f.read()

dialog_content = dialog_content.replace('<Dialog.Close asChild>', '')
dialog_content = dialog_content.replace('</Dialog.Close>', '')

with open("src/components/new-expediente-dialog.tsx", "w") as f:
    f.write(dialog_content)

with open("src/components/pdf-importer.tsx", "r") as f:
    pi_content = f.read()

pi_content = re.sub(
    r'workspace\.tabs\.find\(\(tab\) => tab\.kind === "pdf" && tab\.documentId === documentId\)',
    r'workspace.tabs.find((tab) => tab.kind === "pdf" && (tab as PdfTab).documentId === documentId)',
    pi_content
)

pi_content = re.sub(
    r'tab\.kind === "expediente"\n\s*\?\s*<Folder className=\{clsx\("size-4 shrink-0", EXPEDIENTE_COLORS\[tab\.color\]\?\.dot\.replace\("bg-", "text-"\) \|\| "text-blue-500"\)\} />',
    r'tab.kind === "expediente"\n    ? <Folder className={clsx("size-4 shrink-0", EXPEDIENTE_COLORS[(tab as ExpedienteTab).color]?.dot.replace("bg-", "text-") || "text-blue-500")} />',
    pi_content
)

# And in case there are other tab.color occurrences:
pi_content = pi_content.replace('EXPEDIENTE_COLORS[tab.color]?.dot', 'EXPEDIENTE_COLORS[(tab as ExpedienteTab).color]?.dot')


with open("src/components/pdf-importer.tsx", "w") as f:
    f.write(pi_content)
