import type { CozyFocusDatabase, DocRecord } from "./db";
import { getLocalDayKey } from "./dayKey";

interface CreateDocInput {
  title: string;
  markdown: string;
  tags?: string[];
  dayKey?: string;
}

export const addDoc = async (
  db: CozyFocusDatabase,
  input: CreateDocInput
): Promise<DocRecord> => {
  const now = Date.now();
  const doc: DocRecord = {
    id: crypto.randomUUID(),
    dayKey: input.dayKey ?? getLocalDayKey(),
    title: input.title,
    markdown: input.markdown,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now
  };

  await db.put("docs", doc);
  return doc;
};

export const getDocsByDayKey = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<DocRecord[]> => {
  const docs = await db.getAllFromIndex("docs", "dayKey", dayKey);
  return docs.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return b.id.localeCompare(a.id);
  });
};

export const updateDoc = async (
  db: CozyFocusDatabase,
  id: string,
  patch: Partial<Omit<DocRecord, "id" | "dayKey" | "createdAt" | "updatedAt">> &
    Partial<Pick<DocRecord, "dayKey">>
): Promise<DocRecord | null> => {
  const existing = await db.get("docs", id);
  if (!existing) {
    return null;
  }

  const updated: DocRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now()
  };

  await db.put("docs", updated);
  return updated;
};
