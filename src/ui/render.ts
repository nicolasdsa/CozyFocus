import { mountNotesView } from "../features/notes/notesView";
import { mountPomodoroView } from "../features/pomodoro/pomodoroView";
import { mountPlayerView } from "../features/player/playerView";
import { mountStealth } from "../features/stealth/stealth";
import { mountStreakView } from "../features/streak/streakView";
import { mountTasksView } from "../features/tasks/tasksView";
import { navigateTo, subscribeRoute, type AppRoute } from "../router/router";
import { qs } from "./dom";
import { mountFilesView } from "../views/files/filesView";
import { mountCalendarView } from "../views/calendar/calendarView";
import { mountSettingsView } from "../views/settings/settingsView";

type CleanupTask = () => Promise<void> | void;

const renderFocusView = async (root: HTMLElement): Promise<CleanupTask[]> => {
  root.innerHTML = `
    <header class="header">
      <div class="header-title">
        <h1>CozyFocus</h1>
        <span class="header-subtitle">Deep Work Nook</span>
      </div>
      <div class="header-status">
        <div class="streak-pill" data-testid="streak-badge"></div>
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
  `;

  const cleanups: CleanupTask[] = [];
  const stealthToggle = root.querySelector<HTMLButtonElement>(
    '[data-testid="stealth-toggle"]'
  );

  if ("indexedDB" in globalThis) {
    const taskQueue = qs<HTMLElement>(root, "task-queue");
    const notesPanel = qs<HTMLElement>(root, "quick-notes");
    const pomodoro = qs<HTMLElement>(root, "pomodoro");
    const player = qs<HTMLElement>(root, "player");
    const streakBadge = qs<HTMLElement>(root, "streak-badge");
    const taskHandle = await mountTasksView(taskQueue);
    const notesHandle = await mountNotesView(notesPanel);
    const pomodoroHandle = await mountPomodoroView(pomodoro);
    await mountPlayerView(player);
    const streakHandle = await mountStreakView(streakBadge);
    cleanups.push(() => taskHandle.destroy());
    cleanups.push(() => notesHandle.destroy());
    cleanups.push(() => pomodoroHandle.destroy());
    cleanups.push(() => streakHandle.destroy());
  }

  if (!stealthToggle) {
    return cleanups;
  }
  const stealthHandle = mountStealth(stealthToggle);
  cleanups.push(() => stealthHandle.destroy());

  return cleanups;
};

export const renderApp = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="app-shell">
      <nav class="navbar" data-testid="nav">
        <div class="nav-logo">CF</div>
        <div class="nav-list">
          <button class="nav-btn is-active" aria-label="Focus" data-route="focus">
            <span>F</span>
          </button>
          <button class="nav-btn" aria-label="Calendar" data-route="calendar" data-testid="nav-calendar">
            <span>C</span>
          </button>
          <button class="nav-btn" aria-label="Files (Archive)" data-route="files" data-testid="nav-files">
            <span>A</span>
          </button>
        </div>
        <button class="nav-btn" aria-label="Settings" data-route="settings" data-testid="nav-settings">
          <span>O</span>
        </button>
      </nav>

      <section class="main-column" data-testid="view-root"></section>
    </div>
  `;

  const viewRoot = qs<HTMLElement>(root, "view-root");
  const navFiles = qs<HTMLButtonElement>(root, "nav-files");
  const navCalendar = qs<HTMLButtonElement>(root, "nav-calendar");
  const navSettings = qs<HTMLButtonElement>(root, "nav-settings");
  let activeCleanups: CleanupTask[] = [];
  let renderVersion = 0;

  const setActiveNav = (route: AppRoute) => {
    const navButtons = root.querySelectorAll<HTMLButtonElement>("[data-route]");
    navButtons.forEach((button) => {
      if (button.dataset.route === route) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    });
  };

  const renderRoute = (route: AppRoute) => {
    renderVersion += 1;
    const currentRenderVersion = renderVersion;
    setActiveNav(route);
    const tasks = activeCleanups;
    activeCleanups = [];
    void Promise.all(tasks.map(async (cleanup) => cleanup()));

    if (route === "files") {
      mountFilesView(viewRoot);
      return;
    }
    if (route === "calendar") {
      mountCalendarView(viewRoot);
      return;
    }
    if (route === "settings") {
      mountSettingsView(viewRoot);
      return;
    }

    void renderFocusView(viewRoot).then((cleanups) => {
      if (currentRenderVersion !== renderVersion) {
        void Promise.all(cleanups.map(async (cleanup) => cleanup()));
        return;
      }
      activeCleanups = cleanups;
    });
  };

  navFiles.addEventListener("click", () => {
    navigateTo("files");
  });
  navCalendar.addEventListener("click", () => {
    navigateTo("calendar");
  });
  navSettings.addEventListener("click", () => {
    navigateTo("settings");
  });

  subscribeRoute(renderRoute);
};
