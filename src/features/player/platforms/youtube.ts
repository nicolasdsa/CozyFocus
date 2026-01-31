import type { PlatformAdapter } from "./types";

const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const SHORT_HOSTS = new Set(["youtu.be"]);

const parseTimeToSeconds = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const match = trimmed.match(/^((\d+)h)?((\d+)m)?((\d+)s)?$/);
  if (!match) {
    return null;
  }

  const hours = match[2] ? Number(match[2]) : 0;
  const minutes = match[4] ? Number(match[4]) : 0;
  const seconds = match[6] ? Number(match[6]) : 0;
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total >= 0 ? total : null;
};

const parseYouTubeInput = (
  input: string
): { videoId?: string; playlistId?: string; startSeconds?: number } | null => {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const startSeconds =
      parseTimeToSeconds(url.searchParams.get("start")) ??
      parseTimeToSeconds(url.searchParams.get("t")) ??
      undefined;
    if (SHORT_HOSTS.has(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      const playlistId = url.searchParams.get("list") ?? undefined;
      if (!id && !playlistId) {
        return null;
      }
      return {
        videoId: id || undefined,
        playlistId,
        startSeconds
      };
    }

    if (YOUTUBE_HOSTS.has(url.hostname)) {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v") ?? undefined;
        const playlistId = url.searchParams.get("list") ?? undefined;
        if (!videoId && !playlistId) {
          return null;
        }
        return { videoId, playlistId, startSeconds };
      }
      if (url.pathname === "/playlist") {
        const playlistId = url.searchParams.get("list") ?? undefined;
        return playlistId ? { playlistId, startSeconds } : null;
      }
      if (url.pathname.startsWith("/embed/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[1] === "videoseries") {
          const playlistId = url.searchParams.get("list") ?? undefined;
          return playlistId ? { playlistId, startSeconds } : null;
        }
        const videoId = parts[1] ?? undefined;
        const playlistId = url.searchParams.get("list") ?? undefined;
        if (!videoId && !playlistId) {
          return null;
        }
        return { videoId, playlistId, startSeconds };
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",
  match: (input) => parseYouTubeInput(input) !== null,
  normalize: (input) => input.trim(),
  buildEmbedUrl: (input) => {
    const parsed = parseYouTubeInput(input);
    if (!parsed) {
      throw new Error("Invalid YouTube input.");
    }

    const params = new URLSearchParams();
    if (parsed.playlistId) {
      params.set("list", parsed.playlistId);
    }
    if (parsed.startSeconds !== undefined) {
      params.set("start", String(parsed.startSeconds));
    }
    const query = params.toString();

    if (parsed.playlistId && !parsed.videoId) {
      return `https://www.youtube.com/embed/videoseries${query ? `?${query}` : ""}`;
    }

    if (parsed.videoId && parsed.playlistId) {
      return `https://www.youtube.com/embed/${parsed.videoId}${query ? `?${query}` : ""}`;
    }

    if (parsed.videoId) {
      return `https://www.youtube.com/embed/${parsed.videoId}${
        parsed.startSeconds !== undefined ? `?start=${parsed.startSeconds}` : ""
      }`;
    }

    throw new Error("Invalid YouTube input.");
  },
  getDisplayName: () => "YouTube"
};
