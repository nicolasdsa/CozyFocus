import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { mountCalendarView } from "../src/views/calendar/calendarView";
import { addCompletedSession, addDoc, createTask, getLocalDayKey, openCozyDB } from "../src/storage";

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
const waitForCalendarLoad = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.querySelectorAll(".calendar-grid__weekday").length === 7) {
      return;
    }
    await flush();
  }
};
const waitForCondition = async (check: () => boolean, attempts = 20) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) {
      return;
    }
    await flush();
  }
};

const formatKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("calendar polish", () => {
  it("renders header elements with expected classes", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();
    mountCalendarView(root);

    await waitForCalendarLoad();

    const header = document.querySelector<HTMLElement>(".cal-header");
    const title = document.querySelector<HTMLElement>(".cal-month-title");
    const navButtons = document.querySelectorAll<HTMLElement>(".cal-nav-btn");
    const todayButton = document.querySelector<HTMLElement>(".cal-today-btn");

    expect(header).toBeTruthy();
    expect(title).toBeTruthy();
    expect(navButtons.length).toBe(2);
    expect(todayButton).toBeTruthy();

    await deleteDB(DB_NAME);
  });

  it("marks outside days and renders badges with dots", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();

    const dayKey = getLocalDayKey();
    const db = await openCozyDB(DB_NAME);

    await addCompletedSession(db, {
      type: "focus",
      durationMs: 25 * 60 * 1000,
      startedAt: Date.now() - 25 * 60 * 1000,
      endedAt: Date.now(),
      dayKey
    });

    await createTask(db, { title: "Polish calendar", dayKey });

    await addDoc(db, { title: "Design notes", markdown: "# Notes", dayKey });

    db.close();

    mountCalendarView(root);
    await waitForCalendarLoad();

    const outsideCells = document.querySelectorAll(".cal-cell--outside");
    expect(outsideCells.length).toBeGreaterThan(0);

    const badge = document.querySelector<HTMLElement>(".cal-badge");
    expect(badge).toBeTruthy();
    expect(badge?.querySelector(".cal-badge__icon")).toBeTruthy();
    expect(badge?.querySelector(".cal-badge__text")).toBeTruthy();

    await deleteDB(DB_NAME);
  });

  it("updates selected day class on click and keeps drawer open", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();
    mountCalendarView(root);

    await waitForCalendarLoad();

    const today = new Date();
    const firstKey = formatKey(today);
    const nextDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    nextDate.setDate(today.getDate() === 15 ? 16 : 15);
    const secondKey = formatKey(nextDate);

    const firstCell = document.querySelector<HTMLElement>(`[data-testid=\"day-${firstKey}\"]`);
    const secondCell = document.querySelector<HTMLElement>(`[data-testid=\"day-${secondKey}\"]`);

    if (!firstCell || !secondCell) {
      throw new Error("Missing calendar day cells");
    }

    secondCell.click();
    await waitForCondition(() => {
      const updated = document.querySelector<HTMLElement>(`[data-testid=\"day-${secondKey}\"]`);
      return updated?.classList.contains("cal-cell--selected") === true;
    });

    const firstCellUpdated = document.querySelector<HTMLElement>(`[data-testid=\"day-${firstKey}\"]`);
    const secondCellUpdated = document.querySelector<HTMLElement>(`[data-testid=\"day-${secondKey}\"]`);
    expect(firstCellUpdated?.classList.contains("cal-cell--selected")).toBe(false);
    expect(secondCellUpdated?.classList.contains("cal-cell--selected")).toBe(true);

    const drawer = document.querySelector<HTMLElement>("[data-testid=\"calendar-drawer\"]");
    expect(drawer?.classList.contains("drawer--open")).toBe(true);

    await deleteDB(DB_NAME);
  });

  it("renders metric cards and timeline styling hooks", async () => {
    await deleteDB(DB_NAME);
    const root = createRoot();

    const dayKey = getLocalDayKey();
    const db = await openCozyDB(DB_NAME);

    await addCompletedSession(db, {
      type: "focus",
      durationMs: 25 * 60 * 1000,
      startedAt: Date.now() - 25 * 60 * 1000,
      endedAt: Date.now(),
      dayKey
    });

    db.close();

    mountCalendarView(root);
    await waitForCalendarLoad();

    const metricCards = document.querySelectorAll<HTMLElement>(".metric-card");
    expect(metricCards.length).toBeGreaterThan(0);

    const timelineItem = document.querySelector<HTMLElement>(".timeline-item");
    const timelineDot = document.querySelector<HTMLElement>(".timeline-icon");
    expect(timelineItem).toBeTruthy();
    expect(timelineDot).toBeTruthy();

    await deleteDB(DB_NAME);
  });
});
