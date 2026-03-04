const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const SHORT_HOSTS = new Set(["youtu.be"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const normalizeVideoId = (candidate: string | null): string | null => {
  if (!candidate) {
    return null;
  }
  const trimmed = candidate.trim();
  if (!VIDEO_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const extractYouTubeId = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (SHORT_HOSTS.has(parsed.hostname)) {
      const shortId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return normalizeVideoId(shortId);
    }

    if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
      return null;
    }

    if (parsed.pathname === "/watch") {
      return normalizeVideoId(parsed.searchParams.get("v"));
    }

    if (parsed.pathname.startsWith("/embed/")) {
      const embedId = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      return normalizeVideoId(embedId);
    }
  } catch {
    return null;
  }
  return null;
};

export const buildYouTubeBackgroundEmbedUrl = (videoId: string): string => {
  const params = new URLSearchParams();
  params.set("autoplay", "1");
  params.set("mute", "1");
  params.set("controls", "0");
  params.set("playsinline", "1");
  params.set("loop", "1");
  params.set("playlist", videoId);
  params.set("modestbranding", "1");
  params.set("rel", "0");
  params.set("iv_load_policy", "3");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};
