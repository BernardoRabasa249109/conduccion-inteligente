/**
 * Geometría de la línea negra. Cada pieza de pista se convierte en segmentos y
 * arcos; los sensores calculan su lectura midiendo la distancia a esas formas,
 * y la textura del suelo se dibuja con exactamente las mismas formas.
 */
import { LINE } from "./config";
import type { MarkObject, Scenario, TileSpec, TileType } from "./scenario";

export type Vec = [number, number];

export interface Seg {
  kind: "seg";
  a: Vec;
  b: Vec;
}
export interface Arc {
  kind: "arc";
  c: Vec;
  r: number;
  a0: number;
  sweep: number;
}
export type Prim = Seg | Arc;

/** Lados de una pieza: N=1, E=2, S=4, W=8. */
export const N = 1, E = 2, S = 4, W = 8;

export function tileMask(type: TileType, rot: number): number {
  const r = ((rot % 4) + 4) % 4;
  switch (type) {
    case "straight":
      return r % 2 === 0 ? E | W : N | S;
    case "curve":
      return [N | E, E | S, S | W, W | N][r];
    case "tee":
      return (N | E | S | W) & ~[N, E, S, W][r];
    case "cross":
      return N | E | S | W;
  }
}

function sideMid(side: number, ox: number, oy: number, t: number): Vec {
  const cx = ox + t / 2, cy = oy + t / 2;
  if (side === N) return [cx, oy];
  if (side === E) return [ox + t, cy];
  if (side === S) return [cx, oy + t];
  return [ox, cy];
}

export function tilePrims(tile: TileSpec, t: number): Prim[] {
  const ox = tile.c * t, oy = tile.r * t;
  const center: Vec = [ox + t / 2, oy + t / 2];
  const mask = tileMask(tile.type, tile.rot);
  const out: Prim[] = [];
  if (tile.type === "curve") {
    const half = t / 2;
    if (mask === (N | E)) out.push({ kind: "arc", c: [ox + t, oy], r: half, a0: Math.PI / 2, sweep: Math.PI / 2 });
    if (mask === (E | S)) out.push({ kind: "arc", c: [ox + t, oy + t], r: half, a0: Math.PI, sweep: Math.PI / 2 });
    if (mask === (S | W)) out.push({ kind: "arc", c: [ox, oy + t], r: half, a0: (3 * Math.PI) / 2, sweep: Math.PI / 2 });
    if (mask === (W | N)) out.push({ kind: "arc", c: [ox, oy], r: half, a0: 0, sweep: Math.PI / 2 });
    return out;
  }
  // Rectas, T y cruces: un tramo desde el centro hacia cada lado conectado.
  for (const side of [N, E, S, W]) {
    if (mask & side) out.push({ kind: "seg", a: center, b: sideMid(side, ox, oy, t) });
  }
  return out;
}

export function markPrim(m: MarkObject): Seg {
  const dx = (Math.cos(m.rot) * m.length) / 2, dy = (Math.sin(m.rot) * m.length) / 2;
  return { kind: "seg", a: [m.x - dx, m.y - dy], b: [m.x + dx, m.y + dy] };
}

function distSeg(p: Vec, s: Seg): number {
  const [ax, ay] = s.a, [bx, by] = s.b;
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let u = len2 > 0 ? ((p[0] - ax) * vx + (p[1] - ay) * vy) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(p[0] - (ax + u * vx), p[1] - (ay + u * vy));
}

function distArc(p: Vec, a: Arc): number {
  const dx = p[0] - a.c[0], dy = p[1] - a.c[1];
  const ang = Math.atan2(dy, dx);
  let rel = (ang - a.a0) % (Math.PI * 2);
  if (rel < 0) rel += Math.PI * 2;
  if (rel <= a.sweep) return Math.abs(Math.hypot(dx, dy) - a.r);
  const e0: Vec = [a.c[0] + Math.cos(a.a0) * a.r, a.c[1] + Math.sin(a.a0) * a.r];
  const e1: Vec = [a.c[0] + Math.cos(a.a0 + a.sweep) * a.r, a.c[1] + Math.sin(a.a0 + a.sweep) * a.r];
  return Math.min(Math.hypot(p[0] - e0[0], p[1] - e0[1]), Math.hypot(p[0] - e1[0], p[1] - e1[1]));
}

