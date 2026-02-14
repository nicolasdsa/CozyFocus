import { openCozyDB } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";

export type DaySummary = {
  dayKey: string;
  focusMinutes: number;
  tasksCount: number;
  filesCount: number;
  notesCount: number;
};

export type TimelineItem = {
  id: string;
  type: "focus" | "task" | "file" | "note";
  title: string;
  description?: string;
  time: number;
  timeLabel: string;
  tags?: string[];
};

const buildEmptySummary = (dayKey: string): DaySummary => ({
  dayKey,
  focusMinutes: 0,
  tasksCount: 0,
  filesCount: 0,
  notesCount: 0
});

const getMonthBounds = (year: number, monthIndex0: number): { start: string; end: string } => {
  const startDate = new Date(year, monthIndex0, 1);
  const endDate = new Date(year, monthIndex0 + 1, 0);
  return {
    start: getLocalDayKey(startDate),
    end: getLocalDayKey(endDate)
  };
};

export const getMonthSummary = async (
  year: number,
  monthIndex0: number
): Promise<Map<string, DaySummary>> => {
  const db = await openCozyDB();
  const { start, end } = getMonthBounds(year, monthIndex0);
  const range = IDBKeyRange.bound(start, end);

  const [sessions, tasks, docs, notes] = await Promise.all([
    db.getAllFromIndex("sessions", "dayKey", range),
    db.getAllFromIndex("tasks", "dayKey", range),
    db.getAllFromIndex("docs", "dayKey", range),
    db.getAllFromIndex("notes", "dayKey", range)
  ]);

  const summaryMap = new Map<string, DaySummary>();
  const ensure = (dayKey: string) => {
    const existing = summaryMap.get(dayKey);
    if (existing) {
      return existing;
    }
    const created = buildEmptySummary(dayKey);
    summaryMap.set(dayKey, created);
    return created;
  };

  sessions.forEach((session) => {
    if (session.type !== "focus" || !session.completed) {
      return;
    }
    const summary = ensure(session.dayKey);
    summary.focusMinutes += session.durationMs / 60000;
  });

  tasks.forEach((task) => {
    const summary = ensure(task.dayKey);
    summary.tasksCount += 1;
  });

  docs.forEach((doc) => {
    const summary = ensure(doc.dayKey);
    summary.filesCount += 1;
  });

  notes.forEach((note) => {
    const summary = ensure(note.dayKey);
    summary.notesCount += 1;
  });

  db.close();
  return summaryMap;
};

const formatTimeLabel = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

export const getDayTimeline = async (dayKey: string): Promise<TimelineItem[]> => {
  const db = await openCozyDB();
  const [sessions, tasks, docs, notes] = await Promise.all([
    db.getAllFromIndex("sessions", "dayKey", dayKey),
    db.getAllFromIndex("tasks", "dayKey", dayKey),
    db.getAllFromIndex("docs", "dayKey", dayKey),
    db.getAllFromIndex("notes", "dayKey", dayKey)
  ]);

  const items: TimelineItem[] = [];

  sessions.forEach((session) => {
    if (session.type !== "focus" || !session.completed) {
      return;
    }
    const minutes = Math.round(session.durationMs / 60000);
    items.push({
      id: session.id,
      type: "focus",
      title: "Focus Session",
      description: `${minutes} minutes.`,
      time: session.endedAt,
      timeLabel: formatTimeLabel(session.endedAt)
    });
  });

  tasks.forEach((task) => {
    items.push({
      id: `${task.id}-created`,
      type: "task",
      title: `Task Created: ${task.title}`,
      time: task.createdAt,
      timeLabel: formatTimeLabel(task.createdAt)
    });

    if (!task.completed) {
      return;
    }
    const completedAt = task.completedAt ?? task.updatedAt;
    items.push({
      id: task.id,
      type: "task",
      title: `Task Completed: ${task.title}`,
      time: completedAt,
      timeLabel: formatTimeLabel(completedAt)
    });
  });

  docs.forEach((doc) => {
    items.push({
      id: doc.id,
      type: "file",
      title: `New File: ${doc.title}`,
      time: doc.createdAt,
      timeLabel: formatTimeLabel(doc.createdAt),
      tags: doc.tags ?? []
    });
  });

  notes.forEach((note) => {
    items.push({
      id: note.id,
      type: "note",
      title: "Quick Note Updated",
      description: note.content,
      time: note.updatedAt,
      timeLabel: formatTimeLabel(note.updatedAt)
    });
  });

  items.sort((a, b) => {
    if (a.time !== b.time) {
      return b.time - a.time;
    }
    const titleCompare = a.title.localeCompare(b.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return a.id.localeCompare(b.id);
  });

  db.close();
  return items;
};
