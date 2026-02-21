import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCozyDB, getLocalDayKey } from "../src/storage";
import { renderApp } from "../src/ui/render";

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (check: () => boolean, attempts = 20) => {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) {
      return;
    }
    await waitForRoute();
  }
};

const setupSettings = async () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const navSettings = document.querySelector<HTMLElement>("[data-testid=\"nav-settings\"]");
  if (!navSettings) {
    throw new Error("Missing Settings nav button");
  }
  navSettings.click();
  await waitForRoute();
  const deleteButton = document.querySelector<HTMLButtonElement>("[data-testid=\"data-delete\"]");
  if (!deleteButton) {
    throw new Error("Missing Delete Data button");
  }
  return { deleteButton };
};

const seedAllStores = async () => {
  const db = await openCozyDB();
  const dayKey = getLocalDayKey();
  await db.put("tasks", {
    id: "task-1",
    dayKey,
    title: "Seeded task",
    completed: false,
    createdAt: 10,
    updatedAt: 10,
    completedAt: null
  });
  await db.put("notes", {
    id: "note-1",
    dayKey,
    content: "Seeded note",
    updatedAt: 20
  });
  await db.put("docs", {
    id: "doc-1",
    dayKey,
    title: "Seeded doc",
    markdown: "Hello",
    tags: ["work"],
    createdAt: 30,
    updatedAt: 30
  });
  await db.put("tagLibrary", { name: "work", createdAt: 40 });
  await db.put("sessions", {
    id: "session-1",
    dayKey,
    type: "focus",
    durationMs: 1500000,
    startedAt: 100,
    endedAt: 1600000,
    completed: true
  });
  await db.put("stats", {
    dayKey,
    focusCompletedCount: 1,
    shortBreakCompletedCount: 0,
    longBreakCompletedCount: 0,
    totalFocusMs: 1500000,
    totalBreakMs: 0
  });
  await db.put("settings", { theme: "calm" } as unknown as object, "ui");
  db.close();
};

const clearAllStoresForTest = async () => {
  const db = await openCozyDB();
  const tx = db.transaction(
    ["tasks", "notes", "docs", "tagLibrary", "sessions", "stats", "settings"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("tasks").clear(),
    tx.objectStore("notes").clear(),
    tx.objectStore("docs").clear(),
    tx.objectStore("tagLibrary").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("stats").clear(),
    tx.objectStore("settings").clear()
  ]);
  await tx.done;
  db.close();
};

beforeEach(async () => {
  await clearAllStoresForTest();
});

afterEach(async () => {
  await clearAllStoresForTest();
});

