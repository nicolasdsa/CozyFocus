import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountTasksView } from "../src/features/tasks/tasksView";
import { getLocalDayKey, getTasksByDay, openCozyDB } from "../src/storage";

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"task-queue\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"task-queue\"]");
  if (!root) {
    throw new Error("Missing task queue root");
  }
  return root;
};

const createDbName = () => `cozyfocus-tasks-test-${crypto.randomUUID()}`;

const flush = async () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (check: () => boolean, attempts = 20) => {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) {
      return;
    }
    await flush();
  }
};
const waitForAsync = async (check: () => Promise<boolean>, attempts = 20) => {
  for (let index = 0; index < attempts; index += 1) {
    if (await check()) {
      return;
    }
    await flush();
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
  await waitFor(() => {
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-task-id]"));
    if (items.length === 0) {
      return false;
    }
    return items.every((item) => !item.dataset.taskId?.startsWith("temp-"));
  });
};

describe("tasks", () => {
  it("adding task updates DOM list and persists to IndexedDB", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Write sprint brief");

    const items = root.querySelectorAll('[data-testid^="task-item-"]');
    expect(items).toHaveLength(1);
    expect(root.textContent).toContain("Write sprint brief");

    const db = await openCozyDB(dbName);
    const tasks = await getTasksByDay(db, dayKey);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Write sprint brief");

    db.close();
    await view.destroy();
    await deleteDB(dbName);
  });

  it("toggling checkbox persists completed state", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    const seededDb = await openCozyDB(dbName);
    await seededDb.put("tasks", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Clear inbox",
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null
    });
    seededDb.close();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    const checkbox = root.querySelector<HTMLInputElement>(
      '[data-testid^="task-item-"] input[type="checkbox"]'
    );
    if (!checkbox) {
      throw new Error("Missing task checkbox");
    }

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => {
      const updated = root.querySelector<HTMLInputElement>(
        '[data-testid^="task-item-"] input[type="checkbox"]'
      );
      return Boolean(updated?.checked);
    });

    const db = await openCozyDB(dbName);
    await waitForAsync(async () => {
      const latest = await getTasksByDay(db, dayKey);
      return latest[0]?.completed === true;
    });
    const tasks = await getTasksByDay(db, dayKey);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.completed).toBe(true);

    db.close();
    await view.destroy();
    await deleteDB(dbName);
  });

  it("re-render loads persisted tasks for today", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();

    const db = await openCozyDB(dbName);
    await db.put("tasks", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Prep focus playlist",
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null
    });
    db.close();

    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    const items = root.querySelectorAll('[data-testid^="task-item-"]');
    expect(items).toHaveLength(1);
    expect(root.textContent).toContain("Prep focus playlist");

    await view.destroy();
    await deleteDB(dbName);
  });
});
