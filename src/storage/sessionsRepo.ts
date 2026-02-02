import type { CozyFocusDatabase, DayStatsRecord, SessionRecord } from "./db";
import type { SessionType } from "../types";
import { getLocalDayKey } from "./dayKey";
import { applySessionToStats, createEmptyStats } from "./statsRepo";

interface CompletedSessionInput {
  type: SessionType;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  dayKey?: string;
}

export const addCompletedSession = async (
  db: CozyFocusDatabase,
  input: CompletedSessionInput
): Promise<{ session: SessionRecord; stats: DayStatsRecord }> => {
  const dayKey = input.dayKey ?? getLocalDayKey();
  const session: SessionRecord = {
    id: crypto.randomUUID(),
    dayKey,
    type: input.type,
    durationMs: input.durationMs,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    completed: true
  };

  const tx = db.transaction(["sessions", "stats"], "readwrite");
  await tx.objectStore("sessions").put(session);

  const statsStore = tx.objectStore("stats");
  const existing = (await statsStore.get(dayKey)) ?? createEmptyStats(dayKey);
  const updatedStats = applySessionToStats(
    existing,
    session.type,
    session.durationMs
  );
  await statsStore.put(updatedStats);
  await tx.done;

  return { session, stats: updatedStats };
};

export const getSessionsByDay = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<SessionRecord[]> => {
  return db.getAllFromIndex("sessions", "dayKey", dayKey);
};

export const getSessionsByDayAndType = async (
  db: CozyFocusDatabase,
  dayKey: string,
  type: SessionType
): Promise<SessionRecord[]> => {
  const sessions = await getSessionsByDay(db, dayKey);
  return sessions.filter((session) => session.type === type);
};

export const hasAnySessionForDay = async (
  db: CozyFocusDatabase,
  dayKey: string
): Promise<boolean> => {
  const record = await db.getFromIndex("sessions", "dayKey", dayKey);
  return Boolean(record);
};

export const getById = async (
  db: CozyFocusDatabase,
  id: string
): Promise<SessionRecord | undefined> => {
  return db.get("sessions", id);
};

export const has = async (
  db: CozyFocusDatabase,
  id: string
): Promise<boolean> => {
  const existing = await db.get("sessions", id);
  return Boolean(existing);
};

export const bulkPut = async (
  db: CozyFocusDatabase,
  records: SessionRecord[]
): Promise<void> => {
  if (records.length === 0) {
    return;
  }
  const tx = db.transaction("sessions", "readwrite");
  for (const record of records) {
    await tx.store.put(record);
  }
  await tx.done;
};
