import { DB_VERSION, openCozyDB } from "../../storage";
import type { VisualImage } from "../background/backgroundTypes";

export type ExportVisualAsset = {
  id: string;
  kind: "image";
  mime: string;
  createdAt: number;
  blobBase64: string;
};

export type ExportBundle = {
  schemaVersion: number;
  exportedAt: number;
  app: "CozyFocus";
  data: {
    tasks: any[];
    notes: any[];
    sessions: any[];
    stats: any[];
    docs: any[];
    settings: any[];
    visualAssets?: ExportVisualAsset[];
    tags?: any[];
  };
};

type ExportOptions = {
  dbName?: string;
  now?: number;
  schemaVersion?: number;
};

const readAllFromStore = async (
  db: Awaited<ReturnType<typeof openCozyDB>>,
  storeName: string
): Promise<any[]> => {
  if (!db.objectStoreNames.contains(storeName)) {
    return [];
  }
  try {
    return await db.getAll(storeName as never);
  } catch {
    return [];
  }
};

const toBase64 = (bytes: Uint8Array): string => {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (v: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }
  throw new Error("Base64 encoding is unavailable in this environment.");
};

const encodeVisualAsset = async (record: VisualImage): Promise<ExportVisualAsset> => {
  const bytes = new Uint8Array(await record.blob.arrayBuffer());
  return {
    id: record.id,
    kind: "image",
    mime: record.mime,
    createdAt: record.createdAt,
    blobBase64: toBase64(bytes)
  };
};

export const exportData = async (options: ExportOptions = {}): Promise<ExportBundle> => {
  const now = options.now ?? Date.now();
  const db = await openCozyDB(options.dbName);
  const hasTags = db.objectStoreNames.contains("tagLibrary");

  try {
    const [tasks, notes, sessions, stats, docs, settings, tags, visualAssets] = await Promise.all([
      readAllFromStore(db, "tasks"),
      readAllFromStore(db, "notes"),
      readAllFromStore(db, "sessions"),
      readAllFromStore(db, "stats"),
      readAllFromStore(db, "docs"),
      readAllFromStore(db, "settings"),
      readAllFromStore(db, "tagLibrary"),
      readAllFromStore(db, "visualAssets")
    ]);

    const encodedVisualAssets = await Promise.all(
      (visualAssets as VisualImage[])
        .filter((entry) => entry && entry.kind === "image" && entry.blob instanceof Blob)
        .map((entry) => encodeVisualAsset(entry))
    );

    const data: ExportBundle["data"] = {
      tasks,
      notes,
      sessions,
      stats,
      docs,
      settings,
      visualAssets: encodedVisualAssets
    };

    if (hasTags) {
      data.tags = tags;
    }

    return {
      schemaVersion: options.schemaVersion ?? DB_VERSION,
      exportedAt: now,
      app: "CozyFocus",
      data
    };
  } finally {
    db.close();
  }
};
