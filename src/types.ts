export type SessionType = "focus" | "shortBreak" | "longBreak";

export interface NoteEntry {
  id: string;
  content: string;
  updatedAt: number;
}

export interface TaskEntry {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}
