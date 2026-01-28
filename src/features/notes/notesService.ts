import { openCozyDB, type NoteRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";

export interface NotesService {
  getNotes: (dayKey?: string) => Promise<NoteRecord[]>;
  addNote: (content?: string, dayKey?: string) => Promise<NoteRecord>;
  updateNote: (id: string, content: string) => Promise<NoteRecord | null>;
  deleteNote: (id: string) => Promise<void>;
  close: () => Promise<void>;
}

const sortNotes = (notes: NoteRecord[]): NoteRecord[] => {
  return [...notes].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt - b.updatedAt;
    }
    return a.id.localeCompare(b.id);
  });
};

export const createNotesService = (options?: { dbName?: string }): NotesService => {
  const dbPromise = openCozyDB(options?.dbName);
  const resolveDayKey = (dayKey?: string) => dayKey ?? getLocalDayKey();

  const getNotes = async (dayKey?: string): Promise<NoteRecord[]> => {
    const db = await dbPromise;
    const notes = await db.getAllFromIndex("notes", "dayKey", resolveDayKey(dayKey));
    return sortNotes(notes);
  };

  const addNote = async (content: string = "", dayKey?: string): Promise<NoteRecord> => {
    const db = await dbPromise;
    const now = Date.now();
    const note: NoteRecord = {
      id: crypto.randomUUID(),
      dayKey: resolveDayKey(dayKey),
      content,
      updatedAt: now
    };

    await db.put("notes", note);
    return note;
  };

  const updateNote = async (id: string, content: string): Promise<NoteRecord | null> => {
    const db = await dbPromise;
    const existing = await db.get("notes", id);
    if (!existing) {
      return null;
    }

    const updated: NoteRecord = {
      ...existing,
      content,
      updatedAt: Date.now()
    };

    await db.put("notes", updated);
    return updated;
  };

  const deleteNote = async (id: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete("notes", id);
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getNotes,
    addNote,
    updateNote,
    deleteNote,
    close
  };
};
