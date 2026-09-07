"use client";

import { Check, Copy, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ActiveHighlightPopoverState } from "@/lib/pdf-selection/types";

type HighlightPopoverProps = {
  state: NonNullable<ActiveHighlightPopoverState>;
  onCopy: (text: string) => Promise<boolean> | boolean;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function HighlightPopover({ state, onCopy, onRemove, onClose }: HighlightPopoverProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy(state.highlight.text);
    if (success) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1200);
    }
  };

  return (
    <div
      data-highlight-popover="true"
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        left: `${state.position.x}px`,
        top: `${state.position.y}px`,
      }}
      className="pointer-events-auto absolute z-30 flex -translate-x-1/2 -translate-y-full -mt-2 items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur select-none duration-150 animate-in fade-in zoom-in-95"
      role="toolbar"
      aria-label="Acciones de destacado"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 px-2 text-xs font-medium"
        aria-label="Copiar texto destacado"
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
        onClick={() => onRemove(state.highlight.id)}
        className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Eliminar destacado"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span>Eliminar</span>
      </Button>
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="size-7 text-muted-foreground hover:text-foreground"
        aria-label="Cerrar menú"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
