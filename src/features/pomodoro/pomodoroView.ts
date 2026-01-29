import type { DayStatsRecord } from "../../storage/db";
import { getLocalDayKey } from "../../storage/dayKey";
import { qs } from "../../ui/dom";
import type { PomodoroDefaultsSetting, SessionType } from "../../types";
import {
  createPomodoroEngine,
  type PomodoroCompletion,
  type PomodoroSnapshot,
  POMODORO_DURATIONS_MS
} from "./pomodoroEngine";
import { createPomodoroService, type PomodoroService } from "./pomodoroService";
import {
  ensureNotificationPermission,
  notify,
  playCompletionSound
} from "../notifications/notify";
import { onVisibilityChange } from "../visibility/visibility";
import { dispatchPomodoroCompleted } from "../stealth/stealth";
import { appEvents } from "../../ui/appEvents";

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const modeLabels: Record<SessionType, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break"
};

interface PomodoroViewOptions {
  dayKey?: string;
  dbName?: string;
  service?: PomodoroService;
  engine?: ReturnType<typeof createPomodoroEngine>;
}

export interface PomodoroViewHandle {
  refreshStats: () => Promise<void>;
  destroy: () => Promise<void>;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const totalSessionsForDay = (stats: DayStatsRecord | null): number => {
  if (!stats) {
    return 0;
  }
  return (
    stats.focusCompletedCount +
    stats.shortBreakCompletedCount +
    stats.longBreakCompletedCount
  );
};

const renderDots = (dots: HTMLElement[], overflowEl: HTMLElement, count: number): void => {
  dots.forEach((dot, index) => {
    if (index < count) {
      dot.classList.add("is-active");
    } else {
      dot.classList.remove("is-active");
    }
  });

  const overflow = Math.max(0, count - dots.length);
  if (overflow > 0) {
    overflowEl.textContent = `+${overflow}`;
    overflowEl.classList.add("is-active");
    overflowEl.classList.remove("is-hidden");
  } else {
    overflowEl.textContent = "";
    overflowEl.classList.remove("is-active");
    overflowEl.classList.add("is-hidden");
  }
};

const updateRing = (progressCircle: SVGCircleElement, snapshot: PomodoroSnapshot) => {
  const fraction = snapshot.durationMs > 0 ? snapshot.remainingMs / snapshot.durationMs : 0;
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(Math.max(fraction, 0), 1));
  progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progressCircle.style.strokeDashoffset = `${offset}`;
};

const updateControls = (
  snapshot: PomodoroSnapshot,
  startButton: HTMLButtonElement,
  pauseButton: HTMLButtonElement
) => {
  startButton.disabled = snapshot.status === "running";
  pauseButton.disabled = snapshot.status !== "running";
};

const updateModeButtons = (
  root: HTMLElement,
  mode: SessionType
) => {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-mode]");
  buttons.forEach((button) => {
    if (button.dataset.mode === mode) {
      button.classList.add("is-active");
    } else {
      button.classList.remove("is-active");
    }
  });
};

const updateHeading = (
  title: HTMLElement,
  subtitle: HTMLElement,
  snapshot: PomodoroSnapshot
) => {
  const totalSeconds = Math.max(0, Math.round(snapshot.durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const durationLabel = seconds === 0 ? `${minutes}-minute` : `${minutes}:${seconds.toString().padStart(2, "0")}`;
  if (snapshot.mode === "focus") {
    title.textContent = `Ready for a calm ${durationLabel} focus?`;
    subtitle.textContent = "Eliminate distractions and find your flow.";
    return;
  }

  title.textContent = `Time for a ${modeLabels[snapshot.mode].toLowerCase()}.`;
  subtitle.textContent = `Recharge with a ${durationLabel} pause.`;
};

const updateDisplay = (
  snapshot: PomodoroSnapshot,
  timeEl: HTMLElement,
  labelEl: HTMLElement
) => {
  const formatted = formatTime(snapshot.remainingMs);
  const minutesEl = timeEl.querySelector<HTMLElement>('[data-role="minutes"]');
  const secondsEl = timeEl.querySelector<HTMLElement>('[data-role="seconds"]');
  if (minutesEl && secondsEl) {
    const [minutes, seconds] = formatted.split(":");
    minutesEl.textContent = minutes ?? "00";
    secondsEl.textContent = seconds ?? "00";
  } else {
    timeEl.textContent = formatted;
  }
  labelEl.textContent = modeLabels[snapshot.mode].toUpperCase();
};

const formatDurationInput = (ms: number): { minutes: string; seconds: string } => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return { minutes, seconds };
};

const parseDurationInput = (
  minutesValue: string,
  secondsValue: string,
  fallbackMs: number
): number => {
  const rawMinutes = minutesValue.trim();
  if (!rawMinutes) {
    return fallbackMs;
  }
  const minutes = Number.parseInt(rawMinutes, 10);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return fallbackMs;
  }
  const seconds = Number.parseInt(secondsValue.trim() || "0", 10);
  const clampedSeconds = Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 59) : 0;
  const totalSeconds = minutes * 60 + clampedSeconds;
  if (totalSeconds <= 0) {
    return fallbackMs;
  }
  return totalSeconds * 1000;
};

