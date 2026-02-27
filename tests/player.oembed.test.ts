import { afterEach, describe, expect, it, vi } from "vitest";
import { getYouTubeOEmbedMeta } from "../src/features/player/youtubeOembed";

const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});

describe("youtube oembed cache", () => {
  it("caches successful responses for the configured ttl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Lofi Hip Hop Radio",
        author_name: "LoFi Girl",
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await getYouTubeOEmbedMeta(youtubeUrl, { ttlMs: 60_000 });
    const second = await getYouTubeOEmbedMeta(youtubeUrl, { ttlMs: 60_000 });

    expect(first?.title).toBe("Lofi Hip Hop Radio");
    expect(second?.authorName).toBe("LoFi Girl");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores expired cache entries and fetches again", async () => {
    const cacheKey = `cozyfocus:youtube-oembed:v1:${encodeURIComponent(youtubeUrl)}`;
    globalThis.localStorage?.setItem(
      cacheKey,
      JSON.stringify({
        expiresAt: Date.now() - 1000,
        value: {
          title: "Expired",
          authorName: "Expired",
          thumbnailUrl: ""
        }
      })
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Fresh title",
        author_name: "Fresh author",
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await getYouTubeOEmbedMeta(youtubeUrl, { ttlMs: 60_000 });

    expect(metadata?.title).toBe("Fresh title");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
