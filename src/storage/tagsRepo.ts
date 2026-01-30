import type { CozyFocusDatabase, TagRecord } from "./db";

export const getAllTags = async (db: CozyFocusDatabase): Promise<TagRecord[]> => {
  const tags = await db.getAll("tagLibrary");
  return tags.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.name.localeCompare(b.name);
  });
};

export const addTag = async (
  db: CozyFocusDatabase,
  name: string
): Promise<TagRecord> => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Tag name cannot be empty");
  }

  const existing = await db.get("tagLibrary", trimmed);
  if (existing) {
    return existing;
  }

  const tag: TagRecord = {
    name: trimmed,
    createdAt: Date.now()
  };

  await db.put("tagLibrary", tag);
  return tag;
};

export const deleteTag = async (
  db: CozyFocusDatabase,
  name: string
): Promise<void> => {
  await db.delete("tagLibrary", name);
};
