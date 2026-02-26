import type { AmbientController } from "./ambientController";
import type { AmbientStore } from "./ambientStore";
import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";

interface AmbientDrawerViewOptions {
  controller: AmbientController;
  store: AmbientStore;
}

export interface AmbientDrawerViewHandle {
  destroy: () => void;
}

const toPercent = (value0to1: number): string => `${Math.round(value0to1 * 100)}`;

export const mountAmbientDrawerView = (
  root: HTMLElement,
  options: AmbientDrawerViewOptions
): AmbientDrawerViewHandle => {
  const { controller, store } = options;
  const container = document.createElement("section");
  container.className = "ambient-mixer";
  container.innerHTML = `
    <button
      class="ambient-toggle"
      type="button"
      data-testid="ambient-toggle"
      aria-label="Toggle ambient mixer"
      aria-expanded="false"
    >
      ♪
    </button>
    <aside class="ambient-drawer" data-testid="ambient-drawer" aria-hidden="true">
      <div class="ambient-drawer__header">
        <div>
          <h3>Ambient Mixer</h3>
        </div>
        <button
          class="ambient-close"
          type="button"
          data-testid="ambient-close"
          aria-label="Close ambient mixer"
        >
          X
        </button>
      </div>
      <label class="ambient-master" for="ambient-master-input">
        <span>Master Volume</span>
        <input
          id="ambient-master-input"
          type="range"
          min="0"
          max="100"
          step="1"
          data-testid="ambient-master"
        />
      </label>
      <div class="ambient-track-list">
        ${AMBIENT_TRACKS.map(
          (track) => `
          <div class="ambient-track" data-testid="ambient-track-${track.id}" data-track-id="${track.id}">
            <div class="ambient-track-main">
              <span class="ambient-icon" style="--ambient-icon-url: url('${track.icon}');"></span>
              <span class="ambient-track-label">${track.label}</span>
              <button
                class="ambient-track-toggle"
                type="button"
                data-testid="ambient-play-${track.id}"
                data-track-toggle="${track.id}"
              >
                Play
              </button>
            </div>
            <input
              class="ambient-track-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              data-testid="ambient-volume-${track.id}"
              data-track-volume="${track.id}"
            />
          </div>
        `
        ).join("")}
      </div>
    </aside>
  `;

  // Mount outside route containers to avoid desktop stacking-context clipping.
  const host = document.body ?? root;
  host.appendChild(container);

  const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  const drawer = container.querySelector<HTMLElement>('[data-testid="ambient-drawer"]');
  const closeButton = container.querySelector<HTMLButtonElement>('[data-testid="ambient-close"]');
  const masterInput = container.querySelector<HTMLInputElement>('[data-testid="ambient-master"]');

  if (!toggleButton || !drawer || !closeButton || !masterInput) {
    throw new Error("Ambient drawer is missing required UI elements.");
  }

  const trackToggles = new Map<AmbientTrackId, HTMLButtonElement>();
  const trackVolumes = new Map<AmbientTrackId, HTMLInputElement>();
  const trackRows = new Map<AmbientTrackId, HTMLElement>();

  AMBIENT_TRACKS.forEach((track) => {
    const row = container.querySelector<HTMLElement>(`[data-testid="ambient-track-${track.id}"]`);
    const toggle = container.querySelector<HTMLButtonElement>(
      `[data-testid="ambient-play-${track.id}"]`
    );
    const volume = container.querySelector<HTMLInputElement>(
      `[data-testid="ambient-volume-${track.id}"]`
    );
    if (!row || !toggle || !volume) {
      throw new Error(`Missing ambient controls for ${track.id}`);
    }
    trackRows.set(track.id, row);
    trackToggles.set(track.id, toggle);
    trackVolumes.set(track.id, volume);
  });

  const syncFromState = () => {
    const state = store.getState();
    drawer.classList.toggle("drawer--open", state.drawerOpen);
    drawer.setAttribute("aria-hidden", state.drawerOpen ? "false" : "true");
    toggleButton.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
    masterInput.value = toPercent(state.masterVolume);

    AMBIENT_TRACKS.forEach((track) => {
      const row = trackRows.get(track.id);
      const toggle = trackToggles.get(track.id);
      const volume = trackVolumes.get(track.id);
      if (!row || !toggle || !volume) {
        return;
      }
      const isPlaying = state.playing[track.id];
      row.classList.toggle("is-playing", isPlaying);
      toggle.textContent = isPlaying ? "Pause" : "Play";
      volume.value = toPercent(state.trackVolumes[track.id]);
    });
  };

  const detachActions: Array<() => void> = [];
  const bind = <T extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    eventName: T,
    handler: (event: HTMLElementEventMap[T]) => void
  ) => {
    const wrapped = (event: Event) => {
      handler(event as HTMLElementEventMap[T]);
    };
    element.addEventListener(eventName, wrapped as EventListener);
    detachActions.push(() => {
      element.removeEventListener(eventName, wrapped as EventListener);
    });
  };

  bind(toggleButton, "click", () => {
    store.toggleDrawer();
  });
  bind(closeButton, "click", () => {
    store.setDrawerOpen(false);
  });
  bind(masterInput, "input", () => {
    controller.setMasterVolume(masterInput.valueAsNumber / 100);
  });

  AMBIENT_TRACKS.forEach((track) => {
    const toggle = trackToggles.get(track.id);
    const volume = trackVolumes.get(track.id);
    if (!toggle || !volume) {
      return;
    }
    bind(toggle, "click", () => {
      void controller.toggle(track.id);
    });
    bind(volume, "input", () => {
      controller.setVolume(track.id, volume.valueAsNumber / 100);
    });
  });

  const unsubscribe = store.subscribe(syncFromState);

  return {
    destroy: () => {
      unsubscribe();
      detachActions.forEach((detach) => detach());
      container.remove();
    }
  };
};
