import type { DaySummary } from "../../features/calendar/calendarService";

export interface CalendarGridOptions {
  month: Date;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  getSummary: (date: Date) => DaySummary;
}

type BadgeType = "focus" | "task" | "file" | "note";

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

const badgeIconMarkup = (type: BadgeType): string => {
  if (type === "focus") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M482-80q-83 0-156-31.5T199-199q-54-54-86.5-127T80-482q0-83 31.5-156T199-765q54-54 127-86.5T482-884q83 0 156 31.5T765-765q54 54 86.5 127T884-482q0 83-31.5 156T765-199q-54 54-127 86.5T482-80Zm-2-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm40-200 126 126q11 11 28 11t28-11q11-11 11-28t-11-28L560-434v-206q0-17-11.5-28.5T520-680q-17 0-28.5 11.5T480-640v240q0 8 3 15.5t9 12.5l28 28Z"/></svg>`;
  }
  if (type === "task") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M222-200 80-342l56-56 85 85 170-170 56 57-225 226Zm0-320L80-662l56-56 85 85 170-170 56 57-225 226Zm298 240v-80h360v80H520Zm0-320v-80h360v80H520Z"/></svg>`;
  }
  if (type === "file") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>`;
  }
  return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`;
};

const buildBadge = (
  type: BadgeType,
  label: string,
  className: string,
  testId: string
): HTMLSpanElement => {
  const badge = document.createElement("span");
  badge.className = `cal-badge calendar-badge ${className}`;
  badge.dataset.testid = testId;
  const icon = document.createElement("span");
  icon.className = "cal-badge__icon";
  icon.innerHTML = badgeIconMarkup(type);
  const text = document.createElement("span");
  text.className = "cal-badge__text";
  text.textContent = label;
  badge.append(icon, text);
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
        "focus",
        `${summary.focusMinutes}m`,
        "cal-badge--focus calendar-badge--focus",
        `badge-focus-${dayKey}`
      )
    );
  }
  if (summary.tasksCount > 0) {
    badges.appendChild(
      buildBadge(
        "task",
        `${summary.tasksCount}`,
        "cal-badge--tasks calendar-badge--tasks",
        `badge-tasks-${dayKey}`
      )
    );
  }
  if (summary.filesCount > 0) {
    badges.appendChild(
      buildBadge(
        "file",
        `${summary.filesCount}`,
        "cal-badge--files calendar-badge--files",
        `badge-files-${dayKey}`
      )
    );
  }
  if (summary.notesCount > 0) {
    badges.appendChild(
      buildBadge(
        "note",
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
