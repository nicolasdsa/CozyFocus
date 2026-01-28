import type { PlatformAdapter } from "./types";

const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const SHORT_HOSTS = new Set(["youtu.be"]);

const extractVideoId = (input: string): string | null => {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (SHORT_HOSTS.has(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (YOUTUBE_HOSTS.has(url.hostname)) {
      // TODO: Add playlist handling while keeping the embed URL shape consistent.
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }
      if (url.pathname.startsWith("/embed/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",
  match: (input) => extractVideoId(input) !== null,
  normalize: (input) => input.trim(),
  buildEmbedUrl: (input) => {
    const videoId = extractVideoId(input);
    if (!videoId) {
      throw new Error("Invalid YouTube video input.");
    }
    return `https://www.youtube.com/embed/${videoId}`;
  },
  getDisplayName: () => "YouTube"
};
