import { mountNotesView } from "../features/notes/notesView";
import { mountPomodoroView } from "../features/pomodoro/pomodoroView";
import { mountPlayerView } from "../features/player/playerView";
import { mountStealth } from "../features/stealth/stealth";
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
            <button class="stealth-btn" data-testid="stealth-toggle">Stealth</button>
            <div class="avatar" aria-label="User avatar"></div>
          </div>
        </header>

        <main class="content">
          <aside class="card side-column" data-testid="task-queue"></aside>

          <section class="center-stack" data-testid="pomodoro"></section>

          <aside class="card side-column" data-testid="quick-notes"></aside>
        </main>

        <footer class="footer player" data-testid="player"></footer>
      </section>
    </div>
  `;

  if ("indexedDB" in globalThis) {
    const taskQueue = qs<HTMLElement>(root, "task-queue");
    const notesPanel = qs<HTMLElement>(root, "quick-notes");
    const pomodoro = qs<HTMLElement>(root, "pomodoro");
    const player = qs<HTMLElement>(root, "player");
    void mountTasksView(taskQueue);
    void mountNotesView(notesPanel);
    void mountPomodoroView(pomodoro);
    void mountPlayerView(player);
  }

  const stealthToggle = qs<HTMLButtonElement>(root, "stealth-toggle");
  mountStealth(stealthToggle);
};
