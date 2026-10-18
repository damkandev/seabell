import { clsx, type ClassValue } from "clsx"
import { useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Identificador para datos locales. `randomUUID` requiere un contexto seguro,
 * por lo que no está disponible al abrir el servidor de desarrollo mediante
 * una IP HTTP de la red local.
 */
export function createLocalId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Aplica `update` dentro de una View Transition nativa para que lo que se
 * elimina se desvanezca y el resto se reacomode. Sin soporte o con movimiento
 * reducido, aplica el cambio directamente.
 */
export function withViewTransition(update: () => void): void {
  if (!("startViewTransition" in document) || matchMedia("(prefers-reduced-motion: reduce)").matches) return update()
  document.startViewTransition(() => flushSync(update))
}

const noSubscribe = () => () => {}

/** Etiquetas de atajos: ⌘/⇧/⌥ en macOS, Ctrl/Shift/Alt en el resto. El HTML estático asume macOS. */
export function useKeys() {
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => true)
  return mac
    ? { mod: (key: string) => `⌘${key}`, shiftMod: (key: string) => `⇧⌘${key}`, alt: "⌥" }
    : { mod: (key: string) => `Ctrl+${key}`, shiftMod: (key: string) => `Ctrl+Shift+${key}`, alt: "Alt" }
}
