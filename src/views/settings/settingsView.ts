import { exportData } from "../../features/settings/exportData";
import { downloadBlob } from "../../features/settings/download";
import { clearAllStores } from "../../features/settings/deleteData";
import { createConfirmDeleteView } from "../../features/settings/confirmDeleteView";
import {
  applyMergePlan,
  buildMergePlan,
  parseBundle,
  type MergePlan
} from "../../features/settings/importData";
import {
  readTimeFormatMode,
  saveTimeFormatMode
} from "../../features/time/timeFormat";
import type { ExportBundle } from "../../features/settings/exportData";
import type { TimeFormatMode } from "../../types";
import { appEvents } from "../../ui/appEvents";
import arrowIconUrl from "../../assets/arrow.svg";
import emailIconUrl from "../../assets/email.svg";
import heartIconUrl from "../../assets/heart.svg";

const formatExportDate = (value: number): string => {
  return new Date(value).toISOString().slice(0, 10);
};

export const mountSettingsView = (root: HTMLElement): void => {
  root.innerHTML = `
    <section class="settings-view" data-testid="settings-view">
      <header class="settings-header">
        <h2 class="settings-title" data-testid="settings-title">Settings</h2>
      </header>

      <div class="settings-body">
        <section class="settings-section card" data-testid="settings-about">
          <div class="settings-section-header">
            <span class="settings-caption">About CozyFocus</span>
          </div>
          <p class="settings-text">
            CozyFocus is your minimalist nook for deep work. A quiet, offline-first space
            designed to help you breathe, focus, and create without distraction.
          </p>
        </section>

        <section class="settings-section card" data-testid="settings-repo">
          <div class="settings-section-header">
            <span class="settings-caption">GitHub Repository</span>
          </div>
          <div class="settings-repo-row">
            <div class="settings-repo-copy">
              <h3 class="settings-subtitle">Open Source Project</h3>
              <p class="settings-text settings-muted">
                Star us or contribute on GitHub.
              </p>
            </div>
            <a
              class="settings-link"
              href="https://github.com/nicolasdsa/CozyFocus"
              target="_blank"
              rel="noreferrer"
              aria-label="Open CozyFocus repository on GitHub"
            >
              <span>View Repo</span>
              <img src="${arrowIconUrl}" alt="" aria-hidden="true" class="settings-link-icon" />
            </a>
          </div>
        </section>

        <section class="settings-section card" data-testid="settings-time-format">
          <div class="settings-section-header">
            <span class="settings-caption">Time Format</span>
          </div>
          <p class="settings-text settings-muted">
            Keep system default (Auto) or force 12h / 24h across calendar timeline and notes.
          </p>
          <div class="settings-actions" data-testid="time-format-actions">
            <button class="settings-btn" type="button" data-testid="time-format-auto" data-time-format="auto">
              Auto
            </button>
            <button class="settings-btn" type="button" data-testid="time-format-12h" data-time-format="12h">
              12h
            </button>
            <button class="settings-btn" type="button" data-testid="time-format-24h" data-time-format="24h">
              24h
            </button>
          </div>
        </section>

        <section class="settings-section card" data-testid="settings-data">
          <div class="settings-section-header">
            <span class="settings-caption">Data Management</span>
          </div>
          <p class="settings-text settings-muted">
            Your data stays with you. All notes and preferences are stored locally on this device.
          </p>
          <div class="settings-actions">
            <button class="settings-btn settings-btn--primary" type="button" data-testid="data-export">
              Export (.json)
            </button>
            <button class="settings-btn" type="button" data-testid="data-import">
              Import
            </button>
            <button class="settings-btn settings-btn--danger" type="button" data-testid="data-delete">
              Delete Data
            </button>
          </div>
          <div class="settings-import-status" data-testid="import-status"></div>
          <div class="settings-delete-status" data-testid="delete-status"></div>
        </section>

        <div class="settings-modal" data-testid="import-modal" hidden>
          <div class="settings-modal-backdrop" data-testid="import-backdrop"></div>
          <div class="settings-modal-dialog" role="dialog" aria-modal="true" aria-label="Import data">
            <button class="settings-modal-close" type="button" aria-label="Close import" data-testid="import-close">
              ×
            </button>
            <div class="settings-modal-title">Import Data</div>
            <div class="settings-import-panel" data-testid="import-panel">
              <div class="settings-import-row">
                <label class="settings-import-label" for="import-textarea">Paste JSON</label>
                <textarea
                  id="import-textarea"
                  class="settings-import-textarea"
                  data-testid="import-textarea"
                  placeholder="Paste a CozyFocus export bundle..."
                  rows="8"
                ></textarea>
              </div>
              <div class="settings-import-row">
                <label class="settings-import-label" for="import-file">Or choose a .json file</label>
                <input
                  id="import-file"
                  class="settings-import-file"
                  type="file"
                  accept="application/json,.json"
                />
              </div>
              <div class="settings-import-actions">
                <button class="settings-btn settings-btn--primary" type="button" data-testid="import-confirm">
                  Confirm Import
                </button>
              </div>
              <div class="settings-import-preview" data-testid="import-preview"></div>
            </div>
          </div>
        </div>

        <div class="settings-modal" data-testid="delete-modal" hidden>
          <div class="settings-modal-backdrop" data-testid="delete-backdrop"></div>
          <div class="settings-modal-dialog" role="dialog" aria-modal="true" aria-label="Delete data">
            <button class="settings-modal-close" type="button" aria-label="Close delete" data-testid="delete-close">
              ×
            </button>
            <div class="settings-modal-title">Delete Data</div>
            <div class="settings-delete-panel" data-testid="delete-panel"></div>
          </div>
        </div>

        <section class="settings-support card">
          <div>
            <p class="settings-subtitle">Enjoying the focus?</p>
            <p class="settings-text settings-muted">Fuel the calm with a coffee.</p>
          </div>
          <a
            class="settings-btn settings-btn--ghost settings-support-link"
            href="https://buymeacoffee.com/cozyfocus"
            target="_blank"
            rel="noreferrer"
            aria-label="Support CozyFocus on Buy Me a Coffee"
          >
            <img src="${heartIconUrl}" alt="" aria-hidden="true" class="settings-support-icon" />
            <span>Support Project</span>
          </a>
        </section>

        <section class="settings-support card" data-testid="settings-feedback">
          <div>
            <p class="settings-subtitle">Share your feedback</p>
            <p class="settings-text settings-muted">
              Have feedback, suggestions, or found a bug? We'd love to hear from you.
            </p>
          </div>
          <a
            class="settings-btn settings-btn--ghost settings-feedback-link"
            href="mailto:contact@cozyfocus.com"
            aria-label="Send feedback to CozyFocus"
          >
            <img src="${emailIconUrl}" alt="" aria-hidden="true" class="settings-feedback-icon" />
            <span>Email Us</span>
          </a>
        </section>
      </div>
    </section>
  `;

  const exportButton = root.querySelector<HTMLButtonElement>("[data-testid=\"data-export\"]");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      void (async () => {
        try {
          const bundle = await exportData();
          const filename = `cozyfocus-export-${formatExportDate(bundle.exportedAt)}.json`;
          const blob = new Blob([JSON.stringify(bundle, null, 2)], {
            type: "application/json"
          });
          downloadBlob(filename, blob);
        } catch (error) {
          console.error("Failed to export data", error);
        }
      })();
    });
  }

  const importButton = root.querySelector<HTMLButtonElement>("[data-testid=\"data-import\"]");
  const timeFormatButtons = root.querySelectorAll<HTMLButtonElement>("[data-time-format]");
  const importTextarea = root.querySelector<HTMLTextAreaElement>("[data-testid=\"import-textarea\"]");
  const importPreview = root.querySelector<HTMLDivElement>("[data-testid=\"import-preview\"]");
  const importStatus = root.querySelector<HTMLDivElement>("[data-testid=\"import-status\"]");
  const importConfirm = root.querySelector<HTMLButtonElement>("[data-testid=\"import-confirm\"]");
  const importFile = root.querySelector<HTMLInputElement>("#import-file");
  const importModal = root.querySelector<HTMLDivElement>("[data-testid=\"import-modal\"]");
  const importBackdrop = root.querySelector<HTMLDivElement>("[data-testid=\"import-backdrop\"]");
  const importClose = root.querySelector<HTMLButtonElement>("[data-testid=\"import-close\"]");
  const deleteButton = root.querySelector<HTMLButtonElement>("[data-testid=\"data-delete\"]");
  const deletePanel = root.querySelector<HTMLDivElement>("[data-testid=\"delete-panel\"]");
  const deleteStatus = root.querySelector<HTMLDivElement>("[data-testid=\"delete-status\"]");
  const deleteModal = root.querySelector<HTMLDivElement>("[data-testid=\"delete-modal\"]");
  const deleteBackdrop = root.querySelector<HTMLDivElement>("[data-testid=\"delete-backdrop\"]");
  const deleteClose = root.querySelector<HTMLButtonElement>("[data-testid=\"delete-close\"]");

  const renderPlan = (plan: MergePlan): string => {
    const rows = [
      { label: "Tasks", counts: plan.tasks },
      { label: "Notes", counts: plan.notes },
      { label: "Docs", counts: plan.docs },
      { label: "Sessions", counts: plan.sessions },
      { label: "Stats", counts: plan.stats },
      { label: "Settings", counts: plan.settings },
      plan.tags ? { label: "Tags", counts: plan.tags } : null
    ].filter(Boolean) as Array<{ label: string; counts: MergePlan["tasks"] }>;

    return `
      <div class="settings-import-preview-header">Preview</div>
      <div class="settings-import-preview-legend">
        <span>Add</span>
        <span>Update</span>
        <span>Skip</span>
      </div>
      ${rows
        .map(
          (row) => `
            <div class="settings-import-preview-row">
              <span>${row.label}</span>
              <span class="settings-import-preview-counts">
                <span class="settings-import-preview-count">+${row.counts.add}</span>
                <span class="settings-import-preview-count">~${row.counts.update}</span>
                <span class="settings-import-preview-count">=${row.counts.skip}</span>
              </span>
            </div>
          `
        )
        .join("")}
    `;
  };

  const applyTimeFormatSelection = (mode: TimeFormatMode): void => {
    timeFormatButtons.forEach((button) => {
      const active = button.dataset.timeFormat === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  timeFormatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.timeFormat as TimeFormatMode | undefined;
      if (!mode) {
        return;
      }
      applyTimeFormatSelection(mode);
      void saveTimeFormatMode(mode).catch((error) => {
        console.error("Failed to save time format setting", error);
      });
    });
  });

  void (async () => {
    try {
      const mode = await readTimeFormatMode();
      applyTimeFormatSelection(mode);
    } catch (error) {
      console.error("Failed to load time format setting", error);
      applyTimeFormatSelection("auto");
    }
  })();

  const setStatus = (message: string, tone: "error" | "info" = "info"): void => {
    if (!importStatus) {
      return;
    }
    importStatus.textContent = message;
    importStatus.dataset.tone = tone;
  };

  const resetImportPreview = (): void => {
    if (!importPreview) {
      return;
    }
    importPreview.innerHTML = `
      <div class="settings-import-preview-placeholder">
        Paste a CozyFocus export to preview it.
      </div>
    `;
  };

  const setDeleteStatus = (message: string, tone: "error" | "info" = "info"): void => {
    if (!deleteStatus) {
      return;
    }
    deleteStatus.textContent = message;
    deleteStatus.dataset.tone = tone;
  };

  const openImportModal = (): void => {
    if (!importModal) {
      return;
    }
    importModal.hidden = false;
    importTextarea?.focus();
  };

  const closeImportModal = (): void => {
    if (importModal) {
      importModal.hidden = true;
    }
  };

  const openDeleteModal = (): void => {
    if (!deleteModal) {
      return;
    }
    deleteModal.hidden = false;
  };

  const closeDeleteModal = (): void => {
    if (deleteModal) {
      deleteModal.hidden = true;
    }
  };

  const resetSettingsState = (): void => {
    closeImportModal();
    closeDeleteModal();
    if (importTextarea) {
      importTextarea.value = "";
    }
    if (importFile) {
      importFile.value = "";
    }
    resetImportPreview();
    if (importStatus) {
      importStatus.textContent = "";
      delete importStatus.dataset.tone;
    }
  };

  const loadBundleFromInput = (): ExportBundle | null => {
    if (!importTextarea) {
      return null;
    }
    const raw = importTextarea.value.trim();
    if (!raw) {
      setStatus("Paste or load a CozyFocus export bundle to continue.", "error");
      if (importPreview) {
        importPreview.innerHTML = "";
      }
      return null;
    }
    try {
      return parseBundle(raw);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.", "error");
      if (importPreview) {
        importPreview.innerHTML = "";
      }
      return null;
    }
  };

  const autoPreview = (bundle: ExportBundle | null): void => {
    if (!bundle || !importPreview) {
      return;
    }
    void (async () => {
      try {
        const plan = await buildMergePlan(bundle);
        importPreview.innerHTML = renderPlan(plan);
        setStatus("Preview ready. Review the plan before confirming.", "info");
      } catch (error) {
        console.error("Failed to build import preview", error);
        setStatus("Unable to build preview.", "error");
      }
    })();
  };

  if (importButton) {
    importButton.addEventListener("click", () => {
      openImportModal();
    });
  }

  importClose?.addEventListener("click", () => {
    closeImportModal();
  });

  importBackdrop?.addEventListener("click", () => {
    closeImportModal();
  });

  deleteClose?.addEventListener("click", () => {
    closeDeleteModal();
  });

  deleteBackdrop?.addEventListener("click", () => {
    closeDeleteModal();
  });

  let deleteConfirmHandle:
    | ReturnType<typeof createConfirmDeleteView>
    | null = null;

  const showDeletePanel = () => {
    if (!deletePanel) {
      return;
    }
    openDeleteModal();
    if (!deleteConfirmHandle) {
      const onCancel = () => {
        closeDeleteModal();
      };
      const onConfirm = () => {
        deleteConfirmHandle?.setBusy(true);
        setDeleteStatus("Deleting local data...", "info");
        void (async () => {
          try {
            await clearAllStores();
            resetSettingsState();
            appEvents.emit("dataChanged", { reason: "delete" });
            setDeleteStatus("All local data has been deleted.", "info");
          } catch (error) {
            console.error("Failed to delete local data", error);
            setDeleteStatus("Delete failed. Please try again.", "error");
          } finally {
            deleteConfirmHandle?.setBusy(false);
          }
        })();
      };
      deleteConfirmHandle = createConfirmDeleteView({
        onCancel,
        onConfirm,
        showTitle: false
      });
      deletePanel.appendChild(deleteConfirmHandle.element);
    }
  };

  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      showDeletePanel();
    });
  }

  if (importFile && importTextarea) {
    importFile.addEventListener("change", () => {
      const file = importFile.files?.[0];
      if (!file) {
        return;
      }
      void (async () => {
        try {
          const text = await file.text();
          importTextarea.value = text;
          setStatus(`Loaded ${file.name}.`, "info");
          autoPreview(loadBundleFromInput());
        } catch (error) {
          console.error("Failed to read import file", error);
          setStatus("Unable to read that file.", "error");
        }
      })();
    });
  }

  if (importTextarea) {
    let previewTimer: number | null = null;
    importTextarea.addEventListener("input", () => {
      if (previewTimer) {
        window.clearTimeout(previewTimer);
      }
      previewTimer = window.setTimeout(() => {
        autoPreview(loadBundleFromInput());
      }, 400);
    });
  }

  if (importConfirm && importPreview) {
    importConfirm.addEventListener("click", () => {
      void (async () => {
        const bundle = loadBundleFromInput();
        if (!bundle) {
          return;
        }
        try {
          const { plan } = await applyMergePlan(bundle);
          appEvents.emit("dataChanged", { reason: "import" });
          importPreview.innerHTML = renderPlan(plan);
          const totalAdded =
            plan.tasks.add +
            plan.notes.add +
            plan.docs.add +
            plan.sessions.add +
            plan.stats.add +
            plan.settings.add +
            (plan.tags?.add ?? 0);
          const totalUpdated =
            plan.tasks.update +
            plan.notes.update +
            plan.docs.update +
            plan.sessions.update +
            plan.stats.update +
            plan.settings.update +
            (plan.tags?.update ?? 0);
          const totalSkipped =
            plan.tasks.skip +
            plan.notes.skip +
            plan.docs.skip +
            plan.sessions.skip +
            plan.stats.skip +
            plan.settings.skip +
            (plan.tags?.skip ?? 0);
          setStatus(
            `Import complete. Added ${totalAdded}, updated ${totalUpdated}, skipped ${totalSkipped}.`,
            "info"
          );
          if (importFile) {
            importFile.value = "";
          }
          closeImportModal();
        } catch (error) {
          console.error("Failed to import data", error);
          setStatus("Import failed. Please check the bundle and try again.", "error");
        }
      })();
    });
  }

  if (importPreview) {
    resetImportPreview();
  }
};
