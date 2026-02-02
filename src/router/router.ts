export type AppRoute = "focus" | "files" | "calendar" | "settings";

type RouteHandler = (route: AppRoute) => void;

const ROUTE_HASHES: Record<AppRoute, string> = {
  focus: "#/focus",
  files: "#/files",
  calendar: "#/calendar",
  settings: "#/settings"
};

const listeners = new Set<RouteHandler>();
let currentRoute: AppRoute = "focus";
let started = false;

const parseRoute = (hash: string): AppRoute => {
  if (hash.startsWith(ROUTE_HASHES.files)) {
    return "files";
  }
  if (hash.startsWith(ROUTE_HASHES.calendar)) {
    return "calendar";
  }
  if (hash.startsWith(ROUTE_HASHES.settings)) {
    return "settings";
  }
  if (hash.startsWith(ROUTE_HASHES.focus)) {
    return "focus";
  }
  return "focus";
};

const notify = (route: AppRoute) => {
  if (route === currentRoute) {
    return;
  }
  currentRoute = route;
  listeners.forEach((handler) => {
    handler(route);
  });
};

const ensureStarted = () => {
  if (started) {
    return;
  }
  started = true;
  currentRoute = parseRoute(window.location.hash);
  window.addEventListener("hashchange", () => {
    notify(parseRoute(window.location.hash));
  });
};

export const subscribeRoute = (handler: RouteHandler): (() => void) => {
  ensureStarted();
  listeners.add(handler);
  handler(currentRoute);
  return () => {
    listeners.delete(handler);
  };
};

export const navigateTo = (route: AppRoute): void => {
  ensureStarted();
  const target = ROUTE_HASHES[route];
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
  notify(route);
};

export const getCurrentRoute = (): AppRoute => {
  ensureStarted();
  return currentRoute;
};
