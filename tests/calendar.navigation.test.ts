import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render";

const setup = () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }
  renderApp(root);
  const navCalendar = document.querySelector<HTMLButtonElement>(
    '[data-testid="nav-calendar"]'
  );
  if (!navCalendar) {
    throw new Error("Missing Calendar nav button");
  }
  return { root, navCalendar };
};

const waitForRoute = async () => new Promise((resolve) => setTimeout(resolve, 0));

const formatKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("calendar navigation", () => {
  it("clicking nav-calendar mounts calendar-view without reload", async () => {
    const { navCalendar } = setup();
    const baseHref = window.location.href.split("#")[0];
    navCalendar.click();
    await waitForRoute();
    expect(document.querySelector('[data-testid="calendar-view"]')).toBeTruthy();
    expect(window.location.hash).toBe("#/calendar");
    expect(window.location.href.startsWith(baseHref)).toBe(true);
  });

  it("calendar-grid exists and has 7 columns header row", async () => {
    const { navCalendar } = setup();
    navCalendar.click();
    await waitForRoute();
    const grid = document.querySelector('[data-testid="calendar-grid"]');
    expect(grid).toBeTruthy();
    const weekdays = document.querySelectorAll(".calendar-grid__weekday");
    expect(weekdays.length).toBe(7);
  });

  it("default selected day is today and drawer is visible", async () => {
    const { navCalendar } = setup();
    navCalendar.click();
    await waitForRoute();
    const today = new Date();
    const dayCell = document.querySelector(
      `[data-testid="day-${formatKey(today)}"]`
    ) as HTMLElement | null;
    expect(dayCell).toBeTruthy();
    expect(dayCell?.classList.contains("day--selected")).toBe(true);
    const drawer = document.querySelector('[data-testid="calendar-drawer"]') as HTMLElement | null;
    expect(drawer).toBeTruthy();
    expect(drawer?.hasAttribute("hidden")).toBe(false);
  });
});
