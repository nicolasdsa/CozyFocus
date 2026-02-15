import type { DaySummary, TimelineItem } from "../../features/calendar/calendarService";
import { create } from "../../ui/dom";

type DrawerIconKind = TimelineItem["type"];

const formatDrawerTitle = (date: Date): string =>
  date.toLocaleDateString([], {
    month: "long",
    day: "numeric"
  });

const formatDrawerWeekday = (date: Date): string =>
  date.toLocaleDateString([], {
    weekday: "long"
  });

const formatLabel = (value: number, suffix: string): string => {
  if (value <= 0) {
    return "—";
  }
  return `${value}${suffix}`;
};

const iconMarkup = (kind: DrawerIconKind): string => {
  if (kind === "focus") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M482-80q-83 0-156-31.5T199-199q-54-54-86.5-127T80-482q0-83 31.5-156T199-765q54-54 127-86.5T482-884q83 0 156 31.5T765-765q54 54 86.5 127T884-482q0 83-31.5 156T765-199q-54 54-127 86.5T482-80Zm-2-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm40-200 126 126q11 11 28 11t28-11q11-11 11-28t-11-28L560-434v-206q0-17-11.5-28.5T520-680q-17 0-28.5 11.5T480-640v240q0 8 3 15.5t9 12.5l28 28Z"/></svg>`;
  }
  if (kind === "task") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M440-600 280-760l56-56 104 104 184-184 56 56-240 240Zm0 320L280-440l56-56 104 104 184-184 56 56-240 240Zm200 40v-80h200v80H640Zm0-320v-80h200v80H640Z"/></svg>`;
  }
  if (kind === "file") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>`;
  }
  return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`;
};

const createIcon = (kind: DrawerIconKind, className: string): HTMLSpanElement => {
  const icon = create<HTMLSpanElement>("span", className);
  icon.innerHTML = iconMarkup(kind);
  return icon;
};

const buildMetricCard = (
  kind: DrawerIconKind,
  label: string,
  value: string,
  testId: string,
  toneClass: string
): HTMLDivElement => {
  const card = create<HTMLDivElement>("div", `metric-card ${toneClass}`);
  card.dataset.testid = testId;
  const icon = createIcon(kind, "metric-card__icon");
  const title = create<HTMLSpanElement>("span", "metric-card__label");
  title.textContent = label;
  const number = create<HTMLElement>("strong", "metric-card__value");
  number.textContent = value;
  card.append(icon, title, number);
  return card;
};

const buildTimelineItem = (item: TimelineItem, index: number): HTMLLIElement => {
  const entry = create<HTMLLIElement>("li", "calendar-timeline__item timeline-item");
  entry.classList.add(`timeline--${item.type}`);
  entry.dataset.testid = `timeline-item-${index}`;

  const icon = createIcon(item.type, "calendar-timeline__icon timeline-icon");
  icon.classList.add(`icon--${item.type}`);

  const content = create<HTMLDivElement>("div", "calendar-timeline__content");
  const header = create<HTMLDivElement>("div", "calendar-timeline__header");
  const title = create<HTMLSpanElement>("span", "calendar-timeline__title");
  title.textContent = item.title;
  const time = create<HTMLSpanElement>("span", "calendar-timeline__time");
  time.textContent = item.timeLabel;
  header.append(title, time);

  content.appendChild(header);

  if (item.description) {
    const description = create<HTMLParagraphElement>("p", "calendar-timeline__description");
    description.textContent = item.description;
    content.appendChild(description);
  }

  if (item.tags && item.tags.length > 0) {
    const tags = create<HTMLDivElement>("div", "calendar-timeline__tags");
    item.tags.forEach((tag) => {
      const chip = create<HTMLSpanElement>("span", "calendar-timeline__tag");
      chip.textContent = tag;
      tags.appendChild(chip);
    });
    content.appendChild(tags);
  }

  entry.append(icon, content);
  return entry;
};

export const renderCalendarDrawer = (
  root: HTMLElement,
  date: Date,
  summary: DaySummary,
  timeline: TimelineItem[]
): void => {
  root.innerHTML = "";

  const header = create<HTMLDivElement>("div", "calendar-drawer__header drawer-header");
  const overline = create<HTMLParagraphElement>("p", "calendar-drawer__overline");
  overline.textContent = "Selected day";
  const title = create<HTMLHeadingElement>("h3", "calendar-drawer__title");
  title.textContent = formatDrawerTitle(date);
  title.dataset.testid = "drawer-day-title";
  const weekday = create<HTMLParagraphElement>("p", "calendar-drawer__weekday");
  weekday.textContent = formatDrawerWeekday(date);
  weekday.dataset.testid = "drawer-weekday";
  header.append(overline, title, weekday);

  const stats = create<HTMLDivElement>("div", "calendar-drawer__stats metric-grid");
  stats.append(
    buildMetricCard(
      "focus",
      "Focused minutes",
      formatLabel(summary.focusMinutes, "m"),
      "drawer-metric-focus",
      "metric-card--focus"
    ),
    buildMetricCard(
      "task",
      "Tasks",
      formatLabel(summary.tasksCount, ""),
      "drawer-metric-tasks",
      "metric-card--tasks"
    ),
    buildMetricCard(
      "file",
      "Files",
      formatLabel(summary.filesCount, ""),
      "drawer-metric-files",
      "metric-card--files"
    ),
    buildMetricCard(
      "note",
      "Quick notes",
      formatLabel(summary.notesCount, ""),
      "drawer-metric-notes",
      "metric-card--notes"
    )
  );

  const section = create<HTMLDivElement>("div", "calendar-drawer__section");
  const sectionTitle = create<HTMLHeadingElement>("h4");
  sectionTitle.textContent = "Activity Timeline";
  section.appendChild(sectionTitle);

  const list = create<HTMLOListElement>("ol", "calendar-timeline timeline-list");
  list.dataset.testid = "drawer-timeline";

  if (timeline.length === 0) {
    const empty = create<HTMLParagraphElement>("p", "calendar-drawer__empty");
    empty.textContent = "No activity logged for this day.";
    section.appendChild(empty);
  }

  timeline.forEach((item, index) => list.appendChild(buildTimelineItem(item, index)));
  section.appendChild(list);

  root.append(header, stats, section);
};
