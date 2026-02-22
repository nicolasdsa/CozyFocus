import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it, vi, afterEach } from "vitest";
import { createPlayerService } from "../src/features/player/playerService";
import { mountPlayerView } from "../src/features/player/playerView";
import * as net from "../src/features/player/net";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRoot = () => {
  const root = document.createElement("footer");
  root.dataset.testid = "player";
  document.body.innerHTML = "";
  document.body.appendChild(root);
  return root;
};

const cleanupDb = async (name: string) => {
  await deleteDB(name);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("player", () => {
  it("persists Spotify input and renders embed", async () => {
    const dbName = `cozyfocus-player-test-${uuidv4()}`;
    const service = createPlayerService({ dbName });
    const root = createRoot();
    vi.spyOn(net, "isOnline").mockReturnValue(true);

    await mountPlayerView(root, { service });

    const input = root.querySelector<HTMLInputElement>('[data-testid="player-input"]');
    const save = root.querySelector<HTMLButtonElement>('[data-testid="player-save"]');
    if (!input || !save) {
      throw new Error("Missing player controls");
    }

    input.value = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
    save.click();
    await flushPromises();

    const setting = await service.getSetting();
    expect(setting?.platformId).toBe("spotify");
    expect(setting?.embedUrl).toContain("open.spotify.com/embed/playlist/");

    const iframe = root.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.src).toBe(setting?.embedUrl);

    await service.close();
    await cleanupDb(dbName);
  });

  it("persists YouTube input and renders embed", async () => {
    const dbName = `cozyfocus-player-test-${uuidv4()}`;
    const service = createPlayerService({ dbName });
    const root = createRoot();
    vi.spyOn(net, "isOnline").mockReturnValue(true);

    await mountPlayerView(root, { service });

    const input = root.querySelector<HTMLInputElement>('[data-testid="player-input"]');
    const save = root.querySelector<HTMLButtonElement>('[data-testid="player-save"]');
    if (!input || !save) {
      throw new Error("Missing player controls");
    }

    input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    save.click();
    await flushPromises();

    const setting = await service.getSetting();
    expect(setting?.platformId).toBe("youtube");
    expect(setting?.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");

    const iframe = root.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.src).toBe(setting?.embedUrl);

    await service.close();
    await cleanupDb(dbName);
  });

  it("shows validation and does not persist for unknown input", async () => {
    const dbName = `cozyfocus-player-test-${uuidv4()}`;
    const service = createPlayerService({ dbName });
    const root = createRoot();
    vi.spyOn(net, "isOnline").mockReturnValue(true);

    await mountPlayerView(root, { service });

    const input = root.querySelector<HTMLInputElement>('[data-testid="player-input"]');
    const save = root.querySelector<HTMLButtonElement>('[data-testid="player-save"]');
    const status = root.querySelector<HTMLElement>('[data-testid="player-status"]');
    if (!input || !save || !status) {
      throw new Error("Missing player controls");
    }

    input.value = "hello world";
    save.click();
    await flushPromises();

    expect(status.textContent).toContain("Unsupported");
    const setting = await service.getSetting();
    expect(setting).toBeNull();

    await service.close();
    await cleanupDb(dbName);
  });

  it("shows offline placeholder and does not mount iframe", async () => {
    const dbName = `cozyfocus-player-test-${uuidv4()}`;
    const service = createPlayerService({ dbName });
    await service.saveSetting("https://youtu.be/dQw4w9WgXcQ");

    const root = createRoot();
    vi.spyOn(net, "isOnline").mockReturnValue(false);

    await mountPlayerView(root, { service });

    const iframe = root.querySelector<HTMLIFrameElement>("iframe");
    const status = root.querySelector<HTMLElement>('[data-testid="player-status"]');
    expect(iframe).toBeNull();
    expect(status?.textContent).toContain("Offline");

    await service.close();
    await cleanupDb(dbName);
  });
});
