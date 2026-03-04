import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const setup = () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);

  const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  const visualsTab = document.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-visuals"]');
  const overlayInput = document.querySelector<HTMLInputElement>('[data-testid="visuals-overlay"]');
  const blurInput = document.querySelector<HTMLInputElement>('[data-testid="visuals-blur"]');
  const imageInput = document.querySelector<HTMLInputElement>('[data-testid="visuals-add-image"]');
  const youtubeInput = document.querySelector<HTMLInputElement>('[data-testid="visuals-youtube-input"]');
  const youtubeApply = document.querySelector<HTMLButtonElement>('[data-testid="visuals-youtube-apply"]');
  if (
    !toggle ||
    !visualsTab ||
    !overlayInput ||
    !blurInput ||
    !imageInput ||
    !youtubeInput ||
    !youtubeApply
  ) {
    throw new Error("Missing visuals controls");
  }

  toggle.click();
  visualsTab.click();

  return {
    overlayInput,
    blurInput,
    imageInput,
    youtubeInput,
    youtubeApply
  };
};

const createImage = (name: string): File => new File([`content-${name}`], name, { type: "image/png" });

const setInputFiles = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const setRangeValue = (input: HTMLInputElement, value: number) => {
  input.value = `${value}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

beforeEach(async () => {
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: () => "blob:initial"
    });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: () => undefined
    });
  }
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock-image");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  await clearVisuals();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearVisuals();
});

describe("visual effects", () => {
  it("changing overlay slider updates overlay style and persists in visualPrefs", async () => {
    const { overlayInput } = setup();
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");
    if (!overlay) {
      throw new Error("Missing background overlay");
    }

    setRangeValue(overlayInput, 70);

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.overlayDarkness === 0.7;
    });

    expect(overlay.style.backgroundColor).toContain("0.7");
  });

  it("changing blur slider updates bg-media filter and persists in visualPrefs", async () => {
    const { blurInput } = setup();
    const imageLayer = document.querySelector<HTMLElement>('[data-testid="bg-image"]');
    const videoLayer = document.querySelector<HTMLElement>('[data-testid="bg-video-layer"]');
    if (!imageLayer || !videoLayer) {
      throw new Error("Missing background media layers");
    }

    setRangeValue(blurInput, 12);

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.backgroundBlurPx === 12;
    });

    expect(imageLayer.style.filter).toBe("blur(12px)");
    expect(videoLayer.style.filter).toBe("blur(12px)");
  });

  it("effects remain applied for image and video selectedKind modes", async () => {
    const { overlayInput, blurInput, imageInput, youtubeInput, youtubeApply } = setup();
    const imageLayer = document.querySelector<HTMLElement>('[data-testid="bg-image"]');
    const videoLayer = document.querySelector<HTMLElement>('[data-testid="bg-video-layer"]');
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");
    if (!imageLayer || !videoLayer || !overlay) {
      throw new Error("Missing background layers");
    }

    setRangeValue(overlayInput, 45);
    setRangeValue(blurInput, 9);
    setInputFiles(imageInput, [createImage("mode-switch.png")]);

    await waitFor(() =>
      Boolean(document.querySelector('[data-testid^="visuals-img-"]:not([data-testid^="visuals-img-del-"])'))
    );
    const thumb = document.querySelector<HTMLElement>(
      '[data-testid^="visuals-img-"]:not([data-testid^="visuals-img-del-"])'
    );
    if (!thumb) {
      throw new Error("Missing image thumb");
    }
    thumb.click();

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.selectedKind === "image";
    });

    expect(imageLayer.hidden).toBe(false);
    expect(imageLayer.style.filter).toBe("blur(9px)");
    expect(videoLayer.style.filter).toBe("blur(9px)");
    expect(overlay.style.backgroundColor).toContain("0.45");

    youtubeInput.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    youtubeApply.click();

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.selectedKind === "video";
    });
    await waitFor(() => Boolean(document.querySelector('[data-testid="bg-video"]')));

    expect(imageLayer.style.filter).toBe("blur(9px)");
    expect(videoLayer.style.filter).toBe("blur(9px)");
    expect(overlay.style.backgroundColor).toContain("0.45");
  });
});
