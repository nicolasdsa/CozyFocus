import { openCozyDB, type TaskRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { getSetting, saveSetting } from "../../storage/settingsRepo";
import type { TaskFocusSetting } from "../../types";

export interface TasksService {
  getTasks: (dayKey?: string) => Promise<TaskRecord[]>;
  addTask: (title: string, dayKey?: string) => Promise<TaskRecord>;
  toggleTask: (
    id: string,
    completed: boolean,
    existing?: TaskRecord
  ) => Promise<TaskRecord | null>;
  updateTitle: (id: string, title: string) => Promise<TaskRecord | null>;
  deleteTask: (id: string) => Promise<void>;
  getCurrentFocus: (dayKey?: string) => Promise<string | null>;
  setCurrentFocus: (dayKey: string, taskId: string | null) => Promise<void>;
  close: () => Promise<void>;
}

const sortTasks = (tasks: TaskRecord[]): TaskRecord[] => {
  return [...tasks].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return b.id.localeCompare(a.id);
  });
};

export const createTasksService = (options?: { dbName?: string }): TasksService => {
  const dbPromise = openCozyDB(options?.dbName);
  const resolveDayKey = (dayKey?: string) => dayKey ?? getLocalDayKey();
  const focusKeyForDay = (dayKey: string) => `tasks.currentFocus.${dayKey}`;

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
    completed: boolean,
    existing?: TaskRecord
  ): Promise<TaskRecord | null> => {
    const db = await dbPromise;
    const base = existing ?? (await db.get("tasks", id));
    if (!base) {
      return null;
    }

    const updated: TaskRecord = {
      ...base,
      completed,
      updatedAt: Date.now()
    };

    await db.put("tasks", updated);
    return updated;
  };

  const updateTitle = async (id: string, title: string): Promise<TaskRecord | null> => {
    const db = await dbPromise;
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

  const deleteTask = async (id: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete("tasks", id);
  };

  const getCurrentFocus = async (dayKey?: string): Promise<string | null> => {
    const db = await dbPromise;
    const resolvedDay = resolveDayKey(dayKey);
    const setting = await getSetting<TaskFocusSetting>(db, focusKeyForDay(resolvedDay));
    return setting?.taskId ?? null;
  };

  const setCurrentFocus = async (
    dayKey: string,
    taskId: string | null
  ): Promise<void> => {
    const db = await dbPromise;
    const setting: TaskFocusSetting = {
      dayKey,
      taskId,
      updatedAt: Date.now()
    };
    await saveSetting(db, focusKeyForDay(dayKey), setting);
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getTasks,
    addTask,
    toggleTask,
    updateTitle,
    deleteTask,
    getCurrentFocus,
    setCurrentFocus,
    close
  };
};
