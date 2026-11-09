/**
 * Escribe en ejemplos/ los escenarios y los programas de ejemplo como archivos
 * JSON que la aplicación puede abrir. Uso: npx vite-node scripts/export-examples.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "../src/scenarios/defaults";
import { EXAMPLES } from "../src/program/examples";
import { exportMakeCode } from "../src/program/makecode";
import { compileWorkspace } from "../src/program/compile";

const root = join(__dirname, "..", "ejemplos");
mkdirSync(join(root, "escenarios"), { recursive: true });
mkdirSync(join(root, "programas"), { recursive: true });
mkdirSync(join(root, "makecode"), { recursive: true });
for (const [id, make] of Object.entries(SCENARIOS)) writeFileSync(join(root, "escenarios", `${id}.json`), JSON.stringify(make(), null, 2));
for (const ex of EXAMPLES) {
  const scen = SCENARIOS[ex.scenario]();
  ex.setup?.(scen);
  if (ex.start) scen.start = ex.start;
  const file = { tipo: "conduccion-inteligente-proyecto", version: 1, nombre: ex.title, fecha: "2026-11-03T00:00:00.000Z", practica: null, programa: ex.build(), escenario: scen };
  writeFileSync(join(root, "programas", `${ex.id}.json`), JSON.stringify(file, null, 2));
  const mk = exportMakeCode(compileWorkspace(ex.build()));
  if (mk.compatible) writeFileSync(join(root, "makecode", `${ex.id}.ts`), mk.code);
}
console.log("ejemplos exportados");
