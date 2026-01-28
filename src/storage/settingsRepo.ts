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
