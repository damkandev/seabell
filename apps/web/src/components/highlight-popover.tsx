"use client";

import { useState } from "react";

import type { ActiveHighlightPopoverState } from "@/lib/pdf-selection/types";
import { Icon } from "./icon";
import { popButton, popClass } from "./selection-popover";

export function HighlightPopover({ state, onCopy, onRemove, onClose }: {
  state: NonNullable<ActiveHighlightPopoverState>;
  onCopy: (text: string) => Promise<boolean> | boolean;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await onCopy(state.highlight.text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      data-highlight-popover="true"
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left: `${state.position.x}px`, top: `${state.position.y}px` }}
      className={`${popClass} -mt-2 -translate-x-1/2 -translate-y-full`}
      role="toolbar"
      aria-label="Acciones de destacado"
    >
      <button type="button" className={popButton} onClick={handleCopy} aria-label="Copiar texto destacado">{copied ? "¡Copiado!" : "Copiar"}</button>
      <button type="button" className={popButton} onClick={() => onRemove(state.highlight.id)} aria-label="Eliminar destacado">Quitar resalte</button>
      <button type="button" className={popButton} onClick={onClose} aria-label="Cerrar menú"><Icon name="close" className="size-3.5" /></button>
    </div>
  );
}
