import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import {
  addCompletedSession,
  addNote,
  createTask,
  getLocalDayKey,
  openCozyDB,
  DB_VERSION
} from "../src/storage";
import { exportData } from "../src/features/settings/exportData";
import { downloadBlob } from "../src/features/settings/download";

const createTestDb = async () => {
  const name = `cozyfocus-test-${crypto.randomUUID()}`;
  const db = await openCozyDB(name);
  return { db, name };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settings export", () => {
  it("exports seeded records into a bundle", async () => {
    const { db, name } = await createTestDb();
    const dayKey = getLocalDayKey();

    const task = await createTask(db, { title: "Export me", dayKey });
    const note = await addNote(db, { content: "Remember this", dayKey });
    const { session } = await addCompletedSession(db, {
      type: "focus",
      durationMs: 600000,
      startedAt: Date.now() - 600000,
      endedAt: Date.now(),
      dayKey
    });

    db.close();

    const now = new Date("2026-02-02T10:00:00.000Z").valueOf();
    const bundle = await exportData({ dbName: name, now });

    expect(bundle.app).toBe("CozyFocus");
    expect(bundle.schemaVersion).toBe(DB_VERSION);
    expect(bundle.exportedAt).toBe(now);
    expect(bundle.data.tasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: task.id, title: task.title })])
    );
    expect(bundle.data.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: note.id, content: note.content })])
    );
    expect(bundle.data.sessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: session.id, type: session.type })])
    );

    await deleteDB(name);
  });

  it("downloads json bundles with a .json filename", () => {
    if (!("createObjectURL" in URL)) {
      Object.defineProperty(URL, "createObjectURL", {
        writable: true,
        configurable: true,
        value: () => "blob:pre-mock"
      });
    }
    if (!("revokeObjectURL" in URL)) {
      Object.defineProperty(URL, "revokeObjectURL", {
        writable: true,
        configurable: true,
        value: () => undefined
      });
    }

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const appendSpy = vi.spyOn(document.body, "appendChild");

    const blob = new Blob(["{}"], { type: "application/json" });
    downloadBlob("cozyfocus-export-2026-02-02.json", blob);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    const appendedAnchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement | undefined;
    expect(appendedAnchor?.download).toMatch(/\.json$/);
  });
});
