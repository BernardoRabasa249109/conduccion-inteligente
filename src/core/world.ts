/**
 * Entorno en ejecución: la línea, los objetos con su estado (semáforo,
 * obstáculos que se retiran) y las consultas geométricas que usan los
 * sensores y las colisiones.
 */
import { LineMap } from "./track";
import {
  lightAt,
  matHeight,
  matWidth,
  type LightObject,
  type LightState,
  type ObstacleObject,
  type Scenario,
  type SignObject,
  type WorldObject,
} from "./scenario";

/** Medidas de los objetos del tapete (cm, aproximación de las piezas del kit). */
export const PROPS = {
  signBaseR: 2.8,
  signBaseH: 1.2,
  signPoleR: 0.45,
  signPlateR: 3.3,
  signPlateCenter: 11.5,
  lightBaseR: 3.2,
  lightPoleR: 0.6,
  lightBoxW: 3.4,
  lightBoxH: 9,
  lightCenter: 13.5,
};

export interface Footprint {
  id: string;
  kind: "circle" | "box";
  x: number;
  y: number;
  r: number;
  w: number;
  d: number;
  rot: number;
  /** Altura del objeto (para el ultrasonido y las oclusiones). */
  h: number;
  label: string;
}

export class World {
  readonly lines: LineMap;
  readonly width: number;
  readonly height: number;
  /** Obstáculos retirados durante la simulación. */
  removed = new Set<string>();
  /** Tiempo que el robot lleva detenido delante de cada obstáculo. */
  waitedBy = new Map<string, number>();

  constructor(readonly scenario: Scenario) {
    this.lines = new LineMap(scenario);
    this.width = matWidth(scenario);
    this.height = matHeight(scenario);
  }

  reset() {
    this.removed.clear();
    this.waitedBy.clear();
  }

  get objects(): WorldObject[] {
    return this.scenario.objects;
  }

  lightState(light: LightObject, time: number): LightState {
    return lightAt(light, time);
  }

  isPresent(obj: WorldObject): boolean {
    return !this.removed.has(obj.id);
  }

  /** Formas en planta de todo lo que puede chocar o reflejar el ultrasonido. */
  footprints(): Footprint[] {
    const out: Footprint[] = [];
    for (const o of this.scenario.objects) {
      if (!this.isPresent(o)) continue;
      if (o.kind === "sign") out.push({ id: o.id, kind: "circle", x: o.x, y: o.y, r: PROPS.signBaseR, w: 0, d: 0, rot: 0, h: 16, label: "señal" });
      if (o.kind === "light") out.push({ id: o.id, kind: "circle", x: o.x, y: o.y, r: PROPS.lightBaseR, w: 0, d: 0, rot: 0, h: 18, label: "semáforo" });
      if (o.kind === "obstacle") out.push({ id: o.id, kind: "box", x: o.x, y: o.y, r: 0, w: o.w, d: o.d, rot: o.rot, h: o.h, label: o.shape === "persona" ? "persona" : "obstáculo" });
    }
    return out;
  }

  /** Forma que ve el ultrasonido a su altura: el poste delgado, no la base. */
  sonarShape(f: Footprint, height: number): Footprint | null {
    if (f.kind === "box") return height <= f.h ? f : null;
    if (f.label === "señal") return { ...f, r: height < PROPS.signBaseH ? PROPS.signBaseR : PROPS.signPoleR };
    return { ...f, r: PROPS.lightPoleR };
  }

  /** ¿El círculo (cx, cy, r) choca con algo? Devuelve la etiqueta del objeto. */
  collide(cx: number, cy: number, r: number): string | null {
    if (cx - r < 0 || cy - r < 0 || cx + r > this.width || cy + r > this.height) return "borde del tapete";
    for (const f of this.footprints()) {
      if (f.kind === "circle") {
        if (Math.hypot(cx - f.x, cy - f.y) < r + f.r) return f.label;
      } else if (circleBox(cx, cy, r, f)) return f.label;
    }
    return null;
  }

