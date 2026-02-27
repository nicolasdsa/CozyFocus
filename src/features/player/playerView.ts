import { qs } from "../../ui/dom";
import { ALL_ADAPTERS } from "./platforms";
import type { PlatformAdapter } from "./platforms/types";
import { createPlayerService, PlayerValidationError, type PlayerService } from "./playerService";
import type { MediaPlayerSetting } from "./playerTypes";
import { isOnline } from "./net";
import { getYouTubeOEmbedMeta } from "./youtubeOembed";

interface PlayerViewOptions {
  dbName?: string;
  service?: PlayerService;
  adapters?: PlatformAdapter[];
}

export interface PlayerViewHandle {
  reloadFromStorage: () => Promise<void>;
  destroy: () => Promise<void>;
}

const YOUTUBE_EMBED_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const YOUTUBE_DEFAULT_VOLUME = 55;

const buildPlaceholder = (message: string): HTMLElement => {
  const el = document.createElement("div");
  el.className = "player-placeholder";
  el.textContent = message;
  return el;
};

const findAdapterById = (
  adapters: PlatformAdapter[],
  platformId: string
): PlatformAdapter | null => {
  return adapters.find((adapter) => adapter.id === platformId) ?? null;
};

const isYouTubeSetting = (setting: MediaPlayerSetting): boolean => setting.platformId === "youtube";

const buildYouTubeIframeUrl = (embedUrl: string): string => {
  try {
    const parsed = new URL(embedUrl);
    if (!YOUTUBE_EMBED_HOSTS.has(parsed.hostname)) {
      return embedUrl;
    }
    if (!parsed.searchParams.has("enablejsapi")) {
      parsed.searchParams.set("enablejsapi", "1");
    }
    if (!parsed.searchParams.has("playsinline")) {
      parsed.searchParams.set("playsinline", "1");
    }
    const origin = globalThis.location?.origin;
    if (!parsed.searchParams.has("origin") && origin && origin !== "null") {
      parsed.searchParams.set("origin", origin);
    }
    return parsed.toString();
  } catch {
    return embedUrl;
  }
};

const getFallbackThumbnail = (embedUrl: string): string | null => {
  try {
    const parsed = new URL(embedUrl);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts[0] !== "embed" || !pathParts[1] || pathParts[1] === "videoseries") {
      return null;
    }
    return `https://i.ytimg.com/vi/${pathParts[1]}/hqdefault.jpg`;
  } catch {
    return null;
  }
};

const sendYouTubeCommand = (
  iframe: HTMLIFrameElement,
  func: string,
  args: Array<number | string | boolean> = []
): void => {
  if (!iframe.contentWindow) {
    return;
  }
  iframe.contentWindow.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args
    }),
    "*"
  );
};

const sendYouTubeListeningHandshake = (iframe: HTMLIFrameElement): void => {
  if (!iframe.contentWindow) {
    return;
  }
  iframe.contentWindow.postMessage(
    JSON.stringify({
      event: "listening",
      id: "cozyfocus-player",
      channel: "widget"
    }),
    "*"
  );
};

const parseYouTubeMessage = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return null;
};

