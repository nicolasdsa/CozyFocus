export const mountFilesView = (root: HTMLElement): void => {
  root.innerHTML = `
    <section class="files-view" data-testid="files-view">
      <aside class="files-aside">
        <div class="files-aside-header">
          <div>
            <p class="files-overline">Archive</p>
            <h2 class="files-title">Today</h2>
          </div>
          <button class="files-icon-btn" type="button" aria-label="Filter notes">
            Filter
          </button>
        </div>
        <label class="files-search" aria-label="Search today's notes">
          <span class="files-search-label">Search</span>
          <input
            class="files-search-input"
            type="search"
            placeholder="Search today's notes..."
            data-testid="files-search"
          />
        </label>
        <div class="files-list" data-testid="files-list">
          <button class="files-list-item is-active" type="button">
            <div class="files-list-row">
              <span class="files-list-title">Morning Warmup</span>
              <span class="files-list-time">08:45</span>
            </div>
            <p class="files-list-snippet">Targets for deep work, daily highlight, and focus soundtrack.</p>
            <div class="files-tag">Work</div>
          </button>
          <button class="files-list-item" type="button">
            <div class="files-list-row">
              <span class="files-list-title">Brain Dump</span>
              <span class="files-list-time">11:20</span>
            </div>
            <p class="files-list-snippet">Loose thoughts, sticky questions, and small experiments.</p>
            <div class="files-tag is-muted">Personal</div>
          </button>
          <button class="files-list-item" type="button">
            <div class="files-list-row">
              <span class="files-list-title">Evening Wrap</span>
              <span class="files-list-time">17:05</span>
            </div>
            <p class="files-list-snippet">What shipped, what slipped, and what needs a follow-up.</p>
            <div class="files-tag">Review</div>
          </button>
        </div>
        <div class="files-aside-footer">
          <button class="files-primary-btn" type="button">New Note</button>
        </div>
      </aside>
      <main class="files-main" data-testid="files-editor">
        <div class="files-main-header">
          <div>
            <p class="files-overline">Archive / Today</p>
            <h1 class="files-doc-title">Morning Warmup</h1>
          </div>
          <div class="files-actions">
            <button class="files-icon-btn" type="button">Edit</button>
            <button class="files-icon-btn" type="button">Archive</button>
            <button class="files-icon-btn is-danger" type="button">Delete</button>
          </div>
        </div>
        <div class="files-meta">
          <span>Jan 30, 2026</span>
          <span>08:45 AM</span>
          <span class="files-pill">Work</span>
          <span class="files-pill is-muted">Focus</span>
        </div>
        <div class="files-toolbar">
          <button class="files-icon-btn" type="button">Bold</button>
          <button class="files-icon-btn" type="button">List</button>
          <button class="files-icon-btn" type="button">Quote</button>
          <span class="files-toolbar-divider"></span>
          <button class="files-icon-btn" type="button">Preview</button>
        </div>
        <div class="files-editor">
          <div class="files-editor-pane">
            <h3>Draft</h3>
            <p>
              Stretch to reset. Capture the next small wins. Stay soft on the plan and hard on the focus.
            </p>
            <ul>
              <li>Warm tea + 10-minute settle</li>
              <li>Two high-leverage tasks, one nice-to-have</li>
              <li>Break before meeting at 10:30</li>
            </ul>
          </div>
          <div class="files-editor-pane is-preview">
            <h3>Preview</h3>
            <p>
              The day starts with a calm sprint. The timer holds the boundaries, the notes hold the intent.
            </p>
            <blockquote>
              "Stay gentle with the plan; stay fierce with the practice."
            </blockquote>
          </div>
        </div>
      </main>
    </section>
  `;
};