  /** Distancia a lo largo de un rayo hasta el primer objeto (o Infinity). */
  raycast(ox: number, oy: number, dx: number, dy: number, height: number): { dist: number; id: string | null } {
    let best = Infinity, id: string | null = null;
    for (const f0 of this.footprints()) {
      const f = this.sonarShape(f0, height);
      if (!f) continue;
      const t = f.kind === "circle" ? rayCircle(ox, oy, dx, dy, f.x, f.y, f.r) : rayBox(ox, oy, dx, dy, f);
      if (t < best) {
        best = t;
        id = f.id;
      }
    }
    return { dist: best, id };
  }

  /**
   * ¿Algún objeto tapa el segmento 3D entre la cámara y un punto? Se usa para
   * las oclusiones de la visión simulada. Ignora el objeto observado.
   */
  occluded(from: [number, number, number], to: [number, number, number], ignore: string): string | null {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const ux = dx / len, uy = dy / len;
    for (const f of this.footprints()) {
      if (f.id === ignore) continue;
      const t = f.kind === "circle" ? rayCircle(from[0], from[1], ux, uy, f.x, f.y, f.kind === "circle" && f.label === "semáforo" ? PROPS.lightBoxW / 2 : PROPS.signPlateR) : rayBox(from[0], from[1], ux, uy, f);
      if (t >= len - 0.5) continue;
      if (!Number.isFinite(t)) continue;
      // Altura del rayo en el punto de cruce frente a la altura del objeto.
      const z = from[2] + ((to[2] - from[2]) * t) / len;
      const top = f.kind === "box" ? f.h : f.label === "semáforo" ? PROPS.lightCenter + PROPS.lightBoxH / 2 : PROPS.signPlateCenter + PROPS.signPlateR;
      const bottom = f.kind === "box" ? 0 : f.label === "semáforo" ? PROPS.lightCenter - PROPS.lightBoxH / 2 : PROPS.signPlateCenter - PROPS.signPlateR;
      if (z <= top && z >= bottom) return f.label;
    }
    return null;
  }

  signs(): SignObject[] {
    return this.scenario.objects.filter((o): o is SignObject => o.kind === "sign");
  }

  lights(): LightObject[] {
    return this.scenario.objects.filter((o): o is LightObject => o.kind === "light");
  }

  obstacles(): ObstacleObject[] {
    return this.scenario.objects.filter((o): o is ObstacleObject => o.kind === "obstacle");
  }
}

function toLocal(f: Footprint, x: number, y: number): [number, number] {
  const c = Math.cos(-f.rot), s = Math.sin(-f.rot);
  const dx = x - f.x, dy = y - f.y;
  return [dx * c - dy * s, dx * s + dy * c];
}

export function circleBox(cx: number, cy: number, r: number, f: Footprint): boolean {
  const [lx, ly] = toLocal(f, cx, cy);
  const qx = Math.max(-f.w / 2, Math.min(f.w / 2, lx));
  const qy = Math.max(-f.d / 2, Math.min(f.d / 2, ly));
  return Math.hypot(lx - qx, ly - qy) < r;
}

export function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t0 = -b - s, t1 = -b + s;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return 0;
  return Infinity;
}

export function rayBox(ox: number, oy: number, dx: number, dy: number, f: Footprint): number {
  const [lx, ly] = toLocal(f, ox, oy);
  const c = Math.cos(-f.rot), s = Math.sin(-f.rot);
  const ldx = dx * c - dy * s, ldy = dx * s + dy * c;
  let tmin = -Infinity, tmax = Infinity;
  for (const [p, d, half] of [[lx, ldx, f.w / 2], [ly, ldy, f.d / 2]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < -half || p > half) return Infinity;
    } else {
      let t1 = (-half - p) / d, t2 = (half - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  if (tmax < 0) return Infinity;
  return Math.max(0, tmin);
}
