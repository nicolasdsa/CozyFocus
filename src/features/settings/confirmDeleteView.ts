type ConfirmDeleteOptions = {
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  showTitle?: boolean;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  testIdPrefix?: string;
  testId?: string;
  confirmButtonClassName?: string;
};

type ConfirmDeleteHandle = {
  element: HTMLDivElement;
  setBusy: (busy: boolean) => void;
  destroy: () => void;
};

export const createConfirmDeleteView = (options: ConfirmDeleteOptions): ConfirmDeleteHandle => {
  const testIdPrefix = options.testIdPrefix ?? "delete";
  const title = options.title ?? "Confirm delete";
  const showTitle = options.showTitle ?? true;
  const message =
    options.message ??
    "This will permanently remove tasks, notes, sessions, stats, docs, settings, and tags from this device.";
  const confirmLabel = options.confirmLabel ?? "Confirm Delete";
  const cancelLabel = options.cancelLabel ?? "Cancel";
  const confirmButtonClassName =
    options.confirmButtonClassName ?? "settings-btn settings-btn--danger";

  const element = document.createElement("div");
  element.className = "settings-delete-confirm";
  element.dataset.testid = options.testId ?? `${testIdPrefix}-confirmation`;
  element.innerHTML = `
    <div class="settings-delete-copy">
      ${showTitle ? `<div class="settings-delete-title">${title}</div>` : ""}
      <p class="settings-delete-text">
        ${message}
      </p>
    </div>
    <div class="settings-delete-actions">
      <button class="${confirmButtonClassName}" type="button" data-testid="${testIdPrefix}-confirm">
        ${confirmLabel}
      </button>
      <button class="settings-btn" type="button" data-testid="${testIdPrefix}-cancel">
        ${cancelLabel}
      </button>
    </div>
  `;

  const confirmButton = element.querySelector<HTMLButtonElement>(
    `[data-testid="${testIdPrefix}-confirm"]`
  );
  const cancelButton = element.querySelector<HTMLButtonElement>(
    `[data-testid="${testIdPrefix}-cancel"]`
  );

  const onConfirm = () => options.onConfirm();
  const onCancel = () => options.onCancel();

  confirmButton?.addEventListener("click", onConfirm);
  cancelButton?.addEventListener("click", onCancel);

  const setBusy = (busy: boolean) => {
    if (confirmButton) {
      confirmButton.disabled = busy;
    }
    if (cancelButton) {
      cancelButton.disabled = busy;
    }
    element.dataset.busy = busy ? "true" : "false";
  };

  const destroy = () => {
    confirmButton?.removeEventListener("click", onConfirm);
    cancelButton?.removeEventListener("click", onCancel);
    element.remove();
  };

  return { element, setBusy, destroy };
};
