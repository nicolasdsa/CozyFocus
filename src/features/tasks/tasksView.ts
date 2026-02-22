import { v4 as uuidv4 } from 'uuid';
import type { TaskRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { create, qs } from "../../ui/dom";
import type { DeleteUndoRequest } from "../../ui/deleteUndo";
import { createTasksService, type TasksService } from "./tasksService";

interface TasksViewOptions {
  dayKey?: string;
  dbName?: string;
  service?: TasksService;
  onRequestUndo?: (request: DeleteUndoRequest) => void;
}

export interface TasksViewHandle {
  refresh: () => Promise<void>;
  destroy: () => Promise<void>;
}

const renderTasks = (
  list: HTMLElement,
  tasks: TaskRecord[],
  editingId: string | null,
  currentFocusId: string | null,
  waveTaskIds: Set<string>
): void => {
  list.innerHTML = "";

  tasks.forEach((task) => {
    const item = create<HTMLDivElement>("div", "task-item");
    item.dataset.taskId = task.id;
    item.setAttribute("data-testid", `task-item-${task.id}`);
    if (task.completed) {
      item.classList.add("task--completed");
    }
    if (currentFocusId === task.id && !task.completed) {
      item.classList.add("task--focus");
    }
    if (waveTaskIds.has(task.id)) {
      item.classList.add("task--wave");
    }

    const row = create<HTMLDivElement>("div", "task-row");
    const checkbox = create<HTMLInputElement>("input", "task-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    if (task.completed) {
      checkbox.classList.add("is-checked");
    }

    row.appendChild(checkbox);
    const content = create<HTMLDivElement>("div", "task-content");
    if (editingId === task.id) {
      const input = create<HTMLInputElement>("input", "task-title-input");
      input.type = "text";
      input.value = task.title;
      input.setAttribute("data-testid", `task-title-${task.id}`);
      content.appendChild(input);
    } else {
      const title = create<HTMLDivElement>("div", "task-title");
      title.textContent = task.title;
      title.setAttribute("data-testid", `task-title-${task.id}`);
      content.appendChild(title);
    }

    if (currentFocusId === task.id && !task.completed) {
      const badge = create<HTMLDivElement>("div", "task-meta");
      badge.textContent = "Current Focus";
      content.appendChild(badge);
    }

    row.appendChild(content);
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

    list.appendChild(item);
  });
};

const sortTasksForView = (tasks: TaskRecord[]): TaskRecord[] => {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.createdAt - b.createdAt;
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
  let currentFocusId: string | null = null;
  let isDestroyed = false;
  const waveTaskIds = new Set<string>();
  const pendingAdds = new Map<string, Promise<TaskRecord>>();
  const resolvedTempIds = new Map<string, string>();
  const deletedTempIds = new Set<string>();
  const pendingTitleUpdates = new Map<string, string>();

  const refresh = async () => {
    tasks = await service.getTasks(dayKey);
    currentFocusId = await service.getCurrentFocus(dayKey);
    if (currentFocusId) {
      const focusedTask = tasks.find((task) => task.id === currentFocusId);
      if (!focusedTask || focusedTask.completed) {
        currentFocusId = null;
        await service.setCurrentFocus(dayKey, null);
      }
    }
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
  };

  const removeInputRow = () => {
    if (inputRow) {
      inputRow.remove();
      inputRow = null;
    }
  };

  const runSafely = (operation: () => Promise<void>) => {
    void operation().catch((error: unknown) => {
      if (isDestroyed) {
        return;
      }
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return;
      }
      console.error(error);
    });
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
      id: `temp-${uuidv4()}`,
      dayKey,
      title,
      completed: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    if (tasks.length === 0 && !currentFocusId) {
      currentFocusId = tempTask.id;
    }
    tasks = [...tasks, tempTask];
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);

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
      completed: current?.completed ?? persisted.completed,
      completedAt: current?.completedAt ?? persisted.completedAt ?? null
    };
    tasks = tasks.map((task) => (task.id === tempTask.id ? merged : task));
    if (currentFocusId === tempTask.id) {
      currentFocusId = persisted.id;
      await service.setCurrentFocus(dayKey, persisted.id);
    }
    const tempItem = list.querySelector<HTMLElement>(`[data-task-id="${tempTask.id}"]`);
    if (tempItem) {
      tempItem.dataset.taskId = persisted.id;
      tempItem.setAttribute("data-testid", `task-item-${persisted.id}`);
      const titleEl = tempItem.querySelector<HTMLElement>(
        ".task-title, .task-title-input"
      );
      if (titleEl) {
        titleEl.setAttribute("data-testid", `task-title-${persisted.id}`);
      }
      const trashButton = tempItem.querySelector<HTMLButtonElement>(".trash-btn");
      if (trashButton) {
        trashButton.dataset.taskId = persisted.id;
        trashButton.setAttribute("data-testid", `task-delete-${persisted.id}`);
      }
    } else {
      renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
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
    const row = create<HTMLDivElement>("div", "task-row");
    const checkbox = create<HTMLInputElement>("input", "task-checkbox");
    checkbox.type = "checkbox";
    checkbox.disabled = true;
    checkbox.tabIndex = -1;
    checkbox.setAttribute("aria-hidden", "true");
    const content = create<HTMLDivElement>("div", "task-content");
    const input = create<HTMLInputElement>("input", "task-title-input");
    input.type = "text";
    input.placeholder = "Add a task...";
    input.setAttribute("data-testid", "tasks-input");
    content.appendChild(input);
    row.appendChild(checkbox);
    row.appendChild(content);
    inputRow.appendChild(row);

    list.prepend(inputRow);
    input.focus();

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSafely(async () => {
          await handleSubmit(input);
        });
      }

      if (event.key === "Escape") {
        event.preventDefault();
        removeInputRow();
      }
    });

    input.addEventListener("blur", () => {
      runSafely(async () => {
        await handleSubmit(input);
      });
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
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
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
      renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
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
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);

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
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
  };

  const triggerWave = (taskId: string) => {
    if (waveTaskIds.has(taskId)) {
      return;
    }
    waveTaskIds.add(taskId);
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
    window.setTimeout(() => {
      if (!waveTaskIds.has(taskId)) {
        return;
      }
      waveTaskIds.delete(taskId);
      renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
    }, 600);
  };

  const deleteTaskFromUi = (taskId: string) => {
    const removedTask = tasks.find((task) => task.id === taskId);
    if (!removedTask) {
      return;
    }
    const wasCurrentFocus = currentFocusId === taskId;
    editingId = editingId === taskId ? null : editingId;
    tasks = tasks.filter((task) => task.id !== taskId);
    if (wasCurrentFocus) {
      currentFocusId = null;
      runSafely(async () => {
        await service.setCurrentFocus(dayKey, null);
      });
    }
    renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
    if (taskId.startsWith("temp-")) {
      deletedTempIds.add(taskId);
      return;
    }

    if (options.onRequestUndo) {
      options.onRequestUndo({
        message: `Task removed: ${removedTask.title}`,
        onUndo: () => {
          editingId = null;
          tasks = sortTasksForView([...tasks, removedTask]);
          if (wasCurrentFocus && !removedTask.completed) {
            currentFocusId = removedTask.id;
            runSafely(async () => {
              await service.setCurrentFocus(dayKey, removedTask.id);
            });
          }
          renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
        },
        onCommit: async () => {
          await service.deleteTask(taskId);
        }
      });
      return;
    }

    void service.deleteTask(taskId);
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
  });

  list.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const title = target.closest<HTMLElement>(".task-title");
    if (!title) {
      if (target.closest(".task-title-input")) {
        return;
      }
      if (target.closest(".task-checkbox")) {
        return;
      }
      if (target.closest(".trash-btn")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showInputRow();
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
      runSafely(async () => {
        await commitEdit(item.dataset.taskId, target);
      });
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
    runSafely(async () => {
      await commitEdit(item.dataset.taskId, target);
    });
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

    runSafely(async () => {
      let taskId = item.dataset.taskId;
      const resolved = await resolveTaskId(taskId);
      if (!resolved) {
        return;
      }
      taskId = resolved;

      const taskIndex = tasks.findIndex((task) => task.id === taskId);
      if (taskIndex >= 0) {
        const wasCompleted = tasks[taskIndex]?.completed ?? false;
        const updated: TaskRecord = {
          ...tasks[taskIndex],
          completed: target.checked,
          updatedAt: Date.now(),
          completedAt: target.checked ? Date.now() : null
        };
        if (!wasCompleted && target.checked) {
          triggerWave(taskId);
        }
        if (target.checked && currentFocusId === taskId) {
          currentFocusId = null;
          await service.setCurrentFocus(dayKey, null);
        }
        tasks = tasks.map((task, index) => (index === taskIndex ? updated : task));
        renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
        await service.toggleTask(taskId, target.checked, updated);
        return;
      }

      await service.toggleTask(taskId, target.checked);
      await refresh();
    });
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const deleteButton = target.closest<HTMLButtonElement>(".trash-btn");
    if (deleteButton?.dataset.taskId) {
      event.stopPropagation();
      deleteTaskFromUi(deleteButton.dataset.taskId);
      return;
    }
    if (target.closest(".task-checkbox")) {
      event.stopPropagation();
      return;
    }
    if (target.closest(".task-title-input")) {
      return;
    }
    const item = target.closest<HTMLElement>("[data-task-id]");
    if (!item?.dataset.taskId) {
      return;
    }
    const taskId = item.dataset.taskId;
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task || task.completed) {
      return;
    }
    if (currentFocusId === taskId) {
      return;
    }
    runSafely(async () => {
      currentFocusId = taskId;
      renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
      const resolved = await resolveTaskId(taskId);
      if (resolved) {
        if (resolved !== taskId) {
          currentFocusId = resolved;
          renderTasks(list, tasks, editingId, currentFocusId, waveTaskIds);
        }
        await service.setCurrentFocus(dayKey, resolved);
      }
    });
  });

  await refresh();

  return {
    refresh,
    destroy: async () => {
      isDestroyed = true;
      root.innerHTML = "";
      await service.close();
    }
  };
};
