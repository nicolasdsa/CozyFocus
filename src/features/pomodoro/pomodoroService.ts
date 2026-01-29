import { addCompletedSession, getStatsByDay, openCozyDB } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { createEmptyStats } from "../../storage/statsRepo";
import type { DayStatsRecord, SessionRecord } from "../../storage/db";
import type { PomodoroDefaultsSetting, SessionType } from "../../types";
import { getSetting, saveSetting } from "../../storage/settingsRepo";
import { POMODORO_DURATIONS_MS } from "./pomodoroEngine";

interface CompletedSessionInput {
  type: SessionType;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  dayKey?: string;
}

export interface PomodoroService {
  getStats: (dayKey?: string) => Promise<DayStatsRecord>;
  getDefaults: () => Promise<PomodoroDefaultsSetting>;
  saveDefaults: (defaults: PomodoroDefaultsSetting) => Promise<PomodoroDefaultsSetting>;
  recordSession: (
    input: CompletedSessionInput
  ) => Promise<{ session: SessionRecord; stats: DayStatsRecord }>;
  close: () => Promise<void>;
}

export const createPomodoroService = (options?: { dbName?: string }): PomodoroService => {
  const dbPromise = openCozyDB(options?.dbName);
  const defaultsKey = "pomodoroDefaults";

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

  const getDefaults = async (): Promise<PomodoroDefaultsSetting> => {
    const db = await dbPromise;
    const stored = await getSetting<PomodoroDefaultsSetting>(db, defaultsKey);
    if (stored) {
      return stored;
    }
    return {
      focus: POMODORO_DURATIONS_MS.focus,
      shortBreak: POMODORO_DURATIONS_MS.shortBreak,
      longBreak: POMODORO_DURATIONS_MS.longBreak,
      updatedAt: Date.now()
    };
  };

  const saveDefaults = async (
    defaults: PomodoroDefaultsSetting
  ): Promise<PomodoroDefaultsSetting> => {
    const db = await dbPromise;
    const payload: PomodoroDefaultsSetting = {
      ...defaults,
      updatedAt: defaults.updatedAt ?? Date.now()
    };
    await saveSetting(db, defaultsKey, payload);
    return payload;
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getStats,
    getDefaults,
    saveDefaults,
    recordSession,
    close
  };
};
