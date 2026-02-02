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
    updatedAt: now,
    completedAt: input.completed ? now : null
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

export const deleteTask = async (
  db: CozyFocusDatabase,
  id: string
): Promise<void> => {
  await db.delete("tasks", id);
};

export const getById = async (
  db: CozyFocusDatabase,
  id: string
): Promise<TaskRecord | undefined> => {
  return db.get("tasks", id);
};

export const has = async (
  db: CozyFocusDatabase,
  id: string
): Promise<boolean> => {
  const existing = await db.get("tasks", id);
  return Boolean(existing);
};

export const bulkPut = async (
  db: CozyFocusDatabase,
  records: TaskRecord[]
): Promise<void> => {
  if (records.length === 0) {
    return;
  }
  const tx = db.transaction("tasks", "readwrite");
  for (const record of records) {
    await tx.store.put(record);
  }
  await tx.done;
};

export const updateTaskTitle = async (
  db: CozyFocusDatabase,
  id: string,
  title: string
): Promise<TaskRecord | null> => {
  const existing = await db.get("tasks", id);
  if (!existing) {
    return null;
  }

  const updated: TaskRecord = {
    ...existing,
    title,
    updatedAt: Date.now()
  };

  await db.put("tasks", updated);
  return updated;
};
