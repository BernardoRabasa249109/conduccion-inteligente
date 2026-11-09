import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileWorkspace } from "../src/program/compile";
import { EXAMPLES } from "../src/program/examples";
import { exportMakeCode } from "../src/program/makecode";
import { SOLUCIONES } from "@soluciones";
import { allBlocksWorkspace } from "./allBlocks";

const norm = (n: string) => n.split("\\").join("/");
const DIR = norm(join(__dirname, "makecode"));
const LIB = ["microbit-core.d.ts", "tinybit-main.ts"].map((f) => ({ name: `${DIR}/${f}`, text: readFileSync(join(DIR, f), "utf8") }));

/** Compila el código exportado junto con la extensión oficial. Devuelve los errores. */
function typecheck(code: string): string[] {
  const files = new Map<string, string>(LIB.map((f) => [f.name, f.text]));
  const main = `${DIR}/programa.ts`;
  files.set(main, code);
  const opts: ts.CompilerOptions = { noEmit: true, target: ts.ScriptTarget.ES2017, strict: false, noLib: false, lib: ["lib.es2017.d.ts"], types: [] };
  const host = ts.createCompilerHost(opts);
  const orig = host.getSourceFile;
  host.getSourceFile = (name, lang) => (files.has(norm(name)) ? ts.createSourceFile(name, files.get(norm(name))!, lang) : orig(name, lang));
  host.fileExists = (n) => files.has(norm(n)) || ts.sys.fileExists(n);
  host.readFile = (n) => files.get(norm(n)) ?? ts.sys.readFile(n);
  const program = ts.createProgram([...files.keys()], opts, host);
  return ts.getPreEmitDiagnostics(program).map((d) => `${d.file?.fileName.split(/[\/]/).pop()}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
}

describe("exportación a MakeCode", () => {
  it("la extensión oficial compila con las declaraciones del núcleo", () => {
    expect(typecheck("let x = 0\n")).toEqual([]);
  });

  const compatibles = ["avanzar-parar", "seguidor-basico", "recuperar-linea", "obstaculo", "sensor-estacionamiento", "media-vuelta", "botones-velocidad", "rodear-obstaculo"];
  for (const id of compatibles) {
    it(`ejemplo «${id}»: compatible y compila contra Tinybit oficial`, () => {
      const res = exportMakeCode(compileWorkspace(EXAMPLES.find((e) => e.id === id)!.build()));
      expect(res.compatible).toBe(true);
      expect(typecheck(res.code)).toEqual([]);
      expect(typecheck(exportMakeCode(compileWorkspace(EXAMPLES.find((e) => e.id === id)!.build()), "V1").code)).toEqual([]);
    });
  }

  for (const id of ["semaforo", "zona-30", "elegir-giro", "estacionar", "prioridades", "seguidor-inteligente", "cronometro", "mision"]) {
    it(`ejemplo «${id}»: usa visión, NO se marca como compatible`, () => {
      const res = exportMakeCode(compileWorkspace(EXAMPLES.find((e) => e.id === id)!.build()));
      expect(res.compatible).toBe(false);
      expect(res.missing.map((m) => m.block)).toContain("la cámara ve …");
    });
  }

  // Solo en el equipo del docente, donde están las soluciones (docente/soluciones.ts).
  it.skipIf(!Object.keys(SOLUCIONES).length)("las soluciones sin visión de las prácticas compilan", () => {
    for (const [n, s] of Object.entries(SOLUCIONES)) {
      if (!s?.solution) continue;
      const res = exportMakeCode(compileWorkspace(s.solution()));
      if (!res.compatible) continue;
      expect(typecheck(res.code), `práctica ${n}`).toEqual([]);
    }
  });

  it("un programa con TODOS los bloques traducibles compila (V2 y V1)", () => {
    for (const v of ["V2", "V1"] as const) {
      const res = exportMakeCode(compileWorkspace(allBlocksWorkspace()), v);
      expect(res.compatible).toBe(true);
      expect(typecheck(res.code)).toEqual([]);
    }
  });

  it("la comprobación local detecta comparaciones imposibles, como MakeCode", () => {
    expect(typecheck('let e = ""\nif (e == "A") { if (e != "B") { basic.pause(1) } }\n').length).toBeGreaterThan(0);
  });

  it("un nombre de función inventado NO compila (la prueba detecta errores)", () => {
    expect(typecheck("Tinybit.CarAvanzar(100)\n").length).toBeGreaterThan(0);
  });
});
