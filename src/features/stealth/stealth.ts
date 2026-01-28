export const STEALTH_CLASS = "stealth";
export const POMODORO_COMPLETED_EVENT = "pomodoro:completed";

export interface StealthHandle {
  destroy: () => void;
}

export const dispatchPomodoroCompleted = (detail?: unknown): void => {
  document.dispatchEvent(new CustomEvent(POMODORO_COMPLETED_EVENT, { detail }));
};

export const mountStealth = (toggle: HTMLButtonElement): StealthHandle => {
  let isStealth = false;
  let mouseListener: ((event: MouseEvent) => void) | null = null;
  let pomodoroListener: ((event: Event) => void) | null = null;

  const removeListeners = () => {
    if (mouseListener) {
      document.removeEventListener("mousemove", mouseListener);
      mouseListener = null;
    }
    if (pomodoroListener) {
      document.removeEventListener(POMODORO_COMPLETED_EVENT, pomodoroListener);
      pomodoroListener = null;
    }
  };

  const disableStealth = () => {
    if (!isStealth) {
      return;
    }
    isStealth = false;
    document.body.classList.remove(STEALTH_CLASS);
    removeListeners();
  };

  const enableStealth = () => {
    if (isStealth) {
      return;
    }
    isStealth = true;
    document.body.classList.add(STEALTH_CLASS);

    mouseListener = () => {
      disableStealth();
    };
    pomodoroListener = () => {
      disableStealth();
    };

    document.addEventListener("mousemove", mouseListener, { once: true });
    document.addEventListener(POMODORO_COMPLETED_EVENT, pomodoroListener, { once: true });
  };

  const onToggleClick = () => {
    if (isStealth) {
      disableStealth();
    } else {
      enableStealth();
    }
  };

  toggle.addEventListener("click", onToggleClick);

  return {
    destroy: () => {
      toggle.removeEventListener("click", onToggleClick);
      disableStealth();
    }
  };
};
