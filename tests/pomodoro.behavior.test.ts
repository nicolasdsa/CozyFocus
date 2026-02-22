import { v4 as uuidv4 } from 'uuid';
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playSoundNTimes } from "../src/features/notifications/notify";
import { createPomodoroEngine } from "../src/features/pomodoro/pomodoroEngine";
import { mountPomodoroView } from "../src/features/pomodoro/pomodoroView";
import type { PomodoroService } from "../src/features/pomodoro/pomodoroService";
import type { DayStatsRecord, SessionRecord } from "../src/storage/db";
import { getLocalDayKey } from "../src/storage/dayKey";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("pomodoro behavior", () => {
  it("plays completion sound 5 times", async () => {
    class MockAudio extends EventTarget {
      currentTime = 0;
      play = vi.fn().mockResolvedValue(undefined);
    }

    const audio = new MockAudio();
    const playback = playSoundNTimes(audio as unknown as HTMLAudioElement, 5, 0);

    expect(audio.play).toHaveBeenCalledTimes(1);
    audio.dispatchEvent(new Event("ended"));
    await flushPromises();

    expect(audio.play).toHaveBeenCalledTimes(2);
    audio.dispatchEvent(new Event("ended"));
    await flushPromises();

    expect(audio.play).toHaveBeenCalledTimes(3);
    audio.dispatchEvent(new Event("ended"));
    await flushPromises();

    expect(audio.play).toHaveBeenCalledTimes(4);
    audio.dispatchEvent(new Event("ended"));
    await flushPromises();

    expect(audio.play).toHaveBeenCalledTimes(5);
    audio.dispatchEvent(new Event("ended"));
    await playback;
  });

  it("after completion resets to default duration", async () => {
    vi.useFakeTimers();
    const originalAudio = globalThis.Audio;
    // @ts-expect-error - avoid jsdom media playback side effects in unit tests.
    globalThis.Audio = undefined;
    const root = document.createElement("section");
    document.body.innerHTML = "";
    document.body.appendChild(root);

    const dayKey = getLocalDayKey();
    const session: SessionRecord = {
      id: "session-1",
      dayKey,
      type: "focus",
      durationMs: 25 * 60 * 1000,
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
        focus: 25 * 60 * 1000,
        shortBreak: 5 * 60 * 1000,
        longBreak: 15 * 60 * 1000,
        updatedAt: Date.now()
      }),
      saveDefaults: async (defaults) => defaults,
      recordSession: vi.fn().mockResolvedValue({ session, stats: emptyStats }),
      close: async () => {}
    };

    const engine = createPomodoroEngine();
    const view = await mountPomodoroView(root, {
      dayKey,
      service,
      engine
    });

    const startButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-start"]'
    );
    const timeEl = root.querySelector<HTMLElement>('[data-testid="pomodoro-time"]');
    if (!startButton || !timeEl) {
      throw new Error("Missing pomodoro elements");
    }

    startButton.click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    await flushPromises();

    expect(timeEl.textContent?.replace(/\s+/g, "")).toBe("25:00");

    await view.destroy();
    // @ts-expect-error - restore original.
    globalThis.Audio = originalAudio;
  }, 10000);

  it("editing duration updates heading and persists as default", async () => {
    const dbName = `cozyfocus-pomodoro-defaults-${uuidv4()}`;
    const root = document.createElement("section");
    document.body.innerHTML = "";
    document.body.appendChild(root);

    const view = await mountPomodoroView(root, { dbName });
    const durationInput = root.querySelector<HTMLElement>('[data-testid="pomodoro-time"]');
    const title = root.querySelector<HTMLElement>('[data-testid="pomodoro-title"]');
    if (!durationInput || !title) {
      throw new Error("Missing pomodoro duration input");
    }

    const minutesEl = durationInput.querySelector<HTMLElement>('[data-role="minutes"]');
    const secondsEl = durationInput.querySelector<HTMLElement>('[data-role="seconds"]');
    if (!minutesEl || !secondsEl) {
      throw new Error("Missing pomodoro time fields");
    }

    minutesEl.textContent = "30";
    secondsEl.textContent = "15";
    minutesEl.dispatchEvent(new Event("blur"));
    await flushPromises();

    expect(title.textContent).toBe("Ready for a calm 30:15 focus?");

    await view.destroy();

    const rootReload = document.createElement("section");
    document.body.innerHTML = "";
    document.body.appendChild(rootReload);
    const viewReload = await mountPomodoroView(rootReload, { dbName });

    const durationReload = rootReload.querySelector<HTMLElement>(
      '[data-testid="pomodoro-time"]'
    );
    if (!durationReload) {
      throw new Error("Missing pomodoro duration input");
    }

    const minutesReload = durationReload.querySelector<HTMLElement>('[data-role="minutes"]');
    const secondsReload = durationReload.querySelector<HTMLElement>('[data-role="seconds"]');
    if (!minutesReload || !secondsReload) {
      throw new Error("Missing pomodoro time fields");
    }

    expect(minutesReload.textContent).toBe("30");
    expect(secondsReload.textContent).toBe("15");

    await viewReload.destroy();
    await deleteDB(dbName);
  });
});
