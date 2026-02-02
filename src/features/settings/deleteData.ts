import { openCozyDB } from "../../storage";

const STORE_NAMES = [
  "tasks",
  "notes",
  "sessions",
  "stats",
  "docs",
  "settings",
  "tagLibrary"
] as const;

type StoreName = (typeof STORE_NAMES)[number];

type ClearOptions = {
  dbName?: string;
};

export const clearAllStores = async (options: ClearOptions = {}): Promise<void> => {
  const db = await openCozyDB(options.dbName);
  try {
    const storesToClear = STORE_NAMES.filter((store) => db.objectStoreNames.contains(store));
    if (storesToClear.length === 0) {
      return;
    }
    const tx = db.transaction(storesToClear as StoreName[], "readwrite");
    await Promise.all(storesToClear.map((store) => tx.objectStore(store).clear()));
    await tx.done;
  } finally {
    db.close();
  }
};
