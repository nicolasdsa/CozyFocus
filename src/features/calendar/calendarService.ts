import { openCozyDB } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";

export type DaySummary = {
  dayKey: string;
  focusMinutes: number;
  tasksCount: number;
  filesCount: number;
};

const buildEmptySummary = (dayKey: string): DaySummary => ({
  dayKey,
  focusMinutes: 0,
  tasksCount: 0,
  filesCount: 0
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

  const [sessions, tasks, docs] = await Promise.all([
    db.getAllFromIndex("sessions", "dayKey", range),
    db.getAllFromIndex("tasks", "dayKey", range),
    db.getAllFromIndex("docs", "dayKey", range)
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

  db.close();
  return summaryMap;
};
