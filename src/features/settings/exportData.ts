import { DB_VERSION, openCozyDB } from "../../storage";

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

export const exportData = async (options: ExportOptions = {}): Promise<ExportBundle> => {
  const now = options.now ?? Date.now();
  const db = await openCozyDB(options.dbName);
  const hasTags = db.objectStoreNames.contains("tagLibrary");

  try {
    const [tasks, notes, sessions, stats, docs, settings, tags] = await Promise.all([
      readAllFromStore(db, "tasks"),
      readAllFromStore(db, "notes"),
      readAllFromStore(db, "sessions"),
      readAllFromStore(db, "stats"),
      readAllFromStore(db, "docs"),
      readAllFromStore(db, "settings"),
      readAllFromStore(db, "tagLibrary")
    ]);

    const data: ExportBundle["data"] = {
      tasks,
      notes,
      sessions,
      stats,
      docs,
      settings
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
