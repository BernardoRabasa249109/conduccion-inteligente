/**
 * Objetos sólidos: señales, semáforos, obstáculos y el robot no se pueden
 * atravesar entre sí en ningún momento, tampoco en el editor de escenarios ni
 * al colocar el robot. Lo que se arrastra se detiene al tocar a otro y se
 * desliza por su costado; las franjas y las zonas son pintura: no estorban.
 */
import { ROBOT } from "./config";
import { chassisCenter } from "./robot";
import type { Scenario, WorldObject } from "./scenario";
import { PROPS } from "./world";

export type Solid = { kind: "circle"; x: number; y: number; r: number } | { kind: "box"; x: number; y: number; w: number; d: number; rot: number };
/** Pose de algo que se mueve sobre el tapete (a: giro en radianes). */
export interface Place {
  x: number;
  y: number;
  a: number;
}

/** Tocarse está permitido; encimarse, no (cm). */
const EPS = 0.05;

/** Forma sólida de un objeto, en su pose o en otra (franjas y zonas: null). */
export function objectSolid(o: WorldObject, p?: Place): Solid | null {
  const x = p?.x ?? o.x, y = p?.y ?? o.y;
  if (o.kind === "sign") return { kind: "circle", x, y, r: PROPS.signBaseR };
  if (o.kind === "light") return { kind: "circle", x, y, r: PROPS.lightBaseR };
  if (o.kind === "obstacle") return { kind: "box", x, y, w: o.w, d: o.d, rot: p?.a ?? o.rot };
  return null;
}

/** El robot: el mismo círculo de su chasis que usan los choques de la simulación. */
export function robotSolid(p: Place): Solid {
  const [x, y] = chassisCenter({ x: p.x, y: p.y, heading: p.a });
  return { kind: "circle", x, y, r: ROBOT.collisionRadius };
}

function circleBox(cx: number, cy: number, r: number, b: Extract<Solid, { kind: "box" }>): boolean {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = cx - b.x, dy = cy - b.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  const qx = Math.max(-b.w / 2, Math.min(b.w / 2, lx)), qy = Math.max(-b.d / 2, Math.min(b.d / 2, ly));
  return Math.hypot(lx - qx, ly - qy) < r - EPS;
}

function boxBox(a: Extract<Solid, { kind: "box" }>, b: Extract<Solid, { kind: "box" }>): boolean {
  // Ejes separadores: los dos lados de cada caja.
  const axes = [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2].map((t) => [Math.cos(t), Math.sin(t)]);
  const half = (q: typeof a, [ux, uy]: number[]) =>
    (q.w / 2) * Math.abs(Math.cos(q.rot) * ux + Math.sin(q.rot) * uy) + (q.d / 2) * Math.abs(-Math.sin(q.rot) * ux + Math.cos(q.rot) * uy);
  return axes.every((ax) => Math.abs((b.x - a.x) * ax[0] + (b.y - a.y) * ax[1]) < half(a, ax) + half(b, ax) - EPS);
}

/** ¿Se enciman las dos formas? */
export function overlap(a: Solid, b: Solid): boolean {
  if (a.kind === "circle" && b.kind === "circle") return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - EPS;
  if (a.kind === "circle" && b.kind === "box") return circleBox(a.x, a.y, a.r, b);
  if (a.kind === "box" && b.kind === "circle") return circleBox(b.x, b.y, b.r, a);
  return boxBox(a as Extract<Solid, { kind: "box" }>, b as Extract<Solid, { kind: "box" }>);
}

export const blocked = (s: Solid, others: Solid[]) => others.some((o) => overlap(s, o));

/** Lo que estorba en un escenario: sus objetos sólidos (menos uno) y, si se indica, el robot. */
export function solidsOf(s: Scenario, opts: { ignoreId?: string | null; robot?: Place | null; present?: (o: WorldObject) => boolean } = {}): Solid[] {
  const out: Solid[] = [];
  for (const o of s.objects) {
    if (o.id === opts.ignoreId || (opts.present && !opts.present(o))) continue;
    const sol = objectSolid(o);
    if (sol) out.push(sol);
  }
  if (opts.robot) out.push(robotSolid(opts.robot));
  return out;
}

const angDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/**
 * Avanza en línea recta (y girando) de «from» a «to» hasta tocar algo:
 * devuelve el último punto libre del camino. Si ya estaba encimado, lo deja salir.
 */
export function solidStep(from: Place, to: Place, shape: (p: Place) => Solid, others: Solid[], step = 0.5): Place {
  if (blocked(shape(from), others)) return to;
  const da = angDelta(from.a, to.a);
  // Al girar, las esquinas se mueven: unos 8 cm por radián en los objetos del tapete.
  const len = Math.hypot(to.x - from.x, to.y - from.y) + Math.abs(da) * 8;
  const n = Math.max(1, Math.ceil(len / step));
  const at = (t: number): Place => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, a: from.a + da * t });
  let ok = 0;
  for (let i = 1; i <= n; i++) {
    if (blocked(shape(at(i / n)), others)) break;
    ok = i / n;
  }
  if (ok === 1) return to;
  let lo = ok, hi = Math.min(1, ok + 1 / n);
  for (let k = 0; k < 12; k++) {
    const m = (lo + hi) / 2;
    if (blocked(shape(at(m)), others)) hi = m;
    else lo = m;
  }
  return at(lo);
}

/** Mueve sin atravesar nada: se detiene al tocar y se desliza por el costado (primero en x, luego en y). */
export function solidMove(cur: Place, target: Place, shape: (p: Place) => Solid, others: Solid[]): Place {
  let p = solidStep(cur, target, shape, others);
  if (p === target) return target;
  p = solidStep(p, { x: target.x, y: p.y, a: p.a }, shape, others);
  p = solidStep(p, { x: p.x, y: target.y, a: p.a }, shape, others);
  return p;
}

/** El lugar libre más cercano a «p» (busca en círculos de hasta 40 cm), o null. */
export function nearestFree(p: Place, shape: (p: Place) => Solid, others: Solid[], inside: (p: Place) => boolean): Place | null {
  if (inside(p) && !blocked(shape(p), others)) return p;
  for (let r = 1; r <= 40; r += 1) {
    const n = Math.max(8, Math.round(r * 2));
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const q = { x: p.x + Math.cos(t) * r, y: p.y + Math.sin(t) * r, a: p.a };
      if (inside(q) && !blocked(shape(q), others)) return q;
    }
  }
  return null;
}
