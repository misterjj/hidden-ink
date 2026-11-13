import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { handleFicheRequest } from "./shared/fiche-url";

export default defineConfig({
  // En dev, Owlbear charge le manifest depuis un autre domaine.
  server: { cors: true },
  build: {
    rollupOptions: {
      input: {
        guide: resolve("index.html"),
        guideFr: resolve("fr/index.html"),
        background: resolve("background.html"),
        editor: resolve("editor.html"),
        statblock: resolve("statblock.html"),
        notes: resolve("notes.html"),
        notesList: resolve("notes-list.html"),
        settings: resolve("settings.html"),
      },
    },
  },
  plugins: [
    {
      // Même relais qu'en production (functions/api/fiche.ts), pour le dev local.
      name: "relais-aidedd-dev",
      configureServer(server) {
        server.middlewares.use("/api/fiche", async (req, res) => {
          const response = await handleFicheRequest(
            new URL(req.originalUrl ?? "", "http://localhost"),
          );
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        });
      },
    },
  ],
  test: { environment: "jsdom" },
});
