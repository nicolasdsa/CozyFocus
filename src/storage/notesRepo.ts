import { v4 as uuidv4 } from 'uuid';
import type { CozyFocusDatabase, NoteRecord } from "./db";
import { getLocalDayKey } from "./dayKey";

interface CreateNoteInput {
  content: string;
  dayKey?: string;
}

let lastNoteTimestamp = 0;

export const addNote = async (
  db: CozyFocusDatabase,
  input: CreateNoteInput
): Promise<NoteRecord> => {
  const now = Date.now();
  const updatedAt = now <= lastNoteTimestamp ? lastNoteTimestamp + 1 : now;
  lastNoteTimestamp = updatedAt;

  const note: NoteRecord = {
    id: uuidv4(),
    dayKey: input.dayKey ?? getLocalDayKey(),
    content: input.content,
    updatedAt
  };

  await db.put("notes", note);
  return note;
};

export const getNotesByDay = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<NoteRecord[]> => {
  const notes = await db.getAllFromIndex("notes", "dayKey", dayKey);
  return notes.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt - b.updatedAt;
    }
    return a.id.localeCompare(b.id);
  });
};

export const deleteNote = async (
  db: CozyFocusDatabase,
  id: string
): Promise<void> => {
  await db.delete("notes", id);
};

export const getById = async (
  db: CozyFocusDatabase,
  id: string
): Promise<NoteRecord | undefined> => {
  return db.get("notes", id);
};

export const has = async (
  db: CozyFocusDatabase,
  id: string
): Promise<boolean> => {
  const existing = await db.get("notes", id);
  return Boolean(existing);
};

export const bulkPut = async (
  db: CozyFocusDatabase,
  records: NoteRecord[]
): Promise<void> => {
  if (records.length === 0) {
    return;
  }
  const tx = db.transaction("notes", "readwrite");
  for (const record of records) {
    await tx.store.put(record);
  }
  await tx.done;
};
