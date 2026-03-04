import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCozyDB } from "../src/storage";
import { renderApp } from "../src/ui/render";

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (check: () => boolean | Promise<boolean>, attempts = 40) => {
  for (let index = 0; index < attempts; index += 1) {
    if (await check()) {
      return;
    }
    await waitForRoute();
  }
  throw new Error("Timed out waiting for UI update");
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
  const input = document.querySelector<HTMLInputElement>('[data-testid="visuals-add-image"]');
  if (!toggle || !visualsTab || !input) {
    throw new Error("Missing visuals controls");
  }

  toggle.click();
  visualsTab.click();

  if (input.disabled) {
    const status = document.querySelector<HTMLElement>('[data-testid="visuals-status"]');
    throw new Error(`Visuals input disabled: ${status?.textContent ?? "unknown"}`);
  }

  return { input };
};

const setInputFiles = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const createImage = (name: string): File => new File([`content-${name}`], name, { type: "image/png" });

const getVisualAssets = async () => {
  const db = await openCozyDB();
  const assets = await db.getAll("visualAssets");
  db.close();
  return assets;
};

const clearVisuals = async () => {
  const db = await openCozyDB();
  const tx = db.transaction(["visualAssets", "settings"], "readwrite");
  await Promise.all([tx.objectStore("visualAssets").clear(), tx.objectStore("settings").clear()]);
  await tx.done;
  db.close();
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

  let counter = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mock-${++counter}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

  await clearVisuals();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearVisuals();
});

describe("visuals images", () => {
  it("add image stores it and shows preview thumbnail", async () => {
    const { input } = setup();

    setInputFiles(input, [createImage("first.png")]);

    await waitFor(async () => (await getVisualAssets()).length === 1);

    const assets = await getVisualAssets();
    const imageId = assets[0]?.id;
    const thumb = document.querySelector(`[data-testid="visuals-img-${imageId}"]`);
    if (!thumb) {
      const status = document.querySelector<HTMLElement>('[data-testid="visuals-status"]');
      const grid = document.querySelector<HTMLElement>('[data-testid="visuals-grid"]');
      throw new Error(`Missing thumb. status=${status?.textContent ?? ""} grid=${grid?.innerHTML ?? ""}`);
    }

    expect(assets).toHaveLength(1);
    expect(assets[0]?.mime).toBe("image/png");
  });

  it("cannot exceed 4 images", async () => {
    const { input } = setup();

    setInputFiles(input, [
      createImage("1.png"),
      createImage("2.png"),
      createImage("3.png"),
      createImage("4.png"),
      createImage("5.png")
    ]);

    await waitFor(async () => (await getVisualAssets()).length === 4);
    const assets = await getVisualAssets();
    assets.forEach((asset) => {
      expect(document.querySelector(`[data-testid="visuals-img-${asset.id}"]`)).toBeTruthy();
    });

    const status = document.querySelector<HTMLElement>('[data-testid="visuals-status"]');
    expect(status?.textContent).toContain("up to 4 images");

    expect(assets).toHaveLength(4);
  });

  it("selecting an image updates prefs and backgroundView shows bg-image with that image", async () => {
    const { input } = setup();

    setInputFiles(input, [createImage("selected.png")]);
    await waitFor(async () => (await getVisualAssets()).length === 1);

    const assets = await getVisualAssets();
    const imageId = assets[0]?.id;
    if (!imageId) {
      throw new Error("Missing image id");
    }

    const thumb = document.querySelector<HTMLElement>(`[data-testid="visuals-img-${imageId}"]`);
    if (!thumb) {
      throw new Error("Missing visual thumb");
    }
    thumb.click();

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.selectedKind === "image" && prefs?.selectedImageId === imageId;
    });

    const bgRoot = document.querySelector<HTMLElement>('[data-testid="app-background"]');
    const bgImage = document.querySelector<HTMLElement>('[data-testid="bg-image"]');
    expect(bgRoot).toBeTruthy();
    expect(bgImage?.hidden).toBe(false);
    expect(bgImage?.style.backgroundImage).toContain("blob:mock-");
  });

  it("delete image removes from DB and from UI; selected deletion clears prefs", async () => {
    const { input } = setup();

    setInputFiles(input, [createImage("deletable.png")]);
    await waitFor(async () => (await getVisualAssets()).length === 1);

    let assets = await getVisualAssets();
    const imageId = assets[0]?.id;
    if (!imageId) {
      throw new Error("Missing image id");
    }

    const thumb = document.querySelector<HTMLElement>(`[data-testid="visuals-img-${imageId}"]`);
    if (!thumb) {
      throw new Error("Missing image controls");
    }

    thumb.click();
    await waitFor(async () => {
      const checkDb = await openCozyDB();
      const prefs = await checkDb.get("settings", "visualPrefs");
      checkDb.close();
      return prefs?.selectedKind === "image";
    });

    const del = document.querySelector<HTMLElement>(`[data-testid="visuals-img-del-${imageId}"]`);
    if (!del) {
      throw new Error("Missing delete control");
    }
    del.click();

    await waitFor(() => !document.querySelector(`[data-testid="visuals-img-${imageId}"]`));

    assets = await getVisualAssets();
    const db = await openCozyDB();
    const prefs = await db.get("settings", "visualPrefs");
    db.close();

    expect(assets).toHaveLength(0);
    expect(prefs?.selectedKind).toBe("none");
  });
});
