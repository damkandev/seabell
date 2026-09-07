"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "./ui/button";

export type NewExpedienteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
};

export function NewExpedienteDialog({ open, onClose, onConfirm }: NewExpedienteDialogProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
      setName("");
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) { setName(""); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background p-6 shadow-lg border border-border">
          <Dialog.Title className="text-lg font-semibold mb-4 text-foreground">
            Crear nuevo expediente
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Nombre del expediente
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Ej. Sucesión García"
              />
            </label>
            <div className="flex justify-end gap-2 mt-4">
              
                <Button variant="outline" type="button" onClick={() => { setName(""); onClose(); }}>
                  Cancelar
                </Button>
              
              <Button type="submit" disabled={!name.trim()}>
                Crear
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
