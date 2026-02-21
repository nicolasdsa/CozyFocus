export type AppRoute = "focus" | "files" | "calendar" | "roadmap" | "settings";

type RouteHandler = (route: AppRoute) => void;

const ROUTE_PATHS: Record<AppRoute, string> = {
  focus: "/",
  files: "/files",
  calendar: "/calendar",
  roadmap: "/roadmap",
  settings: "/settings"
};

export const getRoutePath = (route: AppRoute): string => {
  return ROUTE_PATHS[route];
};

const listeners = new Set<RouteHandler>();
let currentRoute: AppRoute = "focus";
let started = false;

const normalizePath = (pathname: string): string => {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.replace(/\/+$/, "");
};

const parseRoute = (pathname: string): AppRoute => {
  const normalized = normalizePath(pathname);
  if (normalized === ROUTE_PATHS.files) {
    return "files";
  }
  if (normalized === ROUTE_PATHS.calendar) {
    return "calendar";
  }
  if (normalized === ROUTE_PATHS.roadmap) {
    return "roadmap";
  }
  if (normalized === ROUTE_PATHS.settings) {
    return "settings";
  }
  return "focus";
};

const normalizeLocation = (): AppRoute => {
  const { hash, pathname } = window.location;
  if (hash.startsWith("#/")) {
    const legacyPath = `/${hash.slice(2)}`;
    const route = parseRoute(legacyPath);
    window.history.replaceState(null, "", ROUTE_PATHS[route]);
    return route;
  }

  const route = parseRoute(pathname);
  const canonical = ROUTE_PATHS[route];
  if (normalizePath(pathname) !== canonical) {
    window.history.replaceState(null, "", canonical);
  }
  return route;
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
  currentRoute = normalizeLocation();
  window.addEventListener("popstate", () => {
    notify(parseRoute(window.location.pathname));
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
  const target = getRoutePath(route);
  if (normalizePath(window.location.pathname) !== target) {
    window.history.pushState(null, "", target);
  }
  notify(route);
};

export const getCurrentRoute = (): AppRoute => {
  ensureStarted();
  return currentRoute;
};
