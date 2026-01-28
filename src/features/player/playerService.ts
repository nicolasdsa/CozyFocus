import { openCozyDB } from "../../storage/db";
import { getSetting, saveSetting } from "../../storage/settingsRepo";
import { ALL_ADAPTERS } from "./platforms";
import { resolveAdapter } from "./platforms/resolver";
import type { PlatformAdapter } from "./platforms/types";
import type { MediaPlayerSetting } from "./playerTypes";

export class PlayerValidationError extends Error {
  code: "unsupported" | "empty";

  constructor(message: string, code: "unsupported" | "empty" = "unsupported") {
    super(message);
    this.name = "PlayerValidationError";
    this.code = code;
  }
}

export interface PlayerService {
  getSetting: () => Promise<MediaPlayerSetting | null>;
  saveSetting: (rawInput: string) => Promise<MediaPlayerSetting>;
  close: () => Promise<void>;
}

interface PlayerServiceOptions {
  dbName?: string;
  adapters?: PlatformAdapter[];
}

const MEDIA_PLAYER_KEY = "mediaPlayer";

export const createPlayerService = (options: PlayerServiceOptions = {}): PlayerService => {
  const dbPromise = openCozyDB(options.dbName);
  const adapters = options.adapters ?? ALL_ADAPTERS;

  const getSettingValue = async (): Promise<MediaPlayerSetting | null> => {
    const db = await dbPromise;
    return getSetting<MediaPlayerSetting>(db, MEDIA_PLAYER_KEY);
  };

  const saveSettingValue = async (rawInput: string): Promise<MediaPlayerSetting> => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      throw new PlayerValidationError("Paste a Spotify or YouTube link.", "empty");
    }

    const adapter = resolveAdapter(trimmed, adapters);
    if (!adapter) {
      throw new PlayerValidationError("Unsupported source. Paste a Spotify or YouTube link.");
    }

    const normalized = adapter.normalize(trimmed);
    const embedUrl = adapter.buildEmbedUrl(normalized);
    const setting: MediaPlayerSetting = {
      rawInput,
      platformId: adapter.id,
      embedUrl,
      updatedAt: Date.now()
    };

    const db = await dbPromise;
    await saveSetting(db, MEDIA_PLAYER_KEY, setting);
    return setting;
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

export type { MediaPlayerSetting };
