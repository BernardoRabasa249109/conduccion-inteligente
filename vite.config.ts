import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Un único archivo HTML con todo incluido: funciona con doble clic, sin servidor ni internet.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
    // Navegadores con WebGL 2. Con estos destinos, el CSS lleva los prefijos
    // -webkit- que Safari todavía necesita (backdrop-filter, user-select…).
    target: ["es2020", "chrome90", "edge90", "firefox90", "safari15"],
    cssTarget: ["chrome90", "edge90", "firefox90", "safari15"],
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
