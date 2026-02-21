import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = () => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);

  const navRoadmap = document.querySelector<HTMLElement>('[data-testid="nav-roadmap"]');
  const navSettings = document.querySelector<HTMLElement>('[data-testid="nav-settings"]');
  if (!navRoadmap || !navSettings) {
    throw new Error("Missing roadmap or settings nav button");
  }

  return { navRoadmap, navSettings };
};

const readCardTitles = (root: Element): string[] => {
  return Array.from(root.querySelectorAll<HTMLElement>(".roadmap-card__title"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter((title) => title.length > 0);
};

describe("roadmap view", () => {
  it("clicking nav-roadmap mounts roadmap view without page reload", async () => {
    const { navRoadmap } = setup();
    const baseHref = window.location.href.split("#")[0];

    navRoadmap.click();
    await waitForRoute();

    expect(document.querySelector('[data-testid="roadmap-view"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="roadmap-title"]')?.textContent?.trim()).toBe(
      "Product Roadmap"
    );
    expect(window.location.pathname).toBe("/roadmap");
    expect(window.location.href.startsWith(baseHref)).toBe(true);
  });

  it("renders roadmap columns and expected card titles", async () => {
    const { navRoadmap } = setup();
    navRoadmap.click();
    await waitForRoute();

    const planned = document.querySelector<HTMLElement>('[data-testid="roadmap-col-planned"]');
    const progress = document.querySelector<HTMLElement>('[data-testid="roadmap-col-progress"]');
    const done = document.querySelector<HTMLElement>('[data-testid="roadmap-col-done"]');

    if (!planned || !progress || !done) {
      throw new Error("Missing roadmap columns");
    }

    const plannedTitles = readCardTitles(planned);
    const progressTitles = readCardTitles(progress);
    const doneTitles = readCardTitles(done);

    expect(plannedTitles).toEqual([
      "Dynamic and fixed background update",
      "Pomodoro extension"
    ]);
    expect(progressTitles).toEqual(["Ambient sounds"]);
    expect(doneTitles).toEqual(["Version 1.0 completed"]);

    expect(planned.querySelectorAll("[data-testid^='roadmap-card-']").length).toBe(2);
    expect(progress.querySelectorAll("[data-testid^='roadmap-card-']").length).toBe(1);
    expect(done.querySelectorAll("[data-testid^='roadmap-card-']").length).toBe(1);
  });

  it("places roadmap button directly above settings in navbar", () => {
    const { navRoadmap, navSettings } = setup();

    expect(navRoadmap.parentElement).toBe(navSettings.parentElement);
    expect(navRoadmap.nextElementSibling).toBe(navSettings);
  });
});
