import type { AmbientController } from "./ambientController";
import type { AmbientDrawerTab, AmbientStore } from "./ambientStore";
import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";
import { MAX_VISUAL_IMAGES, type VisualImage } from "../background/backgroundTypes";
import type { BackgroundManager } from "../background/backgroundManager";
import { extractYouTubeId } from "../background/youtube";

interface AmbientDrawerViewOptions {
  controller: AmbientController;
  store: AmbientStore;
  backgroundManager?: BackgroundManager | null;
}

export interface AmbientDrawerViewHandle {
  destroy: () => void;
}

const toPercent = (value0to1: number): string => `${Math.round(value0to1 * 100)}`;
const TAB_SWITCH_ANIMATION_MS = 180;

export const mountAmbientDrawerView = (
  root: HTMLElement,
  options: AmbientDrawerViewOptions
): AmbientDrawerViewHandle => {
  const { controller, store } = options;
  const backgroundManager = options.backgroundManager ?? null;
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
      <div class="ambient-tabs" data-testid="ambient-tabs" role="tablist" aria-label="Ambient panels">
        <button
          class="ambient-tab ambient-tab--active"
          type="button"
          data-testid="ambient-tab-sounds"
          data-tab="sounds"
          role="tab"
          aria-selected="true"
        >
          Sounds
        </button>
        <button
          class="ambient-tab"
          type="button"
          data-testid="ambient-tab-visuals"
          data-tab="visuals"
          role="tab"
          aria-selected="false"
        >
          Visuals
        </button>
      </div>
      <div class="ambient-panel" data-testid="ambient-panel" data-active="sounds">
        <div class="ambient-panel__content ambient-panel__content--active" data-panel="sounds">
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
        </div>
        <div class="ambient-panel__content" data-panel="visuals">
          <div class="ambient-visuals" data-testid="visuals-panel">
            <div class="ambient-visuals__youtube">
              <label class="ambient-visuals__label" for="visuals-youtube-input">YouTube URL</label>
              <div class="ambient-visuals__youtube-row">
                <input
                  id="visuals-youtube-input"
                  class="ambient-visuals__youtube-input"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  data-testid="visuals-youtube-input"
                />
                <button
                  type="button"
                  class="ambient-visuals__youtube-apply"
                  data-testid="visuals-youtube-apply"
                >
                  Apply
                </button>
              </div>
              <button
                type="button"
                class="ambient-visuals__reset"
                data-testid="visuals-reset"
              >
                Reset to default background
              </button>
            </div>
            <div class="ambient-visuals__effects">
              <label class="ambient-visuals__effect" for="visuals-overlay-input">
                <span>Overlay Darkness</span>
                <input
                  id="visuals-overlay-input"
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  data-testid="visuals-overlay"
                />
              </label>
              <label class="ambient-visuals__effect" for="visuals-blur-input">
                <span>Background Blur</span>
                <input
                  id="visuals-blur-input"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  data-testid="visuals-blur"
                />
              </label>
            </div>
            <label class="ambient-visuals__add">
              <input
                class="ambient-visuals__input"
                type="file"
                accept="image/*"
                multiple
                data-testid="visuals-add-image"
              />
              <span>Add image</span>
            </label>
            <div class="ambient-visuals__status" data-testid="visuals-status" aria-live="polite"></div>
            <div class="ambient-visuals__grid" data-testid="visuals-grid"></div>
          </div>
        </div>
      </div>
    </aside>
  `;

  // Mount outside route containers to avoid desktop stacking-context clipping.
  const host = document.body ?? root;
  host.appendChild(container);

  const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  const drawer = container.querySelector<HTMLElement>('[data-testid="ambient-drawer"]');
  const closeButton = container.querySelector<HTMLButtonElement>('[data-testid="ambient-close"]');
  const tabs = container.querySelector<HTMLElement>('[data-testid="ambient-tabs"]');
  const soundsTab = container.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-sounds"]');
  const visualsTab = container.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-visuals"]');
  const panel = container.querySelector<HTMLElement>('[data-testid="ambient-panel"]');
  const soundsPanel = container.querySelector<HTMLElement>('[data-panel="sounds"]');
  const visualsPanel = container.querySelector<HTMLElement>('[data-panel="visuals"]');
  const masterInput = container.querySelector<HTMLInputElement>('[data-testid="ambient-master"]');
  const visualsYoutubeInput = container.querySelector<HTMLInputElement>(
    '[data-testid="visuals-youtube-input"]'
  );
  const visualsYoutubeApply = container.querySelector<HTMLButtonElement>(
    '[data-testid="visuals-youtube-apply"]'
  );
  const visualsReset = container.querySelector<HTMLButtonElement>('[data-testid="visuals-reset"]');
  const visualsInput = container.querySelector<HTMLInputElement>('[data-testid="visuals-add-image"]');
  const visualsOverlayInput = container.querySelector<HTMLInputElement>(
    '[data-testid="visuals-overlay"]'
  );
  const visualsBlurInput = container.querySelector<HTMLInputElement>('[data-testid="visuals-blur"]');
  const visualsGrid = container.querySelector<HTMLElement>('[data-testid="visuals-grid"]');
  const visualsStatus = container.querySelector<HTMLElement>('[data-testid="visuals-status"]');

  if (
    !toggleButton ||
    !drawer ||
    !closeButton ||
    !tabs ||
    !soundsTab ||
    !visualsTab ||
    !panel ||
    !soundsPanel ||
    !visualsPanel ||
    !masterInput ||
    !visualsYoutubeInput ||
    !visualsYoutubeApply ||
    !visualsReset ||
    !visualsInput ||
    !visualsOverlayInput ||
    !visualsBlurInput ||
    !visualsGrid ||
    !visualsStatus
  ) {
    throw new Error("Ambient drawer is missing required UI elements.");
  }

  let switchAnimationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let visualsStatusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const previewUrls = new Map<string, string>();

  const schedulePanelSwitchAnimation = () => {
    if (switchAnimationTimeoutId) {
      clearTimeout(switchAnimationTimeoutId);
    }
    panel.classList.add("ambient-panel--switching");
    switchAnimationTimeoutId = setTimeout(() => {
      panel.classList.remove("ambient-panel--switching");
      switchAnimationTimeoutId = null;
    }, TAB_SWITCH_ANIMATION_MS);
  };

  const setVisualsStatus = (
    message: string,
    tone: "info" | "error" = "info",
    hideAfterMs: number | null = 2200
  ) => {
    visualsStatus.textContent = message;
    visualsStatus.setAttribute("data-tone", tone);
    if (visualsStatusTimeoutId) {
      clearTimeout(visualsStatusTimeoutId);
      visualsStatusTimeoutId = null;
    }
    if (hideAfterMs && hideAfterMs > 0) {
      visualsStatusTimeoutId = setTimeout(() => {
        visualsStatus.textContent = "";
        visualsStatusTimeoutId = null;
      }, hideAfterMs);
    }
  };

  const getPreviewUrl = (image: VisualImage): string => {
    const cached = previewUrls.get(image.id);
    if (cached) {
      return cached;
    }
    const created = URL.createObjectURL(image.blob);
    previewUrls.set(image.id, created);
    return created;
  };

  const releaseMissingPreviewUrls = (images: VisualImage[]) => {
    const nextIds = new Set(images.map((image) => image.id));
    previewUrls.forEach((url, imageId) => {
      if (nextIds.has(imageId)) {
        return;
      }
      URL.revokeObjectURL(url);
      previewUrls.delete(imageId);
    });
  };

  const applyActiveTab = (activeTab: AmbientDrawerTab) => {
    const soundsActive = activeTab === "sounds";
    soundsTab.classList.toggle("ambient-tab--active", soundsActive);
    visualsTab.classList.toggle("ambient-tab--active", !soundsActive);
    soundsTab.setAttribute("aria-selected", soundsActive ? "true" : "false");
    visualsTab.setAttribute("aria-selected", soundsActive ? "false" : "true");
    panel.setAttribute("data-active", activeTab);
    soundsPanel.classList.toggle("ambient-panel__content--active", soundsActive);
    visualsPanel.classList.toggle("ambient-panel__content--active", !soundsActive);
  };

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

  const renderVisuals = () => {
    if (!backgroundManager) {
      visualsYoutubeInput.disabled = true;
      visualsYoutubeApply.disabled = true;
      visualsReset.disabled = true;
      visualsInput.disabled = true;
      visualsOverlayInput.disabled = true;
      visualsBlurInput.disabled = true;
      visualsGrid.innerHTML = "";
      visualsStatus.textContent = "Visual backgrounds unavailable in this environment.";
      visualsStatus.setAttribute("data-tone", "error");
      return;
    }

    visualsInput.disabled = false;
    visualsYoutubeInput.disabled = false;
    visualsYoutubeApply.disabled = false;
    visualsReset.disabled = false;
    visualsOverlayInput.disabled = false;
    visualsBlurInput.disabled = false;
    const { images, prefs } = backgroundManager.getState();
    if (document.activeElement !== visualsOverlayInput) {
      visualsOverlayInput.value = `${Math.round(prefs.overlayDarkness * 100)}`;
    }
    if (document.activeElement !== visualsBlurInput) {
      visualsBlurInput.value = `${Math.round(prefs.backgroundBlurPx)}`;
    }
    if (document.activeElement !== visualsYoutubeInput) {
      visualsYoutubeInput.value = prefs.selectedKind === "video" ? (prefs.youtubeUrl ?? "") : "";
    }
    releaseMissingPreviewUrls(images);

    visualsGrid.innerHTML = "";
    images.forEach((image) => {
      const thumb = document.createElement("div");
      thumb.className = "ambient-visual-thumb";
      thumb.dataset.imageId = image.id;
      thumb.setAttribute("data-testid", `visuals-img-${image.id}`);
      thumb.setAttribute("aria-label", "Select visual background image");
      thumb.setAttribute("role", "button");
      thumb.tabIndex = 0;
      thumb.classList.toggle(
        "ambient-visual-thumb--selected",
        prefs.selectedKind === "image" && prefs.selectedImageId === image.id
      );

      const preview = document.createElement("span");
      preview.className = "ambient-visual-thumb__preview";
      preview.style.backgroundImage = `url("${getPreviewUrl(image)}")`;
      thumb.appendChild(preview);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "trash-btn ambient-visual-thumb__delete";
      deleteButton.dataset.imageId = image.id;
      deleteButton.setAttribute("data-testid", `visuals-img-del-${image.id}`);
      deleteButton.setAttribute("aria-label", "Delete image");
      deleteButton.innerHTML =
        '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';
      thumb.appendChild(deleteButton);

      visualsGrid.appendChild(thumb);
    });
  };

  const syncFromState = () => {
    const state = store.getState();
    drawer.classList.toggle("drawer--open", state.drawerOpen);
    drawer.setAttribute("aria-hidden", state.drawerOpen ? "false" : "true");
    toggleButton.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
    applyActiveTab(state.activeTab);
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

  bind(soundsTab, "click", () => {
    if (store.getState().activeTab === "sounds") {
      return;
    }
    schedulePanelSwitchAnimation();
    store.setActiveTab("sounds");
  });
  bind(visualsTab, "click", () => {
    if (store.getState().activeTab === "visuals") {
      return;
    }
    schedulePanelSwitchAnimation();
    store.setActiveTab("visuals");
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

  bind(visualsInput, "change", () => {
    if (!backgroundManager || !visualsInput.files || visualsInput.files.length === 0) {
      return;
    }
    const files = Array.from(visualsInput.files);
    visualsInput.value = "";
    void backgroundManager
      .addImages(files)
      .then((result) => {
        if (result.rejected > 0) {
          setVisualsStatus(`You can store up to ${MAX_VISUAL_IMAGES} images.`, "error");
        } else if (result.added > 0) {
          setVisualsStatus("Image added.");
        }
        renderVisuals();
      })
      .catch(() => {
        setVisualsStatus("Failed to add image.", "error");
      });
  });

  bind(visualsYoutubeApply, "click", () => {
    if (!backgroundManager) {
      return;
    }
    const youtubeUrl = visualsYoutubeInput.value.trim();
    if (!extractYouTubeId(youtubeUrl)) {
      setVisualsStatus("Enter a valid YouTube URL.", "error");
      return;
    }
    void backgroundManager
      .selectVideo(youtubeUrl)
      .then(() => {
        setVisualsStatus("Video background applied.");
      })
      .catch(() => {
        setVisualsStatus("Failed to apply video.", "error");
      });
  });

  bind(visualsYoutubeInput, "keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== "Enter") {
      return;
    }
    keyboardEvent.preventDefault();
    visualsYoutubeApply.click();
  });

  bind(visualsReset, "click", () => {
    if (!backgroundManager) {
      return;
    }
    void backgroundManager
      .clearSelection()
      .then(() => {
        setVisualsStatus("Background reset to default.");
      })
      .catch(() => {
        setVisualsStatus("Failed to reset background.", "error");
      });
  });

  bind(visualsOverlayInput, "input", () => {
    if (!backgroundManager) {
      return;
    }
    void backgroundManager.setOverlayDarkness(visualsOverlayInput.valueAsNumber / 100);
  });

  bind(visualsBlurInput, "input", () => {
    if (!backgroundManager) {
      return;
    }
    void backgroundManager.setBackgroundBlurPx(visualsBlurInput.valueAsNumber);
  });

  bind(visualsGrid, "click", (event) => {
    if (!backgroundManager) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const deleteButton = target.closest<HTMLButtonElement>("[data-testid^='visuals-img-del-']");
    if (deleteButton?.dataset.imageId) {
      void backgroundManager.deleteImage(deleteButton.dataset.imageId);
      return;
    }
    const imageButton = target.closest<HTMLButtonElement>("[data-testid^='visuals-img-']");
    if (imageButton?.dataset.imageId) {
      void backgroundManager.selectImage(imageButton.dataset.imageId);
    }
  });

  bind(visualsGrid, "keydown", (event) => {
    if (!backgroundManager) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
      return;
    }
    const target = keyboardEvent.target as HTMLElement | null;
    const imageButton = target?.closest<HTMLElement>("[data-testid^='visuals-img-']");
    if (!imageButton?.dataset.imageId) {
      return;
    }
    keyboardEvent.preventDefault();
    void backgroundManager.selectImage(imageButton.dataset.imageId);
  });

  const detachBackgroundListener = backgroundManager
    ? backgroundManager.subscribe(() => {
        renderVisuals();
      })
    : null;
  renderVisuals();

  const unsubscribe = store.subscribe(syncFromState);

  return {
    destroy: () => {
      unsubscribe();
      detachBackgroundListener?.();
      detachActions.forEach((detach) => detach());
      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      if (visualsStatusTimeoutId) {
        clearTimeout(visualsStatusTimeoutId);
      }
      if (switchAnimationTimeoutId) {
        clearTimeout(switchAnimationTimeoutId);
      }
      container.remove();
    }
  };
};
