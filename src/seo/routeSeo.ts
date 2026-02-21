import type { AppRoute } from "../router/router";
import { getRoutePath } from "../router/router";

interface RouteSeo {
  title: string;
  description: string;
}

const BASE_TITLE = "CozyFocus";

const ROUTE_SEO: Record<AppRoute, RouteSeo> = {
  focus: {
    title: `${BASE_TITLE} | Focus Sessions and Daily Flow`,
    description:
      "Run calm focus sessions with a Pomodoro timer, quick notes, and a task queue in one offline-first workspace."
  },
  files: {
    title: `${BASE_TITLE} | Files and Writing Archive`,
    description:
      "Capture, search, tag, and organize notes in your personal archive with Markdown editing and local-first storage."
  },
  calendar: {
    title: `${BASE_TITLE} | Calendar Productivity Overview`,
    description:
      "Review month, week, and day productivity signals including focus time, tasks, files, and notes activity."
  },
  settings: {
    title: `${BASE_TITLE} | Settings and Data Controls`,
    description:
      "Manage preferences and local data with export, import, and cleanup controls while keeping your workspace private."
  }
};

const upsertMeta = (
  lookup: string,
  attrs: Record<string, string>,
  content: string
): HTMLMetaElement => {
  const existing = document.head.querySelector<HTMLMetaElement>(lookup);
  const element = existing ?? document.createElement("meta");
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  element.content = content;
  if (!existing) {
    document.head.appendChild(element);
  }
  return element;
};

const upsertCanonical = (href: string): HTMLLinkElement => {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const element = existing ?? document.createElement("link");
  element.rel = "canonical";
  element.href = href;
  if (!existing) {
    document.head.appendChild(element);
  }
  return element;
};

const toAbsolute = (path: string): string => {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
};

export const applyRouteSeo = (route: AppRoute): void => {
  const seo = ROUTE_SEO[route];
  const absoluteUrl = toAbsolute(getRoutePath(route));

  document.documentElement.lang = "en";
  document.title = seo.title;

  upsertCanonical(absoluteUrl);

  upsertMeta('meta[name="description"]', { name: "description" }, seo.description);
  upsertMeta('meta[name="robots"]', { name: "robots" }, "index, follow");

  upsertMeta('meta[property="og:type"]', { property: "og:type" }, "website");
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, BASE_TITLE);
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, seo.title);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, seo.description);
  upsertMeta('meta[property="og:url"]', { property: "og:url" }, absoluteUrl);
  upsertMeta('meta[property="og:image"]', { property: "og:image" }, toAbsolute("/og-cover.svg"));
  upsertMeta(
    'meta[property="og:image:alt"]',
    { property: "og:image:alt" },
    "CozyFocus productivity workspace preview"
  );

  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, seo.title);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, seo.description);
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, toAbsolute("/og-cover.svg"));
};
