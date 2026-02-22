import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountNotesView } from "../src/features/notes/notesView";
import { mountTasksView } from "../src/features/tasks/tasksView";
import { getLocalDayKey, getNotesByDay, getTasksByDay, openCozyDB } from "../src/storage";

const createTasksRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"task-queue\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"task-queue\"]");
  if (!root) {
    throw new Error("Missing task queue root");
  }
  return root;
};

const createNotesRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"quick-notes\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"quick-notes\"]");
  if (!root) {
    throw new Error("Missing notes root");
  }
  return root;
};

const createDbName = (prefix: string) => `cozyfocus-${prefix}-${uuidv4()}`;

const flush = async () => new Promise((resolve) => setTimeout(resolve, 0));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForTaskId = async (root: HTMLElement, persisted = false): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const taskItem = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    const taskId = taskItem?.dataset.taskId;
    if (taskId) {
      if (!persisted || !taskId.startsWith("temp-")) {
        return taskId;
      }
    }
    await flush();
  }
  throw new Error("Timed out waiting for task id");
};

const waitForTaskTitle = async (
  dbName: string,
  dayKey: string,
  expected: string
): Promise<void> => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const db = await openCozyDB(dbName);
    const tasks = await getTasksByDay(db, dayKey);
    db.close();
    if (tasks[0]?.title === expected) {
      return;
    }
    await delay(10);
  }
};

const addTaskViaUi = async (root: HTMLElement, title: string) => {
  const addButton = root.querySelector<HTMLButtonElement>(
    '[data-testid="tasks-add"]'
  );
  if (!addButton) {
    throw new Error("Missing tasks add button");
  }
  addButton.click();

  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="tasks-input"]'
  );
  if (!input) {
    throw new Error("Missing tasks input");
  }
  input.value = title;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flush();
};

describe("delete and edit flows", () => {
  it("deletes a task from UI and IndexedDB", async () => {
    const dbName = createDbName("task-delete");
    const dayKey = getLocalDayKey();
    const root = createTasksRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Tidy desk");

    const taskItem = root.querySelector<HTMLElement>(
      '[data-testid^="task-item-"]'
    );
    if (!taskItem) {
      throw new Error("Missing task item");
    }
    const taskId = taskItem.dataset.taskId;
    if (!taskId) {
      throw new Error("Missing task id");
    }

    const deleteButton = root.querySelector<HTMLButtonElement>(
      `[data-testid="task-delete-${taskId}"]`
    );
    if (!deleteButton) {
      throw new Error("Missing task delete button");
    }

    deleteButton.click();
    await flush();

    expect(root.querySelector(`[data-testid="task-item-${taskId}"]`)).toBeNull();

    const db = await openCozyDB(dbName);
    const tasks = await getTasksByDay(db, dayKey);
    expect(tasks).toHaveLength(0);
    db.close();

    await view.destroy();
    await deleteDB(dbName);
  });

  it("supports undo callback for task deletion", async () => {
    const dbName = createDbName("task-undo");
    const dayKey = getLocalDayKey();
    const root = createTasksRoot();
    let pendingUndo:
      | {
          onUndo: () => void | Promise<void>;
          onCommit: () => void | Promise<void>;
        }
      | null = null;

    const view = await mountTasksView(root, {
      dbName,
      dayKey,
      onRequestUndo: (request) => {
        pendingUndo = request;
      }
    });

    await addTaskViaUi(root, "Recover me");

    const taskId = await waitForTaskId(root, true);

    const deleteButton = root.querySelector<HTMLButtonElement>(
      `[data-testid="task-delete-${taskId}"]`
    );
    if (!deleteButton) {
      throw new Error("Missing task delete button");
    }

    deleteButton.click();
    await flush();
    expect(root.querySelector(`[data-testid="task-item-${taskId}"]`)).toBeNull();
    expect(pendingUndo).toBeTruthy();

    if (!pendingUndo) {
      throw new Error("Missing undo payload");
    }
    await pendingUndo.onUndo();
    await flush();

    expect(root.querySelector(`[data-testid="task-item-${taskId}"]`)).toBeTruthy();
    const db = await openCozyDB(dbName);
    const tasks = await getTasksByDay(db, dayKey);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe(taskId);
    db.close();

    await view.destroy();
    await deleteDB(dbName);
  });

  it("renames a task on double click and persists", async () => {
    const dbName = createDbName("task-edit");
    const dayKey = getLocalDayKey();
    const root = createTasksRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Old");

    const taskItem = root.querySelector<HTMLElement>(
      '[data-testid^="task-item-"]'
    );
    if (!taskItem) {
      throw new Error("Missing task item");
    }
    const taskId = taskItem.dataset.taskId;
    if (!taskId) {
      throw new Error("Missing task id");
    }

    const title = root.querySelector<HTMLElement>(
      `[data-testid="task-title-${taskId}"]`
    );
    if (!title) {
      throw new Error("Missing task title");
    }

    title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const titleInput = root.querySelector<HTMLInputElement>(
      `[data-testid="task-title-${taskId}"]`
    );
    if (!titleInput) {
      throw new Error("Missing task title input");
    }

    titleInput.value = "New Title";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();

    expect(root.textContent).toContain("New Title");

    await waitForTaskTitle(dbName, dayKey, "New Title");
    const db = await openCozyDB(dbName);
    const tasks = await getTasksByDay(db, dayKey);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("New Title");
    db.close();

    await view.destroy();
    await deleteDB(dbName);
  });

  it("deletes a quick note from UI and IndexedDB", async () => {
    const dbName = createDbName("note-delete");
    const dayKey = getLocalDayKey();

    const db = await openCozyDB(dbName);
    const seeded = {
      id: uuidv4(),
      dayKey,
      content: "Keep it cozy",
      updatedAt: Date.now()
    };
    await db.put("notes", seeded);
    db.close();

    const root = createNotesRoot();
    const view = await mountNotesView(root, { dbName, dayKey, debounceMs: 10 });

    const deleteButton = root.querySelector<HTMLButtonElement>(
      `[data-testid="note-delete-${seeded.id}"]`
    );
    if (!deleteButton) {
      throw new Error("Missing note delete button");
    }

    deleteButton.click();
    await flush();

    expect(root.querySelector(`[data-testid="note-${seeded.id}"]`)).toBeNull();

    const dbAfter = await openCozyDB(dbName);
    const notes = await getNotesByDay(dbAfter, dayKey);
    expect(notes).toHaveLength(0);
    dbAfter.close();

    await view.destroy();
    await deleteDB(dbName);
  });

  it("trash buttons toggle hover attribute", async () => {
    const dbName = createDbName("hover");
    const dayKey = getLocalDayKey();
    const root = createTasksRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Hover check");

    const taskItem = root.querySelector<HTMLElement>(
      '[data-testid^="task-item-"]'
    );
    if (!taskItem) {
      throw new Error("Missing task item");
    }
    const taskId = taskItem.dataset.taskId;
    if (!taskId) {
      throw new Error("Missing task id");
    }

    const deleteButton = root.querySelector<HTMLButtonElement>(
      `[data-testid="task-delete-${taskId}"]`
    );
    if (!deleteButton) {
      throw new Error("Missing task delete button");
    }

    deleteButton.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(deleteButton.dataset.hover).toBe("true");

    deleteButton.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(deleteButton.dataset.hover).toBeUndefined();

    await view.destroy();
    await deleteDB(dbName);
  });
});
