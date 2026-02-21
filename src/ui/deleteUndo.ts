export interface DeleteUndoRequest {
  message: string;
  undoLabel?: string;
  onUndo: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
}

export interface DeleteUndoHandle {
  show: (request: DeleteUndoRequest) => void;
  destroy: () => void;
}

interface MountDeleteUndoOptions {
  timeoutMs?: number;
}

export const mountDeleteUndo = (
  root: HTMLElement,
  options: MountDeleteUndoOptions = {}
): DeleteUndoHandle => {
  const timeoutMs = options.timeoutMs ?? 5000;

  root.innerHTML = `
    <div class="undo-toast" data-testid="undo-toast" hidden>
      <div class="undo-toast__message" data-testid="undo-toast-message"></div>
      <button class="undo-toast__button" type="button" data-testid="undo-toast-action">Undo</button>
    </div>
  `;

  const toast = root.querySelector<HTMLElement>('[data-testid="undo-toast"]');
  const message = root.querySelector<HTMLElement>('[data-testid="undo-toast-message"]');
  const action = root.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]');

  if (!toast || !message || !action) {
    throw new Error("Missing undo toast elements");
  }

  let timerId: number | null = null;
  let token = 0;
  let active: DeleteUndoRequest | null = null;

  const clearTimer = () => {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  const hide = () => {
    toast.hidden = true;
    toast.classList.remove("is-visible");
  };

  const commitActive = (targetToken: number) => {
    if (!active || targetToken !== token) {
      return;
    }
    const request = active;
    active = null;
    clearTimer();
    hide();
    void Promise.resolve(request.onCommit()).catch((error: unknown) => {
      console.error(error);
    });
  };

  const show = (request: DeleteUndoRequest) => {
    if (active) {
      const pending = active;
      clearTimer();
      active = null;
      void Promise.resolve(pending.onCommit()).catch((error: unknown) => {
        console.error(error);
      });
    }

    token += 1;
    const currentToken = token;
    active = request;
    message.textContent = request.message;
    action.textContent = request.undoLabel ?? "Undo";

    toast.hidden = false;
    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");

    clearTimer();
    timerId = window.setTimeout(() => {
      commitActive(currentToken);
    }, timeoutMs);
  };

  action.addEventListener("click", () => {
    if (!active) {
      return;
    }
    const request = active;
    active = null;
    clearTimer();
    hide();
    void Promise.resolve(request.onUndo()).catch((error: unknown) => {
      console.error(error);
    });
  });

  return {
    show,
    destroy: () => {
      if (active) {
        const pending = active;
        active = null;
        clearTimer();
        void Promise.resolve(pending.onCommit()).catch((error: unknown) => {
          console.error(error);
        });
      }
      hide();
      root.innerHTML = "";
    }
  };
};
