import { openCozyDB } from "../../storage/db";
import { getSetting, saveSetting } from "../../storage/settingsRepo";
import type { AmbientMixerSetting } from "./ambientSetting";
import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";
import {
  buildTrackVolumeRecord,
  DEFAULT_AMBIENT_MASTER_VOLUME,
  DEFAULT_AMBIENT_TRACK_VOLUME
} from "./ambientStore";

const AMBIENT_MIXER_KEY = "ambientMixer";

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

const sanitizeTrackVolumes = (
  trackVolumes: unknown
): Record<AmbientTrackId, number> => {
  const defaults = buildTrackVolumeRecord(DEFAULT_AMBIENT_TRACK_VOLUME);
  if (!trackVolumes || typeof trackVolumes !== "object") {
    return defaults;
  }

  const input = trackVolumes as Record<string, unknown>;
  return AMBIENT_TRACKS.reduce<Record<AmbientTrackId, number>>((acc, track) => {
    acc[track.id] = clamp01(
      typeof input[track.id] === "number" ? (input[track.id] as number) : defaults[track.id]
    );
    return acc;
  }, { ...defaults });
};

const sanitizeSetting = (
  value: AmbientMixerSetting | null
): AmbientMixerSetting | null => {
  if (!value) {
    return null;
  }
  return {
    masterVolume: clamp01(value.masterVolume),
    trackVolumes: sanitizeTrackVolumes(value.trackVolumes),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now()
  };
};

export interface AmbientService {
  getSetting: () => Promise<AmbientMixerSetting | null>;
  saveSetting: (input: Pick<AmbientMixerSetting, "masterVolume" | "trackVolumes">) => Promise<AmbientMixerSetting>;
  close: () => Promise<void>;
}

interface AmbientServiceOptions {
  dbName?: string;
  now?: () => number;
}

export const createAmbientService = (
  options: AmbientServiceOptions = {}
): AmbientService => {
  const dbPromise = openCozyDB(options.dbName);
  const now = options.now ?? (() => Date.now());

  const getSettingValue = async (): Promise<AmbientMixerSetting | null> => {
    const db = await dbPromise;
    const stored = await getSetting<AmbientMixerSetting>(db, AMBIENT_MIXER_KEY);
    return sanitizeSetting(stored);
  };

  const saveSettingValue = async (
    input: Pick<AmbientMixerSetting, "masterVolume" | "trackVolumes">
  ): Promise<AmbientMixerSetting> => {
    const payload: AmbientMixerSetting = {
      masterVolume: clamp01(input.masterVolume),
      trackVolumes: sanitizeTrackVolumes(input.trackVolumes),
      updatedAt: now()
    };
    const db = await dbPromise;
    await saveSetting(db, AMBIENT_MIXER_KEY, payload);
    return payload;
  };

  const close = async (): Promise<void> => {
    const db = await dbPromise;
    db.close();
  };

  return {
    getSetting: getSettingValue,
    saveSetting: saveSettingValue,
    close
  };
};

export const getAmbientMixerDefaults = (): Pick<
  AmbientMixerSetting,
  "masterVolume" | "trackVolumes"
> => ({
  masterVolume: DEFAULT_AMBIENT_MASTER_VOLUME,
  trackVolumes: buildTrackVolumeRecord(DEFAULT_AMBIENT_TRACK_VOLUME)
});
