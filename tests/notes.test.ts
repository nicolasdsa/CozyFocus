import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountNotesView } from "../src/features/notes/notesView";
import { getLocalDayKey, getNotesByDay, openCozyDB } from "../src/storage";

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"quick-notes\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"quick-notes\"]");
  if (!root) {
    throw new Error("Missing notes root");
  }
  return root;
};

const createDbName = () => `cozyfocus-notes-test-${crypto.randomUUID()}`;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("notes", () => {
  it("dblclick empty area creates a new note and focuses it", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountNotesView(root, { dbName, dayKey, debounceMs: 10 });

    const container = root.querySelector<HTMLElement>(
      '[data-testid="notes-container"]'
    );
    if (!container) {
      throw new Error("Missing notes container");
    }

    container.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await delay(0);

    const cards = root.querySelectorAll(
      '[data-testid^="note-"]:not([data-testid^="note-editor-"])'
    );
    expect(cards).toHaveLength(1);

    const editor = root.querySelector<HTMLTextAreaElement>(
      '[data-testid^="note-editor-"]'
    );
    expect(editor).toBeTruthy();
    expect(document.activeElement).toBe(editor);

    await view.destroy();
    await deleteDB(dbName);
  });

  it("dblclick existing note enters edit mode and changes persist", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();

    const db = await openCozyDB(dbName);
    const seeded = {
      id: crypto.randomUUID(),
      dayKey,
      content: "Initial note",
      updatedAt: Date.now()
    };
    await db.put("notes", seeded);
    db.close();

    const root = createRoot();
    const view = await mountNotesView(root, { dbName, dayKey, debounceMs: 10 });

    const card = root.querySelector<HTMLElement>(
      `[data-testid="note-${seeded.id}"]`
    );
    if (!card) {
      throw new Error("Missing seeded note card");
    }

    card.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const editor = root.querySelector<HTMLTextAreaElement>(
      `[data-testid="note-editor-${seeded.id}"]`
    );
    if (!editor) {
      throw new Error("Missing seeded note editor");
    }

    expect(editor.readOnly).toBe(false);
    expect(document.activeElement).toBe(editor);

    editor.value = "Updated note";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(20);

    const dbAfter = await openCozyDB(dbName);
    const notes = await getNotesByDay(dbAfter, dayKey);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("Updated note");

    dbAfter.close();
    await view.destroy();
    await deleteDB(dbName);
  });

  it("reload/re-render restores notes for today", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();

    const db = await openCozyDB(dbName);
    await db.put("notes", {
      id: crypto.randomUUID(),
      dayKey,
      content: "Remember to stretch",
      updatedAt: Date.now()
    });
    db.close();

    const root = createRoot();
    const view = await mountNotesView(root, { dbName, dayKey, debounceMs: 10 });

    const cards = root.querySelectorAll(
      '[data-testid^="note-"]:not([data-testid^="note-editor-"])'
    );
    expect(cards).toHaveLength(1);
    expect(root.textContent).toContain("Remember to stretch");

    await view.destroy();
    await deleteDB(dbName);
  });
});
