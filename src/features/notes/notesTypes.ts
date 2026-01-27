import type { NoteRecord } from "../../storage";

export interface NotesViewState {
  notes: NoteRecord[];
  selectedId: string | null;
  editingId: string | null;
}
