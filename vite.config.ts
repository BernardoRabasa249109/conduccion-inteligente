import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
/** Solo en el equipo del docente: la carpeta docente/ está en .gitignore. */
const SOLUCIONES = here("./docente/soluciones.ts");
const SIN_SOLUCIONES = here("./src/practices/sinSoluciones.ts");

// Dos versiones del mismo simulador:
// · pública (npm run build → dist/): sin modo docente y sin soluciones. Es la de GitHub y Vercel.
// · docente (npm run build:docente → docente/simulador/): con modo docente y soluciones. Solo local.
// Un único archivo HTML con todo incluido: funciona con doble clic, sin servidor ni internet.
export default defineConfig(({ mode }) => {
  const docente = mode === "docente";
  if (docente && !existsSync(SOLUCIONES)) {
    throw new Error("Falta docente/soluciones.ts: la versión del docente solo se compila en el equipo del docente.");
  }
  // Las pruebas usan las soluciones si están en este equipo (comprueban que resuelven cada práctica).
  const conSoluciones = docente || (mode === "test" && existsSync(SOLUCIONES));
  return {
    base: "./",
    plugins: [viteSingleFile()],
    define: { __DOCENTE__: JSON.stringify(docente) },
    resolve: { alias: { "@soluciones": conSoluciones ? SOLUCIONES : SIN_SOLUCIONES } },
    build: {
      outDir: docente ? "docente/simulador" : "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
      assetsInlineLimit: 100000000,
      // Navegadores con WebGL 2. Con estos destinos, el CSS lleva los prefijos
      // -webkit- que Safari todavía necesita (backdrop-filter, user-select…).
      target: ["es2020", "chrome90", "edge90", "firefox90", "safari15"],
      cssTarget: ["chrome90", "edge90", "firefox90", "safari15"],
    },
    test: { environment: "node", include: ["tests/**/*.test.ts"] },
  };
});
