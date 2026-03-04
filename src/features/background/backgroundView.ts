import type { BackgroundManager } from "./backgroundManager";

export interface BackgroundViewHandle {
  destroy: () => void;
}

interface BackgroundViewOptions {
  manager: BackgroundManager | null;
}

const BACKGROUND_TINT = "2, 6, 23";

export const mountBackgroundView = (
  root: HTMLElement,
  options: BackgroundViewOptions
): BackgroundViewHandle => {
  root.innerHTML = `
    <div class="app-background__image" data-testid="bg-image" hidden></div>
    <div class="app-background__overlay" aria-hidden="true"></div>
  `;

  const imageLayer = root.querySelector<HTMLElement>('[data-testid="bg-image"]');
  const overlayLayer = root.querySelector<HTMLElement>(".app-background__overlay");
  if (!imageLayer || !overlayLayer) {
    throw new Error("Background view is missing required elements");
  }

  let activeImageId: string | null = null;
  let activeObjectUrl: string | null = null;

  const applyOverlay = (darkness: number, blurPx: number) => {
    overlayLayer.style.backgroundColor = `rgba(${BACKGROUND_TINT}, ${darkness})`;
    imageLayer.style.filter = `blur(${blurPx}px)`;
  };

  const clearImage = () => {
    imageLayer.hidden = true;
    imageLayer.style.removeProperty("background-image");
    activeImageId = null;
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  };

  if (!options.manager) {
    applyOverlay(0, 0);
    clearImage();
    return {
      destroy: () => {
        clearImage();
        root.innerHTML = "";
      }
    };
  }

  const syncFromState = () => {
    const state = options.manager!.getState();
    const hasSelection = state.prefs.selectedKind !== "none";
    applyOverlay(hasSelection ? state.prefs.overlayDarkness : 0, state.prefs.backgroundBlurPx);

    if (state.prefs.selectedKind !== "image" || !state.prefs.selectedImageId) {
      clearImage();
      return;
    }

    const selected = state.images.find((entry) => entry.id === state.prefs.selectedImageId);
    if (!selected) {
      clearImage();
      return;
    }

    if (activeImageId === selected.id && activeObjectUrl) {
      imageLayer.hidden = false;
      return;
    }

    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }

    activeObjectUrl = URL.createObjectURL(selected.blob);
    activeImageId = selected.id;
    imageLayer.style.backgroundImage = `url("${activeObjectUrl}")`;
    imageLayer.hidden = false;
  };

  const unsubscribe = options.manager.subscribe(syncFromState);

  return {
    destroy: () => {
      unsubscribe();
      clearImage();
      root.innerHTML = "";
    }
  };
};
