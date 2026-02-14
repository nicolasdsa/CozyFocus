import type { DaySummary } from "../../features/calendar/calendarService";

export interface CalendarGridOptions {
  month: Date;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  getSummary: (date: Date) => DaySummary;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildBadge = (
  label: string,
  className: string,
  testId: string
): HTMLSpanElement => {
  const badge = document.createElement("span");
  badge.className = `cal-badge calendar-badge ${className}`;
  badge.dataset.testid = testId;
  const dot = document.createElement("span");
  dot.className = "cal-badge__dot";
  const text = document.createElement("span");
  text.className = "cal-badge__text";
  text.textContent = label;
  badge.append(dot, text);
  return badge;
};

const buildDayCell = (
  date: Date,
  month: Date,
  selectedDate: Date,
  today: Date,
  summary: DaySummary,
  onSelect: (date: Date) => void
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cal-cell calendar-day";
  const dayKey = toDateKey(date);
  button.dataset.testid = `day-${dayKey}`;
  button.setAttribute("aria-label", date.toDateString());

  if (date.getMonth() !== month.getMonth()) {
    button.classList.add("cal-cell--outside", "day--outside");
  }
  if (isSameDay(date, today)) {
    button.classList.add("day--today", "cal-cell--today");
  }
  if (isSameDay(date, selectedDate)) {
    button.classList.add("cal-cell--selected");
  }

  const number = document.createElement("span");
  number.className = "cal-cell__daynum calendar-day__number";
  if (isSameDay(date, selectedDate)) {
    number.classList.add("cal-cell__daynum--selected");
  }
  number.textContent = `${date.getDate()}`;

  const badges = document.createElement("div");
  badges.className = "cal-cell__badges calendar-day__badges";

  if (summary.focusMinutes > 0) {
    badges.appendChild(
      buildBadge(
        `${summary.focusMinutes}m`,
        "cal-badge--focus calendar-badge--focus",
        `badge-focus-${dayKey}`
      )
    );
  }
  if (summary.tasksCount > 0) {
    badges.appendChild(
      buildBadge(
        `${summary.tasksCount}`,
        "cal-badge--tasks calendar-badge--tasks",
        `badge-tasks-${dayKey}`
      )
    );
  }
  if (summary.filesCount > 0) {
    badges.appendChild(
      buildBadge(
        `${summary.filesCount}`,
        "cal-badge--files calendar-badge--files",
        `badge-files-${dayKey}`
      )
    );
  }
  if (summary.notesCount > 0) {
    badges.appendChild(
      buildBadge(
        `${summary.notesCount}`,
        "cal-badge--notes calendar-badge--notes",
        `badge-notes-${dayKey}`
      )
    );
  }

  button.append(number, badges);
  button.addEventListener("click", () => {
    onSelect(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  });

  return button;
};

export const renderCalendarGrid = (root: HTMLElement, options: CalendarGridOptions): void => {
  root.innerHTML = "";
  root.className = "calendar-grid cal-grid-panel";
  const month = options.month;
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  const weekdaysRow = document.createElement("div");
  weekdaysRow.className = "calendar-grid__weekdays";
  WEEKDAYS.forEach((label) => {
    const day = document.createElement("div");
    day.className = "calendar-grid__weekday";
    day.textContent = label;
    weekdaysRow.appendChild(day);
  });

  const daysGrid = document.createElement("div");
  daysGrid.className = "calendar-grid__days";

  const today = new Date();
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const summary = options.getSummary(date);
    const dayCell = buildDayCell(date, month, options.selectedDate, today, summary, options.onSelect);
    daysGrid.appendChild(dayCell);
  }

  root.append(weekdaysRow, daysGrid);
};

export const formatDateKey = (date: Date): string => toDateKey(date);
