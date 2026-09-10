export type ImportedPdf = {
  file: File;
  name: string;
  size: number;
  lastModified: number;
};

const PDF_SIGNATURE = "%PDF-";
const SIGNATURE_BYTES = PDF_SIGNATURE.length;

/**
 * Confirma que el archivo comienza con la firma de un PDF.
 * Solo lee cinco bytes, independientemente del tamaño del archivo.
 */
async function hasPdfSignature(file: File): Promise<boolean> {
  const header = await file.slice(0, SIGNATURE_BYTES).text();
  return header === PDF_SIGNATURE;
}

/**
 * Punto único de entrada para PDFs locales.
 * No crea un ArrayBuffer del documento: conserva la referencia a File para que
 * el visor posterior pueda pedir datos y páginas de forma diferida.
 */
export async function importLocalPdf(file: File): Promise<ImportedPdf> {
  if (!(await hasPdfSignature(file))) {
    throw new Error("El archivo seleccionado no es un PDF válido.");
  }

  return {
    file,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length);
  const value = bytes / 1024 ** unit;
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} ${units[unit - 1]}`;
}
