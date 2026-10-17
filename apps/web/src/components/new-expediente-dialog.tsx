"use client";

import { useEffect, useId, useRef } from "react";

export const dialogClass = "m-auto w-[min(440px,calc(100vw-32px))] rounded-[4px] bg-paper p-0 text-ink shadow-[0_0_0_1px_var(--line),0_24px_48px_-16px_rgb(21_23_26/40%)] backdrop:bg-[rgb(21_23_26/35%)]";

/** Abre o cierra un `<dialog>` nativo como modal según `open`. */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return ref;
}

export function NewExpedienteDialog({ open, onClose, onConfirm }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const ref = useModal(open);
  return (
    <dialog ref={ref} className={dialogClass} aria-labelledby="nuevo-expediente" onClose={onClose}>
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          const name = new FormData(event.currentTarget).get("name")?.toString().trim();
          if (name) onConfirm(name);
          event.currentTarget.reset();
        }}
      >
        <h2 id="nuevo-expediente" className="m-0 font-serif text-[22px] tracking-[-0.015em]">Nuevo expediente</h2>
        <label className="flex flex-col gap-1.5 text-ink-2">
          Nombre o rol
          <input name="name" required autoFocus placeholder="Ej. Rol C-2418-2025" className="h-9 rounded-[3px] bg-paper px-2.5 text-ink shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus:shadow-[inset_0_0_0_1px_var(--ink)]" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="ib px-3" onClick={onClose}>Cancelar</button>
          <button type="submit" className="press h-8 cursor-pointer rounded-[3px] bg-ink px-3 text-surface shadow-[inset_0_-2px_0_rgb(0_0_0/35%)] hover:bg-[#2b2f35]">Crear</button>
        </div>
      </form>
    </dialog>
  );
}

/** Confirmación de una acción destructiva; Cancelar o Escape la descartan. */
export function ConfirmDialog({ open, title, children, confirmLabel, onClose, onConfirm }: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useModal(open);
  const id = useId();
  return (
    <dialog ref={ref} className={dialogClass} aria-labelledby={id} onClose={onClose}>
      <form method="dialog" className="flex flex-col gap-4 p-6" onSubmit={onConfirm}>
        <h2 id={id} className="m-0 font-serif text-[22px] tracking-[-0.015em]">{title}</h2>
        <p className="m-0 leading-normal text-ink-2">{children}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="ib px-3" autoFocus onClick={onClose}>Cancelar</button>
          <button type="submit" className="press h-8 cursor-pointer rounded-[3px] bg-destructive px-3 text-surface hover:opacity-90">{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