export const mountPomodoroView = async (
  root: HTMLElement,
  options: PomodoroViewOptions = {}
): Promise<PomodoroViewHandle> => {
  root.innerHTML = `
    <div class="center-heading">
      <h2 data-testid="pomodoro-title">Ready for a calm 25-minute focus?</h2>
      <p data-testid="pomodoro-subtitle">Eliminate distractions and find your flow.</p>
    </div>

    <div class="card center-card">
      <div class="center-glow"></div>
      <div class="session-toggle" data-testid="pomodoro-modes">
        <button class="is-active" data-mode="focus" data-testid="pomodoro-mode-focus">Focus</button>
        <button data-mode="shortBreak" data-testid="pomodoro-mode-short">Short Break</button>
        <button data-mode="longBreak" data-testid="pomodoro-mode-long">Long Break</button>
      </div>
      <div class="timer-ring">
        <svg viewBox="0 0 100 100">
          <circle class="track" cx="50" cy="50" r="46"></circle>
          <circle class="progress" cx="50" cy="50" r="46" data-testid="pomodoro-progress"></circle>
        </svg>
        <div class="timer-display">
          <span data-testid="pomodoro-time">
            <span data-role="minutes" contenteditable="true">25</span>:<span data-role="seconds" contenteditable="true">00</span>
          </span>
          <span data-testid="pomodoro-label">FOCUS</span>
        </div>
      </div>
      <div class="center-actions">
        <button class="icon-btn" aria-label="Reset" data-testid="pomodoro-reset">Reset</button>
        <button class="primary-btn" data-testid="pomodoro-start">Start</button>
        <button class="icon-btn" aria-label="Pause" data-testid="pomodoro-pause">Pause</button>
      </div>
    </div>

    <div class="session-dots" data-testid="pomodoro-dots">
      <span>Today's Sessions</span>
      <span class="dot" data-role="dot"></span>
      <span class="dot" data-role="dot"></span>
      <span class="dot" data-role="dot"></span>
      <span class="dot" data-role="dot"></span>
      <span class="dot dot-overflow is-hidden" data-role="overflow"></span>
    </div>
  `;

  const service = options.service ?? createPomodoroService({ dbName: options.dbName });
  const engine = options.engine ?? createPomodoroEngine();
  const dayKey = options.dayKey ?? getLocalDayKey();

  const title = qs<HTMLElement>(root, "pomodoro-title");
  const subtitle = qs<HTMLElement>(root, "pomodoro-subtitle");
  const timeEl = qs<HTMLElement>(root, "pomodoro-time");
  const labelEl = qs<HTMLElement>(root, "pomodoro-label");
  const minutesEl = timeEl.querySelector<HTMLElement>('[data-role="minutes"]');
  const secondsEl = timeEl.querySelector<HTMLElement>('[data-role="seconds"]');
  if (!minutesEl || !secondsEl) {
    throw new Error("Missing pomodoro time fields");
  }
  const startButton = qs<HTMLButtonElement>(root, "pomodoro-start");
  const pauseButton = qs<HTMLButtonElement>(root, "pomodoro-pause");
  const resetButton = qs<HTMLButtonElement>(root, "pomodoro-reset");
  const progressCircle = qs<SVGCircleElement>(root, "pomodoro-progress");
  const dots = Array.from(root.querySelectorAll<HTMLElement>(".session-dots [data-role='dot']"));
  const overflowDot = root.querySelector<HTMLElement>(".session-dots [data-role='overflow']");
  if (!overflowDot) {
    throw new Error("Missing pomodoro overflow dot");
  }

  let defaults: PomodoroDefaultsSetting = {
    focus: POMODORO_DURATIONS_MS.focus,
    shortBreak: POMODORO_DURATIONS_MS.shortBreak,
    longBreak: POMODORO_DURATIONS_MS.longBreak,
    updatedAt: Date.now()
  };

  const updateSnapshot = (snapshot: PomodoroSnapshot) => {
    updateDisplay(snapshot, timeEl, labelEl);
    updateRing(progressCircle, snapshot);
    updateControls(snapshot, startButton, pauseButton);
    updateModeButtons(root, snapshot.mode);
    updateHeading(title, subtitle, snapshot);
    const isEditable = snapshot.status === "idle";
    minutesEl.contentEditable = isEditable ? "true" : "false";
    secondsEl.contentEditable = isEditable ? "true" : "false";
    if (
      snapshot.status === "idle" &&
      document.activeElement !== minutesEl &&
      document.activeElement !== secondsEl
    ) {
      const { minutes, seconds } = formatDurationInput(snapshot.durationMs);
      minutesEl.textContent = minutes;
      secondsEl.textContent = seconds;
    }
  };

  const updateStats = async () => {
    const stats = await service.getStats(dayKey);
    renderDots(dots, overflowDot, totalSessionsForDay(stats));
  };

  const handleCompletion = async (completion: PomodoroCompletion) => {
    dispatchPomodoroCompleted(completion);
    await service.recordSession({
      type: completion.mode,
      durationMs: completion.durationMs,
      startedAt: completion.startedAt,
      endedAt: completion.endedAt,
      dayKey: getLocalDayKey(new Date(completion.endedAt))
    });
    appEvents.emit("sessionCompleted", {
      dayKey: getLocalDayKey(new Date(completion.endedAt)),
      type: completion.mode
    });
    await updateStats();
    notify("Session complete", {
      body: `${modeLabels[completion.mode]} finished. Take a breath.`
    });
    playCompletionSound();
  };

  const onStart = async () => {
    await ensureNotificationPermission();
    engine.start();
  };

  const onPause = () => {
    engine.pause();
  };

  const onReset = () => {
    engine.reset();
  };

  startButton.addEventListener("click", () => {
    void onStart();
  });
  pauseButton.addEventListener("click", onPause);
  resetButton.addEventListener("click", onReset);

  const persistDefaults = async () => {
    defaults.updatedAt = Date.now();
    await service.saveDefaults({ ...defaults });
  };

  const applyDurationChange = async () => {
    if (engine.getSnapshot().status !== "idle") {
      return;
    }
    const snapshot = engine.getSnapshot();
    const newDuration = parseDurationInput(
      minutesEl.textContent ?? "",
      secondsEl.textContent ?? "",
      snapshot.durationMs
    );
    const normalized = formatDurationInput(newDuration);
    minutesEl.textContent = normalized.minutes;
    secondsEl.textContent = normalized.seconds;
    if (snapshot.mode === "focus") {
      defaults.focus = newDuration;
    } else if (snapshot.mode === "shortBreak") {
      defaults.shortBreak = newDuration;
    } else {
      defaults.longBreak = newDuration;
    }
    engine.setDuration(snapshot.mode, newDuration);
    await persistDefaults();
  };

  const sanitizeField = (field: HTMLElement, maxLength?: number) => {
    const digits = (field.textContent ?? "").replace(/\D+/g, "");
    const trimmed = maxLength ? digits.slice(0, maxLength) : digits;
    if ((field.textContent ?? "") !== trimmed) {
      field.textContent = trimmed;
    }
  };

  const handleBlur = () => {
    void applyDurationChange();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void applyDurationChange();
      return;
    }
    if (event.key.length === 1 && !/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  minutesEl.addEventListener("input", () => sanitizeField(minutesEl));
  secondsEl.addEventListener("input", () => sanitizeField(secondsEl, 2));
  minutesEl.addEventListener("blur", handleBlur);
  secondsEl.addEventListener("blur", handleBlur);
  minutesEl.addEventListener("keydown", handleKeydown);
  secondsEl.addEventListener("keydown", handleKeydown);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-mode]");
    if (!button?.dataset.mode) {
      return;
    }
    const mode = button.dataset.mode as SessionType;
    engine.setMode(mode);
  });

  const unsubscribeTick = engine.on("tick", updateSnapshot);
  const unsubscribeState = engine.on("state", updateSnapshot);
  const unsubscribeComplete = engine.on("completed", (completion) => {
    void handleCompletion(completion);
  });

  const stopVisibilityListener = onVisibilityChange((state) => {
    if (state === "visible") {
      engine.sync();
    }
  });

  defaults = await service.getDefaults();
  engine.setDuration("focus", defaults.focus);
  engine.setDuration("shortBreak", defaults.shortBreak);
  engine.setDuration("longBreak", defaults.longBreak);

  updateSnapshot(engine.getSnapshot());
  updateRing(progressCircle, engine.getSnapshot());
  await updateStats();

  return {
    refreshStats: updateStats,
    destroy: async () => {
      stopVisibilityListener();
      unsubscribeTick();
      unsubscribeState();
      unsubscribeComplete();
      engine.destroy();
      await service.close();
      root.innerHTML = "";
    }
  };
};
