import type { AmbientController } from "./ambientController";
import type { AmbientStore } from "./ambientStore";
import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";

interface AmbientDockViewOptions {
  controller: AmbientController;
  store: AmbientStore;
}

export interface AmbientDockViewHandle {
  destroy: () => void;
}

const toPercent = (value0to1: number): string => `${Math.round(value0to1 * 100)}`;

export const mountAmbientDockView = (
  root: HTMLElement,
  options: AmbientDockViewOptions
): AmbientDockViewHandle => {
  const { controller, store } = options;

  root.innerHTML = `
    <div class="ambient-dock-popup" data-testid="ambient-dock-popup">
      <div class="ambient-dock-popup__header">
        <strong>Ambient Sounds</strong>
        <span data-testid="ambient-dock-count">0 active</span>
      </div>
      <label class="ambient-dock-popup__master" for="ambient-dock-master-input">
        <span>Master Volume</span>
        <input
          id="ambient-dock-master-input"
          type="range"
          min="0"
          max="100"
          step="1"
          data-testid="ambient-dock-master"
        />
      </label>
      <div class="ambient-dock-popup__tracks">
        ${AMBIENT_TRACKS.map(
          (track) => `
            <div class="ambient-dock-track" data-testid="ambient-dock-track-${track.id}">
              <div class="ambient-dock-track__main">
                <span class="ambient-icon" style="--ambient-icon-url: url('${track.icon}');"></span>
                <span class="ambient-dock-track__label">${track.label}</span>
                <button
                  class="ambient-track-toggle"
                  type="button"
                  data-testid="ambient-dock-play-${track.id}"
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
                data-testid="ambient-dock-volume-${track.id}"
              />
            </div>
          `
        ).join("")}
      </div>
    </div>
  `;

  const masterInput = root.querySelector<HTMLInputElement>('[data-testid="ambient-dock-master"]');
  const countEl = root.querySelector<HTMLElement>('[data-testid="ambient-dock-count"]');
  if (!masterInput || !countEl) {
    throw new Error("Missing ambient dock controls");
  }

  const trackRows = new Map<AmbientTrackId, HTMLElement>();
  const trackToggles = new Map<AmbientTrackId, HTMLButtonElement>();
  const trackVolumes = new Map<AmbientTrackId, HTMLInputElement>();

  AMBIENT_TRACKS.forEach((track) => {
    const row = root.querySelector<HTMLElement>(`[data-testid="ambient-dock-track-${track.id}"]`);
    const toggle = root.querySelector<HTMLButtonElement>(
      `[data-testid="ambient-dock-play-${track.id}"]`
    );
    const volume = root.querySelector<HTMLInputElement>(
      `[data-testid="ambient-dock-volume-${track.id}"]`
    );
    if (!row || !toggle || !volume) {
      throw new Error(`Missing ambient dock track controls for ${track.id}`);
    }
    trackRows.set(track.id, row);
    trackToggles.set(track.id, toggle);
    trackVolumes.set(track.id, volume);
  });

  const syncFromState = () => {
    const state = store.getState();
    const activeCount = AMBIENT_TRACKS.filter((track) => state.playing[track.id]).length;
    countEl.textContent = `${activeCount} active`;
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
      root.innerHTML = "";
    }
  };
};
