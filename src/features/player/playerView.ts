import { qs } from "../../ui/dom";
import { ALL_ADAPTERS } from "./platforms";
import type { PlatformAdapter } from "./platforms/types";
import { createPlayerService, PlayerValidationError, type PlayerService } from "./playerService";
import type { MediaPlayerSetting } from "./playerTypes";
import { isOnline } from "./net";

interface PlayerViewOptions {
  dbName?: string;
  service?: PlayerService;
  adapters?: PlatformAdapter[];
}

export interface PlayerViewHandle {
  reloadFromStorage: () => Promise<void>;
  destroy: () => Promise<void>;
}

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
    <div class="player-embed" data-testid="player-embed"></div>
  `;

  const ownsService = !options.service;
  const service =
    options.service ?? createPlayerService({ dbName: options.dbName, adapters: options.adapters });
  const adapters = options.adapters ?? ALL_ADAPTERS;

  const input = qs<HTMLInputElement>(root, "player-input");
  const saveButton = qs<HTMLButtonElement>(root, "player-save");
  const status = qs<HTMLElement>(root, "player-status");
  const embed = qs<HTMLElement>(root, "player-embed");

  const renderStatus = (message: string) => {
    status.textContent = message;
  };

  const renderEmbed = (setting: MediaPlayerSetting | null) => {
    embed.innerHTML = "";

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

    const iframe = document.createElement("iframe");
    iframe.title = "Media player";
    iframe.src = setting.embedUrl;
    iframe.loading = "lazy";
    iframe.allow =
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.className = "player-iframe";
    embed.appendChild(iframe);

    const adapter = findAdapterById(adapters, setting.platformId);
    const platformName = adapter?.getDisplayName() ?? "your selection";
    renderStatus(`Playing from ${platformName}`);
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
      if (ownsService) {
        await service.close();
      }
      root.innerHTML = "";
    }
  };
};
