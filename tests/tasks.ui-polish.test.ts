import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountTasksView } from "../src/features/tasks/tasksView";
import { getLocalDayKey } from "../src/storage";

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<aside data-testid=\"task-queue\"></aside>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"task-queue\"]");
  if (!root) {
    throw new Error("Missing task queue root");
  }
  return root;
};

const createDbName = (suffix: string) =>
  `cozyfocus-tasks-ui-${suffix}-${crypto.randomUUID()}`;

const flush = async () => new Promise((resolve) => setTimeout(resolve, 0));

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

describe("tasks UI polish", () => {
  it("new task creation input uses the same styling class as edit input", async () => {
    const dbName = createDbName("input");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

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

    expect(input.classList.contains("task-title-input")).toBe(true);

    await view.destroy();
    await deleteDB(dbName);
  });

  it("double click on task list creates a new input row", async () => {
    const dbName = createDbName("dblclick");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    const list = root.querySelector<HTMLElement>('[data-testid="tasks-list"]');
    if (!list) {
      throw new Error("Missing tasks list");
    }

    list.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const input = root.querySelector<HTMLInputElement>(
      '[data-testid="tasks-input"]'
    );
    expect(input).not.toBeNull();

    await view.destroy();
    await deleteDB(dbName);
  });

  it("checkbox has custom classes for unchecked and checked", async () => {
    const dbName = createDbName("checkbox");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Checkbox styling");

    const item = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    const checkbox = item?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!item || !checkbox) {
      throw new Error("Missing task checkbox");
    }

    expect(checkbox.classList.contains("task-checkbox")).toBe(true);
    expect(checkbox.classList.contains("is-checked")).toBe(false);
    expect(item.classList.contains("task--completed")).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const updatedItem = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    const updatedCheckbox = updatedItem?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    if (!updatedItem || !updatedCheckbox) {
      throw new Error("Missing updated checkbox");
    }

    expect(updatedCheckbox.classList.contains("is-checked")).toBe(true);
    expect(updatedItem.classList.contains("task--completed")).toBe(true);

    await view.destroy();
    await deleteDB(dbName);
  });

  it("checking a task triggers wave animation class", async () => {
    const dbName = createDbName("wave");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Wave");

    const item = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    const checkbox = item?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!item || !checkbox) {
      throw new Error("Missing task checkbox");
    }

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const updatedItem = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    if (!updatedItem) {
      throw new Error("Missing updated task item");
    }

    expect(updatedItem.classList.contains("task--wave")).toBe(true);

    await view.destroy();
    await deleteDB(dbName);
  });

  it("task click sets Current Focus and persists", async () => {
    const dbName = createDbName("focus");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Focus me");
    await addTaskViaUi(root, "Not focus");

    const item = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    if (!item) {
      throw new Error("Missing task item");
    }
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    const focusedItem = root.querySelector<HTMLElement>(".task--focus");
    if (!focusedItem) {
      throw new Error("Missing focused item");
    }
    expect(focusedItem.classList.contains("task--focus")).toBe(true);
    expect(focusedItem.textContent).toContain("Current Focus");

    await view.destroy();

    const rootAfter = createRoot();
    const viewAfter = await mountTasksView(rootAfter, { dbName, dayKey });
    await flush();

    const focusedAfter = rootAfter.querySelector<HTMLElement>(".task--focus");
    if (!focusedAfter) {
      throw new Error("Missing focused item after re-render");
    }
    expect(focusedAfter.classList.contains("task--focus")).toBe(true);
    expect(focusedAfter.textContent).toContain("Current Focus");

    await viewAfter.destroy();
    await deleteDB(dbName);
  });

  it("title and meta are stacked", async () => {
    const dbName = createDbName("stacked");
    const dayKey = getLocalDayKey();
    const root = createRoot();
    const view = await mountTasksView(root, { dbName, dayKey });

    await addTaskViaUi(root, "Stacked title");

    const item = root.querySelector<HTMLElement>('[data-testid^="task-item-"]');
    if (!item) {
      throw new Error("Missing task item");
    }
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    const updatedItem = root.querySelector<HTMLElement>(".task--focus");
    if (!updatedItem) {
      throw new Error("Missing focused task item");
    }

    const content = updatedItem.querySelector<HTMLElement>(".task-content");
    if (!content) {
      throw new Error("Missing task content");
    }
    const firstChild = content.children[0];
    const secondChild = content.children[1];
    if (!firstChild || !secondChild) {
      throw new Error("Missing title or meta elements");
    }

    expect(firstChild.classList.contains("task-title")).toBe(true);
    expect(secondChild.classList.contains("task-meta")).toBe(true);

    await view.destroy();
    await deleteDB(dbName);
  });
});
