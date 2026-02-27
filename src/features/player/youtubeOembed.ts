export interface YouTubeOEmbedMetadata {
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

interface YouTubeOEmbedCacheEntry {
  expiresAt: number;
  value: YouTubeOEmbedMetadata;
}

const CACHE_PREFIX = "cozyfocus:youtube-oembed:v1:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const REQUEST_TIMEOUT_MS = 4000;

const getCacheKey = (inputUrl: string): string => {
  return `${CACHE_PREFIX}${encodeURIComponent(inputUrl.trim())}`;
};

const canUseStorage = (): boolean => {
  try {
    return typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
};

const readCache = (key: string): YouTubeOEmbedMetadata | null => {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as YouTubeOEmbedCacheEntry | null;
    if (!parsed || typeof parsed.expiresAt !== "number" || !parsed.value) {
      globalThis.localStorage.removeItem(key);
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      globalThis.localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: YouTubeOEmbedMetadata, ttlMs: number): void => {
  if (!canUseStorage() || ttlMs <= 0) {
    return;
  }
  try {
    const payload: YouTubeOEmbedCacheEntry = {
      expiresAt: Date.now() + ttlMs,
      value
    };
    globalThis.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc).
  }
};

const parseOEmbedResponse = (input: unknown): YouTubeOEmbedMetadata | null => {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const authorName = typeof record.author_name === "string" ? record.author_name.trim() : "";
  const thumbnailUrl =
    typeof record.thumbnail_url === "string" ? record.thumbnail_url.trim() : "";
  if (!title) {
    return null;
  }
  return {
    title,
    authorName: authorName || "YouTube",
    thumbnailUrl
  };
};

export const getYouTubeOEmbedMeta = async (
  inputUrl: string,
  options: { ttlMs?: number } = {}
): Promise<YouTubeOEmbedMetadata | null> => {
  const normalizedInput = inputUrl.trim();
  if (!normalizedInput || typeof globalThis.fetch !== "function") {
    return null;
  }

  const ttlMs = Math.max(0, options.ttlMs ?? CACHE_TTL_MS);
  const cacheKey = getCacheKey(normalizedInput);
  const cached = readCache(cacheKey);
  if (cached) {
    return cached;
  }

  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      normalizedInput
    )}&format=json`;
    const response = await globalThis.fetch(endpoint, {
      signal: abortController.signal,
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    const parsed = parseOEmbedResponse(await response.json());
    if (!parsed) {
      return null;
    }
    writeCache(cacheKey, parsed, ttlMs);
    return parsed;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};
