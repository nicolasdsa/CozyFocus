import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountCalendarView } from "../src/views/calendar/calendarView";
import { addCompletedSession, getLocalDayKey, openCozyDB } from "../src/storage";

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

const formatDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDayTitle = (date: Date): string =>
  date.toLocaleDateString([], { month: "long", day: "numeric" });

const formatWeekday = (date: Date): string =>
  date.toLocaleDateString([], { weekday: "long" });

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

describe("calendar drawer", () => {
  it("default drawer shows today", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();
    mountCalendarView(root);

    await flush();
    await flush();

    const today = new Date();
    const title = document.querySelector<HTMLElement>("[data-testid=\"drawer-day-title\"]");
    const weekday = document.querySelector<HTMLElement>(
      "[data-testid=\"drawer-weekday\"]"
    );

    expect(title?.textContent).toBe(formatDayTitle(today));
    expect(weekday?.textContent).toBe(formatWeekday(today));

    await deleteDB(DB_NAME);
  });

  it("selecting another day updates drawer", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();

    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayNumber = today.getDate() === 15 ? 16 : 15;
    target.setDate(dayNumber);

    const dayKey = formatDayKey(target);
    const db = await openCozyDB(DB_NAME);

    await addCompletedSession(db, {
      type: "focus",
      durationMs: 30 * 60 * 1000,
      startedAt: new Date(target.getFullYear(), target.getMonth(), target.getDate(), 8, 30).getTime(),
      endedAt: new Date(target.getFullYear(), target.getMonth(), target.getDate(), 9, 0).getTime(),
      dayKey
    });

    await db.put("tasks", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Plan meeting",
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null
    });

    await db.put("tasks", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Review pull request",
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null
    });

    await db.put("docs", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Sprint notes",
      markdown: "# Notes",
      tags: ["planning"],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    db.close();

    mountCalendarView(root);
    await flush();
    await flush();

    const dayCell = document.querySelector<HTMLElement>(
      `[data-testid=\"day-${dayKey}\"]`
    );
    if (!dayCell) {
      throw new Error("Missing day cell for selection");
    }
    dayCell.click();

    await flush();
    await flush();

    const title = document.querySelector<HTMLElement>("[data-testid=\"drawer-day-title\"]");
    const focusMetric = document.querySelector<HTMLElement>(
      "[data-testid=\"drawer-metric-focus\"]"
    );
    const taskMetric = document.querySelector<HTMLElement>(
      "[data-testid=\"drawer-metric-tasks\"]"
    );
    const fileMetric = document.querySelector<HTMLElement>(
      "[data-testid=\"drawer-metric-files\"]"
    );

    expect(title?.textContent).toBe(formatDayTitle(target));
    expect(focusMetric?.textContent).toContain("30m");
    expect(taskMetric?.textContent).toContain("2");
    expect(fileMetric?.textContent).toContain("1");

    await deleteDB(DB_NAME);
  });

  it("timeline merges events sorted by time", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();

    const today = new Date();
    const dayKey = getLocalDayKey(today);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

    const focusEndedAt = base.getTime() + 9 * 60 * 60 * 1000;
    const docCreatedAt = base.getTime() + 10 * 60 * 60 * 1000 + 45 * 60 * 1000;
    const taskCompletedAt = base.getTime() + 13 * 60 * 60 * 1000 + 30 * 60 * 1000;

    const db = await openCozyDB(DB_NAME);

    await addCompletedSession(db, {
      type: "focus",
      durationMs: 30 * 60 * 1000,
      startedAt: focusEndedAt - 30 * 60 * 1000,
      endedAt: focusEndedAt,
      dayKey
    });

    await db.put("docs", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Daily recap",
      markdown: "# Recap",
      tags: ["daily"],
      createdAt: docCreatedAt,
      updatedAt: docCreatedAt
    });

    await db.put("tasks", {
      id: crypto.randomUUID(),
      dayKey,
      title: "Send summary",
      completed: true,
      createdAt: base.getTime() + 8 * 60 * 60 * 1000,
      updatedAt: taskCompletedAt,
      completedAt: taskCompletedAt
    });

    db.close();

    mountCalendarView(root);
    await flush();
    await flush();

    const first = document.querySelector<HTMLElement>("[data-testid=\"timeline-item-0\"]");
    const second = document.querySelector<HTMLElement>("[data-testid=\"timeline-item-1\"]");
    const third = document.querySelector<HTMLElement>("[data-testid=\"timeline-item-2\"]");

    expect(first?.textContent).toContain("Focus Session");
    expect(first?.textContent).toContain(formatTime(focusEndedAt));

    expect(second?.textContent).toContain("New File: Daily recap");
    expect(second?.textContent).toContain(formatTime(docCreatedAt));

    expect(third?.textContent).toContain("Task Completed: Send summary");
    expect(third?.textContent).toContain(formatTime(taskCompletedAt));

    await deleteDB(DB_NAME);
  });
});
