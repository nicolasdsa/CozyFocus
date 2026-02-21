import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        focus: resolve(__dirname, "index.html"),
        files: resolve(__dirname, "files/index.html"),
        calendar: resolve(__dirname, "calendar/index.html"),
        roadmap: resolve(__dirname, "roadmap/index.html"),
        settings: resolve(__dirname, "settings/index.html")
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: []
  }
});
