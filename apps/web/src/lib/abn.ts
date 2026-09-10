/**
 * Portable `.abn` v1 archive support.
 *
 * An ABN file is UTF-8 JSON, deliberately not a ZIP: it contains application
 * state plus each PDF as base64. This makes the format easy to move between
 * browsers without adding a runtime dependency.
 */

export const ABN_FORMAT = "abn";
export const ABN_VERSION = 1;

/** JSON values accepted as archive state. */
export type AbnSerializableValue =
  | null
  | boolean
  | number
  | string
  | readonly AbnSerializableValue[]
  | { readonly [key: string]: AbnSerializableValue };

/** A PDF to persist in an ABN archive. IDs must be unique within the archive. */
export type AbnPdfInput = {
  id: string;
  file: Blob;
  name?: string;
  lastModified?: number;
};

/** Values supplied to {@link exportAbn}. */
export type AbnExportInput<State extends AbnSerializableValue = AbnSerializableValue> = {
  state: State;
  pdfs: readonly AbnPdfInput[];
  fileName?: string;
};

/** A PDF restored from an ABN archive. */
export type AbnImportedPdf = {
  id: string;
  file: File;
};

/** The result returned by {@link importAbn}. */
export type AbnImportResult<State extends AbnSerializableValue = AbnSerializableValue> = {
  state: State;
  pdfs: AbnImportedPdf[];
};

/** Limits that protect the browser from unexpectedly large JSON/base64 imports. */
export const ABN_LIMITS = {
  maxPdfs: 50,
  maxPdfBytes: 25 * 1024 * 1024,
  maxTotalPdfBytes: 100 * 1024 * 1024,
  maxArchiveBytes: 140 * 1024 * 1024,
  maxStateDepth: 64,
  maxStateNodes: 10_000,
} as const;

const PDF_SIGNATURE = "%PDF-";
const ABN_MIME_TYPE = "application/x-abn+json";

type AbnPdfRecord = {
  id: string;
  name: string;
  lastModified: number;
  data: string;
};

type AbnRecord = {
  format: typeof ABN_FORMAT;
  version: typeof ABN_VERSION;
  state: AbnSerializableValue;
  pdfs: AbnPdfRecord[];
};

/** Error raised when an archive cannot be safely exported or imported. */
export class AbnFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbnFormatError";
  }
}

/**
 * Serializes state and PDFs into a v1 ABN `File`.
 * PDFs are read only after their count and sizes pass the archive limits.
 */
export async function exportAbn<State extends AbnSerializableValue>(
  input: AbnExportInput<State>,
): Promise<File> {
  if (!input || typeof input !== "object") {
    throw new AbnFormatError("No se recibió el estado a exportar.");
  }

  assertSerializableState(input.state);
  const pdfs = await Promise.all(validateExportPdfs(input.pdfs));
  const archive: AbnRecord = {
    format: ABN_FORMAT,
    version: ABN_VERSION,
    state: input.state,
    pdfs,
  };

  let json: string;
  try {
    json = JSON.stringify(archive);
  } catch {
    throw new AbnFormatError("El estado contiene datos que no se pueden convertir a JSON.");
  }

  const fileName = normaliseArchiveName(input.fileName);
  return new File([json], fileName, { type: ABN_MIME_TYPE });
}

/**
 * Restores state and PDF `File`s from a v1 ABN `Blob` or `File`.
 * The generic is a convenience for callers that own and validate their state
 * schema; the archive itself is still checked to be valid JSON data.
 */
