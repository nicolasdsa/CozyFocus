type ConfirmDeleteOptions = {
  onConfirm: () => void;
  onCancel: () => void;
};

type ConfirmDeleteHandle = {
  element: HTMLDivElement;
  setBusy: (busy: boolean) => void;
  destroy: () => void;
};

export const createConfirmDeleteView = (options: ConfirmDeleteOptions): ConfirmDeleteHandle => {
  const element = document.createElement("div");
  element.className = "settings-delete-confirm";
  element.dataset.testid = "delete-confirmation";
  element.innerHTML = `
    <div class="settings-delete-copy">
      <div class="settings-delete-title">Confirm delete</div>
      <p class="settings-delete-text">
        This will permanently remove tasks, notes, sessions, stats, docs, settings, and tags
        from this device.
      </p>
    </div>
    <div class="settings-delete-actions">
      <button class="settings-btn settings-btn--danger" type="button" data-testid="delete-confirm">
        Confirm Delete
      </button>
      <button class="settings-btn" type="button" data-testid="delete-cancel">
        Cancel
      </button>
    </div>
  `;

  const confirmButton = element.querySelector<HTMLButtonElement>("[data-testid=\"delete-confirm\"]");
  const cancelButton = element.querySelector<HTMLButtonElement>("[data-testid=\"delete-cancel\"]");

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
