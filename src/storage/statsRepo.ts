import type { CozyFocusDatabase, DayStatsRecord } from "./db";
import type { SessionType } from "../types";

const createEmptyStats = (dayKey: string): DayStatsRecord => ({
  dayKey,
  focusCompletedCount: 0,
  shortBreakCompletedCount: 0,
  longBreakCompletedCount: 0,
  totalFocusMs: 0,
  totalBreakMs: 0
});

const applySessionToStats = (
  stats: DayStatsRecord,
  type: SessionType,
  durationMs: number
): DayStatsRecord => {
  if (type === "focus") {
    stats.focusCompletedCount += 1;
    stats.totalFocusMs += durationMs;
    return stats;
  }

  if (type === "shortBreak") {
    stats.shortBreakCompletedCount += 1;
    stats.totalBreakMs += durationMs;
    return stats;
  }

  stats.longBreakCompletedCount += 1;
  stats.totalBreakMs += durationMs;
  return stats;
};

export const getStatsByDay = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<DayStatsRecord | undefined> => {
  return db.get("stats", dayKey);
};

export const recordCompletedSessionStats = async (
  db: CozyFocusDatabase,
  dayKey: string,
  type: SessionType,
  durationMs: number
): Promise<DayStatsRecord> => {
  const tx = db.transaction("stats", "readwrite");
  const store = tx.store;
  const existing = (await store.get(dayKey)) ?? createEmptyStats(dayKey);
  const updated = applySessionToStats(existing, type, durationMs);
  await store.put(updated);
  await tx.done;
  return updated;
};

export { createEmptyStats, applySessionToStats };