export const mountPlayerView = async (
  root: HTMLElement,
  options: PlayerViewOptions = {}
): Promise<PlayerViewHandle> => {
  root.innerHTML = `
    <div class="player-form">
      <div class="player-input-row">
        <input
          class="player-input"
          type="text"
          placeholder="Paste Spotify playlist or YouTube link"
          data-testid="player-input"
        />
        <button class="player-save" data-testid="player-save">Save</button>
      </div>
      <div class="player-status" data-testid="player-status"></div>
    </div>
    <div class="player-custom" data-testid="player-custom"></div>
    <div class="player-embed" data-testid="player-embed"></div>
  `;

  const ownsService = !options.service;
  const service =
    options.service ?? createPlayerService({ dbName: options.dbName, adapters: options.adapters });
  const adapters = options.adapters ?? ALL_ADAPTERS;

  const input = qs<HTMLInputElement>(root, "player-input");
  const saveButton = qs<HTMLButtonElement>(root, "player-save");
  const status = qs<HTMLElement>(root, "player-status");
  const custom = qs<HTMLElement>(root, "player-custom");
  const embed = qs<HTMLElement>(root, "player-embed");
  let renderVersion = 0;
  let detachYouTubeSync: (() => void) | null = null;

  const renderStatus = (message: string) => {
    status.textContent = message;
  };

  const renderEmbed = (setting: MediaPlayerSetting | null) => {
    const version = ++renderVersion;
    if (detachYouTubeSync) {
      detachYouTubeSync();
      detachYouTubeSync = null;
    }
    custom.innerHTML = "";
    embed.innerHTML = "";
    embed.className = "player-embed";

    if (!setting) {
      embed.appendChild(buildPlaceholder("Paste a link to start."));
      renderStatus("Ready for a Spotify or YouTube link.");
      return;
    }

    if (!isOnline()) {
      embed.appendChild(buildPlaceholder("Offline — embed unavailable."));
      renderStatus("Offline — embed unavailable. Your selection is saved.");
      return;
    }

    const adapter = findAdapterById(adapters, setting.platformId);
    const platformName = adapter?.getDisplayName() ?? "your selection";
    renderStatus(`Playing from ${platformName}`);

    const iframe = document.createElement("iframe");
    iframe.title = "Media player";
    iframe.loading = "lazy";
    iframe.allow =
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    if (!isYouTubeSetting(setting)) {
      iframe.src = setting.embedUrl;
      iframe.className = "player-iframe";
      embed.appendChild(iframe);
      return;
    }

    iframe.src = buildYouTubeIframeUrl(setting.embedUrl);
    iframe.className = "player-iframe player-iframe--youtube";
    embed.classList.add("player-embed--youtube", "player-embed--collapsed");
    embed.appendChild(iframe);

    const shell = document.createElement("article");
    shell.className = "player-youtube-shell";

    const thumb = document.createElement("img");
    thumb.className = "player-youtube-thumb";
    thumb.alt = "YouTube thumbnail";
    thumb.loading = "lazy";
    const fallbackThumbnail = getFallbackThumbnail(setting.embedUrl);
    if (fallbackThumbnail) {
      thumb.src = fallbackThumbnail;
    }

    const details = document.createElement("div");
    details.className = "player-youtube-details";

    const title = document.createElement("strong");
    title.className = "player-youtube-title";
    title.textContent = "YouTube track";

    const subtitle = document.createElement("span");
    subtitle.className = "player-youtube-subtitle";
    subtitle.textContent = "YouTube";

    details.append(title, subtitle);

    const controls = document.createElement("div");
    controls.className = "player-youtube-controls";

    const playPauseButton = document.createElement("button");
    playPauseButton.className = "player-youtube-btn";
    playPauseButton.type = "button";
    playPauseButton.textContent = "Play";
    playPauseButton.setAttribute("data-testid", "player-youtube-toggle");

    const muteButton = document.createElement("button");
    muteButton.className = "player-youtube-btn player-youtube-btn--ghost";
    muteButton.type = "button";
    muteButton.textContent = "Mute";
    muteButton.setAttribute("data-testid", "player-youtube-mute");

    const volume = document.createElement("input");
    volume.className = "player-youtube-volume";
    volume.type = "range";
    volume.min = "0";
    volume.max = "100";
    volume.step = "1";
    volume.value = String(YOUTUBE_DEFAULT_VOLUME);
    volume.setAttribute("data-testid", "player-youtube-volume");
    volume.setAttribute("aria-label", "YouTube volume");

    const expandButton = document.createElement("button");
    expandButton.className = "player-youtube-btn player-youtube-btn--primary";
    expandButton.type = "button";
    expandButton.textContent = "Open";
    expandButton.setAttribute("data-testid", "player-youtube-expand");
    expandButton.setAttribute("aria-expanded", "false");

    controls.append(playPauseButton, muteButton, volume, expandButton);
    shell.append(thumb, details, controls);
    custom.appendChild(shell);

    let isPlaying = false;
    let isMuted = false;
    let isExpanded = false;
    let isDraggingVolume = false;

    const syncPlayLabel = () => {
      playPauseButton.textContent = isPlaying ? "Pause" : "Play";
    };

    const syncMuteLabel = () => {
      muteButton.textContent = isMuted ? "Unmute" : "Mute";
    };

    const setExpandedState = (nextExpanded: boolean): void => {
      isExpanded = nextExpanded;
      embed.classList.toggle("player-embed--expanded", isExpanded);
      embed.classList.toggle("player-embed--collapsed", !isExpanded);
      expandButton.textContent = isExpanded ? "Expanded" : "Open";
      expandButton.setAttribute("aria-expanded", String(isExpanded));
    };

    playPauseButton.addEventListener("click", () => {
      if (isPlaying) {
        sendYouTubeCommand(iframe, "pauseVideo");
      } else {
        sendYouTubeCommand(iframe, "playVideo");
      }
    });

    muteButton.addEventListener("click", () => {
      if (isMuted) {
        sendYouTubeCommand(iframe, "unMute");
      } else {
        sendYouTubeCommand(iframe, "mute");
      }
    });

    volume.addEventListener("pointerdown", () => {
      isDraggingVolume = true;
    });
    volume.addEventListener("pointerup", () => {
      isDraggingVolume = false;
    });
    volume.addEventListener("blur", () => {
      isDraggingVolume = false;
    });
    volume.addEventListener("input", () => {
      sendYouTubeCommand(iframe, "setVolume", [Number(volume.value)]);
      if (Number(volume.value) > 0) {
        sendYouTubeCommand(iframe, "unMute");
      }
    });

    expandButton.addEventListener("click", () => {
      setExpandedState(!isExpanded);
    });

    iframe.addEventListener("load", () => {
      sendYouTubeListeningHandshake(iframe);
      sendYouTubeCommand(iframe, "addEventListener", ["onStateChange"]);
      sendYouTubeCommand(iframe, "setVolume", [YOUTUBE_DEFAULT_VOLUME]);
    });

    const applyStateChange = (state: number): void => {
      if (state === 1) {
        isPlaying = true;
      } else if (state === 0 || state === 2 || state === 5) {
        isPlaying = false;
      }
      syncPlayLabel();
    };

    const handleYouTubeWindowMessage = (event: MessageEvent): void => {
      if (event.source !== iframe.contentWindow) {
        return;
      }
      const parsed = parseYouTubeMessage(event.data);
      if (!parsed) {
        return;
      }

      const eventName = typeof parsed.event === "string" ? parsed.event : "";
      if (eventName === "onStateChange") {
        if (typeof parsed.info === "number") {
          applyStateChange(parsed.info);
        }
        return;
      }

      if (eventName !== "infoDelivery") {
        return;
      }

      const info = parsed.info;
      if (!info || typeof info !== "object") {
        return;
      }
      const infoRecord = info as Record<string, unknown>;
      if (typeof infoRecord.playerState === "number") {
        applyStateChange(infoRecord.playerState);
      }
      if (typeof infoRecord.muted === "boolean") {
        isMuted = infoRecord.muted;
        syncMuteLabel();
      }
      if (typeof infoRecord.volume === "number" && !isDraggingVolume) {
        const clampedVolume = Math.max(0, Math.min(100, Math.round(infoRecord.volume)));
        volume.value = String(clampedVolume);
      }
    };

    let disposed = false;
    window.addEventListener("message", handleYouTubeWindowMessage);
    const volumeSyncTimer = window.setInterval(() => {
      if (!iframe.isConnected) {
        if (!disposed) {
          disposed = true;
          window.removeEventListener("message", handleYouTubeWindowMessage);
          window.clearInterval(volumeSyncTimer);
        }
        return;
      }
      sendYouTubeCommand(iframe, "getPlayerState");
      sendYouTubeCommand(iframe, "isMuted");
      sendYouTubeCommand(iframe, "getVolume");
    }, 600);

    detachYouTubeSync = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      window.removeEventListener("message", handleYouTubeWindowMessage);
      window.clearInterval(volumeSyncTimer);
    };

    syncPlayLabel();
    syncMuteLabel();
    setExpandedState(false);

    void getYouTubeOEmbedMeta(setting.rawInput).then((metadata) => {
      if (!metadata || version !== renderVersion) {
        return;
      }
      title.textContent = metadata.title;
      subtitle.textContent = metadata.authorName || "YouTube";
      if (metadata.thumbnailUrl) {
        thumb.src = metadata.thumbnailUrl;
      }
      renderStatus(`Playing on YouTube: ${metadata.title}`);
    });
  };

  const handleSave = async () => {
    try {
      const setting = await service.saveSetting(input.value);
      renderEmbed(setting);
    } catch (error) {
      if (error instanceof PlayerValidationError) {
        renderStatus(error.message);
        return;
      }
      renderStatus("Something went wrong. Please try again.");
    }
  };

  saveButton.addEventListener("click", () => {
    void handleSave();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSave();
    }
  });

  const reloadFromStorage = async () => {
    const stored = await service.getSetting();
    input.value = stored?.rawInput ?? "";
    renderEmbed(stored);
  };

  await reloadFromStorage();

  return {
    reloadFromStorage,
    destroy: async () => {
      if (detachYouTubeSync) {
        detachYouTubeSync();
        detachYouTubeSync = null;
      }
      if (ownsService) {
        await service.close();
      }
      root.innerHTML = "";
    }
  };
};
