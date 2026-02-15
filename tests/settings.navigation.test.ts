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
  const navFocus = document.querySelector<HTMLButtonElement>('[data-testid="nav-focus"]');
  const navCalendar = document.querySelector<HTMLButtonElement>('[data-testid="nav-calendar"]');
  const navFiles = document.querySelector<HTMLButtonElement>('[data-testid="nav-files"]');
  if (!navSettings || !navFocus || !navCalendar || !navFiles) {
    throw new Error("Missing nav button");
  }
  return { root, navSettings, navFocus, navCalendar, navFiles };
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

  it("keeps pomodoro/player active while settings is open", async () => {
    const { navSettings, navFocus } = setup();
    await waitFor(() => Boolean(document.querySelector('[data-testid="pomodoro-start"]')));

    const startButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-start"]'
    );
    if (!startButton) {
      throw new Error("Missing pomodoro start button");
    }

    startButton.click();
    await waitFor(() => Boolean(startButton.disabled));

    navSettings.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="activity-dock"]')));

    const dockToggle = document.querySelector<HTMLButtonElement>(
      '[data-testid="activity-pomodoro-toggle"]'
    );
    const playerToggle = document.querySelector<HTMLButtonElement>(
      '[data-testid="activity-player-toggle"]'
    );
    const dockTime = document.querySelector<HTMLElement>('[data-testid="activity-pomodoro-time"]');
    if (!dockToggle || !playerToggle || !dockTime) {
      throw new Error("Missing activity dock controls");
    }

    expect(dockTime.textContent).not.toBe("00:00");
    expect(dockToggle.textContent).toBe("❚❚");

    dockToggle.click();
    await waitFor(() => dockToggle.textContent === "▶");

    playerToggle.click();
    await waitFor(() =>
      Boolean(document.querySelector('[data-testid="activity-player-drawer"] [data-testid="player"]'))
    );

    navFocus.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="pomodoro-start"]')));

    const focusStart = document.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-start"]'
    );
    const focusPause = document.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-pause"]'
    );
    if (!focusStart || !focusPause) {
      throw new Error("Missing focus pomodoro controls");
    }

    expect(focusStart.disabled).toBe(false);
    expect(focusPause.disabled).toBe(true);
  });

  it("shows top compact dock on calendar and files", async () => {
    const { navCalendar, navFiles, navFocus } = setup();
    navCalendar.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="activity-dock"]')));
    const dock = document.querySelector<HTMLElement>('[data-testid="activity-dock"]');
    expect(dock?.hidden).toBe(false);

    navFiles.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="activity-dock"]')));
    expect(dock?.hidden).toBe(false);

    navFocus.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="activity-dock"]')));
    expect(dock?.hidden).toBe(true);
  });

  it("reuses the same player iframe across route changes", async () => {
    const { navCalendar, navSettings, navFiles } = setup();

    navCalendar.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="activity-player-toggle"]')));
    const playerToggle = document.querySelector<HTMLButtonElement>(
      '[data-testid="activity-player-toggle"]'
    );
    if (!playerToggle) {
      throw new Error("Missing player toggle");
    }

    playerToggle.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="player-embed"]')));
    const firstEmbed = document.querySelector<HTMLElement>('[data-testid="player-embed"]');

    navSettings.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="player-embed"]')));
    const secondEmbed = document.querySelector<HTMLElement>('[data-testid="player-embed"]');

    navFiles.click();
    await waitFor(() => Boolean(document.querySelector('[data-testid="player-embed"]')));
    const thirdEmbed = document.querySelector<HTMLElement>('[data-testid="player-embed"]');

    expect(firstEmbed).toBeTruthy();
    expect(secondEmbed).toBeTruthy();
    expect(thirdEmbed).toBeTruthy();
    expect(secondEmbed).toBe(firstEmbed);
    expect(thirdEmbed).toBe(firstEmbed);
  });
});
