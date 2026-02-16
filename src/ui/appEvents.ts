import type { SessionType } from "../types";

export interface SessionCompletedPayload {
  dayKey: string;
  type: SessionType;
}

export interface DataChangedPayload {
  reason: "delete" | "import";
}

type AppEventPayloads = {
  sessionCompleted: SessionCompletedPayload;
  dataChanged: DataChangedPayload;
};

type AppEventHandler<K extends keyof AppEventPayloads> = (detail: AppEventPayloads[K]) => void;

const listeners = new Map<keyof AppEventPayloads, Set<AppEventHandler<keyof AppEventPayloads>>>();

export const appEvents = {
  emit: <K extends keyof AppEventPayloads>(type: K, detail: AppEventPayloads[K]): void => {
    const set = listeners.get(type);
    if (!set) {
      return;
    }
    set.forEach((handler) => {
      handler(detail);
    });
  },
  on: <K extends keyof AppEventPayloads>(type: K, handler: AppEventHandler<K>): (() => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(handler as AppEventHandler<keyof AppEventPayloads>);
    listeners.set(type, set);
    return () => {
      const current = listeners.get(type);
      if (!current) {
        return;
      }
      current.delete(handler as AppEventHandler<keyof AppEventPayloads>);
      if (current.size === 0) {
        listeners.delete(type);
      }
    };
  }
};
