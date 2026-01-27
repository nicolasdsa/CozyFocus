import { addCompletedSession, getStatsByDay, openCozyDB } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { createEmptyStats } from "../../storage/statsRepo";
import type { DayStatsRecord, SessionRecord } from "../../storage/db";
import type { SessionType } from "../../types";

interface CompletedSessionInput {
  type: SessionType;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  dayKey?: string;
}

export interface PomodoroService {
  getStats: (dayKey?: string) => Promise<DayStatsRecord>;
  recordSession: (
    input: CompletedSessionInput
  ) => Promise<{ session: SessionRecord; stats: DayStatsRecord }>;
  close: () => Promise<void>;
}

export const createPomodoroService = (options?: { dbName?: string }): PomodoroService => {
  const dbPromise = openCozyDB(options?.dbName);

  const resolveDayKey = (input?: string, endedAt?: number) => {
    if (input) {
      return input;
    }
    if (endedAt) {
      return getLocalDayKey(new Date(endedAt));
    }
    return getLocalDayKey();
  };

  const getStats = async (dayKey?: string): Promise<DayStatsRecord> => {
    const db = await dbPromise;
    const key = resolveDayKey(dayKey);
    return (await getStatsByDay(db, key)) ?? createEmptyStats(key);
  };

  const recordSession = async (
    input: CompletedSessionInput
  ): Promise<{ session: SessionRecord; stats: DayStatsRecord }> => {
    const db = await dbPromise;
    const dayKey = resolveDayKey(input.dayKey, input.endedAt);
    return addCompletedSession(db, {
      type: input.type,
      durationMs: input.durationMs,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      dayKey
    });
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getStats,
    recordSession,
    close
  };
};
