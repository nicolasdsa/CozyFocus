import "./styles/base.css";
import { openDB } from "idb";
import { renderApp } from "./ui/render";

const setupDb = async () => {
  await openDB("cozyfocus", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("notes")) {
        db.createObjectStore("notes", { keyPath: "id" });
      }
    }
  });
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}

renderApp(appRoot);
setupDb().catch(() => {
  // Keep UI responsive even if IndexedDB is unavailable.
});
