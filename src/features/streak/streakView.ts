import { getLocalDayKey } from "../../storage/dayKey";
import { qs } from "../../ui/dom";
import { appEvents } from "../../ui/appEvents";
import { createStreakService, type StreakService } from "./streakService";

interface StreakViewOptions {
  dayKey?: string;
  dbName?: string;
  service?: StreakService;
}

export interface StreakViewHandle {
  refresh: () => Promise<void>;
  destroy: () => Promise<void>;
}

export const mountStreakView = async (
  root: HTMLElement,
  options: StreakViewOptions = {}
): Promise<StreakViewHandle> => {
  root.innerHTML = `
    <span class="streak-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" role="img" aria-label="Streak">
        <path
          d="M12 3c.6 1.7.4 2.9-.4 4.3-.6 1-1.2 1.9-1.2 3.1 0 1.6 1.3 3 3 3 1.5 0 2.7-1.1 2.9-2.6 1.8 1 3 2.9 3 5.1 0 3.3-2.7 6-6 6s-6-2.7-6-6c0-2.7 1.6-4.9 3.9-5.7-.3 1.1-.1 2 .4 2.8.5.7 1.4 1.2 2.3 1.2 1.7 0 3-1.3 3-3 0-1.9-1.2-3.1-3-4.2z"
          fill="currentColor"
        />
      </svg>
    </span>
    <span class="streak-count" data-testid="streak-count">0</span>
  `;

  const service = options.service ?? createStreakService({ dbName: options.dbName });
  const dayKey = options.dayKey ?? getLocalDayKey();
  const countEl = qs<HTMLElement>(root, "streak-count");
  let currentCount = 0;
  let currentTodayCompleted = false;
  let isActive = true;
  let pendingRefresh: Promise<void> | null = null;

  const applyState = (count: number, todayCompleted: boolean) => {
    currentCount = count;
    currentTodayCompleted = todayCompleted;
    countEl.textContent = `${count}`;
    if (count > 0 && !todayCompleted) {
      root.classList.add("streak--dim");
    } else {
      root.classList.remove("streak--dim");
    }
  };

  const refresh = async () => {
    if (!isActive) {
      return;
    }
    const task = (async () => {
      try {
        const info = await service.getStreakInfo(dayKey);
        if (!isActive) {
          return;
        }
        // When count is 0, keep the badge normal (no dim state).
        applyState(info.count, info.todayCompleted);
      } catch (error) {
        if (!isActive) {
          return;
        }
        throw error;
      } finally {
        if (pendingRefresh === task) {
          pendingRefresh = null;
        }
      }
    })();
    pendingRefresh = task;
    await task;
  };

  const unsubscribe = appEvents.on("sessionCompleted", (detail) => {
    if (detail.dayKey !== dayKey) {
      return;
    }
    if (!currentTodayCompleted) {
      applyState(currentCount + 1, true);
    }
    void refresh();
  });

  await refresh();

  return {
    refresh,
    destroy: async () => {
      isActive = false;
      unsubscribe();
      if (pendingRefresh) {
        await pendingRefresh.catch(() => {});
      }
      await service.close();
      root.innerHTML = "";
    }
  };
};
