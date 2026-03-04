export type VisualImage = {
  id: string;
  kind: "image";
  mime: string;
  blob: Blob;
  createdAt: number;
};

export type VisualPrefs = {
  selectedKind: "none" | "image" | "video";
  selectedImageId?: string;
  youtubeUrl?: string;
  overlayDarkness: number;
  backgroundBlurPx: number;
  themeColor: string;
  updatedAt: number;
};

export const VISUAL_PREFS_KEY = "visualPrefs";
export const MAX_VISUAL_IMAGES = 4;

export const DEFAULT_VISUAL_PREFS: VisualPrefs = {
  selectedKind: "none",
  overlayDarkness: 0.32,
  backgroundBlurPx: 0,
  themeColor: "blue",
  updatedAt: 0
};
