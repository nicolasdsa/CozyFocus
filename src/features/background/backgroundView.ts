import type { BackgroundManager } from "./backgroundManager";
import { deriveSurfaceVars, deriveThemeVars } from "./backgroundTypes";
import { buildYouTubeBackgroundEmbedUrl, extractYouTubeId } from "./youtube";

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
    <div class="app-background__video bg-media" data-testid="bg-video-layer"></div>
    <div class="app-background__image bg-media" data-testid="bg-image" hidden></div>
    <div class="app-background__overlay bg-overlay" aria-hidden="true"></div>
  `;

  const videoLayer = root.querySelector<HTMLElement>('[data-testid="bg-video-layer"]');
  const imageLayer = root.querySelector<HTMLElement>('[data-testid="bg-image"]');
  const overlayLayer = root.querySelector<HTMLElement>(".app-background__overlay");
  if (!videoLayer || !imageLayer || !overlayLayer) {
    throw new Error("Background view is missing required elements");
  }

  let videoIframe: HTMLIFrameElement | null = null;
  let activeVideoId: string | null = null;
  let activeImageId: string | null = null;
  let activeObjectUrl: string | null = null;
  const rootStyle = document.documentElement.style;

  const applyOverlay = (darkness: number, blurPx: number) => {
    overlayLayer.style.backgroundColor = `rgba(${BACKGROUND_TINT}, ${darkness})`;
    imageLayer.style.filter = `blur(${blurPx}px)`;
    videoLayer.style.filter = `blur(${blurPx}px)`;
  };

  const applyTheme = (themeColor: string) => {
    const vars = deriveThemeVars(themeColor);
    rootStyle.setProperty("--color-brand-primary", vars.primary);
    rootStyle.setProperty("--color-brand-primaryHover", vars.primaryHover);
    rootStyle.setProperty("--color-focus-ring", vars.focusRing);
    rootStyle.setProperty("--color-brand-primary-rgb", vars.primaryRgb);
    rootStyle.setProperty("--color-on-primary", vars.onPrimary);
  };

  const applySurface = (surfaceColor: string) => {
    const vars = deriveSurfaceVars(surfaceColor);
    rootStyle.setProperty("--color-bg-page", vars.bgPage);
    rootStyle.setProperty("--color-bg-page-rgb", vars.bgPageRgb);
    rootStyle.setProperty("--color-bg-page-deep-rgb", vars.bgPageDeepRgb);
    rootStyle.setProperty("--color-surface-rgb", vars.surfaceRgb);
    rootStyle.setProperty("--color-bg-card", vars.bgCard);
    rootStyle.setProperty("--color-bg-card-hover", vars.bgCardHover);
    rootStyle.setProperty("--color-border-card", vars.borderCard);
    rootStyle.setProperty("--color-shell-fog", vars.shellFog);
  };

  const clearVideo = () => {
    if (videoIframe) {
      videoIframe.remove();
      videoIframe = null;
    }
    activeVideoId = null;
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
    clearVideo();
    clearImage();
    return {
      destroy: () => {
        clearVideo();
        clearImage();
        root.innerHTML = "";
      }
    };
  }

  const syncFromState = () => {
    const state = options.manager!.getState();
    applyOverlay(state.prefs.overlayDarkness, state.prefs.backgroundBlurPx);
    applyTheme(state.prefs.themeColor);
    applySurface(state.prefs.surfaceColor);

    if (state.prefs.selectedKind === "video" && state.prefs.youtubeUrl) {
      const videoId = extractYouTubeId(state.prefs.youtubeUrl);
      if (videoId) {
        clearImage();
        if (activeVideoId === videoId && videoIframe) {
          return;
        }
        clearVideo();
        const iframe = document.createElement("iframe");
        iframe.className = "app-background__video-frame";
        iframe.setAttribute("data-testid", "bg-video");
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;
        iframe.src = buildYouTubeBackgroundEmbedUrl(videoId);
        videoLayer.appendChild(iframe);
        videoIframe = iframe;
        activeVideoId = videoId;
        return;
      }
    }

    clearVideo();

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
      clearVideo();
      clearImage();
      root.innerHTML = "";
    }
  };
};
