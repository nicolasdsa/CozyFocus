export type SessionType = "focus" | "short-break" | "long-break";

export interface NoteEntry {
  id: string;
  content: string;
  updatedAt: number;
}
