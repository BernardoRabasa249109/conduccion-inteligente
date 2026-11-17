// Copias optimizadas de los modelos 3D para el simulador (semáforo y maniquí).
//
// Cada copia:
//   · tiene una malla por material (en vez de decenas o cientos de piezas: muchas menos llamadas de dibujo);
//   · no lleva coordenadas de textura (los modelos no usan texturas);
//   · tiene la geometría simplificada sin cambiar la silueta;
//   · va cuantizada y comprimida con meshopt (Three.js la lee con MeshoptDecoder, unos 20 KB).
// Los nombres de los materiales se conservan: el simulador enciende cada lente del
// semáforo por el nombre de su material (Lente_roja_apagada, …).
//
// Uso: npm run semaforo · npm run maniqui
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/** Fuente, salida y cuánto simplificar (proporción de triángulos y error máximo relativo al tamaño de cada malla). */
const MODELS = {
  // Semaforo_3D: 350 piezas, 63 mil triángulos, 2.5 MB.
  semaforo: { src: "../Semaforo_3D/modelos/semaforo.glb", out: "../modelo3D/Semaforo_simulador.glb", ratio: 0.35, error: 0.002 },
  // Maniquí de «Piezas Pista/Modelado de Maniqui»: 47 piezas, 55 mil triángulos. En el
  // simulador mide 14 cm, así que se puede simplificar más.
  maniqui: { src: "../Piezas Pista/Modelado de Maniqui/Maniqui_3D_OBJ_STL_GLB/Maniqui_3D/maniqui.glb", out: "../modelo3D/Maniqui_simulador.glb", ratio: 0.3, error: 0.004 },
};

const name = process.argv[2];
const model = MODELS[name];
if (!model) {
  console.error(`Uso: node scripts/optimizar-modelos.mjs <${Object.keys(MODELS).join("|")}>`);
  process.exit(1);
}
const SRC = here(model.src);
const OUT = here(model.out);
const RATIO = Number(process.env.RATIO ?? model.ratio);
const ERROR = Number(process.env.ERROR ?? model.error);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(SRC);
const count = () => {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
  return { mallas: doc.getRoot().listMeshes().length, triangulos: Math.round(tris) };
};
const before = count();

for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) p.setAttribute("TEXCOORD_0", null);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await doc.transform(
  dedup(),
  flatten(),
  join({ keepNamed: false }),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }),
  prune(),
  // Cuantiza y comprime (EXT_meshopt_compression). Three.js lo lee con MeshoptDecoder.
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
await io.write(OUT, doc);

const after = count();
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;
console.log(`${name} · antes:   ${before.mallas} mallas · ${before.triangulos} triángulos · ${kb(SRC)}`);
console.log(`${name} · después: ${after.mallas} mallas · ${after.triangulos} triángulos · ${kb(OUT)}`);
console.log("materiales:", doc.getRoot().listMaterials().map((m) => m.getName()).join(", "));
