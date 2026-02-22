import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it, vi, afterEach } from "vitest";
import { createPomodoroEngine } from "../src/features/pomodoro/pomodoroEngine";
import { createPomodoroService } from "../src/features/pomodoro/pomodoroService";
import { mountPomodoroView } from "../src/features/pomodoro/pomodoroView";
import type { PomodoroService } from "../src/features/pomodoro/pomodoroService";
import { openCozyDB } from "../src/storage";
import { getLocalDayKey } from "../src/storage/dayKey";
import type { DayStatsRecord, SessionRecord } from "../src/storage/db";
import { POMODORO_DURATIONS_MS } from "../src/features/pomodoro/pomodoroEngine";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const waitFor = async (check: () => boolean, attempts = 20) => {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) {
      return;
    }
    await flushPromises();
  }
};

afterEach(() => {
  vi.useRealTimers();
});

describe("pomodoro", () => {
  it("engine computes remaining based on targetEndAt even after time jump", () => {
    vi.useFakeTimers();
    const baseTime = new Date("2025-01-01T00:00:00Z");
    vi.setSystemTime(baseTime);

    const engine = createPomodoroEngine({
      durations: { focus: 10000, shortBreak: 1000, longBreak: 1000 }
    });

    engine.setMode("focus");
    engine.start();

    expect(engine.getSnapshot().remainingMs).toBe(10000);

    vi.setSystemTime(new Date(baseTime.getTime() + 7000));
    engine.sync();

    expect(engine.getSnapshot().remainingMs).toBe(3000);
    engine.destroy();
  });

  it("completing a session writes session record and updates stats", async () => {
    const dbName = `cozyfocus-pomodoro-test-${uuidv4()}`;
    const service = createPomodoroService({ dbName });

    const now = Date.now();
    const dayKey = getLocalDayKey(new Date(now));

    await service.recordSession({
      type: "focus",
      durationMs: 1500000,
      startedAt: now - 1500000,
      endedAt: now,
      dayKey
    });

    const db = await openCozyDB(dbName);
    const sessions = await db.getAllFromIndex("sessions", "dayKey", dayKey);
    const stats = await db.get("stats", dayKey);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.type).toBe("focus");
    expect(stats?.focusCompletedCount).toBe(1);
    expect(stats?.totalFocusMs).toBe(1500000);

    db.close();
    await service.close();
    await deleteDB(dbName);
  });

  it("notifies on completion", async () => {
    vi.useFakeTimers();
    const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
    const originalNotification = globalThis.Notification;
    const originalAudio = globalThis.Audio;

    class MockNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = vi.fn().mockResolvedValue("granted");
      title: string;
      options?: NotificationOptions;

      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.options = options;
        notifications.push({ title, options });
      }
    }

    // @ts-expect-error - test override.
    globalThis.Notification = MockNotification;
    // @ts-expect-error - avoid jsdom media playback side effects in unit tests.
    globalThis.Audio = undefined;

    const root = document.createElement("section");
    root.dataset.testid = "pomodoro";
    document.body.innerHTML = "";
    document.body.appendChild(root);

    const dayKey = getLocalDayKey();
    const session: SessionRecord = {
      id: "session-1",
      dayKey,
      type: "focus",
      durationMs: 1000,
      startedAt: Date.now(),
      endedAt: Date.now(),
      completed: true
    };
    const emptyStats: DayStatsRecord = {
      dayKey,
      focusCompletedCount: 0,
      shortBreakCompletedCount: 0,
      longBreakCompletedCount: 0,
      totalFocusMs: 0,
      totalBreakMs: 0
    };

    const service: PomodoroService = {
      getStats: async () => emptyStats,
      getDefaults: async () => ({
        focus: 1000,
        shortBreak: 1000,
        longBreak: 1000,
        updatedAt: Date.now()
      }),
      saveDefaults: async (defaults) => defaults,
      recordSession: vi.fn().mockResolvedValue({ session, stats: emptyStats }),
      close: async () => {}
    };

    const engine = createPomodoroEngine({
      durations: { focus: 1000, shortBreak: 1000, longBreak: 1000 }
    });

    const view = await mountPomodoroView(root, {
      dayKey,
      service,
      engine
    });

    const startButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-start"]'
    );
    if (!startButton) {
      throw new Error("Missing start button");
    }

    startButton.click();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => notifications.length === 1);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe("Session complete");

    await view.destroy();

    // @ts-expect-error - restore original.
    globalThis.Notification = originalNotification;
    // @ts-expect-error - restore original.
    globalThis.Audio = originalAudio;
  });
});
