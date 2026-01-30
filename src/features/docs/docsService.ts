import { openCozyDB, type DocRecord, type TagRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";

type DocPatch = Partial<Pick<DocRecord, "title" | "markdown" | "tags">>;

export interface DocsService {
  todayKey: string;
  getDocs: () => Promise<DocRecord[]>;
  createDoc: (title: string, markdown?: string) => Promise<DocRecord>;
  updateDoc: (id: string, patch: DocPatch) => Promise<DocRecord | null>;
  deleteDoc: (id: string) => Promise<void>;
  toggleTag: (id: string, tagName: string) => Promise<DocRecord | null>;
  getTags: () => Promise<TagRecord[]>;
  addTag: (name: string) => Promise<TagRecord>;
  deleteTag: (name: string) => Promise<void>;
  scheduleAutosave: (id: string, patch: DocPatch) => void;
  flushAutosave: () => Promise<void>;
  getSelectedId: () => string | null;
  setSelectedId: (id: string | null) => void;
  close: () => Promise<void>;
}

const sortDocs = (docs: DocRecord[]): DocRecord[] => {
  return [...docs].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return b.id.localeCompare(a.id);
  });
};

export const createDocsService = (options?: {
  dbName?: string;
  dayKey?: string;
  debounceMs?: number;
}): DocsService => {
  const dbPromise = openCozyDB(options?.dbName);
  const todayKey = options?.dayKey ?? getLocalDayKey();
  const debounceMs = options?.debounceMs ?? 400;
  const pendingPatches = new Map<string, DocPatch>();
  const timers = new Map<string, number>();
  let selectedId: string | null = null;

  const getDocs = async (): Promise<DocRecord[]> => {
    const db = await dbPromise;
    const docs = await db.getAllFromIndex("docs", "dayKey", todayKey);
    return sortDocs(docs);
  };

  const createDoc = async (title: string, markdown: string = ""): Promise<DocRecord> => {
    const db = await dbPromise;
    const now = Date.now();
    const doc: DocRecord = {
      id: crypto.randomUUID(),
      dayKey: todayKey,
      title,
      markdown,
      tags: [],
      createdAt: now,
      updatedAt: now
    };
    await db.put("docs", doc);
    return doc;
  };

  const updateDoc = async (id: string, patch: DocPatch): Promise<DocRecord | null> => {
    const db = await dbPromise;
    const existing = await db.get("docs", id);
    if (!existing) {
      return null;
    }
    const updated: DocRecord = {
      ...existing,
      ...patch,
      updatedAt: Date.now()
    };
    await db.put("docs", updated);
    return updated;
  };

  const deleteDoc = async (id: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete("docs", id);
  };

  const toggleTag = async (id: string, tagName: string): Promise<DocRecord | null> => {
    const db = await dbPromise;
    const existing = await db.get("docs", id);
    if (!existing) {
      return null;
    }
    const tags = new Set(existing.tags);
    if (tags.has(tagName)) {
      tags.delete(tagName);
    } else {
      tags.add(tagName);
    }
    const updated: DocRecord = {
      ...existing,
      tags: Array.from(tags),
      updatedAt: Date.now()
    };
    await db.put("docs", updated);
    return updated;
  };

  const getTags = async (): Promise<TagRecord[]> => {
    const db = await dbPromise;
    const tags = await db.getAll("tagLibrary");
    return tags.sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const addTag = async (name: string): Promise<TagRecord> => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Tag name cannot be empty");
    }
    const db = await dbPromise;
    const existing = await db.get("tagLibrary", trimmed);
    if (existing) {
      return existing;
    }
    const tag: TagRecord = {
      name: trimmed,
      createdAt: Date.now()
    };
    await db.put("tagLibrary", tag);
    return tag;
  };

  const deleteTag = async (name: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete("tagLibrary", name);
  };

  const scheduleAutosave = (id: string, patch: DocPatch) => {
    const existing = pendingPatches.get(id) ?? {};
    pendingPatches.set(id, { ...existing, ...patch });
    const timer = timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
    }
    const timeout = window.setTimeout(async () => {
      timers.delete(id);
      const payload = pendingPatches.get(id);
      pendingPatches.delete(id);
      if (!payload) {
        return;
      }
      await updateDoc(id, payload);
    }, debounceMs);
    timers.set(id, timeout);
  };

  const flushAutosave = async () => {
    const entries = Array.from(pendingPatches.entries());
    pendingPatches.clear();
    entries.forEach(([id]) => {
      const timer = timers.get(id);
      if (timer) {
        window.clearTimeout(timer);
        timers.delete(id);
      }
    });
    await Promise.all(entries.map(([id, patch]) => updateDoc(id, patch)));
  };

  const close = async () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    pendingPatches.clear();
    const db = await dbPromise;
    db.close();
  };

  return {
    todayKey,
    getDocs,
    createDoc,
    updateDoc,
    deleteDoc,
    toggleTag,
    getTags,
    addTag,
    deleteTag,
    scheduleAutosave,
    flushAutosave,
    getSelectedId: () => selectedId,
    setSelectedId: (id: string | null) => {
      selectedId = id;
    },
    close
  };
};
