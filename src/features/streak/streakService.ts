import { getLocalDayKey, openCozyDB } from "../../storage";
import { hasAnySessionForDay } from "../../storage/sessionsRepo";

export interface StreakInfo {
  count: number;
  todayCompleted: boolean;
}

export interface StreakService {
  getStreakInfo: (dayKey?: string) => Promise<StreakInfo>;
  close: () => Promise<void>;
}

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const shiftDays = (date: Date, delta: number): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
};

export const createStreakService = (options?: { dbName?: string }): StreakService => {
  const dbPromise = openCozyDB(options?.dbName);

  const getStreakInfo = async (dayKey?: string): Promise<StreakInfo> => {
    const db = await dbPromise;
    const todayKey = dayKey ?? getLocalDayKey();
    // Count any completed session type as a streak day.
    const todayCompleted = await hasAnySessionForDay(db, todayKey);

    let count = 0;
    let cursor = parseDayKey(todayKey);

    if (todayCompleted) {
      count = 1;
    }

    cursor = shiftDays(cursor, -1);

    while (true) {
      const key = getLocalDayKey(cursor);
      const hasSession = await hasAnySessionForDay(db, key);
      if (!hasSession) {
        break;
      }
      count += 1;
      cursor = shiftDays(cursor, -1);
    }

    return { count, todayCompleted };
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return { getStreakInfo, close };
};
