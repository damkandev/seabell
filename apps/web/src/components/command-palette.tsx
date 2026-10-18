"use client";

import { useState } from "react";

import { Icon, type IconName } from "./icon";
import { dialogClass, useModal } from "./new-expediente-dialog";

export type PaletteItem = { id: string; label: string; hint: string; icon: IconName; run: () => void };

/**
 * Búsqueda global por nombre de expediente, documento o escrito.
 * ponytail: no busca dentro del texto; la búsqueda de contenido vive en cada expediente (⌘F o Ctrl+F).
 */
export function CommandPalette({ open, items, onClose }: { open: boolean; items: PaletteItem[]; onClose: () => void }) {
  const ref = useModal(open);
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const matches = items.filter((item) => normalize(`${item.label} ${item.hint}`).includes(normalize(query.trim()))).slice(0, 12);
  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <dialog ref={ref} className={`${dialogClass} mt-[12vh] w-[min(560px,calc(100vw-32px))]`} aria-label="Buscar en todo" onClose={() => { setQuery(""); onClose(); }}>
      <label className="flex h-12 items-center gap-2.5 border-b border-line px-4 text-ink-3">
        <Icon name="search" className="size-4" />
        <input
          autoFocus
          aria-label="Buscar en todo"
          placeholder="Busca expedientes, documentos o escritos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") run(matches[0]); }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
        <kbd>esc</kbd>
      </label>
      <ul className="m-0 max-h-[50vh] list-none overflow-y-auto p-1.5">
        {matches.map((item) => (
          <li key={item.id}>
            <button type="button" className="node h-9" onClick={() => run(item)}>
              <Icon name={item.icon} /><span className="min-w-0 truncate text-ink">{item.label}</span><span className="ml-auto truncate text-xs text-ink-3">{item.hint}</span>
            </button>
          </li>
        ))}
        {!matches.length && <li className="px-2.5 py-3 text-ink-3">Sin resultados.</li>}
      </ul>
    </dialog>
  );
}
