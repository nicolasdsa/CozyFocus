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

const renderTasks = (list: HTMLElement, tasks: TaskRecord[]): void => {
  list.innerHTML = "";

  const currentFocusId = tasks.find((task) => !task.completed)?.id;

  tasks.forEach((task) => {
    const item = create<HTMLDivElement>("div", "task-item");
    item.dataset.taskId = task.id;
    item.setAttribute("data-testid", `task-item-${task.id}`);
    if (task.completed) {
      item.classList.add("is-completed");
    }

    const label = create<HTMLLabelElement>("label", "task-row");
    const checkbox = create<HTMLInputElement>("input", "task-check");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;

    const title = create<HTMLDivElement>("div", "task-title");
    title.textContent = task.title;

    label.appendChild(checkbox);
    label.appendChild(title);
    item.appendChild(label);

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
  const pendingAdds = new Map<string, Promise<TaskRecord>>();

  const refresh = async () => {
    tasks = await service.getTasks(dayKey);
    renderTasks(list, tasks);
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
    renderTasks(list, tasks);

    const addPromise = service.addTask(title, dayKey);
    pendingAdds.set(tempTask.id, addPromise);
    const persisted = await addPromise;
    pendingAdds.delete(tempTask.id);
    tasks = tasks.map((task) => (task.id === tempTask.id ? persisted : task));
    renderTasks(list, tasks);
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

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest('[data-testid="tasks-add"]')) {
      showInputRow();
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
      if (taskId.startsWith("temp-")) {
        const pending = pendingAdds.get(taskId);
        if (pending) {
          const persisted = await pending;
          taskId = persisted.id;
        } else {
          return;
        }
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