export async function importAbn<State extends AbnSerializableValue = AbnSerializableValue>(
  archive: Blob,
): Promise<AbnImportResult<State>> {
  if (!isBlobLike(archive)) {
    throw new AbnFormatError("Selecciona un archivo .abn válido para importar.");
  }
  if (archive.size > ABN_LIMITS.maxArchiveBytes) {
    throw new AbnFormatError("El archivo .abn supera el límite de 140 MB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await archive.text());
  } catch {
    throw new AbnFormatError("El archivo .abn no contiene JSON UTF-8 válido.");
  }

  const record = validateArchive(parsed);
  const pdfs = record.pdfs.map((pdf) => {
    const decoded = decodeBase64(pdf.data, pdf.id);
    // Copy into an ArrayBuffer: BlobPart rejects ArrayBufferLike in newer DOM types.
    const bytes = new Uint8Array(decoded.length);
    bytes.set(decoded);
    return {
      id: pdf.id,
      file: new File([bytes.buffer], pdf.name, {
        type: "application/pdf",
        lastModified: pdf.lastModified,
      }),
    };
  });

  return { state: record.state as State, pdfs };
}

function validateExportPdfs(pdfs: readonly AbnPdfInput[]): Promise<AbnPdfRecord>[] {
  if (!Array.isArray(pdfs)) {
    throw new AbnFormatError("Los PDFs a exportar deben ser una lista.");
  }
  if (pdfs.length > ABN_LIMITS.maxPdfs) {
    throw new AbnFormatError(`Un archivo .abn admite como máximo ${ABN_LIMITS.maxPdfs} PDFs.`);
  }

  const ids = new Set<string>();
  let totalBytes = 0;
  return pdfs.map(async (pdf, index) => {
    if (!pdf || typeof pdf !== "object" || !isBlobLike(pdf.file)) {
      throw new AbnFormatError(`El PDF ${index + 1} no contiene un Blob o File válido.`);
    }
    assertId(pdf.id, ids, `PDF ${index + 1}`);
    if (pdf.file.size > ABN_LIMITS.maxPdfBytes) {
      throw new AbnFormatError(`El PDF “${pdf.id}” supera el límite de 25 MB.`);
    }
    totalBytes += pdf.file.size;
    if (totalBytes > ABN_LIMITS.maxTotalPdfBytes) {
      throw new AbnFormatError("Los PDFs superan el límite total de 100 MB por archivo .abn.");
    }

    const bytes = new Uint8Array(await pdf.file.arrayBuffer());
    assertPdfHeader(bytes, pdf.id);
    return {
      id: pdf.id,
      name: normalisePdfName(pdf.name ?? fileNameOf(pdf.file) ?? `${pdf.id}.pdf`, pdf.id),
      lastModified: normaliseLastModified(pdf.lastModified ?? lastModifiedOf(pdf.file)),
      data: encodeBase64(bytes),
    };
  });
}

function validateArchive(value: unknown): AbnRecord {
  if (!isRecord(value)) throw new AbnFormatError("El archivo .abn debe contener un objeto JSON.");
  if (value.format !== ABN_FORMAT) throw new AbnFormatError("El archivo no usa el formato .abn.");
  if (value.version !== ABN_VERSION) {
    throw new AbnFormatError(`Versión .abn no compatible: se esperaba la versión ${ABN_VERSION}.`);
  }
  assertSerializableState(value.state);
  if (!Array.isArray(value.pdfs)) throw new AbnFormatError("El archivo .abn no contiene una lista de PDFs.");
  if (value.pdfs.length > ABN_LIMITS.maxPdfs) {
    throw new AbnFormatError(`El archivo .abn supera el máximo de ${ABN_LIMITS.maxPdfs} PDFs.`);
  }

  const ids = new Set<string>();
  let totalBytes = 0;
  const pdfs = value.pdfs.map((pdf, index) => {
    if (!isRecord(pdf)) throw new AbnFormatError(`La entrada PDF ${index + 1} está mal formada.`);
    assertId(pdf.id, ids, `PDF ${index + 1}`);
    if (typeof pdf.name !== "string") throw new AbnFormatError(`El PDF “${pdf.id}” no tiene un nombre válido.`);
    const name = normalisePdfName(pdf.name, pdf.id);
    if (typeof pdf.lastModified !== "number" || !Number.isFinite(pdf.lastModified) || pdf.lastModified < 0) {
      throw new AbnFormatError(`El PDF “${pdf.id}” tiene una fecha inválida.`);
    }
    if (typeof pdf.data !== "string") throw new AbnFormatError(`El PDF “${pdf.id}” no contiene datos base64.`);
    const bytes = decodeBase64(pdf.data, pdf.id);
    if (bytes.byteLength > ABN_LIMITS.maxPdfBytes) {
      throw new AbnFormatError(`El PDF “${pdf.id}” supera el límite de 25 MB.`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > ABN_LIMITS.maxTotalPdfBytes) {
      throw new AbnFormatError("Los PDFs importados superan el límite total de 100 MB.");
    }
    assertPdfHeader(bytes, pdf.id);
    return { id: pdf.id, name, lastModified: Math.floor(pdf.lastModified), data: pdf.data };
  });
  return { format: ABN_FORMAT, version: ABN_VERSION, state: value.state, pdfs };
}

function assertSerializableState(value: unknown): asserts value is AbnSerializableValue {
  const seen = new Set<unknown>();
  let nodes = 0;
  const visit = (current: unknown, depth: number): void => {
    if (++nodes > ABN_LIMITS.maxStateNodes) throw new AbnFormatError("El estado tiene demasiados valores para exportar.");
    if (depth > ABN_LIMITS.maxStateDepth) throw new AbnFormatError("El estado es demasiado profundo para exportar.");
    if (current === null || typeof current === "boolean" || typeof current === "string") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new AbnFormatError("El estado no puede contener números no finitos.");
      return;
    }
    if (typeof current !== "object") throw new AbnFormatError("El estado debe contener únicamente valores JSON.");
    if (seen.has(current)) throw new AbnFormatError("El estado contiene una referencia circular.");
    const prototype = Object.getPrototypeOf(current);
    if (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null) {
      throw new AbnFormatError("El estado debe usar objetos JSON simples.");
    }
    seen.add(current);
    for (const child of Array.isArray(current) ? current : Object.values(current)) visit(child, depth + 1);
    seen.delete(current);
  };
  visit(value, 0);
}

function assertId(id: unknown, ids: Set<string>, label: string): asserts id is string {
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 200) {
    throw new AbnFormatError(`${label} debe tener un ID de texto no vacío de hasta 200 caracteres.`);
  }
  if (ids.has(id)) throw new AbnFormatError(`El ID de PDF “${id}” está duplicado.`);
  ids.add(id);
}

