import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractYouTubeId } from "../src/features/background/youtube";
import { openCozyDB } from "../src/storage";
import { renderApp } from "../src/ui/render";

const waitForTick = async () => new Promise((resolve) => setTimeout(resolve, 0));

const waitFor = async (check: () => boolean | Promise<boolean>, attempts = 50) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) {
      return;
    }
    await waitForTick();
  }
  throw new Error("Timed out waiting for UI update");
};

const clearVisuals = async () => {
  const db = await openCozyDB();
  const tx = db.transaction(["visualAssets", "settings"], "readwrite");
  await Promise.all([tx.objectStore("visualAssets").clear(), tx.objectStore("settings").clear()]);
  await tx.done;
  db.close();
};

const seedSelectedImage = async () => {
  const db = await openCozyDB();
  const tx = db.transaction(["visualAssets", "settings"], "readwrite");
  await tx.objectStore("visualAssets").put({
    id: "seed-image-id",
    kind: "image",
    mime: "image/png",
    blob: new Blob(["seed"], { type: "image/png" }),
    createdAt: Date.now()
  });
  await tx.objectStore("settings").put(
    {
      selectedKind: "image",
      selectedImageId: "seed-image-id",
      overlayDarkness: 0.32,
      backgroundBlurPx: 0,
      themeColor: "blue",
      updatedAt: Date.now()
    },
    "visualPrefs"
  );
  await tx.done;
  db.close();
};

const setup = () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);

  const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  const visualsTab = document.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-visuals"]');
  const youtubeInput = document.querySelector<HTMLInputElement>('[data-testid="visuals-youtube-input"]');
  const youtubeApply = document.querySelector<HTMLButtonElement>('[data-testid="visuals-youtube-apply"]');
  const navSettings = document.querySelector<HTMLAnchorElement>('[data-testid="nav-settings"]');
  const navFiles = document.querySelector<HTMLAnchorElement>('[data-testid="nav-files"]');

  if (!toggle || !visualsTab || !youtubeInput || !youtubeApply || !navSettings || !navFiles) {
    throw new Error("Missing visuals youtube controls");
  }

  toggle.click();
  visualsTab.click();

  return {
    youtubeInput,
    youtubeApply,
    navSettings,
    navFiles
  };
};

beforeEach(async () => {
  await clearVisuals();
});

afterEach(async () => {
  await clearVisuals();
});

describe("visuals youtube", () => {
  it("extractYouTubeId supports watch, short and embed URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("applying valid YouTube URL sets selectedKind='video' and clears selectedImageId", async () => {
    await seedSelectedImage();
    const { youtubeInput, youtubeApply } = setup();

    youtubeInput.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    youtubeApply.click();

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.selectedKind === "video";
    });

    const db = await openCozyDB();
    const prefs = await db.get("settings", "visualPrefs");
    db.close();

    expect(prefs?.selectedKind).toBe("video");
    expect(prefs?.selectedImageId).toBeUndefined();
    expect(prefs?.youtubeUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("shows bg-video iframe with looping src parameters", async () => {
    const { youtubeInput, youtubeApply } = setup();

    youtubeInput.value = "https://youtu.be/dQw4w9WgXcQ";
    youtubeApply.click();

    await waitFor(() => Boolean(document.querySelector('[data-testid="bg-video"]')));

    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="bg-video"]');
    expect(iframe).toBeTruthy();
    const src = iframe?.src ?? "";
    expect(iframe?.getAttribute("loading")).toBe("lazy");

    expect(src).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ?");
    expect(src).toContain("autoplay=1");
    expect(src).toContain("mute=1");
    expect(src).toContain("controls=0");
    expect(src).toContain("playsinline=1");
    expect(src).toContain("loop=1");
    expect(src).toContain("playlist=dQw4w9WgXcQ");
    expect(src).toContain("modestbranding=1");
    expect(src).toContain("rel=0");
  });

  it("does not recreate the bg-video iframe when navigating routes", async () => {
    const { youtubeInput, youtubeApply, navSettings, navFiles } = setup();

    youtubeInput.value = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    youtubeApply.click();

    await waitFor(() => Boolean(document.querySelector('[data-testid="bg-video"]')));
    const first = document.querySelector<HTMLIFrameElement>('[data-testid="bg-video"]');

    navSettings.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="settings-view"]')));

    const second = document.querySelector<HTMLIFrameElement>('[data-testid="bg-video"]');

    navFiles.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="files-view"]')));

    const third = document.querySelector<HTMLIFrameElement>('[data-testid="bg-video"]');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(third).toBeTruthy();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("reset button clears youtube/image selection and restores default background", async () => {
    const { youtubeInput, youtubeApply } = setup();
    const reset = document.querySelector<HTMLButtonElement>('[data-testid="visuals-reset"]');
    if (!reset) {
      throw new Error("Missing visuals reset button");
    }

    youtubeInput.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    youtubeApply.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="bg-video"]')));

    reset.click();

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.selectedKind === "none";
    });

    const db = await openCozyDB();
    const prefs = await db.get("settings", "visualPrefs");
    db.close();
    expect(prefs?.selectedKind).toBe("none");
    expect(prefs?.youtubeUrl).toBeUndefined();
    expect(prefs?.selectedImageId).toBeUndefined();
    expect(document.querySelector('[data-testid="bg-video"]')).toBeNull();
  });
});
