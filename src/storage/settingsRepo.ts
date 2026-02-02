import type { CozyFocusDatabase } from "./db";

export const getSetting = async <T>(
  db: CozyFocusDatabase,
  key: string
): Promise<T | null> => {
  const value = await db.get("settings", key);
  return value ?? null;
};

export const saveSetting = async <T>(
  db: CozyFocusDatabase,
  key: string,
  value: T
): Promise<void> => {
  await db.put("settings", value, key);
};

export const getById = async <T>(
  db: CozyFocusDatabase,
  key: string
): Promise<T | undefined> => {
  return db.get("settings", key);
};

export const has = async (
  db: CozyFocusDatabase,
  key: string
): Promise<boolean> => {
  const existing = await db.get("settings", key);
  return Boolean(existing);
};

export const bulkPut = async (
  db: CozyFocusDatabase,
  entries: Array<{ key: string; value: CozyFocusDatabase["settings"]["value"] }>
): Promise<void> => {
  if (entries.length === 0) {
    return;
  }
  const tx = db.transaction("settings", "readwrite");
  for (const entry of entries) {
    await tx.store.put(entry.value, entry.key);
  }
  await tx.done;
};
