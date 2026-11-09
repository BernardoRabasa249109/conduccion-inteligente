/** Imprime el programa de prueba con todos los bloques traducibles (para pegarlo en MakeCode). */
import { allBlocksWorkspace } from "../tests/allBlocks";
import { compileWorkspace } from "../src/program/compile";
import { exportMakeCode } from "../src/program/makecode";
const r = exportMakeCode(compileWorkspace(allBlocksWorkspace()));
console.log(r.compatible ? "COMPATIBLE" : "NO", JSON.stringify(r.missing));
console.log(r.code);
