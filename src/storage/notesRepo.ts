import type { CozyFocusDatabase, NoteRecord } from "./db";
import { getLocalDayKey } from "./dayKey";

interface CreateNoteInput {
  content: string;
  dayKey?: string;
}

export const addNote = async (
  db: CozyFocusDatabase,
  input: CreateNoteInput
): Promise<NoteRecord> => {
  const note: NoteRecord = {
    id: crypto.randomUUID(),
    dayKey: input.dayKey ?? getLocalDayKey(),
    content: input.content,
    updatedAt: Date.now()
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
