"use client";

import { useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

type State =
  | { kind: "idle" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; percent: number | null }
  | { kind: "error" };

/** Al abrir revisa una vez si hay una versión nueva publicada y ofrece instalarla. Solo corre dentro de Tauri. */
export function UpdateNotice() {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    import("@tauri-apps/plugin-updater")
      .then(({ check }) => check())
      .then((update) => { if (active && update) setState({ kind: "available", update }); })
      // Sin conexión o sin release publicado: se vuelve a revisar en el próximo inicio.
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function install(update: Update) {
    let total = 0;
    let done = 0;
    setState({ kind: "installing", percent: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress" && total) {
          done += event.data.chunkLength;
          setState({ kind: "installing", percent: Math.round((done / total) * 100) });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "idle") return null;

  const dismiss = () => setState({ kind: "idle" });
  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-[3px] bg-ink py-2 pr-2 pl-4 text-sm text-surface shadow-[0_8px_24px_-8px_rgb(21_23_26/50%)]">
      {state.kind === "available" && (
        <>
          <span>Seabell {state.update.version} está disponible.</span>
          <button type="button" onClick={dismiss} className="h-8 cursor-pointer rounded-[3px] px-2 text-surface/75 hover:text-surface">Más tarde</button>
          <button type="button" onClick={() => void install(state.update)} className="h-8 cursor-pointer rounded-[3px] bg-surface px-3 text-ink hover:bg-paper">Actualizar y reiniciar</button>
        </>
      )}
      {state.kind === "installing" && <span className="py-1.5 pr-2">Descargando actualización…{state.percent !== null && ` ${state.percent} %`}</span>}
      {state.kind === "error" && (
        <>
          <span>No se pudo actualizar. Se volverá a intentar al abrir Seabell.</span>
          <button type="button" onClick={dismiss} className="h-8 cursor-pointer rounded-[3px] px-2 text-surface/75 hover:text-surface">Cerrar</button>
        </>
      )}
    </div>
  );
}
