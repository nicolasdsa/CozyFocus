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
    id: crypto.randomUUID(),
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
