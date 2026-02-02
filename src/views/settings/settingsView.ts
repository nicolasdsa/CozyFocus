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
};
