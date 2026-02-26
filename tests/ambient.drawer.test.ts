import { describe, expect, it, vi } from "vitest";
import type { AmbientController } from "../src/features/ambient/ambientController";
import { createAmbientStore } from "../src/features/ambient/ambientStore";
import { renderApp } from "../src/ui/render";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }

  const store = createAmbientStore();
  const controller: AmbientController = {
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    toggle: vi.fn(async () => {}),
    togglePlay: vi.fn(async () => {}),
    setVolume: vi.fn(),
    setMasterVolume: vi.fn()
  };

  renderApp(root, {
    ambientController: controller,
    ambientStore: store
  });

  return { controller, store };
};

describe("ambient drawer", () => {
  it("opens and closes from the floating toggle button", async () => {
    setup();

    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
    const drawer = document.querySelector<HTMLElement>('[data-testid="ambient-drawer"]');
    const close = document.querySelector<HTMLButtonElement>('[data-testid="ambient-close"]');
    if (!toggle || !drawer || !close) {
      throw new Error("Missing ambient drawer controls");
    }

    expect(drawer.classList.contains("drawer--open")).toBe(false);

    toggle.click();
    expect(drawer.classList.contains("drawer--open")).toBe(true);

    close.click();
    expect(drawer.classList.contains("drawer--open")).toBe(false);
  });

  it("calls controller.toggle when a track toggle is clicked", () => {
    const { controller } = setup();
    const campfireToggle = document.querySelector<HTMLButtonElement>(
      '[data-testid="ambient-play-campfire"]'
    );
    if (!campfireToggle) {
      throw new Error("Missing ambient campfire toggle");
    }

    campfireToggle.click();
    expect(controller.toggle).toHaveBeenCalledWith("campfire");
  });
});
