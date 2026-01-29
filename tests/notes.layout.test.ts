import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountNotesView } from "../src/features/notes/notesView";
import { getLocalDayKey, openCozyDB } from "../src/storage";

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"quick-notes\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"quick-notes\"]");
  if (!root) {
    throw new Error("Missing notes root");
  }
  return root;
};

const createDbName = () => `cozyfocus-notes-layout-${crypto.randomUUID()}`;

describe("notes layout", () => {
  it("places the delete button bottom-left and pads content", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    const noteId = crypto.randomUUID();

    const db = await openCozyDB(dbName);
    await db.put("notes", {
      id: noteId,
      dayKey,
      content: "Layout check",
      updatedAt: Date.now()
    });
    db.close();

    const root = createRoot();
    const view = await mountNotesView(root, { dbName, dayKey, debounceMs: 10 });

    const trash = root.querySelector<HTMLButtonElement>(
      `[data-testid=\"note-delete-${noteId}\"]`
    );
    if (!trash) {
      throw new Error("Missing note delete button");
    }
    expect(trash.classList.contains("note-trash--bl")).toBe(true);

    const editor = root.querySelector<HTMLTextAreaElement>(
      `[data-testid=\"note-editor-${noteId}\"]`
    );
    if (!editor) {
      throw new Error("Missing note editor");
    }
    expect(editor.classList.contains("note-content--with-trash-gap")).toBe(true);

    await view.destroy();
    await deleteDB(dbName);
  });
});
