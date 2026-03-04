import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportData } from "../src/features/settings/exportData";
import { applyMergePlan } from "../src/features/settings/importData";
import { openCozyDB } from "../src/storage";
import { renderApp } from "../src/ui/render";

const THEME_COLORS = {
  blue: "#2563EB",
  violet: "#7C3AED",
  emerald: "#10B981",
  amber: "#F59E0B",
  rose: "#FB7185"
} as const;

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

const mountVisuals = () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }

  renderApp(root);

  const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  const visualsTab = document.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-visuals"]');
  const themeSection = document.querySelector<HTMLElement>('[data-testid="visuals-theme"]');

  if (!toggle || !visualsTab || !themeSection) {
    throw new Error("Missing visuals theme controls");
  }

  toggle.click();
  visualsTab.click();

  return { themeSection };
};

const clickSwatch = (index: number) => {
  const swatch = document.querySelector<HTMLButtonElement>(`[data-testid="theme-swatch-${index}"]`);
  if (!swatch) {
    throw new Error(`Missing theme swatch ${index}`);
  }
  swatch.click();
  return swatch;
};

const defineCustomAccent = (slot: number, color: string) => {
  const input = document.querySelector<HTMLInputElement>(`[data-theme-color-input="${slot}"]`);
  if (!input) {
    throw new Error(`Missing custom accent input ${slot}`);
  }
  input.value = color;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const defineCustomSurface = (slot: number, color: string) => {
  const input = document.querySelector<HTMLInputElement>(`[data-surface-color-input="${slot}"]`);
  if (!input) {
    throw new Error(`Missing custom surface input ${slot}`);
  }
  input.value = color;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

beforeEach(async () => {
  await clearVisuals();
});

afterEach(async () => {
  await clearVisuals();
});

describe("theme color", () => {
  it("selecting a swatch updates CSS vars and selected state", async () => {
    const { themeSection } = mountVisuals();

    defineCustomAccent(0, THEME_COLORS.emerald);

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.themeColor === THEME_COLORS.emerald;
    });

    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue("--color-brand-primary").trim()).toBe(THEME_COLORS.emerald);
    expect(rootStyle.getPropertyValue("--color-focus-ring").trim()).toContain("16, 185, 129");

    const selected = themeSection.querySelectorAll(".ambient-theme-swatch.is-selected");
    expect(selected.length).toBe(1);
    expect((selected[0] as HTMLElement).dataset.themeColor).toBe(THEME_COLORS.emerald.toUpperCase());
  });

  it("auto contrast updates --color-on-primary from luminance", async () => {
    mountVisuals();

    defineCustomAccent(0, THEME_COLORS.amber);
    await waitFor(() =>
      document.documentElement.style.getPropertyValue("--color-on-primary").trim() === "#0F172A"
    );

    defineCustomAccent(1, THEME_COLORS.violet);
    await waitFor(() =>
      document.documentElement.style.getPropertyValue("--color-on-primary").trim() === "#FFFFFF"
    );
  });

  it("persists to IndexedDB and restores after re-init", async () => {
    mountVisuals();

    defineCustomAccent(2, THEME_COLORS.rose);

    await waitFor(async () => {
      const db = await openCozyDB();
      const prefs = await db.get("settings", "visualPrefs");
      db.close();
      return prefs?.themeColor === THEME_COLORS.rose;
    });

    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLDivElement>("#app");
    if (!root) {
      throw new Error("Missing #app root on remount");
    }
    renderApp(root);

    await waitFor(() =>
      document.documentElement.style.getPropertyValue("--color-brand-primary").trim() === THEME_COLORS.rose
    );

    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
    const visualsTab = document.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-visuals"]');
    if (!toggle || !visualsTab) {
      throw new Error("Missing visuals controls after remount");
    }
    toggle.click();
    visualsTab.click();

    await waitFor(() => {
      const swatch = document.querySelector<HTMLElement>('[data-testid="theme-swatch-3"]');
      return Boolean(swatch?.classList.contains("is-selected"));
    });
  });

  it("surface row updates page and card background vars", async () => {
    mountVisuals();

    defineCustomSurface(0, "#334155");

    await waitFor(() =>
      document.documentElement.style.getPropertyValue("--color-bg-page").trim() === "#334155"
    );
    expect(document.documentElement.style.getPropertyValue("--color-bg-card").trim()).toContain("rgba(");
  });

  it("exports themeColor and import restores it", async () => {
    const sourceDbName = `cozyfocus-test-${uuidv4()}`;
    const targetDbName = `cozyfocus-test-${uuidv4()}`;

    const source = await openCozyDB(sourceDbName);
    await source.put(
      "settings",
      {
        selectedKind: "none",
        overlayDarkness: 0.32,
        backgroundBlurPx: 0,
        themeColor: THEME_COLORS.emerald,
        updatedAt: 200
      },
      "visualPrefs"
    );
    await source.put("visualAssets", {
      id: "asset-1",
      kind: "image",
      mime: "image/png",
      blob: new Blob(["first"], { type: "image/png" }),
      createdAt: 100
    });
    source.close();

    const bundle = await exportData({ dbName: sourceDbName });
    expect(bundle.data.visualAssets?.length).toBe(1);
    expect(bundle.data.settings).toEqual(
      expect.arrayContaining([expect.objectContaining({ themeColor: THEME_COLORS.emerald })])
    );

    const target = await openCozyDB(targetDbName);
    await target.put(
      "settings",
      {
        selectedKind: "none",
        overlayDarkness: 0.32,
        backgroundBlurPx: 0,
        themeColor: THEME_COLORS.blue,
        updatedAt: 100
      },
      "visualPrefs"
    );
    await target.put("visualAssets", {
      id: "asset-1",
      kind: "image",
      mime: "image/png",
      blob: new Blob(["local"], { type: "image/png" }),
      createdAt: 100
    });
    target.close();

    const result = await applyMergePlan(bundle, { dbName: targetDbName });
    expect(result.plan.settings.update).toBe(1);

    const verify = await openCozyDB(targetDbName);
    const prefs = await verify.get("settings", "visualPrefs");
    const assets = await verify.getAll("visualAssets");
    verify.close();

    expect(prefs?.themeColor).toBe(THEME_COLORS.emerald);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.id).toBe("asset-1");

    await deleteDB(sourceDbName);
    await deleteDB(targetDbName);
  });
});
