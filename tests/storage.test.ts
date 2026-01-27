import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import {
  addCompletedSession,
  addNote,
  createTask,
  getLocalDayKey,
  getNotesByDay,
  getStatsByDay,
  getTasksByDay,
  openCozyDB
} from "../src/storage";

const createTestDb = async () => {
  const name = `cozyfocus-test-${crypto.randomUUID()}`;
  const db = await openCozyDB(name);
  return { db, name };
};

const cleanup = async (name: string) => {
  await deleteDB(name);
};

describe("storage", () => {
  it("creates a task for today and reads back by dayKey", async () => {
    const { db, name } = await createTestDb();
    const dayKey = getLocalDayKey();

    await createTask(db, { title: "Plan focus block", dayKey });
    const tasks = await getTasksByDay(db, dayKey);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Plan focus block");

    db.close();
    await cleanup(name);
  });

  it("creates multiple notes for today and reads back", async () => {
    const { db, name } = await createTestDb();
    const dayKey = getLocalDayKey();

    await addNote(db, { content: "Call the design lead", dayKey });
    await addNote(db, { content: "Brainstorm session ideas", dayKey });

    const notes = await getNotesByDay(db, dayKey);
    expect(notes).toHaveLength(2);
    expect(notes.map((note) => note.content)).toEqual([
      "Call the design lead",
      "Brainstorm session ideas"
    ]);

    db.close();
    await cleanup(name);
  });

  it("writes a completed focus session and updates stats", async () => {
    const { db, name } = await createTestDb();
    const dayKey = getLocalDayKey();

    await addCompletedSession(db, {
      type: "focus",
      durationMs: 1500000,
      startedAt: Date.now() - 1500000,
      endedAt: Date.now(),
      dayKey
    });

    const stats = await getStatsByDay(db, dayKey);
    expect(stats?.focusCompletedCount).toBe(1);
    expect(stats?.totalFocusMs).toBe(1500000);
    expect(stats?.totalBreakMs).toBe(0);

    db.close();
    await cleanup(name);
  });
});
