import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";
import { openCozyDB } from "../src/storage";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const navSettings = document.querySelector<HTMLButtonElement>(
    '[data-testid="nav-settings"]'
  );
  if (!navSettings) {
    throw new Error("Missing Settings nav button");
  }
  return { root, navSettings };
};

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (check: () => boolean, attempts = 50) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) {
      return;
    }
    await waitForRoute();
  }
  throw new Error("Timed out waiting for UI update");
};

describe("settings navigation", () => {
  it("clicking nav-settings renders settings-view without page reload", async () => {
    const { navSettings } = setup();
    const baseHref = window.location.href.split("#")[0];
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="settings-view"]')).toBeTruthy();
    expect(window.location.pathname).toBe("/settings");
    expect(window.location.href.startsWith(baseHref)).toBe(true);
  });

  it("renders settings sections by testid", async () => {
    const { navSettings } = setup();
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="settings-title"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-about"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-repo"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-data"]')).toBeTruthy();
  });

  it("renders data management buttons by testid", async () => {
    const { navSettings } = setup();
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="data-export"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="data-import"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="data-delete"]')).toBeTruthy();
  });

  it("persists time format selection from settings", async () => {
    let db = await openCozyDB();
    await db.put(
      "settings",
      {
        mode: "auto",
        updatedAt: Date.now()
      },
      "timeFormatPreference"
    );
    db.close();

    let ctx = setup();
    ctx.navSettings.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="time-format-12h"]')));

    const button24 = document.querySelector<HTMLButtonElement>('[data-testid="time-format-24h"]');
    if (!button24) {
      throw new Error("Missing 24h button");
    }
    button24.click();
    await waitFor(() => button24.classList.contains("is-active"));

    db = await openCozyDB();
    const stored = await db.get("settings", "timeFormatPreference");
    db.close();

    expect(stored).toMatchObject({ mode: "24h" });

    ctx = setup();
    ctx.navSettings.click();
    await waitFor(() => {
      const persistedButton = document.querySelector<HTMLButtonElement>(
        '[data-testid="time-format-24h"]'
      );
      return Boolean(persistedButton?.classList.contains("is-active"));
    });

    const persistedButton = document.querySelector<HTMLButtonElement>('[data-testid="time-format-24h"]');
    expect(persistedButton?.classList.contains("is-active")).toBe(true);

    db = await openCozyDB();
    const persisted = await db.get("settings", "timeFormatPreference");
    db.close();
    expect(persisted).toMatchObject({ mode: "24h" });
  });
});
