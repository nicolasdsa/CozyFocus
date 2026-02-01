export type SessionType = "focus" | "shortBreak" | "longBreak";

export type PomodoroDefaultsSetting = {
  focus: number;
  shortBreak: number;
  longBreak: number;
  updatedAt: number;
};

export type TaskFocusSetting = {
  dayKey: string;
  taskId: string | null;
  updatedAt: number;
};

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
  completedAt: number | null;
}
