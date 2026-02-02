import { exportData } from "../../features/settings/exportData";
import { downloadBlob } from "../../features/settings/download";
import {
  applyMergePlan,
  buildMergePlan,
  parseBundle,
  type MergePlan
} from "../../features/settings/importData";
import type { ExportBundle } from "../../features/settings/exportData";

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
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Open CozyFocus repository on GitHub"
            >
              <span>View Repo</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" class="settings-link-icon">
                <path
                  d="M7 17h10M7 17V7h10v10M9 7h8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
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
          <div class="settings-import-panel" data-testid="import-panel" hidden>
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
            <div class="settings-import-status" data-testid="import-status"></div>
          </div>
        </section>

        <section class="settings-support card">
          <div>
            <p class="settings-subtitle">Enjoying the focus?</p>
            <p class="settings-text settings-muted">Fuel the calm with a coffee.</p>
          </div>
          <button class="settings-btn settings-btn--ghost" type="button">Support Project</button>
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
  const importPanel = root.querySelector<HTMLDivElement>("[data-testid=\"import-panel\"]");
  const importTextarea = root.querySelector<HTMLTextAreaElement>("[data-testid=\"import-textarea\"]");
  const importPreview = root.querySelector<HTMLDivElement>("[data-testid=\"import-preview\"]");
  const importStatus = root.querySelector<HTMLDivElement>("[data-testid=\"import-status\"]");
  const importConfirm = root.querySelector<HTMLButtonElement>("[data-testid=\"import-confirm\"]");
  const importFile = root.querySelector<HTMLInputElement>("#import-file");

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
        <span>Adicionar</span>
        <span>Atualizar</span>
        <span>Pular</span>
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

  const setStatus = (message: string, tone: "error" | "info" = "info"): void => {
    if (!importStatus) {
      return;
    }
    importStatus.textContent = message;
    importStatus.dataset.tone = tone;
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

  if (importButton && importPanel) {
    importButton.addEventListener("click", () => {
      importPanel.hidden = !importPanel.hidden;
      if (!importPanel.hidden) {
        importTextarea?.focus();
      }
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
        } catch (error) {
          console.error("Failed to import data", error);
          setStatus("Import failed. Please check the bundle and try again.", "error");
        }
      })();
    });
  }

  if (importPreview) {
    importPreview.innerHTML = `
      <div class="settings-import-preview-placeholder">
        Cole um export do CozyFocus para ver o preview.
      </div>
    `;
  }
};
