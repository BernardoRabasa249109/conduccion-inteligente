/// <reference types="vite/client" />

/** true solo en la versión del docente (`npm run build:docente`); false en la pública. */
declare const __DOCENTE__: boolean;

/** Soluciones de las prácticas: vacías en la versión pública (ver vite.config.ts). */
declare module "@soluciones" {
  export const SOLUCIONES: import("./practices/soluciones").Soluciones;
}
