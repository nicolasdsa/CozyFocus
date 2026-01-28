import type { TaskRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { create, qs } from "../../ui/dom";
import { createTasksService, type TasksService } from "./tasksService";

interface TasksViewOptions {
  dayKey?: string;
  dbName?: string;
  service?: TasksService;
}

export interface TasksViewHandle {
  refresh: () => Promise<void>;
  destroy: () => Promise<void>;
}

const renderTasks = (
  list: HTMLElement,
  tasks: TaskRecord[],
  editingId: string | null
): void => {
  list.innerHTML = "";

  const currentFocusId = tasks.find((task) => !task.completed)?.id;

  tasks.forEach((task) => {
    const item = create<HTMLDivElement>("div", "task-item");
    item.dataset.taskId = task.id;
    item.setAttribute("data-testid", `task-item-${task.id}`);
    if (task.completed) {
      item.classList.add("is-completed");
    }

    const row = create<HTMLDivElement>("div", "task-row");
    const checkbox = create<HTMLInputElement>("input", "task-check");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;

    row.appendChild(checkbox);
    if (editingId === task.id) {
      const input = create<HTMLInputElement>("input", "task-title-input");
      input.type = "text";
      input.value = task.title;
      input.setAttribute("data-testid", `task-title-${task.id}`);
      row.appendChild(input);
    } else {
      const title = create<HTMLDivElement>("div", "task-title");
      title.textContent = task.title;
      title.setAttribute("data-testid", `task-title-${task.id}`);
      row.appendChild(title);
    }

    item.appendChild(row);

    const trash = create<HTMLButtonElement>("button", "trash-btn");
    trash.type = "button";
    trash.dataset.taskId = task.id;
    trash.setAttribute("aria-label", "Delete task");
    trash.setAttribute("data-testid", `task-delete-${task.id}`);
    trash.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
      </svg>
    `;
    item.appendChild(trash);

    if (currentFocusId === task.id && !task.completed) {
      const badge = create<HTMLDivElement>("div", "task-meta");
      badge.textContent = "Current Focus";
      item.appendChild(badge);
    }

    list.appendChild(item);
  });
};

export const mountTasksView = async (
  root: HTMLElement,
  options: TasksViewOptions = {}
): Promise<TasksViewHandle> => {
  root.innerHTML = `
    <div class="card-header">
      <div class="card-title">Task Queue</div>
      <button class="icon-btn" aria-label="Add task" data-testid="tasks-add">+</button>
    </div>
    <div class="card-body">
      <div class="tasks-list" data-testid="tasks-list"></div>
    </div>
  `;

  const service = options.service ?? createTasksService({ dbName: options.dbName });
  const dayKey = options.dayKey ?? getLocalDayKey();
  const list = qs<HTMLDivElement>(root, "tasks-list");
  let tasks: TaskRecord[] = [];
  let inputRow: HTMLDivElement | null = null;
  let editingId: string | null = null;
  const pendingAdds = new Map<string, Promise<TaskRecord>>();
  const resolvedTempIds = new Map<string, string>();
  const deletedTempIds = new Set<string>();
  const pendingTitleUpdates = new Map<string, string>();

  const refresh = async () => {
    tasks = await service.getTasks(dayKey);
    renderTasks(list, tasks, editingId);
  };

  const removeInputRow = () => {
    if (inputRow) {
      inputRow.remove();
      inputRow = null;
    }
  };

  const handleSubmit = async (input: HTMLInputElement) => {
    if (!inputRow) {
      return;
    }
    const title = input.value.trim();
    removeInputRow();
    if (!title) {
      return;
    }
    const now = Date.now();
    const tempTask: TaskRecord = {
      id: `temp-${crypto.randomUUID()}`,
      dayKey,
      title,
      completed: false,
      createdAt: now,
      updatedAt: now
    };
    tasks = [...tasks, tempTask];
    renderTasks(list, tasks, editingId);

    const addPromise = service.addTask(title, dayKey);
    pendingAdds.set(tempTask.id, addPromise);
    const persisted = await addPromise;
    pendingAdds.delete(tempTask.id);

    if (deletedTempIds.has(tempTask.id)) {
      deletedTempIds.delete(tempTask.id);
      await service.deleteTask(persisted.id);
      return;
    }

    resolvedTempIds.set(tempTask.id, persisted.id);
    const current = tasks.find((task) => task.id === tempTask.id);
    const merged: TaskRecord = {
      ...persisted,
      title: current?.title ?? persisted.title,
      completed: current?.completed ?? persisted.completed
    };
    tasks = tasks.map((task) => (task.id === tempTask.id ? merged : task));
    const tempItem = list.querySelector<HTMLElement>(`[data-task-id="${tempTask.id}"]`);
    if (tempItem) {
      tempItem.dataset.taskId = persisted.id;
      tempItem.setAttribute("data-testid", `task-item-${persisted.id}`);
    } else {
      renderTasks(list, tasks, editingId);
    }

    const pendingTitle = pendingTitleUpdates.get(tempTask.id);
    if (pendingTitle) {
      pendingTitleUpdates.delete(tempTask.id);
      await service.updateTitle(persisted.id, pendingTitle);
    }
  };

  const showInputRow = () => {
    if (inputRow) {
      const existingInput = inputRow.querySelector<HTMLInputElement>("input");
      existingInput?.focus();
      return;
    }

    inputRow = create<HTMLDivElement>("div", "task-item is-editing");
    const input = create<HTMLInputElement>("input", "task-input");
    input.type = "text";
    input.placeholder = "Add a task...";
    input.setAttribute("data-testid", "tasks-input");
    inputRow.appendChild(input);

    list.prepend(inputRow);
    input.focus();

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleSubmit(input);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        removeInputRow();
      }
    });

    input.addEventListener("blur", () => {
      void handleSubmit(input);
    });
  };

  const resolveTaskId = async (taskId: string): Promise<string | null> => {
    if (!taskId.startsWith("temp-")) {
      return taskId;
    }
    const pending = pendingAdds.get(taskId);
    if (pending) {
      const persisted = await pending;
      return persisted.id;
    }
    const resolved = resolvedTempIds.get(taskId);
    return resolved ?? null;
  };

  const startEditing = (taskId: string) => {
    editingId = taskId;
    renderTasks(list, tasks, editingId);
    const input = list.querySelector<HTMLInputElement>(
      `[data-testid="task-title-${taskId}"]`
    );
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  const commitEdit = async (taskId: string, input: HTMLInputElement) => {
    const title = input.value.trim();
    editingId = null;
    if (!title) {
      renderTasks(list, tasks, editingId);
      return;
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex >= 0) {
      const updated: TaskRecord = {
        ...tasks[taskIndex],
        title,
        updatedAt: Date.now()
      };
      tasks = tasks.map((task, index) => (index === taskIndex ? updated : task));
    }
    renderTasks(list, tasks, editingId);

    if (taskId.startsWith("temp-")) {
      const pending = pendingAdds.get(taskId);
      if (pending) {
        const persisted = await pending;
        await service.updateTitle(persisted.id, title);
        return;
      }
      const resolvedTemp = resolvedTempIds.get(taskId);
      if (resolvedTemp) {
        await service.updateTitle(resolvedTemp, title);
        return;
      }
      pendingTitleUpdates.set(taskId, title);
      return;
    }

    const resolved = await resolveTaskId(taskId);
    if (resolved) {
      await service.updateTitle(resolved, title);
    }
  };

  const cancelEdit = () => {
    editingId = null;
    renderTasks(list, tasks, editingId);
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest('[data-testid="tasks-add"]')) {
      showInputRow();
      return;
    }

    const deleteButton = target.closest<HTMLButtonElement>(".trash-btn");
    if (deleteButton?.dataset.taskId) {
      const taskId = deleteButton.dataset.taskId;
      editingId = editingId === taskId ? null : editingId;
      tasks = tasks.filter((task) => task.id !== taskId);
      renderTasks(list, tasks, editingId);
      if (taskId.startsWith("temp-")) {
        deletedTempIds.add(taskId);
        return;
      }
      void service.deleteTask(taskId);
    }
  });

  list.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const title = target.closest<HTMLElement>(".task-title");
    if (!title) {
      return;
    }
    const item = title.closest<HTMLElement>("[data-task-id]");
    if (!item?.dataset.taskId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    startEditing(item.dataset.taskId);
  });

  list.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (!target.classList.contains("task-title-input")) {
      return;
    }
    const item = target.closest<HTMLElement>("[data-task-id]");
    if (!item?.dataset.taskId) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (target.dataset.committing === "true") {
        return;
      }
      target.dataset.committing = "true";
      void commitEdit(item.dataset.taskId, target);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  });

  list.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (!target.classList.contains("task-title-input")) {
      return;
    }
    if (target.dataset.committing === "true") {
      return;
    }
    const item = target.closest<HTMLElement>("[data-task-id]");
    if (!item?.dataset.taskId) {
      return;
    }
    target.dataset.committing = "true";
    void commitEdit(item.dataset.taskId, target);
  });

  list.addEventListener("mouseover", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>(".trash-btn");
    if (button) {
      button.dataset.hover = "true";
    }
  });

  list.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>(".trash-btn");
    if (button) {
      delete button.dataset.hover;
    }
  });

  list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.type !== "checkbox") {
      return;
    }

    const item = target.closest<HTMLElement>("[data-task-id]");
    if (!item?.dataset.taskId) {
      return;
    }

    void (async () => {
      let taskId = item.dataset.taskId;
      const resolved = await resolveTaskId(taskId);
      if (!resolved) {
        return;
      }
      taskId = resolved;

      const taskIndex = tasks.findIndex((task) => task.id === taskId);
      if (taskIndex >= 0) {
        const updated: TaskRecord = {
          ...tasks[taskIndex],
          completed: target.checked,
          updatedAt: Date.now()
        };
        tasks = tasks.map((task, index) => (index === taskIndex ? updated : task));
        renderTasks(list, tasks, editingId);
        await service.toggleTask(taskId, target.checked, updated);
        return;
      }

      await service.toggleTask(taskId, target.checked);
      await refresh();
    })();
  });

  await refresh();

  return {
    refresh,
    destroy: async () => {
      root.innerHTML = "";
      await service.close();
    }
  };
};
