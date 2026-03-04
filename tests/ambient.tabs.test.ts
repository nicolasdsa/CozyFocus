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

  const toggle = document.querySelector<HTMLButtonElement>('[data-testid="ambient-toggle"]');
  if (!toggle) {
    throw new Error("Missing ambient toggle");
  }
  toggle.click();

  const soundsTab = document.querySelector<HTMLButtonElement>('[data-testid="ambient-tab-sounds"]');
  const visualsTab = document.querySelector<HTMLButtonElement>(
    '[data-testid="ambient-tab-visuals"]'
  );
  const panel = document.querySelector<HTMLElement>('[data-testid="ambient-panel"]');
  if (!soundsTab || !visualsTab || !panel) {
    throw new Error("Missing ambient tabs");
  }

  return { soundsTab, visualsTab, panel };
};

describe("ambient tabs", () => {
  it("defaults to Sounds when opening the drawer", () => {
    const { soundsTab, visualsTab, panel } = setup();

    expect(panel.getAttribute("data-active")).toBe("sounds");
    expect(soundsTab.classList.contains("ambient-tab--active")).toBe(true);
    expect(visualsTab.classList.contains("ambient-tab--active")).toBe(false);
  });

  it("switches to Visuals and toggles the switch animation class", () => {
    vi.useFakeTimers();
    try {
      const { visualsTab, panel } = setup();

      visualsTab.click();

      expect(panel.getAttribute("data-active")).toBe("visuals");
      expect(panel.classList.contains("ambient-panel--switching")).toBe(true);

      vi.advanceTimersByTime(220);
      expect(panel.classList.contains("ambient-panel--switching")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns to Sounds when the Sounds tab is clicked again", () => {
    const { soundsTab, visualsTab, panel } = setup();

    visualsTab.click();
    expect(panel.getAttribute("data-active")).toBe("visuals");

    soundsTab.click();
    expect(panel.getAttribute("data-active")).toBe("sounds");
  });
});
