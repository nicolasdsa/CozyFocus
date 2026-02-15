import { openCozyDB, type CozyFocusDatabase } from "../../storage";
import { getSetting, saveSetting } from "../../storage/settingsRepo";
import type { TimeFormatMode, TimeFormatSetting } from "../../types";

export const TIME_FORMAT_SETTING_KEY = "timeFormatPreference";

const is12HourCycle = (hourCycle?: string): boolean => {
  return hourCycle === "h11" || hourCycle === "h12";
};

export const detectSystemTimeFormat = (): "12h" | "24h" => {
  const resolved = new Intl.DateTimeFormat([], { hour: "numeric" }).resolvedOptions();
  if (resolved.hour12 === true) {
    return "12h";
  }
  if (resolved.hour12 === false) {
    return "24h";
  }
  return is12HourCycle(resolved.hourCycle) ? "12h" : "24h";
};

export const resolveTimeFormat = (mode: TimeFormatMode): "12h" | "24h" => {
  if (mode === "auto") {
    return detectSystemTimeFormat();
  }
  return mode;
};

export const formatTimeForDisplay = (timestamp: number, mode: TimeFormatMode): string => {
  const resolved = resolveTimeFormat(mode);
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: resolved === "12h"
  });
};

export const getTimeFormatModeFromDb = async (
  db: CozyFocusDatabase
): Promise<TimeFormatMode> => {
  const setting = await getSetting<TimeFormatSetting>(db, TIME_FORMAT_SETTING_KEY);
  return setting?.mode ?? "auto";
};

export const readTimeFormatMode = async (dbName?: string): Promise<TimeFormatMode> => {
  const db = await openCozyDB(dbName);
  const mode = await getTimeFormatModeFromDb(db);
  db.close();
  return mode;
};

export const saveTimeFormatMode = async (
  mode: TimeFormatMode,
  dbName?: string
): Promise<TimeFormatSetting> => {
  const db = await openCozyDB(dbName);
  const setting: TimeFormatSetting = {
    mode,
    updatedAt: Date.now()
  };
  await saveSetting(db, TIME_FORMAT_SETTING_KEY, setting);
  db.close();
  return setting;
};
