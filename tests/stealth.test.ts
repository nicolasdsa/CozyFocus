import { describe, expect, it, afterEach } from "vitest";
import { renderApp } from "../src/ui/render";
import { POMODORO_COMPLETED_EVENT } from "../src/features/stealth/stealth";

const setup = () => {
  document.body.className = "";
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const toggle = document.querySelector<HTMLButtonElement>(
    '[data-testid="stealth-toggle"]'
  );
  if (!toggle) {
    throw new Error("Missing stealth toggle");
  }
  return { toggle };
};

afterEach(() => {
  document.dispatchEvent(new MouseEvent("mousemove"));
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("stealth", () => {
  it("enables stealth on toggle click", () => {
    const { toggle } = setup();
    toggle.click();
    expect(document.body.classList.contains("stealth")).toBe(true);
  });

  it("disables stealth on mousemove", () => {
    const { toggle } = setup();
    toggle.click();
    document.dispatchEvent(new MouseEvent("mousemove"));
    expect(document.body.classList.contains("stealth")).toBe(false);
  });

  it("disables stealth on pomodoro completion event", () => {
    const { toggle } = setup();
    toggle.click();
    document.dispatchEvent(new CustomEvent(POMODORO_COMPLETED_EVENT));
    expect(document.body.classList.contains("stealth")).toBe(false);
  });
});
