import { getSetting, saveSetting } from "../../storage/settingsRepo";
import { openCozyDB } from "../../storage/db";
import {
  DEFAULT_VISUAL_PREFS,
  MAX_VISUAL_IMAGES,
  VISUAL_PREFS_KEY,
  type VisualImage,
  type VisualPrefs
} from "./backgroundTypes";

export interface BackgroundState {
  images: VisualImage[];
  prefs: VisualPrefs;
}

type BackgroundListener = (state: BackgroundState) => void;

export interface AddImagesResult {
  added: number;
  rejected: number;
}

export interface BackgroundManager {
  getState: () => BackgroundState;
  subscribe: (listener: BackgroundListener) => () => void;
  reloadFromStorage: () => Promise<void>;
  addImages: (files: FileList | File[]) => Promise<AddImagesResult>;
  deleteImage: (imageId: string) => Promise<void>;
  selectImage: (imageId: string) => Promise<void>;
  selectVideo: (youtubeUrl: string) => Promise<void>;
  clearSelection: () => Promise<void>;
}

interface BackgroundManagerOptions {
  dbName?: string;
  now?: () => number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

const createImageId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isVisualImage = (value: unknown): value is VisualImage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.kind === "image" &&
    typeof record.mime === "string" &&
    record.blob instanceof Blob &&
    typeof record.createdAt === "number"
  );
};

const sanitizeVisualPrefs = (value: VisualPrefs | null, now: () => number): VisualPrefs => {
  if (!value) {
    return { ...DEFAULT_VISUAL_PREFS, updatedAt: now() };
  }
  const selectedKind =
    value.selectedKind === "image" || value.selectedKind === "video" ? value.selectedKind : "none";
  return {
    selectedKind,
    selectedImageId: typeof value.selectedImageId === "string" ? value.selectedImageId : undefined,
    youtubeUrl: typeof value.youtubeUrl === "string" ? value.youtubeUrl : undefined,
    overlayDarkness: clamp(value.overlayDarkness, 0, 1),
    backgroundBlurPx: clamp(value.backgroundBlurPx, 0, 20),
    themeColor: typeof value.themeColor === "string" && value.themeColor.trim() ? value.themeColor : "blue",
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : now()
  };
};

export const createBackgroundManager = (
  options: BackgroundManagerOptions = {}
): BackgroundManager => {
  const dbPromise = openCozyDB(options.dbName);
  const now = options.now ?? (() => Date.now());
  const listeners = new Set<BackgroundListener>();

  let state: BackgroundState = {
    images: [],
    prefs: { ...DEFAULT_VISUAL_PREFS, updatedAt: now() }
  };

  const emit = () => {
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  const setState = (nextState: BackgroundState) => {
    state = nextState;
    emit();
  };

  const loadImages = async (): Promise<VisualImage[]> => {
    const db = await dbPromise;
    const raw = await db.getAll("visualAssets");
    const images = raw.filter(isVisualImage);
    images.sort((a, b) => b.createdAt - a.createdAt);
    return images;
  };

  const savePrefs = async (prefs: VisualPrefs): Promise<void> => {
    const db = await dbPromise;
    await saveSetting(db, VISUAL_PREFS_KEY, prefs);
  };

  const persistAndApplyPrefs = async (nextPrefs: VisualPrefs): Promise<void> => {
    await savePrefs(nextPrefs);
    setState({
      ...state,
      prefs: nextPrefs
    });
  };

  const reloadFromStorage = async (): Promise<void> => {
    const db = await dbPromise;
    const [images, storedPrefs] = await Promise.all([
      loadImages(),
      getSetting<VisualPrefs>(db, VISUAL_PREFS_KEY)
    ]);

    let prefs = sanitizeVisualPrefs(storedPrefs, now);
    if (prefs.selectedKind === "image") {
      const selectedExists = images.some((entry) => entry.id === prefs.selectedImageId);
      if (!selectedExists) {
        prefs = {
          ...prefs,
          selectedKind: "none",
          selectedImageId: undefined,
          updatedAt: now()
        };
        await savePrefs(prefs);
      }
    }

    setState({ images, prefs });
  };

  const addImages = async (files: FileList | File[]): Promise<AddImagesResult> => {
    const input = Array.from(files ?? []);
    const valid = input.filter((file) => file.type.startsWith("image/"));
    if (valid.length === 0) {
      return { added: 0, rejected: input.length };
    }

    const remaining = MAX_VISUAL_IMAGES - state.images.length;
    if (remaining <= 0) {
      return { added: 0, rejected: valid.length };
    }

    const accepted = valid.slice(0, remaining);
    const createdAt = now();
    const toSave: VisualImage[] = accepted.map((file, index) => ({
      id: createImageId(),
      kind: "image",
      mime: file.type || "image/*",
      blob: new Blob([file], { type: file.type || "application/octet-stream" }),
      createdAt: createdAt + index
    }));

    const db = await dbPromise;
    const tx = db.transaction("visualAssets", "readwrite");
    for (const image of toSave) {
      await tx.store.put(image);
    }
    await tx.done;

    setState({
      ...state,
      images: [...toSave, ...state.images]
    });

    return {
      added: toSave.length,
      rejected: valid.length - toSave.length
    };
  };

  const deleteImage = async (imageId: string): Promise<void> => {
    if (!state.images.some((image) => image.id === imageId)) {
      return;
    }

    const db = await dbPromise;
    await db.delete("visualAssets", imageId);

    const nextImages = state.images.filter((image) => image.id !== imageId);
    let nextPrefs = state.prefs;
    if (state.prefs.selectedKind === "image" && state.prefs.selectedImageId === imageId) {
      nextPrefs = {
        ...state.prefs,
        selectedKind: "none",
        selectedImageId: undefined,
        updatedAt: now()
      };
      await savePrefs(nextPrefs);
    }

    setState({
      images: nextImages,
      prefs: nextPrefs
    });
  };

  const selectImage = async (imageId: string): Promise<void> => {
    if (!state.images.some((image) => image.id === imageId)) {
      return;
    }
    const nextPrefs: VisualPrefs = {
      ...state.prefs,
      selectedKind: "image",
      selectedImageId: imageId,
      youtubeUrl: undefined,
      updatedAt: now()
    };
    await persistAndApplyPrefs(nextPrefs);
  };

  const selectVideo = async (youtubeUrl: string): Promise<void> => {
    const nextPrefs: VisualPrefs = {
      ...state.prefs,
      selectedKind: "video",
      selectedImageId: undefined,
      youtubeUrl,
      updatedAt: now()
    };
    await persistAndApplyPrefs(nextPrefs);
  };

  const clearSelection = async (): Promise<void> => {
    await initialLoadPromise;
    const nextPrefs: VisualPrefs = {
      ...state.prefs,
      selectedKind: "none",
      selectedImageId: undefined,
      youtubeUrl: undefined,
      updatedAt: now()
    };
    await persistAndApplyPrefs(nextPrefs);
  };

  const initialLoadPromise = reloadFromStorage().catch((error: unknown) => {
    console.error("Failed to load visual background state", error);
  });

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    reloadFromStorage,
    addImages: async (files) => {
      await initialLoadPromise;
      return addImages(files);
    },
    deleteImage: async (imageId) => {
      await initialLoadPromise;
      await deleteImage(imageId);
    },
    selectImage: async (imageId) => {
      await initialLoadPromise;
      await selectImage(imageId);
    },
    selectVideo: async (youtubeUrl) => {
      await initialLoadPromise;
      await selectVideo(youtubeUrl);
    },
    clearSelection
  };
};
