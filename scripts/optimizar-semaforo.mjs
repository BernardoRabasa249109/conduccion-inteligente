// Copia optimizada del semáforo 3D para el simulador.
//
// Fuente: Semaforo_3D/modelos/semaforo.glb (350 piezas, 63 mil triángulos, 2.6 MB).
// Salida: modelo3D/Semaforo_simulador.glb
//   · una malla por material (7 en vez de 350 piezas: muchas menos llamadas de dibujo);
//   · sin coordenadas de textura (el modelo no usa texturas);
//   · geometría simplificada sin cambiar la silueta;
//   · cuantizada y comprimida con meshopt (Three.js la lee con MeshoptDecoder, unos 20 KB).
// Los nombres de los materiales (Lente_roja_apagada, …) se conservan: el simulador
// enciende cada lente por el nombre de su material.
//
// Uso: npm run semaforo
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("../Semaforo_3D/modelos/semaforo.glb");
const OUT = here("../modelo3D/Semaforo_simulador.glb");
/** Proporción de triángulos que se intenta conservar y error máximo (relativo al tamaño de cada malla). */
const RATIO = Number(process.env.RATIO ?? 0.35);
const ERROR = Number(process.env.ERROR ?? 0.002);

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
console.log(`antes:   ${before.mallas} mallas · ${before.triangulos} triángulos · ${kb(SRC)}`);
console.log(`después: ${after.mallas} mallas · ${after.triangulos} triángulos · ${kb(OUT)}`);
console.log("materiales:", doc.getRoot().listMaterials().map((m) => m.getName()).join(", "));
