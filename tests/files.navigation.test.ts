import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const navFiles = document.querySelector<HTMLButtonElement>(
    '[data-testid="nav-files"]'
  );
  if (!navFiles) {
    throw new Error("Missing Files nav button");
  }
  return { root, navFiles };
};

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));

describe("files navigation", () => {
  it("renders default view", () => {
    setup();
    expect(document.querySelector('[data-testid="pomodoro"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="files-view"]')).toBeFalsy();
  });

  it("clicking nav-files renders files-view without page reload", async () => {
    const { navFiles } = setup();
    const baseHref = window.location.href.split("#")[0];
    navFiles.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="files-view"]')).toBeTruthy();
    expect(window.location.hash).toBe("#/files");
    expect(window.location.href.startsWith(baseHref)).toBe(true);
  });

  it("ensures files-list and files-editor exist", async () => {
    const { navFiles } = setup();
    navFiles.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="files-list"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="files-editor"]')).toBeTruthy();
  });
});
