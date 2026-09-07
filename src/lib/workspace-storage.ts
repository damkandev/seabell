/**
 * Persistencia exclusivamente del navegador para un workspace y sus documentos.
 * El manifiesto vive en localStorage (para poder recuperarlo aun si IndexedDB no
 * está disponible) y los Blob viven en IndexedDB.
 */

export const WORKSPACE_STORAGE_VERSION = 1;

const KEY_PREFIX = `seabell.workspace.v${WORKSPACE_STORAGE_VERSION}`;
const DATABASE_NAME = "seabell-workspaces";
const DATABASE_VERSION = 1;
const BLOB_STORE = "documents";

export type SerializableWorkspace = Record<string, unknown> | unknown[];

export type WorkspaceDocumentMetadata = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export type WorkspaceDocumentInput = {
  id: string;
  /** Alias explícito cuando el consumidor trabaja directamente con Blob. */
  blob?: Blob;
  /** Acepta File y Blob: File extiende Blob en las APIs web. */
  file?: Blob;
  /** Se usa el nombre de File cuando está disponible. */
  name?: string;
  /** Se usa el tipo del Blob cuando está disponible. */
  type?: string;
  /** Se usa lastModified de File cuando está disponible. */
  lastModified?: number;
};

export type StoredWorkspace<T extends SerializableWorkspace = SerializableWorkspace> = {
  version: typeof WORKSPACE_STORAGE_VERSION;
  savedAt: number;
  workspace: T;
  documents: WorkspaceDocumentMetadata[];
};

export type RestoredWorkspaceDocument = {
  metadata: WorkspaceDocumentMetadata;
  blob: Blob;
  file: File;
};

export type RestoredWorkspace<T extends SerializableWorkspace = SerializableWorkspace> = Omit<StoredWorkspace<T>, "documents"> & {
  documents: RestoredWorkspaceDocument[];
  missingDocumentIds: string[];
  /** Existe cuando se recuperó el manifiesto, pero IndexedDB falló. */
  documentError?: WorkspaceStorageError;
};

export type WorkspaceStorageErrorCode =
  | "invalid-key"
  | "invalid-document"
  | "not-serializable"
  | "storage-unavailable"
  | "read-failed"
  | "write-failed"
  | "delete-failed";

export class WorkspaceStorageError extends Error {
  readonly code: WorkspaceStorageErrorCode;

  constructor(code: WorkspaceStorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkspaceStorageError";
    this.code = code;
  }
}

type BlobRecord = { id: string; workspaceKey: string; blob: Blob };

let databasePromise: Promise<IDBDatabase> | undefined;

function storageKey(workspaceKey: string): string {
  if (!workspaceKey || workspaceKey.trim() !== workspaceKey) {
    throw new WorkspaceStorageError("invalid-key", "La clave del workspace debe ser un texto no vacío y sin espacios externos.");
  }

  return `${KEY_PREFIX}:${encodeURIComponent(workspaceKey)}`;
}

function localStorageOrThrow(): Storage {
  if (typeof window === "undefined") {
    throw new WorkspaceStorageError("storage-unavailable", "El almacenamiento de workspaces solo está disponible en el navegador.");
  }

  try {
    return window.localStorage;
  } catch (cause) {
    throw new WorkspaceStorageError("storage-unavailable", "localStorage no está disponible en este contexto.", { cause });
  }
}

function getDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new WorkspaceStorageError("storage-unavailable", "IndexedDB no está disponible en este navegador."));
  }

  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BLOB_STORE)) {
        const store = database.createObjectStore(BLOB_STORE, { keyPath: "id" });
        store.createIndex("workspaceKey", "workspaceKey", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new WorkspaceStorageError("storage-unavailable", "No se pudo abrir IndexedDB.", { cause: request.error ?? undefined }));
    request.onblocked = () => reject(new WorkspaceStorageError("storage-unavailable", "IndexedDB está bloqueado por otra pestaña."));
  });

  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("La transacción de IndexedDB falló."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La transacción de IndexedDB fue cancelada."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("La operación de IndexedDB falló."));
  });
}

function metadataFor(input: WorkspaceDocumentInput): WorkspaceDocumentMetadata {
  const blob = input.file ?? input.blob;
  if (!input.id || !blob) {
    throw new WorkspaceStorageError("invalid-document", "Cada documento requiere un id y un Blob.");
  }

  const file = typeof File !== "undefined" && blob instanceof File ? blob : undefined;
  return {
    id: input.id,
    name: input.name ?? file?.name ?? "documento",
    type: input.type ?? blob.type,
    size: blob.size,
    lastModified: input.lastModified ?? file?.lastModified ?? Date.now(),
  };
}

function blobFor(input: WorkspaceDocumentInput): Blob {
  const blob = input.file ?? input.blob;
  if (!blob) {
    throw new WorkspaceStorageError("invalid-document", "Cada documento requiere un File o Blob.");
  }
  return blob;
}

function serializable<T extends SerializableWorkspace>(workspace: T): T {
  try {
    const json = JSON.stringify(workspace);
    if (json === undefined) throw new Error("El valor no produce JSON.");
    return JSON.parse(json) as T;
  } catch (cause) {
    throw new WorkspaceStorageError("not-serializable", "El workspace debe poder serializarse como JSON.", { cause });
  }
}

