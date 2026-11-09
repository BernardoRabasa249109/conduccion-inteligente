import type { WorkspaceJson } from "../program/compile";

/**
 * Solución de una práctica: un programa que se abre como ejemplo o una
 * explicación en texto (prácticas de explorar y conducir).
 *
 * Las soluciones NO están en este repositorio: viven en `docente/soluciones.ts`,
 * solo en el equipo del docente. La versión pública importa `@soluciones`, que
 * apunta a `sinSoluciones.ts` (vacío); la del docente (`npm run build:docente`)
 * apunta al archivo real. Ver `vite.config.ts`.
 */
export interface Solucion {
  solution?: () => WorkspaceJson;
  solutionText?: string;
}

/** Soluciones por número de práctica. */
export type Soluciones = Partial<Record<number, Solucion>>;
