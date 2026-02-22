import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { mountStreakView } from "../src/features/streak/streakView";
import { createStreakService } from "../src/features/streak/streakService";
import { addCompletedSession } from "../src/storage/sessionsRepo";
import { openCozyDB } from "../src/storage";
import { getLocalDayKey } from "../src/storage/dayKey";
import { appEvents } from "../src/ui/appEvents";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const dayKeyWithOffset = (offset: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return getLocalDayKey(date);
};

const seedSession = async (dbName: string, dayKey: string) => {
  const db = await openCozyDB(dbName);
  await addCompletedSession(db, {
    type: "focus",
    durationMs: 25 * 60 * 1000,
    startedAt: Date.now(),
    endedAt: Date.now(),
    dayKey
  });
  db.close();
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("streak service", () => {
  it("counts consecutive days when today is completed", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const yesterday = dayKeyWithOffset(-1);
    const twoDaysAgo = dayKeyWithOffset(-2);

    await seedSession(dbName, twoDaysAgo);
    await seedSession(dbName, yesterday);
    await seedSession(dbName, today);

    const service = createStreakService({ dbName });
    const info = await service.getStreakInfo(today);

    expect(info).toEqual({ count: 3, todayCompleted: true });

    await service.close();
    await deleteDB(dbName);
  });

  it("resets after a gap", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const twoDaysAgo = dayKeyWithOffset(-2);

    await seedSession(dbName, twoDaysAgo);
    await seedSession(dbName, today);

    const service = createStreakService({ dbName });
    const info = await service.getStreakInfo(today);

    expect(info).toEqual({ count: 1, todayCompleted: true });

    await service.close();
    await deleteDB(dbName);
  });

  it("returns 0 when today is empty and yesterday breaks the streak", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const twoDaysAgo = dayKeyWithOffset(-2);

    await seedSession(dbName, twoDaysAgo);

    const service = createStreakService({ dbName });
    const info = await service.getStreakInfo(today);

    expect(info).toEqual({ count: 0, todayCompleted: false });

    await service.close();
    await deleteDB(dbName);
  });

  it("does not count retroactive notes or docs as streak activity", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const yesterday = dayKeyWithOffset(-1);
    const twoDaysAgo = dayKeyWithOffset(-2);

    await seedSession(dbName, twoDaysAgo);

    const db = await openCozyDB(dbName);
    const now = Date.now();
    await db.put("notes", {
      id: uuidv4(),
      dayKey: yesterday,
      content: "Backfilled note",
      createdAt: now,
      updatedAt: now
    });
    await db.put("docs", {
      id: uuidv4(),
      dayKey: yesterday,
      title: "Backfilled doc",
      markdown: "retroactive content",
      tags: [],
      createdAt: now,
      updatedAt: now
    });
    db.close();

    const service = createStreakService({ dbName });
    const info = await service.getStreakInfo(today);

    expect(info).toEqual({ count: 0, todayCompleted: false });

    await service.close();
    await deleteDB(dbName);
  });
});

describe("streak badge", () => {
  it("dims when user has streak but has not completed today", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const yesterday = dayKeyWithOffset(-1);
    const twoDaysAgo = dayKeyWithOffset(-2);

    await seedSession(dbName, twoDaysAgo);
    await seedSession(dbName, yesterday);

    const root = document.createElement("div");
    root.className = "streak-pill";
    root.dataset.testid = "streak-badge";
    document.body.appendChild(root);

    const view = await mountStreakView(root, { dbName, dayKey: today });
    await flushPromises();

    const count = root.querySelector<HTMLElement>("[data-testid='streak-count']");
    if (!count) {
      throw new Error("Missing streak count element");
    }

    expect(root.classList.contains("streak--dim")).toBe(true);
    expect(count.textContent).toBe("2");

    await view.destroy();
    await deleteDB(dbName);
  });

  it("updates on session completion", async () => {
    const dbName = `cozyfocus-streak-${uuidv4()}`;
    const today = dayKeyWithOffset(0);
    const yesterday = dayKeyWithOffset(-1);

    await seedSession(dbName, yesterday);

    const root = document.createElement("div");
    root.className = "streak-pill";
    root.dataset.testid = "streak-badge";
    document.body.appendChild(root);

    const view = await mountStreakView(root, { dbName, dayKey: today });
    await flushPromises();

    const count = root.querySelector<HTMLElement>("[data-testid='streak-count']");
    if (!count) {
      throw new Error("Missing streak count element");
    }

    expect(count.textContent).toBe("1");
    expect(root.classList.contains("streak--dim")).toBe(true);

    await seedSession(dbName, today);
    appEvents.emit("sessionCompleted", { dayKey: today, type: "focus" });
    await flushPromises();

    expect(count.textContent).toBe("2");
    expect(root.classList.contains("streak--dim")).toBe(false);

    await view.destroy();
    await deleteDB(dbName);
  });
});