function parseStoredWorkspace<T extends SerializableWorkspace>(value: string): StoredWorkspace<T> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") throw new Error("El manifiesto no es un objeto.");
    const record = parsed as Partial<StoredWorkspace<T>>;
    if (record.version !== WORKSPACE_STORAGE_VERSION || !Array.isArray(record.documents) || !("workspace" in record)) {
      throw new Error("El manifiesto no coincide con la versión esperada.");
    }
    return record as StoredWorkspace<T>;
  } catch (cause) {
    throw new WorkspaceStorageError("read-failed", "El manifiesto del workspace está dañado o tiene una versión incompatible.", { cause });
  }
}

/** Convierte el Blob restaurado y su metadata en un File listo para el visor. */
export function documentMetadataToFile(metadata: WorkspaceDocumentMetadata, blob: Blob): File {
  if (typeof File === "undefined") {
    throw new WorkspaceStorageError("storage-unavailable", "File no está disponible en este entorno.");
  }

  return new File([blob], metadata.name, { type: metadata.type || blob.type, lastModified: metadata.lastModified });
}

/** Alias descriptivo para consumidores que ya tienen metadata y Blob separados. */
export const fileFromDocumentMetadata = documentMetadataToFile;

export async function saveWorkspace<T extends SerializableWorkspace>(
  workspaceKey: string,
  workspace: T,
  documents: readonly WorkspaceDocumentInput[] = [],
): Promise<StoredWorkspace<T>> {
  const key = storageKey(workspaceKey);
  const metadata = documents.map(metadataFor);
  if (new Set(metadata.map((document) => document.id)).size !== metadata.length) {
    throw new WorkspaceStorageError("invalid-document", "Los ids de los documentos deben ser únicos dentro del workspace.");
  }

  const record: StoredWorkspace<T> = {
    version: WORKSPACE_STORAGE_VERSION,
    savedAt: Date.now(),
    workspace: serializable(workspace),
    documents: metadata,
  };

  try {
    localStorageOrThrow().setItem(key, JSON.stringify(record));
  } catch (cause) {
    if (cause instanceof WorkspaceStorageError) throw cause;
    throw new WorkspaceStorageError("write-failed", "No se pudo guardar el manifiesto del workspace en localStorage.", { cause });
  }

  try {
    const database = await getDatabase();
    const transaction = database.transaction(BLOB_STORE, "readwrite");
    const store = transaction.objectStore(BLOB_STORE);
    const index = store.index("workspaceKey");
    const oldIds = await requestResult(index.getAllKeys(IDBKeyRange.only(key)));
    oldIds.forEach((id) => store.delete(id));
    documents.forEach((document) => store.put({ id: `${key}:${document.id}`, workspaceKey: key, blob: blobFor(document) } satisfies BlobRecord));
    await transactionDone(transaction);
  } catch (cause) {
    throw new WorkspaceStorageError("write-failed", "Se guardó el manifiesto en localStorage, pero no se pudieron guardar los documentos en IndexedDB.", { cause });
  }

  return record;
}

export async function getWorkspace<T extends SerializableWorkspace>(workspaceKey: string): Promise<RestoredWorkspace<T> | null> {
  const key = storageKey(workspaceKey);
  let raw: string | null;
  try {
    raw = localStorageOrThrow().getItem(key);
  } catch (cause) {
    if (cause instanceof WorkspaceStorageError) throw cause;
    throw new WorkspaceStorageError("read-failed", "No se pudo leer el manifiesto del workspace.", { cause });
  }
  if (raw === null) return null;

  const record = parseStoredWorkspace<T>(raw);
  try {
    const database = await getDatabase();
    const transaction = database.transaction(BLOB_STORE, "readonly");
    const store = transaction.objectStore(BLOB_STORE);
    const restored = await Promise.all(record.documents.map(async (metadata) => {
      const item = await requestResult(store.get(`${key}:${metadata.id}`)) as BlobRecord | undefined;
      if (!item) return null;
      return { metadata, blob: item.blob, file: documentMetadataToFile(metadata, item.blob) };
    }));
    await transactionDone(transaction);
    const documents = restored.filter((document): document is RestoredWorkspaceDocument => document !== null);
    return { ...record, documents, missingDocumentIds: record.documents.filter((metadata) => !documents.some((document) => document.metadata.id === metadata.id)).map((metadata) => metadata.id) };
  } catch (cause) {
    const documentError = cause instanceof WorkspaceStorageError
      ? cause
      : new WorkspaceStorageError("read-failed", "Se recuperó el manifiesto, pero no se pudieron leer los documentos desde IndexedDB.", { cause });
    return { ...record, documents: [], missingDocumentIds: record.documents.map((document) => document.id), documentError };
  }
}

export async function deleteWorkspace(workspaceKey: string): Promise<void> {
  const key = storageKey(workspaceKey);
  try {
    localStorageOrThrow().removeItem(key);
  } catch (cause) {
    if (cause instanceof WorkspaceStorageError) throw cause;
    throw new WorkspaceStorageError("delete-failed", "No se pudo eliminar el manifiesto del workspace.", { cause });
  }

  try {
    const database = await getDatabase();
    const transaction = database.transaction(BLOB_STORE, "readwrite");
    const store = transaction.objectStore(BLOB_STORE);
    const oldIds = await requestResult(store.index("workspaceKey").getAllKeys(IDBKeyRange.only(key)));
    oldIds.forEach((id) => store.delete(id));
    await transactionDone(transaction);
  } catch (cause) {
    throw new WorkspaceStorageError("delete-failed", "Se eliminó el manifiesto, pero no se pudieron eliminar los documentos de IndexedDB.", { cause });
  }
}
