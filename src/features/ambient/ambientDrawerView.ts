import type { AmbientController } from "./ambientController";
import type { AmbientDrawerTab, AmbientStore } from "./ambientStore";
import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";
import {
  DEFAULT_SURFACE_COLOR,
  DEFAULT_THEME_COLOR,
  MAX_CUSTOM_THEME_COLORS,
  MAX_VISUAL_IMAGES,
  type VisualImage
} from "../background/backgroundTypes";
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
const setRangeProgress = (input: HTMLInputElement) => {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : min;
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}`);
};
const TAB_SWITCH_ANIMATION_MS = 220;
const CUSTOM_COLOR_SLOTS = Array.from({ length: MAX_CUSTOM_THEME_COLORS }, (_, index) => index);

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
        <div class="ambient-drawer__title-wrap">
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
      <div class="ambient-tabs drawer-tabs" data-testid="ambient-tabs" role="tablist" aria-label="Ambient panels">
        <button
          class="ambient-tab drawer-tab ambient-tab--active is-active"
          type="button"
          data-testid="ambient-tab-sounds"
          data-tab="sounds"
          role="tab"
          aria-selected="true"
        >
          Sounds
        </button>
        <button
          class="ambient-tab drawer-tab"
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
          <label class="ambient-master drawer-section" for="ambient-master-input">
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
          <div class="ambient-track-list drawer-section">
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
        <div class="ambient-panel__content ambient-panel__content--visuals" data-panel="visuals">
          <div class="ambient-visuals" data-testid="visuals-panel">
            <div class="ambient-visuals__youtube drawer-section">
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
              <p class="ambient-visuals__youtube-help">
                Video will play muted and loop in the background.
              </p>
              <button
                type="button"
                class="ambient-visuals__reset"
                data-testid="visuals-reset"
              >
                Reset to default background
              </button>
            </div>
            <div class="ambient-visuals__effects drawer-section">
              <label class="ambient-visuals__effect" for="visuals-overlay-input">
                <span class="ambient-visuals__effect-head">
                  <span>Overlay Darkness</span>
                  <span class="ambient-visuals__effect-value" data-testid="visuals-overlay-value">0%</span>
                </span>
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
                <span class="ambient-visuals__effect-head">
                  <span>Background Blur</span>
                  <span class="ambient-visuals__effect-value" data-testid="visuals-blur-value">0px</span>
                </span>
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
            <section class="ambient-visuals__theme drawer-section" data-testid="visuals-theme">
              <h4 class="ambient-visuals__theme-title">Theme accents</h4>
              <div class="ambient-visuals__theme-swatches">
                <button
                  type="button"
                  class="ambient-theme-swatch ambient-theme-swatch--default"
                  data-testid="theme-swatch-0"
                  data-theme-color="${DEFAULT_THEME_COLOR}"
                  aria-label="Default blue accent"
                  title="Default blue"
                ></button>
                ${CUSTOM_COLOR_SLOTS.map(
                  (index) => `
                    <button
                      type="button"
                      class="ambient-theme-swatch ambient-theme-swatch--custom"
                      data-testid="theme-swatch-${index + 1}"
                      data-theme-slot="${index}"
                      aria-label="Custom accent color ${index + 1}"
                      title="Select or define accent color ${index + 1}"
                    >+</button>
                    <input
                      class="ambient-theme-color-input"
                      type="color"
                      data-theme-color-input="${index}"
                      value="${DEFAULT_THEME_COLOR}"
                      aria-label="Pick custom accent color ${index + 1}"
                    />
                  `
                ).join("")}
              </div>
            </section>
            <section class="ambient-visuals__theme drawer-section" data-testid="visuals-surface-theme">
              <h4 class="ambient-visuals__theme-title">Surface colors</h4>
              <div class="ambient-visuals__theme-swatches">
                <button
                  type="button"
                  class="ambient-theme-swatch ambient-theme-swatch--default"
                  data-testid="surface-swatch-0"
                  data-surface-color="${DEFAULT_SURFACE_COLOR}"
                  aria-label="Default surface color"
                  title="Default surface"
                ></button>
                ${CUSTOM_COLOR_SLOTS.map(
                  (index) => `
                    <button
                      type="button"
                      class="ambient-theme-swatch ambient-theme-swatch--custom"
                      data-testid="surface-swatch-${index + 1}"
                      data-surface-slot="${index}"
                      aria-label="Custom surface color ${index + 1}"
                      title="Select or define surface color ${index + 1}"
                    >+</button>
                    <input
                      class="ambient-theme-color-input"
                      type="color"
                      data-surface-color-input="${index}"
                      value="${DEFAULT_SURFACE_COLOR}"
                      aria-label="Pick custom surface color ${index + 1}"
                    />
                  `
                ).join("")}
              </div>
            </section>
            <input
              class="ambient-visuals__input"
              type="file"
              accept="image/*"
              multiple
              data-testid="visuals-add-image"
            />
            <div class="ambient-visuals__status" data-testid="visuals-status" aria-live="polite"></div>
            <div class="ambient-visuals__grid visuals-grid" data-testid="visuals-grid"></div>
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
  const visualsOverlayValue = container.querySelector<HTMLElement>('[data-testid="visuals-overlay-value"]');
  const visualsBlurValue = container.querySelector<HTMLElement>('[data-testid="visuals-blur-value"]');
  const visualsTheme = container.querySelector<HTMLElement>('[data-testid="visuals-theme"]');
  const visualsSurfaceTheme = container.querySelector<HTMLElement>('[data-testid="visuals-surface-theme"]');
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
    !visualsOverlayValue ||
    !visualsBlurValue ||
    !visualsTheme ||
    !visualsSurfaceTheme ||
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
    soundsTab.classList.toggle("is-active", soundsActive);
    visualsTab.classList.toggle("ambient-tab--active", !soundsActive);
    visualsTab.classList.toggle("is-active", !soundsActive);
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
      visualsTheme.setAttribute("aria-disabled", "true");
      visualsSurfaceTheme.setAttribute("aria-disabled", "true");
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
    visualsTheme.removeAttribute("aria-disabled");
    visualsSurfaceTheme.removeAttribute("aria-disabled");
    const { images, prefs } = backgroundManager.getState();
    if (document.activeElement !== visualsOverlayInput) {
      visualsOverlayInput.value = `${Math.round(prefs.overlayDarkness * 100)}`;
    }
    setRangeProgress(visualsOverlayInput);
    visualsOverlayValue.textContent = `${Math.round(prefs.overlayDarkness * 100)}%`;
    if (document.activeElement !== visualsBlurInput) {
      visualsBlurInput.value = `${Math.round(prefs.backgroundBlurPx)}`;
    }
    setRangeProgress(visualsBlurInput);
    visualsBlurValue.textContent = `${Math.round(prefs.backgroundBlurPx)}px`;
    if (document.activeElement !== visualsYoutubeInput) {
      visualsYoutubeInput.value = prefs.selectedKind === "video" ? (prefs.youtubeUrl ?? "") : "";
    }
    releaseMissingPreviewUrls(images);

    const defaultAccent = visualsTheme.querySelector<HTMLButtonElement>("[data-theme-color]");
    if (defaultAccent) {
      defaultAccent.style.setProperty("--theme-swatch-color", DEFAULT_THEME_COLOR);
      defaultAccent.classList.toggle("is-selected", prefs.themeColor === DEFAULT_THEME_COLOR);
    }
    const accentSwatches = visualsTheme.querySelectorAll<HTMLButtonElement>("[data-theme-slot]");
    accentSwatches.forEach((swatch) => {
      const slot = Number(swatch.dataset.themeSlot);
      const color = prefs.customThemeColors[slot] ?? "";
      const input = visualsTheme.querySelector<HTMLInputElement>(`[data-theme-color-input="${slot}"]`);
      if (input && color) {
        input.value = color;
      }
      swatch.classList.toggle("is-defined", Boolean(color));
      swatch.classList.toggle("is-selected", Boolean(color) && color === prefs.themeColor);
      swatch.style.setProperty("--theme-swatch-color", color || "rgba(148, 163, 184, 0.24)");
      swatch.textContent = color ? "" : "+";
      swatch.dataset.themeColor = color;
    });

    const defaultSurface = visualsSurfaceTheme.querySelector<HTMLButtonElement>("[data-surface-color]");
    if (defaultSurface) {
      defaultSurface.style.setProperty("--theme-swatch-color", DEFAULT_SURFACE_COLOR);
      defaultSurface.classList.toggle("is-selected", prefs.surfaceColor === DEFAULT_SURFACE_COLOR);
    }
    const surfaceSwatches = visualsSurfaceTheme.querySelectorAll<HTMLButtonElement>("[data-surface-slot]");
    surfaceSwatches.forEach((swatch) => {
      const slot = Number(swatch.dataset.surfaceSlot);
      const color = prefs.customSurfaceColors[slot] ?? "";
      const input = visualsSurfaceTheme.querySelector<HTMLInputElement>(
        `[data-surface-color-input="${slot}"]`
      );
      if (input && color) {
        input.value = color;
      }
      swatch.classList.toggle("is-defined", Boolean(color));
      swatch.classList.toggle("is-selected", Boolean(color) && color === prefs.surfaceColor);
      swatch.style.setProperty("--theme-swatch-color", color || "rgba(148, 163, 184, 0.24)");
      swatch.textContent = color ? "" : "+";
      swatch.dataset.surfaceColor = color;
    });

    visualsGrid.innerHTML = "";
    images.forEach((image) => {
      const thumb = document.createElement("div");
      thumb.className = "ambient-visual-thumb visuals-thumb";
      thumb.dataset.imageId = image.id;
      thumb.setAttribute("data-testid", `visuals-img-${image.id}`);
      thumb.setAttribute("aria-label", "Select visual background image");
      thumb.setAttribute("role", "button");
      thumb.tabIndex = 0;
      thumb.classList.toggle(
        "ambient-visual-thumb--selected",
        prefs.selectedKind === "image" && prefs.selectedImageId === image.id
      );
      thumb.classList.toggle(
        "is-selected",
        prefs.selectedKind === "image" && prefs.selectedImageId === image.id
      );

      const preview = document.createElement("span");
      preview.className = "ambient-visual-thumb__preview";
      preview.style.backgroundImage = `url("${getPreviewUrl(image)}")`;
      thumb.appendChild(preview);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "trash-btn ambient-visual-thumb__delete visuals-thumb__delete";
      deleteButton.dataset.imageId = image.id;
      deleteButton.setAttribute("data-testid", `visuals-img-del-${image.id}`);
      deleteButton.setAttribute("aria-label", "Delete image");
      deleteButton.innerHTML =
        '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';
      thumb.appendChild(deleteButton);

      visualsGrid.appendChild(thumb);
    });

    if (images.length < MAX_VISUAL_IMAGES) {
      const addThumb = document.createElement("div");
      addThumb.className = "ambient-visual-thumb ambient-visual-thumb--add visuals-thumb visuals-thumb--add";
      addThumb.setAttribute("data-testid", "visuals-add-tile");
      addThumb.setAttribute("role", "button");
      addThumb.setAttribute("aria-label", "Add image");
      addThumb.tabIndex = 0;
      addThumb.innerHTML = `
        <span class="ambient-visual-thumb__add-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v8.6l3.4-3.4a1 1 0 0 1 1.4 0L13 14.4l2.6-2.6a1 1 0 0 1 1.4 0L19 13.8V6H5Zm0 12h14v-1.4l-3.1-3.1-2.6 2.6a1 1 0 0 1-1.4 0l-3.8-3.8L5 15.4V18Zm4-8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
          </svg>
        </span>
      `;
      visualsGrid.appendChild(addThumb);
    }
  };

  const syncFromState = () => {
    const state = store.getState();
    drawer.classList.toggle("drawer--open", state.drawerOpen);
    container.classList.toggle("ambient-mixer--drawer-open", state.drawerOpen);
    drawer.setAttribute("aria-hidden", state.drawerOpen ? "false" : "true");
    toggleButton.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
    applyActiveTab(state.activeTab);
    masterInput.value = toPercent(state.masterVolume);
    setRangeProgress(masterInput);

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
      setRangeProgress(volume);
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
    setRangeProgress(masterInput);
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
      setRangeProgress(volume);
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
    setRangeProgress(visualsOverlayInput);
    visualsOverlayValue.textContent = `${visualsOverlayInput.valueAsNumber}%`;
    void backgroundManager.setOverlayDarkness(visualsOverlayInput.valueAsNumber / 100);
  });

  bind(visualsBlurInput, "input", () => {
    if (!backgroundManager) {
      return;
    }
    setRangeProgress(visualsBlurInput);
    visualsBlurValue.textContent = `${visualsBlurInput.valueAsNumber}px`;
    void backgroundManager.setBackgroundBlurPx(visualsBlurInput.valueAsNumber);
  });

  bind(visualsTheme, "click", (event) => {
    if (!backgroundManager) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const swatch = target?.closest<HTMLButtonElement>(".ambient-theme-swatch");
    if (!swatch) {
      return;
    }
    const defaultColor = swatch.dataset.themeColor;
    if (defaultColor && !swatch.dataset.themeSlot) {
      void backgroundManager.setThemeColor(defaultColor);
      return;
    }
    const slotRaw = swatch.dataset.themeSlot;
    if (typeof slotRaw === "undefined") {
      return;
    }
    const slot = Number(slotRaw);
    const color = swatch.dataset.themeColor;
    if (color) {
      void backgroundManager.setThemeColor(color);
      return;
    }
    const input = visualsTheme.querySelector<HTMLInputElement>(`[data-theme-color-input="${slot}"]`);
    input?.click();
  });

  bind(visualsTheme, "dblclick", (event) => {
    const target = event.target as HTMLElement | null;
    const swatch = target?.closest<HTMLButtonElement>("[data-theme-slot]");
    if (!swatch) {
      return;
    }
    event.preventDefault();
    const slot = Number(swatch.dataset.themeSlot);
    const input = visualsTheme.querySelector<HTMLInputElement>(`[data-theme-color-input="${slot}"]`);
    input?.click();
  });

  const themeInputs = visualsTheme.querySelectorAll<HTMLInputElement>("[data-theme-color-input]");
  themeInputs.forEach((input) => {
    bind(input, "input", () => {
      if (!backgroundManager) {
        return;
      }
      const slot = Number(input.dataset.themeColorInput);
      if (!Number.isFinite(slot)) {
        return;
      }
      void backgroundManager.setCustomThemeColor(slot, input.value);
    });
  });

  bind(visualsSurfaceTheme, "click", (event) => {
    if (!backgroundManager) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const swatch = target?.closest<HTMLButtonElement>(".ambient-theme-swatch");
    if (!swatch) {
      return;
    }
    const defaultColor = swatch.dataset.surfaceColor;
    if (defaultColor && !swatch.dataset.surfaceSlot) {
      void backgroundManager.setSurfaceColor(defaultColor);
      return;
    }
    const slotRaw = swatch.dataset.surfaceSlot;
    if (typeof slotRaw === "undefined") {
      return;
    }
    const slot = Number(slotRaw);
    const color = swatch.dataset.surfaceColor;
    if (color) {
      void backgroundManager.setSurfaceColor(color);
      return;
    }
    const input = visualsSurfaceTheme.querySelector<HTMLInputElement>(
      `[data-surface-color-input="${slot}"]`
    );
    input?.click();
  });

  bind(visualsSurfaceTheme, "dblclick", (event) => {
    const target = event.target as HTMLElement | null;
    const swatch = target?.closest<HTMLButtonElement>("[data-surface-slot]");
    if (!swatch) {
      return;
    }
    event.preventDefault();
    const slot = Number(swatch.dataset.surfaceSlot);
    const input = visualsSurfaceTheme.querySelector<HTMLInputElement>(
      `[data-surface-color-input="${slot}"]`
    );
    input?.click();
  });

  const surfaceInputs = visualsSurfaceTheme.querySelectorAll<HTMLInputElement>(
    "[data-surface-color-input]"
  );
  surfaceInputs.forEach((input) => {
    bind(input, "input", () => {
      if (!backgroundManager) {
        return;
      }
      const slot = Number(input.dataset.surfaceColorInput);
      if (!Number.isFinite(slot)) {
        return;
      }
      void backgroundManager.setCustomSurfaceColor(slot, input.value);
    });
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
    const addButton = target.closest<HTMLElement>('[data-testid="visuals-add-tile"]');
    if (addButton) {
      visualsInput.click();
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
    const addButton = target?.closest<HTMLElement>('[data-testid="visuals-add-tile"]');
    if (addButton) {
      keyboardEvent.preventDefault();
      visualsInput.click();
      return;
    }
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
