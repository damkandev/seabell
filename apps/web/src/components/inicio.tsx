"use client";

import { useState } from "react";

import type { WordDocument } from "@/lib/word-document";
import { Icon } from "./icon";

export type ExpedienteSummary = { id: string; name: string; docs: number; highlights: number };
export type RecentDoc = { doc: string; name: string; expediente: ExpedienteSummary; pages?: number; highlights: number; openedAt: number };
export type RecentNote = { id: string; note: string; doc: string; docName: string; page: number; expediente: ExpedienteSummary };

type InicioProps = {
  expedientes: ExpedienteSummary[];
  escritos: WordDocument[];
  recents: RecentDoc[];
  notes: RecentNote[];
  docCount: number;
  busy: boolean;
  error: string | null;
  highlightColor: string;
  highlightColors: readonly { name: string; value: string }[];
  onHighlightColor: (color: string) => void;
  onOpenPdf: () => void;
  onNewExpediente: () => void;
  onImportAbn: () => void;
  onSearch: () => void;
  onOpenExpediente: (id: string, doc?: string) => void;
  onDeleteExpediente: (id: string) => void;
  onNewEscrito: () => void;
  onOpenEscrito: (id: string) => void;
  onDropFiles: (files: File[]) => void;
};

const h2 = "m-0 font-serif text-xl tracking-[-0.015em]";
const meta = "font-mono text-xs text-ink-3";
const row = "grid h-11 grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_70px_80px_110px] items-center gap-4 border-b border-line px-3 max-[900px]:grid-cols-[minmax(0,1fr)_110px] max-[900px]:[&>:nth-child(2)]:hidden max-[900px]:[&>:nth-child(3)]:hidden max-[900px]:[&>:nth-child(4)]:hidden";
const act = "card flex h-14 cursor-pointer items-center gap-3 px-4 text-sm [&_svg]:size-[18px] [&_svg]:text-ink-2 [&_kbd]:ml-auto disabled:cursor-wait disabled:opacity-60";

