import "./styles/base.css";
import { renderApp } from "./ui/render";
import { openCozyDB } from "./storage/db";

const setupDb = async () => {
  await openCozyDB();
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}

renderApp(appRoot);
setupDb().catch(() => {
  // Keep UI responsive even if IndexedDB is unavailable.
});
