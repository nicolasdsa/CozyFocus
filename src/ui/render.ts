import { mountNotesView } from "../features/notes/notesView";
import { mountPomodoroView } from "../features/pomodoro/pomodoroView";
import { mountTasksView } from "../features/tasks/tasksView";
import { qs } from "./dom";

export const renderApp = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="app-shell">
      <nav class="navbar" data-testid="nav">
        <div class="nav-logo">CF</div>
        <div class="nav-list">
          <button class="nav-btn is-active" aria-label="Focus">
            <span>F</span>
          </button>
          <button class="nav-btn" aria-label="Notes">
            <span>N</span>
          </button>
          <button class="nav-btn" aria-label="Summary">
            <span>S</span>
          </button>
        </div>
        <button class="nav-btn" aria-label="Settings">
          <span>O</span>
        </button>
      </nav>

      <section class="main-column">
        <header class="header">
          <div class="header-title">
            <h1>CozyFocus</h1>
            <span class="header-subtitle">Deep Work Nook</span>
          </div>
          <div class="header-status">
            <div class="status-pill">
              <span class="status-dot"></span>
              <span>Offline Synced</span>
            </div>
            <div class="avatar" aria-label="User avatar"></div>
          </div>
        </header>

        <main class="content">
          <aside class="card side-column" data-testid="task-queue"></aside>

          <section class="center-stack" data-testid="pomodoro"></section>

          <aside class="card side-column" data-testid="quick-notes"></aside>
        </main>

        <footer class="footer" data-testid="player">
          <div class="player-left">
            <div class="album" aria-label="Lofi album art"></div>
            <div class="player-meta">
              <h4>Lofi Beats - Rainy Cafe</h4>
              <span>Now Playing - 45% Volume</span>
            </div>
            <div class="player-controls">
              <button aria-label="Previous">Prev</button>
              <button aria-label="Next">Next</button>
            </div>
          </div>
          <div class="player-right">
            <div class="volume">
              <span>Vol</span>
              <div class="volume-bar"></div>
            </div>
            <button aria-label="Fullscreen">Full</button>
          </div>
        </footer>
      </section>
    </div>
  `;

  if ("indexedDB" in globalThis) {
    const taskQueue = qs<HTMLElement>(root, "task-queue");
    const notesPanel = qs<HTMLElement>(root, "quick-notes");
    const pomodoro = qs<HTMLElement>(root, "pomodoro");
    void mountTasksView(taskQueue);
    void mountNotesView(notesPanel);
    void mountPomodoroView(pomodoro);
  }
};
