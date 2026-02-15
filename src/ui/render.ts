import { mountNotesView } from "../features/notes/notesView";
import {
  mountPomodoroView,
  type PomodoroViewHandle
} from "../features/pomodoro/pomodoroView";
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
type NavIcon = "coffee" | "calendar" | "article" | "settings";

interface PomodoroDockState {
  time: string;
  label: string;
  canResume: boolean;
  canPause: boolean;
}

const navIconMarkup = (icon: NavIcon): string => {
  if (icon === "coffee") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M440-240q-117 0-198.5-81.5T160-520v-240q0-33 23.5-56.5T240-840h500q58 0 99 41t41 99q0 58-41 99t-99 41h-20v40q0 117-81.5 198.5T440-240ZM240-640h400v-120H240v120Zm200 320q83 0 141.5-58.5T640-520v-40H240v40q0 83 58.5 141.5T440-320Zm280-320h20q25 0 42.5-17.5T800-700q0-25-17.5-42.5T740-760h-20v120ZM160-120v-80h640v80H160Zm280-440Z"/></svg>`;
  }
  if (icon === "calendar") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/></svg>`;
  }
  if (icon === "article") {
    return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>`;
  }
  return `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>`;
};

const createPomodoroBridge = (pomodoroRoot: HTMLElement) => {
  let lastState: PomodoroDockState = {
    time: "25:00",
    label: "FOCUS",
    canResume: true,
    canPause: false
  };

  const getState = (): PomodoroDockState => {
    const time = pomodoroRoot.querySelector<HTMLElement>('[data-testid="pomodoro-time"]');
    const label = pomodoroRoot.querySelector<HTMLElement>('[data-testid="pomodoro-label"]');
    const startButton = pomodoroRoot.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-start"]'
    );
    const pauseButton = pomodoroRoot.querySelector<HTMLButtonElement>(
      '[data-testid="pomodoro-pause"]'
    );

    if (!time || !label || !startButton || !pauseButton) {
      return lastState;
    }

    const nextTime = time.textContent?.replace(/\s+/g, "");
    const nextLabel = label.textContent?.trim();
    lastState = {
      time: nextTime && nextTime.length > 0 ? nextTime : lastState.time,
      label: nextLabel && nextLabel.length > 0 ? nextLabel : lastState.label,
      canResume: Boolean(startButton && !startButton.disabled),
      canPause: Boolean(pauseButton && !pauseButton.disabled)
    };
    return lastState;
  };

  return {
    getState,
    pause: () => {
      const pauseButton = pomodoroRoot.querySelector<HTMLButtonElement>(
        '[data-testid="pomodoro-pause"]'
      );
      pauseButton?.click();
    },
    resume: () => {
      const startButton = pomodoroRoot.querySelector<HTMLButtonElement>(
        '[data-testid="pomodoro-start"]'
      );
      startButton?.click();
    }
  };
};

