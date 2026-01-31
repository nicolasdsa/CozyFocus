import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PomodoroDefaultsSetting, SessionType, TaskFocusSetting } from "../types";
import type { MediaPlayerSetting } from "../features/player/playerTypes";

export interface TaskRecord {
  id: string;
  dayKey: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NoteRecord {
  id: string;
  dayKey: string;
  content: string;
  updatedAt: number;
}

export interface DocRecord {
  id: string;
  dayKey: string;
  title: string;
  markdown: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TagRecord {
  name: string;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  dayKey: string;
  type: SessionType;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  completed: true;
}

export interface DayStatsRecord {
  dayKey: string;
  focusCompletedCount: number;
  shortBreakCompletedCount: number;
  longBreakCompletedCount: number;
  totalFocusMs: number;
  totalBreakMs: number;
}

interface CozyFocusDB extends DBSchema {
  tasks: {
    key: string;
    value: TaskRecord;
    indexes: { dayKey: string };
  };
  notes: {
    key: string;
    value: NoteRecord;
    indexes: { dayKey: string };
  };
  docs: {
    key: string;
    value: DocRecord;
    indexes: { dayKey: string };
  };
  tagLibrary: {
    key: string;
    value: TagRecord;
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { dayKey: string; type: SessionType };
  };
  stats: {
    key: string;
    value: DayStatsRecord;
  };
  settings: {
    key: string;
    value: MediaPlayerSetting | PomodoroDefaultsSetting | TaskFocusSetting;
  };
}

export type CozyFocusDatabase = IDBPDatabase<CozyFocusDB>;

const DB_NAME = "cozyfocus";
const DB_VERSION = 4;

export const openCozyDB = (name: string = DB_NAME): Promise<CozyFocusDatabase> => {
  return openDB<CozyFocusDB>(name, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      const ensureIndex = (
        storeName: keyof CozyFocusDB,
        indexName: string,
        keyPath: string
      ): void => {
        const store = transaction.objectStore(storeName);
        if (!store.indexNames.contains(indexName)) {
          store.createIndex(indexName, keyPath);
        }
      };

      if (!db.objectStoreNames.contains("tasks")) {
        const store = db.createObjectStore("tasks", { keyPath: "id" });
        store.createIndex("dayKey", "dayKey");
      } else {
        ensureIndex("tasks", "dayKey", "dayKey");
      }

      if (!db.objectStoreNames.contains("notes")) {
        const store = db.createObjectStore("notes", { keyPath: "id" });
        store.createIndex("dayKey", "dayKey");
      } else {
        ensureIndex("notes", "dayKey", "dayKey");
      }

      if (!db.objectStoreNames.contains("docs")) {
        const store = db.createObjectStore("docs", { keyPath: "id" });
        store.createIndex("dayKey", "dayKey");
      } else {
        ensureIndex("docs", "dayKey", "dayKey");
      }

      if (!db.objectStoreNames.contains("tagLibrary")) {
        db.createObjectStore("tagLibrary", { keyPath: "name" });
      }

      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("dayKey", "dayKey");
        store.createIndex("type", "type");
      } else {
        ensureIndex("sessions", "dayKey", "dayKey");
        ensureIndex("sessions", "type", "type");
      }

      if (!db.objectStoreNames.contains("stats")) {
        db.createObjectStore("stats", { keyPath: "dayKey" });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
    }
  });
};
