import "./styles/base.css";
import { renderApp } from "./ui/render";
import { openCozyDB } from "./storage/db";
import coffeeIconUrl from "./assets/coffee.svg";

const setupDb = async () => {
  await openCozyDB();
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}

const faviconLink =
  document.querySelector<HTMLLinkElement>('link[rel~="icon"]') ?? document.createElement("link");
faviconLink.rel = "icon";
faviconLink.type = "image/svg+xml";
faviconLink.href = coffeeIconUrl;
if (!faviconLink.parentElement) {
  document.head.appendChild(faviconLink);
}

renderApp(appRoot);
setupDb().catch(() => {
  // Keep UI responsive even if IndexedDB is unavailable.
});
