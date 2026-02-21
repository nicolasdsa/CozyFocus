import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));

const getMeta = (selector: string): string | null =>
  document.head.querySelector<HTMLMetaElement>(selector)?.content ?? null;

const setup = () => {
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  return root;
};

describe("seo metadata", () => {
  it("renders crawlable nav links with href targets", () => {
    setup();
    const navFocus = document.querySelector('[data-testid="nav-focus"]');
    const navCalendar = document.querySelector('[data-testid="nav-calendar"]');
    const navFiles = document.querySelector('[data-testid="nav-files"]');
    const navRoadmap = document.querySelector('[data-testid="nav-roadmap"]');
    const navSettings = document.querySelector('[data-testid="nav-settings"]');

    expect(navFocus?.tagName).toBe("A");
    expect(navCalendar?.tagName).toBe("A");
    expect(navFiles?.tagName).toBe("A");
    expect(navRoadmap?.tagName).toBe("A");
    expect(navSettings?.tagName).toBe("A");

    expect(navFocus?.getAttribute("href")).toBe("/");
    expect(navCalendar?.getAttribute("href")).toBe("/calendar");
    expect(navFiles?.getAttribute("href")).toBe("/files");
    expect(navRoadmap?.getAttribute("href")).toBe("/roadmap");
    expect(navSettings?.getAttribute("href")).toBe("/settings");
  });

  it("updates title, description, and canonical tags on route change", async () => {
    setup();
    expect(document.title).toContain("Focus Sessions");
    expect(getMeta('meta[name="description"]')).toContain("focus sessions");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toContain("/");

    const navFiles = document.querySelector<HTMLElement>('[data-testid="nav-files"]');
    if (!navFiles) {
      throw new Error("Missing files nav");
    }
    navFiles.click();
    await waitForRoute();

    expect(window.location.pathname).toBe("/files");
    expect(document.title).toContain("Files and Writing Archive");
    expect(getMeta('meta[name="description"]')).toContain("archive");
    expect(getMeta('meta[property="og:url"]')).toContain("/files");
    expect(getMeta('meta[name="twitter:title"]')).toContain("Files and Writing Archive");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toContain("/files");
  });

  it("sets aria-current on active nav route", async () => {
    setup();
    const navFocus = document.querySelector<HTMLElement>('[data-testid="nav-focus"]');
    const navCalendar = document.querySelector<HTMLElement>('[data-testid="nav-calendar"]');
    if (!navFocus || !navCalendar) {
      throw new Error("Missing nav links");
    }

    navFocus.click();
    await waitForRoute();
    expect(navFocus.getAttribute("aria-current")).toBe("page");
    expect(navCalendar.hasAttribute("aria-current")).toBe(false);

    navCalendar.click();
    await waitForRoute();
    expect(navFocus.hasAttribute("aria-current")).toBe(false);
    expect(navCalendar.getAttribute("aria-current")).toBe("page");
  });
});
