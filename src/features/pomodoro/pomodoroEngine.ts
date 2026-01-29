import type { SessionType } from "../../types";

export const POMODORO_DURATIONS_MS: Record<SessionType, number> = {
  focus: 25 * 60 * 1000,
  shortBreak: 5 * 60 * 1000,
  longBreak: 15 * 60 * 1000
};

const TICK_INTERVAL_MS = 250;

export type PomodoroStatus = "idle" | "running" | "paused";

export interface PomodoroSnapshot {
  mode: SessionType;
  status: PomodoroStatus;
  durationMs: number;
  remainingMs: number;
  startedAt: number | null;
  targetEndAt: number | null;
}

export interface PomodoroCompletion {
  mode: SessionType;
  durationMs: number;
  startedAt: number;
  endedAt: number;
}

type PomodoroEvent = "tick" | "state" | "completed";

type PomodoroListener = (snapshot: PomodoroSnapshot) => void;
type PomodoroCompletionListener = (completion: PomodoroCompletion) => void;

type ListenersMap = {
  tick: Set<PomodoroListener>;
  state: Set<PomodoroListener>;
  completed: Set<PomodoroCompletionListener>;
};

interface PomodoroEngineOptions {
  durations?: Partial<Record<SessionType, number>>;
  now?: () => number;
}

export class PomodoroEngine {
  private durations: Record<SessionType, number>;
  private readonly now: () => number;
  private listeners: ListenersMap = {
    tick: new Set(),
    state: new Set(),
    completed: new Set()
  };
  private status: PomodoroStatus = "idle";
  private mode: SessionType = "focus";
  private remainingMs: number;
  private startedAt: number | null = null;
  private targetEndAt: number | null = null;
  private tickIntervalId: number | null = null;
  private completionTimeoutId: number | null = null;

  constructor(options: PomodoroEngineOptions = {}) {
    this.durations = {
      ...POMODORO_DURATIONS_MS,
      ...options.durations
    };
    this.now = options.now ?? (() => Date.now());
    this.remainingMs = this.durations[this.mode];
  }

  on(event: "tick" | "state", listener: PomodoroListener): () => void;
  on(event: "completed", listener: PomodoroCompletionListener): () => void;
  on(event: PomodoroEvent, listener: PomodoroListener | PomodoroCompletionListener): () => void {
    const set = this.listeners[event] as Set<PomodoroListener | PomodoroCompletionListener>;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  getSnapshot(): PomodoroSnapshot {
    const durationMs = this.durations[this.mode];
    let remainingMs = this.remainingMs;

    if (this.status === "running" && this.targetEndAt !== null) {
      remainingMs = Math.max(0, this.targetEndAt - this.now());
    }

    return {
      mode: this.mode,
      status: this.status,
      durationMs,
      remainingMs,
      startedAt: this.startedAt,
      targetEndAt: this.targetEndAt
    };
  }

  setMode(mode: SessionType): void {
    if (this.status === "running") {
      return;
    }
    this.mode = mode;
    this.reset();
  }

  setDuration(mode: SessionType, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return;
    }
    this.durations[mode] = durationMs;
    if (this.mode === mode && this.status !== "running") {
      this.remainingMs = durationMs;
      this.emitState();
      this.emitTick();
    }
  }

  start(): void {
    if (this.status === "running") {
      return;
    }
    const now = this.now();
    const durationMs = this.durations[this.mode];
    if (this.remainingMs <= 0 || this.remainingMs > durationMs) {
      this.remainingMs = durationMs;
    }
    if (this.startedAt === null) {
      this.startedAt = now;
    }
    this.targetEndAt = now + this.remainingMs;
    this.status = "running";
    this.emitState();
    this.emitTick();
    this.startTimers();
  }

  pause(): void {
    if (this.status !== "running") {
      return;
    }
    const now = this.now();
    if (this.targetEndAt !== null) {
      this.remainingMs = Math.max(0, this.targetEndAt - now);
    }
    this.status = "paused";
    this.targetEndAt = null;
    this.stopTimers();
    this.emitState();
    this.emitTick();
  }

  reset(): void {
    this.stopTimers();
    this.status = "idle";
    this.startedAt = null;
    this.targetEndAt = null;
    this.remainingMs = this.durations[this.mode];
    this.emitState();
    this.emitTick();
  }

  sync(): void {
    if (this.status === "running") {
      this.tick();
      return;
    }
    this.emitTick();
  }

  destroy(): void {
    this.stopTimers();
    this.listeners = {
      tick: new Set(),
      state: new Set(),
      completed: new Set()
    };
  }

  private startTimers(): void {
    this.stopTimers();
    this.tickIntervalId = window.setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

    if (this.targetEndAt !== null) {
      const delay = Math.max(0, this.targetEndAt - this.now());
      this.completionTimeoutId = window.setTimeout(() => {
        this.tick();
      }, delay);
    }
  }

  private stopTimers(): void {
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.completionTimeoutId !== null) {
      window.clearTimeout(this.completionTimeoutId);
      this.completionTimeoutId = null;
    }
  }

  private tick(): void {
    if (this.status !== "running") {
      return;
    }
    if (this.targetEndAt === null) {
      this.emitTick();
      return;
    }
    const remaining = Math.max(0, this.targetEndAt - this.now());
    this.remainingMs = remaining;
    if (remaining <= 0) {
      this.complete();
      return;
    }
    this.emitTick();
  }

  private complete(): void {
    const endedAt = this.now();
    const durationMs = this.durations[this.mode];
    const startedAt = this.startedAt ?? Math.max(endedAt - durationMs, 0);
    const completion: PomodoroCompletion = {
      mode: this.mode,
      durationMs,
      startedAt,
      endedAt
    };

    this.stopTimers();
    this.status = "idle";
    this.remainingMs = durationMs;
    this.startedAt = null;
    this.targetEndAt = null;
    this.emitTick();
    this.emitState();

    this.listeners.completed.forEach((listener) => {
      listener(completion);
    });
  }

  private emitTick(): void {
    const snapshot = this.getSnapshot();
    this.listeners.tick.forEach((listener) => listener(snapshot));
  }

  private emitState(): void {
    const snapshot = this.getSnapshot();
    this.listeners.state.forEach((listener) => listener(snapshot));
  }
}

export const createPomodoroEngine = (options?: PomodoroEngineOptions): PomodoroEngine => {
  return new PomodoroEngine(options);
};
