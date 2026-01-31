import type { DaySummary } from "../../features/calendar/calendarService";

const formatDrawerDate = (date: Date): string =>
  date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

const formatLabel = (value: number, suffix: string): string => {
  if (value <= 0) {
    return "—";
  }
  return `${value}${suffix}`;
};

export const renderCalendarDrawer = (root: HTMLElement, date: Date, summary: DaySummary): void => {
  root.innerHTML = `
    <div class="calendar-drawer__header">
      <p class="calendar-drawer__overline">Selected day</p>
      <h3 class="calendar-drawer__title">${formatDrawerDate(date)}</h3>
    </div>
    <div class="calendar-drawer__stats">
      <div class="calendar-drawer__stat">
        <span>Focus</span>
        <strong>${formatLabel(summary.focusMinutes, "m")}</strong>
      </div>
      <div class="calendar-drawer__stat">
        <span>Tasks</span>
        <strong>${formatLabel(summary.tasksCount, "")}</strong>
      </div>
      <div class="calendar-drawer__stat">
        <span>Files</span>
        <strong>${formatLabel(summary.filesCount, "")}</strong>
      </div>
    </div>
    <div class="calendar-drawer__section">
      <h4>Today at a glance</h4>
      <p class="calendar-drawer__empty">Timeline details will appear here.</p>
    </div>
  `;
};
