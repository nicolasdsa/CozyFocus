import type { CozyFocusDatabase, TaskRecord } from "./db";
import { getLocalDayKey } from "./dayKey";

interface CreateTaskInput {
  title: string;
  dayKey?: string;
  completed?: boolean;
}

export const createTask = async (
  db: CozyFocusDatabase,
  input: CreateTaskInput
): Promise<TaskRecord> => {
  const now = Date.now();
  const task: TaskRecord = {
    id: crypto.randomUUID(),
    dayKey: input.dayKey ?? getLocalDayKey(),
    title: input.title,
    completed: input.completed ?? false,
    createdAt: now,
    updatedAt: now
  };

  await db.put("tasks", task);
  return task;
};

export const getTasksByDay = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<TaskRecord[]> => {
  return db.getAllFromIndex("tasks", "dayKey", dayKey);
};