export function Inicio(props: InicioProps) {
  const { expedientes, escritos, recents, notes, docCount, busy, error } = props;
  const [dropping, setDropping] = useState(false);

  return (
    <div className="flex h-svh overflow-hidden bg-surface">
      <nav aria-label="Navegación" className="flex w-[248px] flex-none flex-col border-r border-line bg-surface-2">
        <div className="titlebar" data-tauri-drag-region />
        <div className="px-2.5 pt-1 pb-2.5">
          <button type="button" onClick={props.onSearch} className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-[3px] bg-paper px-2.5 text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <Icon name="search" className="size-3.5" />
            <span className="flex-1 text-left">Buscar en todo</span><kbd>⌘K</kbd>
          </button>
        </div>
        <div className="flex flex-col gap-px px-2.5">
          <button type="button" className="node" aria-current="page"><Icon name="home" />Inicio</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <SideSection title="Expedientes" addLabel="Nuevo expediente" onAdd={props.onNewExpediente}>
            {expedientes.map((exp) => (
              <button key={exp.id} type="button" className="node sb-item" onClick={() => props.onOpenExpediente(exp.id)}>
                <span className="min-w-0 flex-1 truncate">{exp.name}</span><span className="font-mono text-[11px] text-ink-3">{exp.docs}</span>
              </button>
            ))}
          </SideSection>
          <SideSection title="Escritos" addLabel="Nuevo escrito" onAdd={props.onNewEscrito}>
            {escritos.map((escrito) => (
              <button key={escrito.id} type="button" className="node sb-item" onClick={() => props.onOpenEscrito(escrito.id)}>
                <Icon name="escrito" /><span className="min-w-0 flex-1 truncate">{escrito.title || "Sin título"}</span>
              </button>
            ))}
          </SideSection>
        </div>
        <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
          <span className="flex-1 truncate pl-2.5 text-ink-2">Seabell</span>
          <button type="button" className="ib" aria-label="Ajustes" title="Ajustes" popoverTarget="ajustes"><Icon name="settings" /></button>
          <div id="ajustes" popover="auto" className="fixed inset-auto bottom-12 left-3 m-0 w-60 rounded-[4px] bg-paper p-3.5 text-ink shadow-[0_0_0_1px_var(--line),0_12px_32px_-12px_rgb(21_23_26/35%)]">
            <p className="m-0 mb-2.5 font-medium">Color del resalte</p>
            <div role="radiogroup" aria-label="Colores del resalte" className="flex gap-2">
              {props.highlightColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  role="radio"
                  aria-checked={props.highlightColor === color.value}
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => props.onHighlightColor(color.value)}
                  className="size-7 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/12%)] aria-checked:outline-2 aria-checked:outline-offset-2 aria-checked:outline-ink"
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="titlebar border-b border-line" data-tauri-drag-region />
        <main className="flex min-h-0 flex-1 flex-wrap items-start gap-12 overflow-y-auto px-[clamp(24px,4vw,56px)] pt-10 pb-14">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-10">
            <section aria-labelledby="h-inicio" className="flex flex-col gap-3">
              <h1 id="h-inicio" className="m-0 mb-2 font-serif text-[32px] leading-none tracking-[-0.03em]">Inicio</h1>
              <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-1">
                <button type="button" className={`${act} !bg-ink !text-surface !shadow-[inset_0_-2px_0_rgb(0_0_0/35%)] hover:!bg-[#2b2f35] [&_kbd]:!text-surface/70 [&_svg]:!text-surface/70`} onClick={props.onOpenPdf} disabled={busy}>
                  <Icon name="pdf" />{busy ? "Abriendo…" : "Abrir PDF"}<kbd>⌘O</kbd>
                </button>
                <button type="button" className={act} onClick={props.onNewExpediente}><Icon name="addFolder" />Nuevo expediente<kbd>⌘N</kbd></button>
                <button type="button" className={act} onClick={props.onImportAbn} disabled={busy}><Icon name="import" />Importar .abn<kbd>⇧⌘O</kbd></button>
              </div>
              <button
                type="button"
                onClick={props.onOpenPdf}
                onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDropping(true); } }}
                onDragLeave={() => setDropping(false)}
                onDrop={(event) => { event.preventDefault(); setDropping(false); props.onDropFiles(Array.from(event.dataTransfer.files)); }}
                className={`flex h-[72px] cursor-pointer items-center justify-center rounded-[3px] border border-dashed text-ink-3 transition-colors duration-100 ${dropping ? "border-ink bg-surface-3 text-ink" : "border-line-2 bg-[repeating-linear-gradient(135deg,var(--bg-2)_0_6px,var(--bg)_6px_12px)]"}`}
              >
                Suelta PDFs aquí para agregarlos a un expediente
              </button>
              {error && <p className="sb-enter m-0 text-destructive" role="alert">{error}</p>}
            </section>

            <section aria-labelledby="h-recientes">
              <h2 id="h-recientes" className={`${h2} mb-3`}>Recientes</h2>
              {recents.length ? (
                <div role="table" aria-label="Documentos recientes" className="border-t border-ink">
                  <div role="row" className={`${row} h-8 font-mono text-[11px] text-ink-3`}>
                    <span role="columnheader">Documento</span><span role="columnheader">Expediente</span><span role="columnheader">Págs.</span><span role="columnheader">Resaltes</span><span role="columnheader" className="text-right">Abierto</span>
                  </div>
                  {recents.map((recent) => (
                    <button key={recent.doc} type="button" role="row" className={`${row} sb-item w-full cursor-pointer text-left transition-colors duration-75 hover:bg-surface-2`} onClick={() => props.onOpenExpediente(recent.expediente.id, recent.doc)}>
                      <span role="cell" className="flex min-w-0 items-center gap-2.5"><Icon name="pdf" strokeWidth={1.75} className="size-4 flex-none text-ink-3" /><span className="truncate">{recent.name}</span></span>
                      <span role="cell" className="truncate text-ink-2">{recent.expediente.name}</span>
                      <span role="cell" className={meta}>{recent.pages ?? "—"}</span>
                      <span role="cell" className={meta}>{recent.highlights || "—"}</span>
                      <span role="cell" className={`${meta} text-right`}>{relativeTime(recent.openedAt)}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="m-0 border-t border-ink pt-3 text-ink-3">Los documentos que abras aparecerán aquí.</p>}
            </section>

            <section aria-labelledby="h-expedientes">
              <h2 id="h-expedientes" className={`${h2} mb-3`}>Expedientes</h2>
              {expedientes.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                  {expedientes.map((exp) => (
                    <div key={exp.id} className="sb-item group relative">
                      <button type="button" className="card flex w-full cursor-pointer flex-col gap-2.5 p-4 pr-10" onClick={() => props.onOpenExpediente(exp.id)}>
                        <span className="font-serif text-[17px]">{exp.name}</span>
                        <span className="font-mono text-[11px] text-ink-3">{exp.docs} docs · {exp.highlights} resaltes</span>
                      </button>
                      <button type="button" className="ib absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Eliminar ${exp.name}`} title="Eliminar expediente" onClick={() => props.onDeleteExpediente(exp.id)}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="m-0 text-ink-3">Aún no tienes expedientes. Crea uno o abre un PDF para empezar.</p>}
            </section>
          </div>

          <aside aria-labelledby="h-notas" className="flex max-w-[340px] flex-[1_1_280px] flex-col gap-2">
            <h2 id="h-notas" className={`${h2} mb-1`}>Últimas notas</h2>
            {notes.map((note) => (
              <button key={note.id} type="button" className="card sb-item flex cursor-pointer flex-col gap-1.5 p-4" onClick={() => props.onOpenExpediente(note.expediente.id, note.doc)}>
                <span className="text-sm leading-normal">{note.note}</span>
                <span className="font-mono text-[11px] text-ink-3">{note.docName} · pág. {note.page} · {note.expediente.name}</span>
              </button>
            ))}
            {!notes.length && <p className="m-0 leading-normal text-ink-3">Las notas que agregues a tus resaltes aparecerán aquí.</p>}
          </aside>
        </main>
        <footer className="flex h-[26px] flex-none items-center gap-[18px] border-t border-line px-3.5 font-mono text-[11px] text-ink-3">
          <span>Guardado en este equipo · {docCount === 1 ? "1 documento" : `${docCount} documentos`}</span><span className="ml-auto">Seabell 0.1</span>
        </footer>
      </div>
    </div>
  );
}

function SideSection({ title, addLabel, onAdd, children }: { title: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between pt-4 pr-2.5 pb-1 pl-5">
        <h2 className="m-0 font-serif text-[15px]">{title}</h2>
        <button type="button" className="ib" aria-label={addLabel} title={addLabel} onClick={onAdd}><Icon name="plus" /></button>
      </div>
      <div className="flex flex-col gap-px px-2.5">{children}</div>
    </section>
  );
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function relativeTime(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), "hour");
  if (minutes < 60 * 48) return "ayer";
  return new Date(at).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
