import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const navSettings = document.querySelector<HTMLButtonElement>(
    '[data-testid="nav-settings"]'
  );
  if (!navSettings) {
    throw new Error("Missing Settings nav button");
  }
  return { root, navSettings };
};

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));

describe("settings navigation", () => {
  it("clicking nav-settings renders settings-view without page reload", async () => {
    const { navSettings } = setup();
    const baseHref = window.location.href.split("#")[0];
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="settings-view"]')).toBeTruthy();
    expect(window.location.hash).toBe("#/settings");
    expect(window.location.href.startsWith(baseHref)).toBe(true);
  });

  it("renders settings sections by testid", async () => {
    const { navSettings } = setup();
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="settings-title"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-about"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-repo"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="settings-data"]')).toBeTruthy();
  });

  it("renders data management buttons by testid", async () => {
    const { navSettings } = setup();
    navSettings.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="data-export"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="data-import"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="data-delete"]')).toBeTruthy();
  });
});
