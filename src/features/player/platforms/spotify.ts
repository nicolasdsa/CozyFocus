import type { PlatformAdapter } from "./types";

const PLAYLIST_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);

const extractPlaylistId = (input: string): string | null => {
  const trimmed = input.trim();
  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) {
    return uriMatch[1];
  }

  try {
    const url = new URL(trimmed);
    if (!PLAYLIST_HOSTS.has(url.hostname)) {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "playlist" || !parts[1]) {
      return null;
    }
    return parts[1];
  } catch {
    return null;
  }
};

export const spotifyAdapter: PlatformAdapter = {
  id: "spotify",
  match: (input) => extractPlaylistId(input) !== null,
  normalize: (input) => input.trim(),
  buildEmbedUrl: (input) => {
    const playlistId = extractPlaylistId(input);
    if (!playlistId) {
      throw new Error("Invalid Spotify playlist input.");
    }
    return `https://open.spotify.com/embed/playlist/${playlistId}`;
  },
  getDisplayName: () => "Spotify"
};