export function distPrim(p: Vec, prim: Prim): number {
  return prim.kind === "seg" ? distSeg(p, prim) : distArc(p, prim);
}

/**
 * Índice espacial de la línea: guarda las formas de cada celda para que las
 * consultas de los sensores solo revisen la celda actual y sus vecinas.
 */
export class LineMap {
  readonly prims: Prim[] = [];
  private cells = new Map<string, Prim[]>();
  constructor(readonly scenario: Scenario) {
    const t = scenario.tile;
    for (const tile of scenario.tiles) {
      const prims = tilePrims(tile, t);
      this.prims.push(...prims);
      this.cells.set(`${tile.c},${tile.r}`, [...(this.cells.get(`${tile.c},${tile.r}`) ?? []), ...prims]);
    }
    for (const obj of scenario.objects) {
      if (obj.kind !== "mark") continue;
      const prim = markPrim(obj);
      this.prims.push(prim);
      const c = Math.floor(obj.x / t), r = Math.floor(obj.y / t);
      this.cells.set(`${c},${r}`, [...(this.cells.get(`${c},${r}`) ?? []), prim]);
    }
  }

  /** Distancia desde un punto a la línea negra más cercana (cm). */
  distance(x: number, y: number): number {
    const t = this.scenario.tile;
    const c = Math.floor(x / t), r = Math.floor(y / t);
    let best = Infinity;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const list = this.cells.get(`${c + dc},${r + dr}`);
        if (!list) continue;
        for (const prim of list) best = Math.min(best, distPrim([x, y], prim));
      }
    }
    return best;
  }

  /** ¿Hay tinta negra en este punto? */
  isBlack(x: number, y: number): boolean {
    return this.distance(x, y) <= LINE.width / 2;
  }

  /**
   * Fracción negra del área que ve un sensor (un pequeño círculo de 0.35 cm):
   * se muestrean cinco puntos, igual que un fototransistor ve una mancha y no un punto.
   */
  coverage(x: number, y: number, radius = 0.35): number {
    const pts: Vec[] = [[x, y], [x + radius, y], [x - radius, y], [x, y + radius], [x, y - radius]];
    let black = 0;
    for (const [px, py] of pts) if (this.isBlack(px, py)) black += 1;
    return black / pts.length;
  }
}

/** Contexto mínimo de dibujo (compatible con CanvasRenderingContext2D). */
export interface Ctx2D {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  stroke(): void;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineCap: CanvasLineCap;
}

export function strokePrims(ctx: Ctx2D, prims: Prim[], scale: number, width: number, color: string, cap: CanvasLineCap = "round") {
  ctx.lineWidth = width * scale;
  ctx.strokeStyle = color;
  ctx.lineCap = cap;
  for (const p of prims) {
    ctx.beginPath();
    if (p.kind === "seg") {
      ctx.moveTo(p.a[0] * scale, p.a[1] * scale);
      ctx.lineTo(p.b[0] * scale, p.b[1] * scale);
    } else {
      ctx.arc(p.c[0] * scale, p.c[1] * scale, p.r * scale, p.a0, p.a0 + p.sweep, false);
    }
    ctx.stroke();
  }
}

/** Celda de pista en la que está un punto (o null si fuera del tapete). */
export function cellOf(s: Scenario, x: number, y: number): { c: number; r: number } | null {
  const c = Math.floor(x / s.tile), r = Math.floor(y / s.tile);
  if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) return null;
  return { c, r };
}
