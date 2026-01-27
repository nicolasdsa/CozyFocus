import { openCozyDB, type TaskRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";

export interface TasksService {
  getTasks: (dayKey?: string) => Promise<TaskRecord[]>;
  addTask: (title: string, dayKey?: string) => Promise<TaskRecord>;
  toggleTask: (id: string, completed: boolean) => Promise<TaskRecord | null>;
  close: () => Promise<void>;
}

const sortTasks = (tasks: TaskRecord[]): TaskRecord[] => {
  return [...tasks].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
};

export const createTasksService = (options?: { dbName?: string }): TasksService => {
  const dbPromise = openCozyDB(options?.dbName);
  const resolveDayKey = (dayKey?: string) => dayKey ?? getLocalDayKey();

  const getTasks = async (dayKey?: string): Promise<TaskRecord[]> => {
    const db = await dbPromise;
    const tasks = await db.getAllFromIndex("tasks", "dayKey", resolveDayKey(dayKey));
    return sortTasks(tasks);
  };

  const addTask = async (title: string, dayKey?: string): Promise<TaskRecord> => {
    const db = await dbPromise;
    const now = Date.now();
    const task: TaskRecord = {
      id: crypto.randomUUID(),
      dayKey: resolveDayKey(dayKey),
      title,
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    await db.put("tasks", task);
    return task;
  };

  const toggleTask = async (
    id: string,
    completed: boolean
  ): Promise<TaskRecord | null> => {
    const db = await dbPromise;
    const existing = await db.get("tasks", id);
    if (!existing) {
      return null;
    }

    const updated: TaskRecord = {
      ...existing,
      completed,
      updatedAt: Date.now()
    };

    await db.put("tasks", updated);
    return updated;
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getTasks,
    addTask,
    toggleTask,
    close
  };
};
