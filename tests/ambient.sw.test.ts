import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker ambient runtime caching", () => {
  it("contains an mp3 CacheFirst runtime caching rule with limits", () => {
    const swSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf-8");

    expect(swSource).toContain('endsWith(".mp3")');
    expect(swSource).toContain("CacheFirst");
    expect(swSource).toContain("maxEntries: 20");
    expect(swSource).toContain("maxAgeSeconds: 60 * 60 * 24 * 30");
  });
});
