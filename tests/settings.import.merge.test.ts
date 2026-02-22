import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { openCozyDB } from "../src/storage";
import { applyMergePlan, buildMergePlan } from "../src/features/settings/importData";
import type { ExportBundle } from "../src/features/settings/exportData";

const createTestDb = async () => {
  const name = `cozyfocus-test-${uuidv4()}`;
  const db = await openCozyDB(name);
  return { db, name };
};

afterEach(() => {
  return Promise.resolve();
});

describe("settings import merge", () => {
  it("imports new records into an empty db", async () => {
    const { db, name } = await createTestDb();
    db.close();

    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: "CozyFocus",
      data: {
        tasks: [
          {
            id: "task-1",
            dayKey: "2026-02-02",
            title: "Fresh task",
            completed: false,
            createdAt: 10,
            updatedAt: 10,
            completedAt: null
          }
        ],
        notes: [
          {
            id: "note-1",
            dayKey: "2026-02-02",
            content: "Remember this",
            updatedAt: 50
          }
        ],
        sessions: [],
        stats: [],
        docs: [
          {
            id: "doc-1",
            dayKey: "2026-02-02",
            title: "Idea",
            markdown: "Draft",
            tags: ["work"],
            createdAt: 5,
            updatedAt: 5
          }
        ],
        settings: []
      }
    };

    const plan = await buildMergePlan(bundle, { dbName: name });
    expect(plan.tasks.add).toBe(1);
    expect(plan.notes.add).toBe(1);
    expect(plan.docs.add).toBe(1);

    await applyMergePlan(bundle, { dbName: name });

    const verifyDb = await openCozyDB(name);
    expect((await verifyDb.getAll("tasks")).length).toBe(1);
    expect((await verifyDb.getAll("notes")).length).toBe(1);
    expect((await verifyDb.getAll("docs")).length).toBe(1);
    verifyDb.close();
    await deleteDB(name);
  });

  it("re-importing the same bundle skips duplicates", async () => {
    const { db, name } = await createTestDb();
    db.close();

    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: "CozyFocus",
      data: {
        tasks: [
          {
            id: "task-1",
            dayKey: "2026-02-02",
            title: "Fresh task",
            completed: false,
            createdAt: 10,
            updatedAt: 10,
            completedAt: null
          }
        ],
        notes: [
          {
            id: "note-1",
            dayKey: "2026-02-02",
            content: "Remember this",
            updatedAt: 50
          }
        ],
        sessions: [],
        stats: [],
        docs: [
          {
            id: "doc-1",
            dayKey: "2026-02-02",
            title: "Idea",
            markdown: "Draft",
            tags: ["work"],
            createdAt: 5,
            updatedAt: 5
          }
        ],
        settings: []
      }
    };

    await applyMergePlan(bundle, { dbName: name });
    const plan = await buildMergePlan(bundle, { dbName: name });

    expect(plan.tasks.skip).toBe(1);
    expect(plan.notes.skip).toBe(1);
    expect(plan.docs.skip).toBe(1);

    await applyMergePlan(bundle, { dbName: name });

    const verifyDb = await openCozyDB(name);
    expect((await verifyDb.getAll("tasks")).length).toBe(1);
    expect((await verifyDb.getAll("notes")).length).toBe(1);
    expect((await verifyDb.getAll("docs")).length).toBe(1);
    verifyDb.close();
    await deleteDB(name);
  });

  it("updates newer incoming records", async () => {
    const { db, name } = await createTestDb();
    await db.put("tasks", {
      id: "task-1",
      dayKey: "2026-02-02",
      title: "Old title",
      completed: false,
      createdAt: 10,
      updatedAt: 100,
      completedAt: null
    });
    db.close();

    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: "CozyFocus",
      data: {
        tasks: [
          {
            id: "task-1",
            dayKey: "2026-02-02",
            title: "New title",
            completed: false,
            createdAt: 10,
            updatedAt: 200,
            completedAt: null
          }
        ],
        notes: [],
        sessions: [],
        stats: [],
        docs: [],
        settings: []
      }
    };

    const result = await applyMergePlan(bundle, { dbName: name });
    expect(result.plan.tasks.update).toBe(1);

    const verifyDb = await openCozyDB(name);
    const updated = await verifyDb.get("tasks", "task-1");
    expect(updated?.title).toBe("New title");
    verifyDb.close();
    await deleteDB(name);
  });

  it("merges stats by max counters", async () => {
    const { db, name } = await createTestDb();
    await db.put("stats", {
      dayKey: "2026-02-02",
      focusCompletedCount: 2,
      shortBreakCompletedCount: 1,
      longBreakCompletedCount: 0,
      totalFocusMs: 3000000,
      totalBreakMs: 600000
    });
    db.close();

    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: "CozyFocus",
      data: {
        tasks: [],
        notes: [],
        sessions: [],
        stats: [
          {
            dayKey: "2026-02-02",
            focusCompletedCount: 3,
            shortBreakCompletedCount: 1,
            longBreakCompletedCount: 1,
            totalFocusMs: 4000000,
            totalBreakMs: 900000
          }
        ],
        docs: [],
        settings: []
      }
    };

    await applyMergePlan(bundle, { dbName: name });

    const verifyDb = await openCozyDB(name);
    const stats = await verifyDb.get("stats", "2026-02-02");
    expect(stats?.focusCompletedCount).toBe(3);
    expect(stats?.longBreakCompletedCount).toBe(1);
    expect(stats?.totalFocusMs).toBe(4000000);
    expect(stats?.totalBreakMs).toBe(900000);
    verifyDb.close();
    await deleteDB(name);
  });

  it("unions doc tags on update", async () => {
    const { db, name } = await createTestDb();
    await db.put("docs", {
      id: "doc-1",
      dayKey: "2026-02-02",
      title: "Idea",
      markdown: "Draft",
      tags: ["work"],
      createdAt: 5,
      updatedAt: 100
    });
    db.close();

    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: "CozyFocus",
      data: {
        tasks: [],
        notes: [],
        sessions: [],
        stats: [],
        docs: [
          {
            id: "doc-1",
            dayKey: "2026-02-02",
            title: "Idea",
            markdown: "Draft",
            tags: ["brainstorm", "work"],
            createdAt: 5,
            updatedAt: 200
          }
        ],
        settings: []
      }
    };

    await applyMergePlan(bundle, { dbName: name });

    const verifyDb = await openCozyDB(name);
    const doc = await verifyDb.get("docs", "doc-1");
    expect(doc?.tags?.sort()).toEqual(["brainstorm", "work"]);
    verifyDb.close();
    await deleteDB(name);
  });
});