function assertPdfHeader(bytes: Uint8Array, id: string): void {
  if (bytes.byteLength < PDF_SIGNATURE.length || PDF_SIGNATURE.split("").some((char, i) => bytes[i] !== char.charCodeAt(0))) {
    throw new AbnFormatError(`El archivo asociado al PDF “${id}” no comienza con la cabecera %PDF-.`);
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64(data: string, id: string): Uint8Array {
  if (data.length === 0 || data.length > Math.ceil(ABN_LIMITS.maxPdfBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw new AbnFormatError(`Los datos base64 del PDF “${id}” son inválidos o demasiado grandes.`);
  }
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new AbnFormatError(`Los datos base64 del PDF “${id}” están dañados.`);
  }
}

function normalisePdfName(name: string, id: string): string {
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
    throw new AbnFormatError(`El PDF “${id}” debe tener un nombre de hasta 255 caracteres.`);
  }
  return name;
}

function normaliseArchiveName(name: unknown): string {
  if (name !== undefined && typeof name !== "string") {
    throw new AbnFormatError("El nombre del archivo .abn debe ser texto.");
  }
  const candidate = name?.trim() || "archive.abn";
  if (candidate.length > 255) throw new AbnFormatError("El nombre del archivo .abn es demasiado largo.");
  return candidate.toLowerCase().endsWith(".abn") ? candidate : `${candidate}.abn`;
}

function normaliseLastModified(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : Date.now();
}

function isBlobLike(value: unknown): value is Blob {
  return !!value && typeof value === "object" && typeof (value as Blob).size === "number" && typeof (value as Blob).arrayBuffer === "function";
}

function fileNameOf(file: Blob): string | undefined {
  return typeof (file as File).name === "string" ? (file as File).name : undefined;
}

function lastModifiedOf(file: Blob): number | undefined {
  return typeof (file as File).lastModified === "number" ? (file as File).lastModified : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
