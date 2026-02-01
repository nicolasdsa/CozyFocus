import type { DaySummary, TimelineItem } from "../../features/calendar/calendarService";
import { create } from "../../ui/dom";

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

const buildMetricCard = (
  label: string,
  value: string,
  testId: string,
  toneClass: string
): HTMLDivElement => {
  const card = create<HTMLDivElement>("div", `metric-card ${toneClass}`);
  card.dataset.testid = testId;
  const title = create<HTMLSpanElement>("span", "metric-card__label");
  title.textContent = label;
  const number = create<HTMLElement>("strong", "metric-card__value");
  number.textContent = value;
  card.append(title, number);
  return card;
};

const buildTimelineItem = (item: TimelineItem, index: number): HTMLLIElement => {
  const entry = create<HTMLLIElement>("li", "calendar-timeline__item timeline-item");
  entry.classList.add(`timeline--${item.type}`);
  entry.dataset.testid = `timeline-item-${index}`;

  const dot = create<HTMLSpanElement>("span", "calendar-timeline__dot timeline-dot");
  dot.classList.add(`dot--${item.type}`);

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

  entry.append(dot, content);
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
      "Focused minutes",
      formatLabel(summary.focusMinutes, "m"),
      "drawer-metric-focus",
      "metric-card--focus"
    ),
    buildMetricCard(
      "Tasks",
      formatLabel(summary.tasksCount, ""),
      "drawer-metric-tasks",
      "metric-card--tasks"
    ),
    buildMetricCard(
      "Files",
      formatLabel(summary.filesCount, ""),
      "drawer-metric-files",
      "metric-card--files"
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
