type IterableStream = ReadableStream & { [Symbol.asyncIterator]?: () => AsyncIterator<unknown> };

/**
 * El WKWebView del sistema (Tauri en macOS) no implementa la iteración asíncrona de
 * ReadableStream que pdf.js usa en `getTextContent`; sin ella no hay texto, selección
 * ni búsqueda. Se agrega solo donde falta.
 */
function iterableStreams() {
  const proto = ReadableStream.prototype as IterableStream;
  if (proto[Symbol.asyncIterator]) return;
  proto[Symbol.asyncIterator] = async function* (this: ReadableStream) {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

/** Carga pdf.js bajo demanda y apunta su worker al archivo empaquetado. */
export async function loadPdfJs() {
  iterableStreams();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}
