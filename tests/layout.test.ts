import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  return root;
};

describe("layout", () => {
  it("renders key UI regions", () => {
    setup();
    expect(document.querySelector('[data-testid="nav"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="task-queue"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="pomodoro"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="quick-notes"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="fullscreen-toggle"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="player"]')).toBeTruthy();
  });
});
