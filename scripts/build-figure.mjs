/**
 * Figura isométrica del Tiny:bit Pro (skill Anatomy) para el espacio «Explorar».
 * El robot está sobre un banco de pruebas: sus ruedas giran sobre rodillos y
 * una regleta deslizante lleva la línea negra bajo los dos sensores infrarrojos.
 * Delante, una pantalla para el ultrasonido y, a un lado, una señal para la cámara.
 *
 * Medidas en mm (las mismas que usa el simulador en src/core/config.ts),
 * multiplicadas por U para trabajar a ≈1 px por unidad.
 * Uso: node scripts/build-figure.mjs  →  escribe src/anatomy/robotFigure.gen.ts
 *      node scripts/build-figure.mjs --page  →  además, páginas de verificación en scripts/out/.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../vendor/anatomy-kit/iso-kit.mjs";
import * as G from "../vendor/anatomy-kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const U = 3;
const m = (v) => v * U;
const p3 = (x, y, z) => [m(x), m(y), m(z)];
const W = 820, H = 660;

// ── Medidas del robot (mm) ──
const GROUND = 22; // el robot está levantado sobre los rodillos
const WHEEL_R = 21.5, WHEEL_W = 17, TRACK = 84;
const AXLE_Z = GROUND + WHEEL_R;
const CH_Z0 = GROUND + 25.7, CH_Z1 = GROUND + 27.5;
const SENSOR_X = 46, SENSOR_Y = 7, LINE_HALF = 12;
const SONAR_X = 52, SONAR_Z = GROUND + 34;
const CAM_Z = GROUND + 128;
const CASE_Z0 = GROUND + 110; // base de la caja del K210 (11 cm, como en el modelo 3D)
const CAM_FX = 12.9; // frente del acrílico, donde nace la lente
const TARGET_X = 126;
const SIGN = [118, -52];

const BASE = { x: m(-78), y: m(-86), w: m(226), d: m(172), r: m(4) };
const P = k.fitProjection(
  [...k.boxCorners(BASE, m(-20), 0), p3(-10, -33, 190), p3(-10, 33, 190), p3(SIGN[0], SIGN[1], CAM_Z + 24)],
  W,
  H,
  { pad: 20, azimuth: 56, elevation: 28 },
);
const at = (pt) => k.iso(pt, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);

// Cada pieza es un elemento con su profundidad: se pintan de atrás hacia delante.
const items = [];
const put = (center, svg, comp = null, bias = 0) => items.push({ depth: k.depthOf(center, P) + bias, svg, comp });
// Lo que va bajo el chasis se pinta antes que él, para que el borde del chasis lo tape.
const CHASSIS_DEPTH = () => k.depthOf(p3(16, 0, CH_Z0), P) - 60;
const putUnder = (center, svg, comp, order) => items.push({ depth: CHASSIS_DEPTH() - 10 + order, svg, comp });
const wrap = (svg, comp) => (comp ? `<g data-comp="${comp}">${svg}</g>` : svg);

// ───────── Banco ─────────
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, m(-20), m(14), P)}"/>`];
  for (const [x, y] of k.corners(BASE, m(16))) {
    out.push(S(k.cylinder(x, y, m(6), m(-20), m(1.5), P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, m(4.6), m(-18.5), m(4.5), P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, m(-14), m(14), P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, m(4)), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, m(9));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, m(2.4), 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // Regla frontal con marcas cada 5 mm (mayores cada 25 mm).
  const strip = { x: m(-66), y: m(74), w: m(200), d: m(7), r: m(0.6) };
  out.push(S(k.slabOf(strip, 0, m(0.6), P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + m(3), strip.x + strip.w - m(3), m(5), 5, strip.y + m(0.6), m(0.6), [m(1.6), m(3.2)], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // Placa con el nombre y tres líneas de texto grabado.
  const plate = { x: m(72), y: m(40), w: m(60), d: m(26), r: m(1.5) };
  out.push(S(k.slabOf(plate, 0, m(0.8), P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(plate, m(3)).map(([x, y]) => at([x, y, m(0.8)])), { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([plate.x + m(6), plate.y + m(9)], m(0.8), P, "x"), "TINY:BIT PRO", { size: 10, tone: "mid" }));
  for (let i = 0; i < 3; i++) out.push(L(k.lineOnTop([plate.x + m(6), plate.y + m(14 + i * 3.6)], [plate.x + m(i === 2 ? 34 : 52), plate.y + m(14 + i * 3.6)], m(0.8), P), { tone: "faint", free: true }));
  return out.join("");
}

// ───────── Rodillos bajo las ruedas ─────────
function rollers() {
  for (const side of [1, -1]) {
    const yc = side * (TRACK / 2);
    for (const yPlate of [yc - side * 13, yc + side * 13]) {
      const plan = { x: m(-24), y: m(yPlate - 1.2), w: m(48), d: m(2.4), r: m(0.8) };
      put(p3(0, yPlate, 9), S(k.slabOf(plan, 0, m(19), P, 3, 0.4), { tone: "mid" }));
    }
    for (const x of [-12, 12]) {
      const F = G.frameAlong(p3(x, yc - 12, 16.5), [0, 1, 0]);
      const roll = G.solidOf([[0, m(8)], [m(1), m(8), 1], [m(23), m(8), 1], [m(24), m(8)]], F, P);
      const ribs = G.ribsOf(F, m(2), m(22), m(8), 18, P, { fade: [0.05, 0.4] });
      put(p3(x, yc, 16.5), S(roll, { tone: "mid", inner: k.fadedSvg(ribs, { tone: "faint" }) }));
      put(p3(x, yc + side * 13.5, 16.5), D([at(p3(x, yc + side * 13.6, 16.5))], { size: 0.6, tone: "hi" }), null, 2);
    }
  }
}

// ───────── Regleta con la línea (se desplaza en y) ─────────
const SLED = { x: m(28), y: m(-36), w: m(38), d: m(72), r: m(1.5) };
function rails() {
  for (const x of [29, 61]) {
    const plan = { x: m(x), y: m(-70), w: m(4), d: m(140), r: m(0.8) };
    put(p3(x + 2, 0, 6), S(k.slabOf(plan, 0, m(11), P, 3, 0.4), { tone: "mid" }) + D([-64, 64].map((y) => at(p3(x + 2, y, 11))), { size: 0.45 }));
  }
  for (const y of [-74, 70]) {
    const plan = { x: m(26), y: m(y), w: m(42), d: m(4), r: m(0.8) };
    put(p3(47, y + 2, 8), S(k.slabOf(plan, 0, m(16), P, 3, 0.5), { tone: "mid" }));
  }
  // Escala de desplazamiento en el riel delantero.
  const ticks = k.topTicks(m(-40), m(40), m(2), 5, m(65), m(11), [m(1.2), m(2.4)], P, "y");
  put(p3(64, 0, 11), L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }), null, 1);
}

function sled() {
  const out = [];
  out.push(S(k.slabOf(SLED, m(11), m(10), P, 4, 0.6), { tone: "hi", crease: "lo" }));
  // Línea negra de 24 mm (la misma anchura que en la pista del simulador).
  const ink = { x: SLED.x + m(1), y: m(-LINE_HALF), w: SLED.w - m(2), d: m(LINE_HALF * 2) };
  const corners = [[ink.x, ink.y], [ink.x + ink.w, ink.y], [ink.x + ink.w, ink.y + ink.d], [ink.x, ink.y + ink.d]].map(([x, y]) => at([x, y, m(21.05)]));
  out.push(`<path class="fig-ink" d="M${corners.map((c) => c.join(" ")).join("L")}Z"/>`);
  out.push(L(k.planOutline(k.insetPlan(SLED, m(2.5)), m(21), P, 4), { tone: "faint" }));
  out.push(L(k.lineOnTop([m(63), 0], [m(67), 0], m(21), P), { tone: "lit" }));
  // Pomo moleteado para empujar la regleta.
  const F = G.frameAlong(p3(47, 36, 16), [0, 1, 0]);
  out.push(S(G.solidOf([[0, m(3)], [m(3), m(3)], [m(3), m(6)], [m(10), m(6)]], F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, m(3.5), m(9.5), m(6), 28, P, { fade: [0.05, 0.4] }), { tone: "lo" }) }));
  return out.join("");
}

// ───────── Robot ─────────
function chassisRing() {
  const ring = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const x = 16 + Math.cos(a) * 49;
    let y = Math.sin(a) * 49;
    if (Math.abs(x) < 27 && Math.abs(y) > 31.5) y = Math.sign(y) * 31.5;
    ring.push([m(x), m(y)]);
  }
  return ring;
}

function wheel(side) {
  const yc = side * (TRACK / 2);
  const F = G.frameAlong(p3(0, yc - (WHEEL_W / 2) * side, AXLE_Z), [0, side, 0]);
  const prof = [[0, m(15)], [0, m(19.5), 1], [m(1.5), m(21.2), 1], [m(8.5), m(21.6), 1], [m(15.5), m(21.2), 1], [m(17), m(19.5), 1], [m(17), m(15)]];
  const tire = G.solidOf(prof, F, P);
  const frames = [];
  for (let f = 0; f < 12; f++) {
    const ribs = G.ribsOf(F, m(1.2), m(15.8), m(21.5), 26, P, { phase: (f / 12) * ((Math.PI * 2) / 26), fade: [0.05, 0.42] });
    frames.push(ribs.filter((r) => r.alpha > 0.02).map((r) => r.d).join(""));
  }
  const comp = side > 0 ? "motorL" : "motorR";
  const hubF = G.frameAlong(p3(0, yc + (WHEEL_W / 2 + 0.6) * side, AXLE_Z), [0, side, 0]);
  const svg =
    S(tire, { tone: "hi", inner: `<path class="iso-line fig-tread" data-wheel="${comp}" data-tone="lo" d="${frames[0]}"/>` }) +
    (side > 0 ? S(G.disc(0, m(1.2), m(13), hubF, P), { tone: "hi" }) + L(G.circleOf(hubF, m(1.2), m(9), P), { tone: "faint" }) + D([at(p3(0, yc + (WHEEL_W / 2 + 1.8) * side, AXLE_Z))], { size: 0.9, tone: "hi" }) : "");
  put(p3(0, yc + side * 4, AXLE_Z), wrap(svg, comp), comp, side > 0 ? 40 : -40);
  return frames;
}

function motors() {
  for (const side of [1, -1]) {
    const comp = side > 0 ? "motorL" : "motorR";
    const F = G.frameAlong(p3(0, side * 8, AXLE_Z), [0, side, 0]);
    const can = G.solidOf([[0, m(6.2)], [m(1), m(6.2), 1], [m(16), m(6.2), 1], [m(17), m(6.2)]], F, P);
    put(p3(0, side * 16, AXLE_Z), wrap(S(can, { tone: "mid", inner: L(G.arcOf(F, m(5), m(6.2), P), { tone: "faint" }) }), comp), comp);
    const gb = { x: m(-6.5), y: m(side > 0 ? 25 : -33.4), w: m(13), d: m(8.4), r: m(1) };
    put(p3(0, side * 29, AXLE_Z), wrap(S(k.slabOf(gb, m(AXLE_Z - 6), m(12), P, 3, 0.4), { tone: "mid" }), comp), comp);
  }
}

function chassis() {
  const ring = chassisRing();
  const paths = k.extrude(ring, m(CH_Z0), m(CH_Z1 - CH_Z0), P, { convex: false, bevel: 0.5 });
  const out = [S(paths, { tone: "hi" })];
  out.push(L(k.onTop(ring.map(([x, y]) => [x * 0.94 + m(16) * 0.06, y * 0.94]), m(CH_Z1), P, true), { tone: "faint" }));
  for (const side of [1, -1]) out.push(L(k.onTop([[m(34), m(side * 12)], [m(50), m(side * 26)], [m(30), m(side * 30)]], m(CH_Z1), P, true), { tone: "lo" }));
  out.push(D([[56, 18], [56, -18], [-20, 22], [-20, -22], [-28, 0]].map(([x, y]) => at(p3(x, y, CH_Z1))), { size: 0.55, tone: "mid" }));
  out.push(S(k.slabOf({ x: m(-26), y: m(22), w: m(6), d: m(10), r: m(1) }, m(CH_Z1), m(4), P, 3, 0.3), { tone: "mid" }));
  put(p3(16, 0, CH_Z0), out.join(""), null, -60);
}

function underside() {
  putUnder(p3(34, 0, GROUND + 18), S(k.cylinder(m(34), 0, m(9), m(GROUND + 12), m(CH_Z0 - GROUND - 12), P, 32, 0.4), { tone: "mid" }), null, 1);
  putUnder(p3(34, 0, GROUND + 8.5), S(G.sphereOf(p3(34, 0, GROUND + 8.5), m(8.5), P), { tone: "hi" }), null, 2);
  for (const [side, comp] of [[1, "irL"], [-1, "irR"]]) {
    const plan = { x: m(SENSOR_X - 3), y: m(side * SENSOR_Y - 2.6), w: m(6), d: m(5.2), r: m(0.6) };
    putUnder(p3(SENSOR_X, side * SENSOR_Y, GROUND + 18), wrap(S(k.slabOf(plan, m(GROUND + 12), m(CH_Z0 - GROUND - 12), P, 3, 0.3), { tone: "mid" }), comp), comp, side > 0 ? 5 : 4);
  }
}

function microbit() {
  // Soporte negro alto, como en el modelo 3D: la placa queda a 44 mm del suelo.
  const z = GROUND + 44.3;
  const holder = { x: m(9), y: m(-25), w: m(20), d: m(50), r: m(1.2) };
  put(p3(19, 0, (CH_Z1 + z) / 2), wrap(S(k.slabOf(holder, m(CH_Z1), m(z - CH_Z1), P, 3, 0.5), { tone: "mid" }), "microbit"), "microbit");
  const board = { x: m(-5), y: m(-26), w: m(42), d: m(52), r: m(2) };
  const top = z + 1.2;
  let svg = S(k.slabOf(board, m(z), m(1.2), P, 6, 0.5), { tone: "hi" });
  for (let i = -10; i <= 10; i++) svg += L(k.lineOnTop([m(-4.5), m(i * 2.3)], [m(-1), m(i * 2.3)], m(top), P), { tone: "lo" });
  svg += L(k.lineOnTop([m(-1), m(-24)], [m(-1), m(24)], m(top), P), { tone: "faint" });
  for (const side of [1, -1]) svg += S(k.cylinder(m(21), m(side * 20), m(2.8), m(top), m(1.5), P, 20, 0.3), { tone: "mid" });
  put(p3(16, 0, z), wrap(svg, "microbit"), "microbit", 5);
  const leds = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const [sx, sy] = at(p3(27 - row * 5.5, 11 - col * 5.5, top + 0.1));
    leds.push(`<circle class="fig-led" data-led="${row * 5 + col}" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.3"/>`);
  }
  put(p3(16, 0, top + 0.2), wrap(`<g class="fig-leds">${leds.join("")}</g>`, "leds"), "leds", 6);
}

// Ultrasonido como en el modelo 3D: placa de pie sobre el chasis (sin
// atravesarlo), dos cápsulas abiertas con la malla hundida y el cristal arriba.
function sonar() {
  const board = { x: m(SONAR_X), y: m(-22), w: m(1.6), d: m(44), r: m(0.4) };
  let svg = S(k.slabOf(board, m(CH_Z1), m(SONAR_Z + 10 - CH_Z1), P, 3, 0.3), { tone: "mid" });
  svg += D([[SONAR_X + 1.6, 19, SONAR_Z + 7.5], [SONAR_X + 1.6, -19, SONAR_Z + 7.5]].map((pt) => at(p3(...pt))), { size: 0.5, tone: "lo" });
  svg += S(k.slabOf({ x: m(SONAR_X + 1.6), y: m(-4.5), w: m(2), d: m(9), r: m(0.8) }, m(SONAR_Z + 5.7), m(3.5), P, 3), { tone: "hi" });
  put(p3(SONAR_X, 0, SONAR_Z), wrap(svg, "sonar"), "sonar", 4);
  for (const y of [12.5, -12.5]) {
    const F = G.frameAlong(p3(SONAR_X + 1.6, y, SONAR_Z), [1, 0, 0]);
    const can = G.solidOf([[0, m(8)], [m(12), m(8)]], F, P);
    // Borde fino del tubo y, dentro, la malla oscura con su trama.
    const mesh = S(G.disc(m(11.4), m(0.1), m(7.2), F, P), { tone: "lo" }) + L(G.circleOf(F, m(11.5), m(4.6), P), { tone: "faint" }) + L(G.circleOf(F, m(11.5), m(2), P), { tone: "faint" });
    put(p3(SONAR_X + 6, y, SONAR_Z), wrap(S(can, { tone: "hi" }) + mesh, "sonar"), "sonar", 8);
  }
}

// Faros RGB como en el modelo 3D: cápsulas translúcidas con cúpula, apoyadas
// en el borde delantero del chasis, a los dos lados del ultrasonido.
const LAMP_Z = GROUND + 31.5;
function headlights() {
  for (const y of [30, -30]) {
    const F = G.frameAlong(p3(45.5, y, LAMP_Z), [1, 0, 0]);
    const body = G.solidOf([[0, m(5)], [m(9), m(5)], [m(10.3), m(4.83), 1], [m(11.5), m(4.33), 1], [m(12.5), m(3.54), 1], [m(13.3), m(2.5), 1], [m(13.8), m(1.3), 1], [m(14), m(0.1)]], F, P);
    const seam = L(G.arcOf(F, m(9), m(5), P), { tone: "faint" });
    put(p3(52, y, LAMP_Z), `<g class="fig-headlight">${S(body, { tone: "hi", inner: seam })}</g>`, null, y > 0 ? 9 : 3);
  }
}

function camera() {
  for (const y of [24, -24]) {
    put(p3(-6, y, 90), S(k.slabOf({ x: m(-10), y: m(y - 1.4), w: m(8), d: m(2.8), r: m(0.6) }, m(CH_Z1), m(135 - CH_Z1), P, 3, 0.3), { tone: "mid" }), null, -30);
  }
  put(p3(-6, 0, 136), S(k.slabOf({ x: m(-10), y: m(-25.4), w: m(8), d: m(50.8), r: m(0.6) }, m(135), m(2.8), P, 3, 0.3), { tone: "mid" }), null, -30);
  const hingeF = G.frameAlong(p3(-6, -22, GROUND + 115), [0, 1, 0]);
  put(p3(-6, 0, GROUND + 115), S(G.solidOf([[0, m(2.2)], [m(44), m(2.2)]], hingeF, P), { tone: "mid" }), null, -29);
  // Caja del K210 con las medidas del modelo 3D: la lente queda casi al centro
  // del frente, con la cinta de la cámara bajando hasta el borde inferior.
  const box = { x: m(-4.5), y: m(-33), w: m(15), d: m(66), r: m(3) };
  let svg = S(k.slabOf(box, m(CASE_Z0), m(46), P, 6, 0.8), { tone: "hi" });
  const acr = { x: m(10.5), y: m(-30), w: m(2.4), d: m(60), r: m(2) };
  svg += S(k.slabOf(acr, m(CASE_Z0 + 2), m(42), P, 6, 0.6), { tone: "mid", crease: "faint" });
  svg += D([[CAM_FX, 28, CASE_Z0 + 42], [CAM_FX, -28, CASE_Z0 + 42], [CAM_FX, 28, CASE_Z0 + 4], [CAM_FX, -28, CASE_Z0 + 4]].map(([x, y, z]) => at(p3(x, y, z))), { size: 1.1, tone: "hi" });
  const ribbon = [[CAM_FX, -3, CASE_Z0 + 2], [CAM_FX, -3, CAM_Z - 5], [CAM_FX, 3, CAM_Z - 5], [CAM_FX, 3, CASE_Z0 + 2]].map((pt) => at(p3(...pt)));
  svg += `<path class="iso-line" data-tone="mid" d="M${ribbon.map((c) => c.join(" ")).join("L")}"/>`;
  svg += k.faceTextSvg(k.topMatrix([m(-0.5), m(-24)], m(CASE_Z0 + 46), P, "y"), "K210", { size: 10, tone: "lo" });
  put(p3(3, 0, CASE_Z0 + 23), wrap(svg, "camera"), "camera", 10);
  const lensF = G.frameAlong(p3(CAM_FX, 0, CAM_Z), [1, 0, 0]);
  const lens = G.solidOf([[0, m(5)], [m(1.5), m(5)], [m(1.5), m(4.2)], [m(3.5), m(4)]], lensF, P);
  put(p3(CAM_FX + 3, 0, CAM_Z), wrap(S(lens, { tone: "hi", inner: L(G.circleOf(lensF, m(3.5), m(2.2), P), { tone: "lo" }) }), "camera"), "camera", 30);
}

// ───────── Objetos de prueba delante del robot ─────────
function targets() {
  const wall = { x: m(TARGET_X), y: m(-26), w: m(6), d: m(52), r: m(1) };
  put(p3(TARGET_X, 0, 22), S(k.slabOf(wall, 0, m(66), P, 4, 0.6), { tone: "mid" }) + L(k.planOutline(k.insetPlan(wall, m(1.5)), m(66), P, 4), { tone: "faint" }));
  const [sx, sy] = SIGN;
  put(p3(sx, sy, 4), S(k.cylinder(m(sx), m(sy), m(12), 0, m(4), P, 40, 0.5), { tone: "lo" }));
  put(p3(sx, sy, 70), S(k.cylinder(m(sx), m(sy), m(2), m(4), m(CAM_Z - 22), P, 16), { tone: "mid", crease: "none" }));
  const to = [15 - sx, 0 - sy];
  const len = Math.hypot(to[0], to[1]);
  const n = [to[0] / len, to[1] / len, 0];
  const F = G.frameAlong(p3(sx, sy, CAM_Z), n);
  const plate = G.disc(0, m(2.4), m(22), F, P);
  const u = [-n[1], n[0]];
  const arrow = [[7, -9], [7, 3], [-6, 3], [-6, 9], [-15, 0], [-6, -9], [-6, -3], [1, -3], [1, -9]];
  const face = (a, b) => at([m(sx + n[0] * 2.5 + u[0] * a), m(sy + n[1] * 2.5 + u[1] * a), m(CAM_Z + b)]);
  const ad = "M" + arrow.map(([a, b]) => face(a, b).join(" ")).join("L") + "Z";
  // La cara mira a la cámara del robot; desde aquí solo se ve el dorso (con su abrazadera).
  const facesViewer = n[0] * Math.cos((56 * Math.PI) / 180) + n[1] * Math.sin((56 * Math.PI) / 180) > 0;
  const back = S(k.slabOf({ x: m(sx - 2.5), y: m(sy - 2.5), w: m(5), d: m(5), r: m(0.8) }, m(CAM_Z - 8), m(16), P, 3, 0.3), { tone: "mid" });
  put(p3(sx, sy, CAM_Z), S(plate, { tone: "hi" }) + L(G.circleOf(F, m(2.4), m(19), P), { tone: "lo" }) + (facesViewer ? `<path class="iso-line" data-tone="mid" d="${ad}"/>` : ""), null, 5);
  if (!facesViewer) put(p3(sx, sy, CAM_Z - 1), back, null, 6);
}

// ───────── Ayudas que se activan en vivo ─────────
function live() {
  const out = [];
  for (const [side, id] of [[1, "L"], [-1, "R"]]) {
    out.push(`<path class="fig-ir-spot" data-ir="${id}" d="${k.ring(m(SENSOR_X), m(side * SENSOR_Y), m(2.6), m(21.4), P, 24)}"/>`);
    out.push(`<path class="iso-line fig-ir-beam" data-ir-beam="${id}" data-tone="lit" d="${k.segment(p3(SENSOR_X, side * SENSOR_Y, GROUND + 12), p3(SENSOR_X, side * SENSOR_Y, 21.4), P)}"/>`);
  }
  const waves = [12.5, -12.5].map((y) => k.segment(p3(SONAR_X + 13.6, y, SONAR_Z), p3(TARGET_X, y, SONAR_Z), P)).join("");
  out.push(`<path class="iso-line fig-sonar" data-flow="" data-tone="lit" d="${waves}"/>`);
  out.push(`<path class="iso-line fig-sight" data-tone="lit" d="${k.segment(p3(CAM_FX + 3.5, 0, CAM_Z), p3(SIGN[0], SIGN[1], CAM_Z), P)}"/>`);
  return out.join("");
}

rollers();
rails();
put(p3(47, 0, 16), `<g data-part="sled">${sled()}</g>`, null, -200);
motors();
const frames = { motorL: wheel(1), motorR: wheel(-1) };
underside();
chassis();
microbit();
sonar();
headlights();
camera();
targets();

items.sort((a, b) => a.depth - b.depth);
const svg = k.figureSvg({
  width: W,
  height: H,
  className: "fig-robot",
  label: "Robot Tiny:bit Pro sobre un banco de pruebas. Las ruedas giran sobre rodillos; una regleta lleva una línea negra bajo los dos sensores infrarrojos; delante hay una pantalla para el ultrasonido y una señal para la cámara del módulo K210.",
  body: [bench(), ...items.map((it) => it.svg), `<g class="fig-live">${live()}</g>`],
});

const yAxis = k.axisVector(P, [0, m(1), 0]);
const out = `// Archivo generado por scripts/build-figure.mjs (skill Anatomy). No editar a mano.
export const FIGURE = ${JSON.stringify({ svg, W, H, yAxis, wheelFrames: frames, sensorY: SENSOR_Y, lineHalf: LINE_HALF, sledRange: [-30, 30], sonarCm: Math.round((TARGET_X - SONAR_X - 13.6) / 10), parts: items.length })};
`;
writeFileSync(join(HERE, "..", "src", "anatomy", "robotFigure.gen.ts"), out);
console.log(`figura: ${items.length} elementos, ${svg.length} caracteres`);

if (process.argv.includes("--page")) {
  const css = readFileSync(join(HERE, "..", "vendor", "anatomy-kit", "iso.css"), "utf8");
  const extra = `.fig-ink{fill:#0b0b0e}.fig-led{fill:#3a2020}.fig-ir-spot{fill:none;stroke:#22d3ee;stroke-width:1}.fig-ir-beam,.fig-sonar,.fig-sight{opacity:0}`;
  mkdirSync(join(HERE, "out"), { recursive: true });
  for (const theme of ["dark", "light"]) {
    const page = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Figura</title><style>${css}${extra}body{margin:0;background:var(--anatomy-page)}</style><body class="iso"${theme === "light" ? ' data-theme="light"' : ""}><div style="width:${W}px;margin:20px auto">${svg}</div></body></html>`;
    writeFileSync(join(HERE, "out", `robot-figure${theme === "light" ? "-light" : ""}.html`), page);
  }
  console.log("páginas de verificación en scripts/out/");
}
