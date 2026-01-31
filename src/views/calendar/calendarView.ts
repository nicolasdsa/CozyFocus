import { qs } from "../../ui/dom";
import { renderCalendarGrid, type DaySummary } from "./calendarGrid";
import { renderCalendarDrawer } from "./calendarDrawer";

const formatMonthTitle = (date: Date): string =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

const isSameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const buildSummary = (date: Date): DaySummary => {
  const day = date.getDate();
  const focusMinutes = day % 5 === 0 ? 120 : day % 3 === 0 ? 45 : 0;
  const tasks = day % 4 === 0 ? 3 : day % 6 === 0 ? 1 : 0;
  const files = day % 7 === 0 ? 2 : 0;
  return { focusMinutes, tasks, files };
};

export const mountCalendarView = (root: HTMLElement): void => {
  root.innerHTML = `
    <section class="calendar-view" data-testid="calendar-view">
      <header class="calendar-header">
        <div>
          <p class="calendar-overline">Monthly overview</p>
          <h2 class="calendar-title" data-testid="calendar-month-title"></h2>
        </div>
        <div class="calendar-header__actions">
          <div class="calendar-nav">
            <button class="calendar-nav-btn" type="button" data-testid="calendar-prev" aria-label="Previous month">
              Prev
            </button>
            <button class="calendar-nav-btn" type="button" data-testid="calendar-next" aria-label="Next month">
              Next
            </button>
          </div>
          <button class="calendar-today-btn" type="button" data-testid="calendar-today">Today</button>
        </div>
      </header>

      <div class="calendar-body">
        <section class="calendar-main card">
          <div class="calendar-grid" data-testid="calendar-grid"></div>
        </section>
        <aside class="calendar-drawer card" data-testid="calendar-drawer"></aside>
      </div>
    </section>
  `;

  const monthTitle = qs<HTMLElement>(root, "calendar-month-title");
  const gridRoot = qs<HTMLElement>(root, "calendar-grid");
  const drawerRoot = qs<HTMLElement>(root, "calendar-drawer");
  const prevButton = qs<HTMLButtonElement>(root, "calendar-prev");
  const nextButton = qs<HTMLButtonElement>(root, "calendar-next");
  const todayButton = qs<HTMLButtonElement>(root, "calendar-today");

  const today = new Date();
  let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let currentMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

  const updateView = () => {
    monthTitle.textContent = formatMonthTitle(currentMonth);
    renderCalendarGrid(gridRoot, {
      month: currentMonth,
      selectedDate,
      onSelect: (date) => {
        selectedDate = date;
        if (!isSameMonth(currentMonth, date)) {
          currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        }
        updateView();
      },
      getSummary: buildSummary
    });
    renderCalendarDrawer(drawerRoot, selectedDate, buildSummary(selectedDate));
  };

  prevButton.addEventListener("click", () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    if (!isSameMonth(currentMonth, selectedDate)) {
      selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    }
    updateView();
  });

  nextButton.addEventListener("click", () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (!isSameMonth(currentMonth, selectedDate)) {
      selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    }
    updateView();
  });

  todayButton.addEventListener("click", () => {
    selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    currentMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    updateView();
  });

  updateView();
};
