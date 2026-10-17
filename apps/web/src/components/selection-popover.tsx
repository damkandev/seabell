"use client";

import { useState } from "react";

import type { SelectionPopoverState } from "@/lib/pdf-selection/types";

export const popClass = "sb-pop pointer-events-auto absolute z-30 flex items-center gap-0.5 rounded-[4px] bg-ink p-[3px] font-sans text-[13px] text-surface shadow-[0_8px_24px_-8px_rgb(21_23_26/50%)] select-none";
export const popButton = "press inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[3px] px-2.5 hover:bg-[#2b2f35]";

export function SelectionPopover({ state, onCopy, onHighlight, onNote }: {
  state: NonNullable<SelectionPopoverState>;
  onCopy: () => Promise<boolean> | boolean;
  onHighlight: () => void;
  onNote: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await onCopy())) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      data-selection-popover="true"
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left: `${state.position.x}px`, top: `${state.position.y}px` }}
      className={`${popClass} -translate-x-1/2 ${state.position.placement === "top" ? "-mt-2 -translate-y-full" : "mt-2"}`}
      role="toolbar"
      aria-label="Acciones de texto seleccionado"
    >
      <button type="button" className={popButton} onClick={onHighlight} aria-label="Resaltar texto">
        <span aria-hidden="true" className="size-3 rounded-[2px] bg-mark" />Resaltar
      </button>
      <button type="button" className={popButton} onClick={onNote} aria-label="Agregar nota">Nota</button>
      <button type="button" className={popButton} onClick={handleCopy} aria-label="Copiar texto">
        {copied ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