const renderFocusView = async (
  root: HTMLElement,
  shared: {
    pomodoroRoot: HTMLElement;
    mountPomodoro: () => Promise<void>;
  }
): Promise<CleanupTask[]> => {
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
      <section class="center-stack" data-testid="pomodoro-slot"></section>
      <aside class="card side-column" data-testid="quick-notes"></aside>
    </main>
  `;

  const cleanups: CleanupTask[] = [];
  const stealthToggle = root.querySelector<HTMLButtonElement>('[data-testid="stealth-toggle"]');

  if ("indexedDB" in globalThis) {
    const taskQueue = qs<HTMLElement>(root, "task-queue");
    const notesPanel = qs<HTMLElement>(root, "quick-notes");
    const pomodoroSlot = qs<HTMLElement>(root, "pomodoro-slot");
    const streakBadge = qs<HTMLElement>(root, "streak-badge");

    pomodoroSlot.appendChild(shared.pomodoroRoot);

    const taskHandle = await mountTasksView(taskQueue);
    const notesHandle = await mountNotesView(notesPanel);
    await shared.mountPomodoro();
    const streakHandle = await mountStreakView(streakBadge);

    cleanups.push(() => taskHandle.destroy());
    cleanups.push(() => notesHandle.destroy());
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
        <button
          class="nav-btn nav-logo is-active"
          aria-label="Focus"
          data-route="focus"
          data-testid="nav-focus"
          type="button"
        >
          <span class="nav-icon">${navIconMarkup("coffee")}</span>
        </button>
        <div class="nav-list">
          <button class="nav-btn" aria-label="Calendar" data-route="calendar" data-testid="nav-calendar">
            <span class="nav-icon">${navIconMarkup("calendar")}</span>
          </button>
          <button class="nav-btn" aria-label="Files (Archive)" data-route="files" data-testid="nav-files">
            <span class="nav-icon">${navIconMarkup("article")}</span>
          </button>
        </div>
        <button class="nav-btn" aria-label="Settings" data-route="settings" data-testid="nav-settings">
          <span class="nav-icon">${navIconMarkup("settings")}</span>
        </button>
      </nav>

      <section class="main-column" data-testid="view-root"></section>

      <div class="activity-dock" data-testid="activity-dock" hidden>
        <div class="activity-dock-main">
          <div class="activity-dock-block">
            <span class="activity-dock-label" data-testid="activity-pomodoro-label">FOCUS</span>
            <span class="activity-dock-time" data-testid="activity-pomodoro-time">00:00</span>
            <button class="activity-dock-btn" type="button" data-testid="activity-pomodoro-toggle">▶</button>
          </div>
          <div class="activity-dock-divider"></div>
          <div class="activity-dock-block activity-dock-block--music">
            <span class="activity-dock-track" data-testid="activity-player-title">Playlist</span>
            <button class="activity-dock-btn activity-dock-btn--ghost" type="button" data-testid="activity-player-toggle">◉</button>
          </div>
        </div>
      </div>

      <div class="player-carrier player-carrier--parked" data-testid="activity-player-drawer"></div>
      <div class="view-parking" data-testid="view-parking" hidden></div>
    </div>
  `;

  const viewRoot = qs<HTMLElement>(root, "view-root");
  const navButtons = root.querySelectorAll<HTMLButtonElement>("[data-route]");
  const parking = qs<HTMLElement>(root, "view-parking");
  const dock = qs<HTMLElement>(root, "activity-dock");
  const pomodoroTime = qs<HTMLElement>(root, "activity-pomodoro-time");
  const pomodoroLabel = qs<HTMLElement>(root, "activity-pomodoro-label");
  const pomodoroToggle = qs<HTMLButtonElement>(root, "activity-pomodoro-toggle");
  const playerTitle = qs<HTMLElement>(root, "activity-player-title");
  const playerToggle = qs<HTMLButtonElement>(root, "activity-player-toggle");
  const playerCarrier = qs<HTMLElement>(root, "activity-player-drawer");
  const hasIndexedDb = "indexedDB" in globalThis;

  const sharedPomodoroRoot = document.createElement("section");
  sharedPomodoroRoot.className = "center-stack";
  sharedPomodoroRoot.setAttribute("data-testid", "pomodoro");

  const sharedPlayerRoot = document.createElement("footer");
  sharedPlayerRoot.className = "footer player";
  sharedPlayerRoot.setAttribute("data-testid", "player");

  let activeCleanups: CleanupTask[] = [];
  let renderVersion = 0;
  let currentRoute: AppRoute = "focus";
  let pomodoroHandle: PomodoroViewHandle | null = null;
  let pomodoroMountPromise: Promise<void> | null = null;
  let playerMounted = false;
  let playerMountPromise: Promise<void> | null = null;
  let playerDrawerOpen = false;

  const pomodoroBridge = createPomodoroBridge(sharedPomodoroRoot);

  const parkSharedViews = () => {
    parking.appendChild(sharedPomodoroRoot);
  };

  const closePlayerDrawer = () => {
    playerDrawerOpen = false;
    playerToggle.textContent = "◉";
    sharedPlayerRoot.classList.add("player--compact");
    playerCarrier.classList.remove("player-carrier--dock");
    playerCarrier.classList.add("player-carrier--parked");
  };

  if (!hasIndexedDb) {
    playerToggle.disabled = true;
    playerToggle.setAttribute("aria-label", "Media unavailable");
  }

  const shared = {
    pomodoroRoot: sharedPomodoroRoot,
    mountPomodoro: async () => {
      if (pomodoroHandle) {
        return;
      }
      if (!pomodoroMountPromise) {
        pomodoroMountPromise = mountPomodoroView(sharedPomodoroRoot).then((handle) => {
          pomodoroHandle = handle;
        });
      }
      await pomodoroMountPromise;
    },
    mountPlayer: async () => {
      if (playerMounted) {
        return;
      }
      if (!playerMountPromise) {
        playerMountPromise = mountPlayerView(sharedPlayerRoot).then(() => {
          playerMounted = true;
        });
      }
      await playerMountPromise;
    }
  };

  const syncPomodoroDock = () => {
    const state = pomodoroBridge.getState();
    pomodoroTime.textContent = state.time;
    pomodoroLabel.textContent = state.label;
    if (state.canPause) {
      pomodoroToggle.textContent = "❚❚";
      pomodoroToggle.setAttribute("aria-label", "Pause Pomodoro");
      pomodoroToggle.disabled = false;
      return;
    }
    if (state.canResume) {
      pomodoroToggle.textContent = "▶";
      pomodoroToggle.setAttribute("aria-label", "Resume Pomodoro");
      pomodoroToggle.disabled = false;
      return;
    }
    pomodoroToggle.textContent = "▶";
    pomodoroToggle.setAttribute("aria-label", "Start Pomodoro in Focus view");
    pomodoroToggle.disabled = false;
  };

  const syncPlayerDock = () => {
    const status = sharedPlayerRoot.querySelector<HTMLElement>(".player-status")?.textContent?.trim();
    playerTitle.textContent = status && status.length > 0 ? status : "Playlist";
  };

  parkSharedViews();
  playerCarrier.appendChild(sharedPlayerRoot);
  sharedPlayerRoot.classList.add("player--compact");
  if (hasIndexedDb) {
    void shared.mountPlayer().then(() => {
      syncPlayerDock();
    });
  }

  pomodoroToggle.addEventListener("click", () => {
    const state = pomodoroBridge.getState();
    if (state.canPause) {
      pomodoroBridge.pause();
    } else if (state.canResume) {
      pomodoroBridge.resume();
    } else {
      navigateTo("focus");
      return;
    }
    syncPomodoroDock();
  });

  playerToggle.addEventListener("click", () => {
    void (async () => {
      if (!hasIndexedDb) {
        return;
      }
      await shared.mountPlayer();
      syncPlayerDock();
      if (playerDrawerOpen) {
        closePlayerDrawer();
        return;
      }
      playerDrawerOpen = true;
      playerToggle.textContent = "✕";
      sharedPlayerRoot.classList.add("player--compact");
      playerCarrier.classList.remove("player-carrier--parked");
      playerCarrier.classList.add("player-carrier--dock");
    })();
  });

  window.setInterval(() => {
    if (currentRoute === "focus") {
      return;
    }
    syncPomodoroDock();
    syncPlayerDock();
  }, 250);

  const setActiveNav = (route: AppRoute) => {
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
    currentRoute = route;
    const currentRenderVersion = renderVersion;
    setActiveNav(route);
    const tasks = activeCleanups;
    activeCleanups = [];
    void Promise.all(tasks.map(async (cleanup) => cleanup()));
    closePlayerDrawer();
    parkSharedViews();

    if (route === "files") {
      dock.hidden = false;
      if (hasIndexedDb) {
        void shared.mountPomodoro();
      }
      syncPomodoroDock();
      syncPlayerDock();
      playerCarrier.classList.remove("player-carrier--focus");
      mountFilesView(viewRoot);
      return;
    }
    if (route === "calendar") {
      dock.hidden = false;
      if (hasIndexedDb) {
        void shared.mountPomodoro();
      }
      syncPomodoroDock();
      syncPlayerDock();
      playerCarrier.classList.remove("player-carrier--focus");
      mountCalendarView(viewRoot);
      return;
    }
    if (route === "settings") {
      dock.hidden = false;
      if (hasIndexedDb) {
        void shared.mountPomodoro();
      }
      syncPomodoroDock();
      syncPlayerDock();
      playerCarrier.classList.remove("player-carrier--focus");
      mountSettingsView(viewRoot);
      return;
    }

    dock.hidden = true;
    playerCarrier.classList.remove("player-carrier--parked");
    playerCarrier.classList.remove("player-carrier--dock");
    playerCarrier.classList.add("player-carrier--focus");
    sharedPlayerRoot.classList.remove("player--compact");

    void renderFocusView(viewRoot, shared).then((cleanups) => {
      if (currentRenderVersion !== renderVersion) {
        void Promise.all(cleanups.map(async (cleanup) => cleanup()));
        return;
      }
      activeCleanups = cleanups;
    });
  };

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.dataset.route as AppRoute | undefined;
      if (!route) {
        return;
      }
      navigateTo(route);
    });
  });

  subscribeRoute(renderRoute);
};