describe("settings delete data", () => {
  it("clicking delete shows confirmation UI", async () => {
    const { deleteButton } = await setupSettings();
    deleteButton.click();
    const deleteModal = document.querySelector<HTMLDivElement>("[data-testid=\"delete-modal\"]");
    const confirmButton = document.querySelector<HTMLButtonElement>(
      "[data-testid=\"delete-confirm\"]"
    );
    expect(deleteModal?.hidden).toBe(false);
    expect(confirmButton).toBeTruthy();
  });

  it("cancel does not clear data", async () => {
    await seedAllStores();
    const { deleteButton } = await setupSettings();
    deleteButton.click();
    const cancelButton = document.querySelector<HTMLButtonElement>(
      "[data-testid=\"delete-cancel\"]"
    );
    cancelButton?.click();
    await waitForRoute();

    const db = await openCozyDB();
    expect((await db.getAll("tasks")).length).toBe(1);
    db.close();
  });

  it("confirm clears all stores", async () => {
    await seedAllStores();
    const { deleteButton } = await setupSettings();
    deleteButton.click();
    const confirmButton = document.querySelector<HTMLButtonElement>(
      "[data-testid=\"delete-confirm\"]"
    );
    confirmButton?.click();
    await waitForRoute();

    const db = await openCozyDB();
    expect((await db.getAll("tasks")).length).toBe(0);
    expect((await db.getAll("notes")).length).toBe(0);
    expect((await db.getAll("docs")).length).toBe(0);
    expect((await db.getAll("tagLibrary")).length).toBe(0);
    expect((await db.getAll("sessions")).length).toBe(0);
    expect((await db.getAll("stats")).length).toBe(0);
    expect((await db.getAll("settings")).length).toBe(0);
    db.close();
  });

  it("shows a status message after success", async () => {
    await seedAllStores();
    const { deleteButton } = await setupSettings();
    deleteButton.click();
    const confirmButton = document.querySelector<HTMLButtonElement>(
      "[data-testid=\"delete-confirm\"]"
    );
    confirmButton?.click();
    await waitFor(() => {
      const status = document.querySelector<HTMLDivElement>("[data-testid=\"delete-status\"]");
      const text = status?.textContent?.toLowerCase() ?? "";
      return text.includes("deleted");
    });

    const status = document.querySelector<HTMLDivElement>("[data-testid=\"delete-status\"]");
    expect(status?.textContent?.toLowerCase()).toContain("deleted");
  });

  it("resets pomodoro duration and media player state after confirm delete", async () => {
    document.body.innerHTML = "<div id=\"app\"></div>";
    const root = document.querySelector<HTMLDivElement>("#app");
    if (!root) {
      throw new Error("Missing #app root");
    }
    renderApp(root);

    await waitFor(() => Boolean(document.querySelector('[data-testid="pomodoro-time"]')));
    await waitFor(() => Boolean(document.querySelector('[data-testid="player-input"]')));

    const pomodoroTime = document.querySelector<HTMLElement>('[data-testid="pomodoro-time"]');
    const minutesEl = pomodoroTime?.querySelector<HTMLElement>('[data-role="minutes"]');
    const secondsEl = pomodoroTime?.querySelector<HTMLElement>('[data-role="seconds"]');
    if (!minutesEl || !secondsEl) {
      throw new Error("Missing pomodoro duration fields");
    }

    minutesEl.textContent = "30";
    secondsEl.textContent = "15";
    minutesEl.dispatchEvent(new Event("blur"));
    await waitForRoute();

    const playerInput = document.querySelector<HTMLInputElement>('[data-testid="player-input"]');
    const playerSave = document.querySelector<HTMLButtonElement>('[data-testid="player-save"]');
    if (!playerInput || !playerSave) {
      throw new Error("Missing player controls");
    }
    playerInput.value = "https://youtu.be/dQw4w9WgXcQ";
    playerSave.click();
    await waitFor(() => {
      const status = document.querySelector<HTMLElement>('[data-testid="player-status"]');
      return Boolean(status?.textContent?.toLowerCase().includes("playing"));
    });

    const navSettings = document.querySelector<HTMLElement>('[data-testid="nav-settings"]');
    if (!navSettings) {
      throw new Error("Missing Settings nav button");
    }
    navSettings.click();
    await waitForRoute();

    const deleteButton = document.querySelector<HTMLButtonElement>('[data-testid="data-delete"]');
    if (!deleteButton) {
      throw new Error("Missing Delete Data button");
    }
    deleteButton.click();

    const confirmButton = document.querySelector<HTMLButtonElement>(
      "[data-testid=\"delete-confirm\"]"
    );
    confirmButton?.click();
    await waitFor(() => {
      const status = document.querySelector<HTMLDivElement>("[data-testid=\"delete-status\"]");
      return Boolean(status?.textContent?.toLowerCase().includes("deleted"));
    });

    const navFocus = document.querySelector<HTMLElement>('[data-testid="nav-focus"]');
    if (!navFocus) {
      throw new Error("Missing Focus nav button");
    }
    navFocus.click();
    await waitForRoute();

    await waitFor(() => {
      const playerStatus = document.querySelector<HTMLElement>('[data-testid="player-status"]');
      return (
        minutesEl.textContent === "25" &&
        secondsEl.textContent === "00" &&
        playerInput.value === "" &&
        Boolean(playerStatus?.textContent?.includes("Ready"))
      );
    }, 50);

    expect(minutesEl.textContent).toBe("25");
    expect(secondsEl.textContent).toBe("00");
    expect(playerInput.value).toBe("");
    const playerStatus = document.querySelector<HTMLElement>('[data-testid="player-status"]');
    expect(playerStatus?.textContent).toContain("Ready");
  });
});
