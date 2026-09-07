"use client";

import { Check, Copy, Highlighter } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SelectionPopoverState } from "@/lib/pdf-selection/types";

type SelectionPopoverProps = {
  state: NonNullable<SelectionPopoverState>;
  onCopy: () => Promise<boolean> | boolean;
  onHighlight: () => void;
};

export function SelectionPopover({ state, onCopy, onHighlight }: SelectionPopoverProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1200);
    }
  };

  const isTop = state.position.placement === "top";

  return (
    <div
      data-selection-popover="true"
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        left: `${state.position.x}px`,
        top: `${state.position.y}px`,
      }}
      className={`pointer-events-auto absolute z-30 flex items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur select-none duration-150 animate-in fade-in zoom-in-95 ${
        isTop ? "-translate-x-1/2 -translate-y-full -mt-2" : "-translate-x-1/2 mt-2"
      }`}
      role="toolbar"
      aria-label="Acciones de texto seleccionado"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 px-2 text-xs font-medium"
        aria-label="Copiar texto"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>¡Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden="true" />
            <span>Copiar</span>
          </>
        )}
      </Button>
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onHighlight}
        className="h-7 px-2 text-xs font-medium hover:text-amber-600 dark:hover:text-amber-400"
        aria-label="Destacar texto"
      >
        <Highlighter className="size-3.5" aria-hidden="true" />
        <span>Destacar</span>
      </Button>
    </div>
  );
}
