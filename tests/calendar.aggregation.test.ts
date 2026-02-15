import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountCalendarView } from "../src/views/calendar/calendarView";
import {
  addCompletedSession,
  addDoc,
  addNote,
  createTask,
  getLocalDayKey,
  openCozyDB
} from "../src/storage";
import { getMonthSummary } from "../src/features/calendar/calendarService";

const DB_NAME = "cozyfocus";

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<div data-testid=\"calendar-root\"></div>";
  const root = document.querySelector<HTMLElement>("[data-testid=\"calendar-root\"]");
  if (!root) {
    throw new Error("Missing calendar root");
  }
  return root;
};

const flush = async () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (check: () => boolean, attempts = 40) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) {
      return;
    }
    await flush();
  }
};

const seedDay = async (dayKey: string) => {
  const db = await openCozyDB(DB_NAME);
  const now = Date.now();
  const minutes = (value: number) => value * 60 * 1000;

  await addCompletedSession(db, {
    type: "focus",
    durationMs: minutes(25),
    startedAt: now,
    endedAt: now + minutes(25),
    dayKey
  });

  await addCompletedSession(db, {
    type: "focus",
    durationMs: minutes(45),
    startedAt: now + minutes(30),
    endedAt: now + minutes(75),
    dayKey
  });

  await createTask(db, { title: "Task one", dayKey });
  await createTask(db, { title: "Task two", dayKey });
  await createTask(db, { title: "Task three", dayKey });

  await addDoc(db, { title: "Doc one", markdown: "# Doc", dayKey });
  await addNote(db, { content: "Remember to review this day", dayKey });

  db.close();
};

describe("calendar aggregation", () => {
  it("aggregates focus minutes, tasks, files, and quick notes per day", async () => {
    await deleteDB(DB_NAME);
    const today = new Date();
    const dayKey = getLocalDayKey(today);

    await seedDay(dayKey);

    const summaryMap = await getMonthSummary(today.getFullYear(), today.getMonth());
    const summary = summaryMap.get(dayKey);

    expect(summary).toBeTruthy();
    expect(summary?.focusMinutes).toBe(70);
    expect(summary?.tasksCount).toBe(3);
    expect(summary?.filesCount).toBe(1);
    expect(summary?.notesCount).toBe(1);

    await deleteDB(DB_NAME);
  });

  it("renders badges for aggregated data", async () => {
    await deleteDB(DB_NAME);
    const today = new Date();
    const dayKey = getLocalDayKey(today);

    await seedDay(dayKey);

    const root = createRoot();
    mountCalendarView(root);

    await waitFor(() => {
      return Boolean(document.querySelector(`[data-testid="badge-focus-${dayKey}"]`));
    });

    const focusBadge = document.querySelector<HTMLElement>(
      `[data-testid=\"badge-focus-${dayKey}\"]`
    );
    const tasksBadge = document.querySelector<HTMLElement>(
      `[data-testid=\"badge-tasks-${dayKey}\"]`
    );
    const filesBadge = document.querySelector<HTMLElement>(
      `[data-testid=\"badge-files-${dayKey}\"]`
    );
    const notesBadge = document.querySelector<HTMLElement>(
      `[data-testid=\"badge-notes-${dayKey}\"]`
    );

    expect(focusBadge).toBeTruthy();
    expect(tasksBadge).toBeTruthy();
    expect(filesBadge).toBeTruthy();
    expect(notesBadge).toBeTruthy();

    expect(focusBadge?.textContent).toBe("70m");
    expect(tasksBadge?.textContent).toBe("3");
    expect(filesBadge?.textContent).toBe("1");
    expect(notesBadge?.textContent).toBe("1");

    await deleteDB(DB_NAME);
  });
});
