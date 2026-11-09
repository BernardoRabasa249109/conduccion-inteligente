/**
 * Sensores simulados: dos infrarrojos de línea, ultrasonido y visión.
 * Cada lectura se calcula a partir del estado real del robot y del entorno;
 * el programa del alumno solo recibe estas lecturas.
 */
import { ROBOT, VISION } from "./config";
import { bodyPoint, forwardOf, leftOf, normAngle, type RobotState } from "./robot";
import type { LightObject, SignObject, VisionLabel } from "./scenario";
import { PROPS, rayBox, rayCircle, type World } from "./world";

export interface SensorOptions {
  /** Modo avanzado: añade ruido a las lecturas. */
  noise: boolean;
  /** Modo avanzado: retraso de las lecturas en ms. */
  delayMs: number;
}

export const PREDICTABLE: SensorOptions = { noise: false, delayMs: 0 };

export type CandidateStatus = "reconocida" | "fuera del campo de visión" | "demasiado lejos" | "demasiado cerca" | "de lado" | "tapada" | "muy pequeña";

export interface VisionCandidate {
  id: string;
  label: VisionLabel;
  status: CandidateStatus;
  distance: number;
  /** Posición y tamaño en la imagen de 320×240 (si está delante de la cámara). */
  px?: { x: number; y: number; size: number };
  confidence: number;
  occluder?: string;
}

export interface VisionResult {
  /** Lo que el programa puede leer: una sola etiqueta o null. */
  label: VisionLabel | null;
  /** Confianza SIMULADA (no la calcula un modelo K210). */
  confidence: number;
  candidates: VisionCandidate[];
}

export interface SensorSnapshot {
  time: number;
  lineLeft: 0 | 1;
  lineRight: 0 | 1;
  coverageLeft: number;
  coverageRight: number;
  leftPoint: [number, number];
  rightPoint: [number, number];
  /** Distancia en cm como la devuelve la función oficial (0 = sin eco). */
  distance: number;
  sonarOrigin: [number, number];
  sonarHit: [number, number] | null;
  /** Objeto que devuelve el eco (solo para la interfaz y las prácticas). */
  sonarId: string | null;
  vision: VisionResult;
}

/** Generador pseudoaleatorio con semilla: el ruido es repetible. */
export class Rng {
  constructor(private seed = 12345) {}
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

export function lineSensorPoints(r: RobotState): { left: [number, number]; right: [number, number] } {
  const half = ROBOT.lineSensorSpacing / 2;
  return { left: bodyPoint(r, ROBOT.lineSensorForward, half), right: bodyPoint(r, ROBOT.lineSensorForward, -half) };
}

export function cameraPose(r: RobotState): { x: number; y: number; z: number; yaw: number; pitch: number } {
  const [x, y] = bodyPoint(r, ROBOT.cameraForward, 0);
  return { x, y, z: ROBOT.cameraHeight, yaw: r.heading, pitch: ROBOT.cameraPitch };
}

/** Distancia ultrasónica: varios rayos dentro del cono frontal, se queda con el más cercano. */
export function measureSonar(world: World, r: RobotState): { raw: number; hit: [number, number] | null; origin: [number, number]; id: string | null } {
  const origin = bodyPoint(r, ROBOT.sonarForward, 0);
  let best = Infinity, hit: [number, number] | null = null, hitId: string | null = null;
  const consider = (d: number, x: number, y: number, id: string) => {
    if (d < best) {
      best = d;
      hit = [x, y];
      hitId = id;
    }
  };
  // Cálculo continuo dentro del cono (sin huecos entre rayos que hagan saltar la lectura).
  for (const f0 of world.footprints()) {
    const f = world.sonarShape(f0, ROBOT.sonarHeight);
    if (!f) continue;
    if (f.kind === "circle") {
      const dx = f.x - origin[0], dy = f.y - origin[1];
      const dist = Math.hypot(dx, dy);
      if (dist <= f.r) {
        consider(0, origin[0], origin[1], f.id);
        continue;
      }
      // Un poste delgado apenas devuelve eco fuera del eje: se acepta en un cono más estrecho.
      const half = f.r < 1 ? ROBOT.sonarThinHalfAngle : ROBOT.sonarHalfAngle;
      const ang = normAngle(Math.atan2(dy, dx) - r.heading);
      const spread = Math.asin(Math.min(1, f.r / dist));
      if (Math.abs(ang) - spread > half) continue;
      const a = r.heading + Math.max(-half, Math.min(half, ang));
      let t = rayCircle(origin[0], origin[1], Math.cos(a), Math.sin(a), f.x, f.y, f.r);
      if (!Number.isFinite(t)) t = dist - f.r;
      consider(t, origin[0] + Math.cos(a) * t, origin[1] + Math.sin(a) * t, f.id);
    } else {
      // Cajas y personas: se recorren sus bordes con puntos cada ≈0,5 cm.
      const c = Math.cos(f.rot), sn = Math.sin(f.rot);
      const hw = f.w / 2, hd = f.d / 2;
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      for (let e = 0; e < 4; e++) {
        const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
        const n = Math.max(4, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
        for (let i = 0; i <= n; i++) {
          const lx = ax + ((bx - ax) * i) / n, ly = ay + ((by - ay) * i) / n;
          const px = f.x + lx * c - ly * sn, py = f.y + lx * sn + ly * c;
          const ang = normAngle(Math.atan2(py - origin[1], px - origin[0]) - r.heading);
          if (Math.abs(ang) <= ROBOT.sonarHalfAngle) consider(Math.hypot(px - origin[0], py - origin[1]), px, py, f.id);
        }
      }
      const t = rayBox(origin[0], origin[1], Math.cos(r.heading), Math.sin(r.heading), f);
      if (Number.isFinite(t)) consider(t, origin[0] + Math.cos(r.heading) * t, origin[1] + Math.sin(r.heading) * t, f.id);
    }
  }
  return { raw: best, hit: Number.isFinite(best) ? hit : null, origin, id: Number.isFinite(best) ? hitId : null };
}

/** Convierte la distancia geométrica en lo que devolvería Tinybit.Ultrasonic_CarV2(). */
export function sonarReading(raw: number): number {
  if (!Number.isFinite(raw) || raw > ROBOT.sonarMaxRange) return 0;
  return Math.max(ROBOT.sonarMinRange, Math.floor(raw));
}

const FOCAL = ROBOT.cameraWidthPx / 2 / Math.tan(ROBOT.cameraHFov / 2);

/** Reconocimiento simulado: geometría + reglas, no un modelo de IA. */
export function computeVision(world: World, r: RobotState, time: number): VisionResult {
  const cam = cameraPose(r);
  const [fx, fy] = forwardOf(r.heading);
  const [lx, ly] = leftOf(r.heading);
  const candidates: VisionCandidate[] = [];

  const consider = (id: string, label: VisionLabel, tx: number, ty: number, tz: number, facing: number, radius: number) => {
    const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z;
    const fwd = dx * fx + dy * fy;
    const lat = dx * lx + dy * ly;
    const distance = Math.hypot(dx, dy, dz);
    const base: VisionCandidate = { id, label, status: "fuera del campo de visión", distance, confidence: 0 };
    if (fwd <= 0.5) {
      candidates.push(base);
      return;
    }
    const alpha = Math.atan2(lat, fwd);
    const beta = Math.atan2(dz, fwd) + cam.pitch;
    const size = (2 * radius * FOCAL) / distance;
    const px = { x: ROBOT.cameraWidthPx / 2 - Math.tan(alpha) * FOCAL, y: ROBOT.cameraHeightPx / 2 - Math.tan(beta) * FOCAL, size };
    const halfW = ROBOT.cameraWidthPx / 2, halfH = ROBOT.cameraHeightPx / 2;
    const inside = Math.abs(px.x - halfW) + size * 0.35 < halfW && Math.abs(px.y - halfH) + size * 0.35 < halfH;
    const toCam = [-dx, -dy];
    const len = Math.hypot(toCam[0], toCam[1]) || 1;
    const cosFacing = (Math.cos(facing) * toCam[0] + Math.sin(facing) * toCam[1]) / len;
    const facingAngle = Math.acos(Math.max(-1, Math.min(1, cosFacing)));
    const c: VisionCandidate = { ...base, px };
    if (!inside) c.status = "fuera del campo de visión";
    else if (distance > VISION.maxDistance) c.status = "demasiado lejos";
    else if (distance < VISION.minDistance) c.status = "demasiado cerca";
    else if (facingAngle > VISION.maxFacingAngle) c.status = "de lado";
    else if (size * Math.cos(facingAngle) < VISION.minPixels) c.status = "muy pequeña";
    else {
      const occ = world.occluded([cam.x, cam.y, cam.z], [tx, ty, tz], id);
      if (occ) {
        c.status = "tapada";
        c.occluder = occ;
      } else {
        c.status = "reconocida";
        const sizeFactor = Math.min(1, (size * Math.cos(facingAngle) - VISION.minPixels) / 30);
        c.confidence = Math.min(0.99, 0.6 + 0.39 * sizeFactor * Math.cos(facingAngle));
      }
    }
    candidates.push(c);
  };

  for (const s of world.signs() as SignObject[]) {
    if (!world.isPresent(s)) continue;
    consider(s.id, s.sign, s.x, s.y, PROPS.signPlateCenter, s.facing, PROPS.signPlateR);
  }
  for (const l of world.lights() as LightObject[]) {
    if (!world.isPresent(l)) continue;
    const st = world.lightState(l, time);
    // Apagado: no hay color que reconocer.
    if (st === "apagado") continue;
    consider(l.id, `semaforo_${st}` as VisionLabel, l.x, l.y, PROPS.lightCenter, l.facing, PROPS.lightBoxW * 0.9);
  }
  const seen = candidates.filter((c) => c.status === "reconocida").sort((a, b) => (b.px?.size ?? 0) - (a.px?.size ?? 0));
  const best = seen[0] ?? null;
  return { label: best ? best.label : null, confidence: best ? best.confidence : 0, candidates };
}

/** Calcula todas las lecturas en un instante. */
export class SensorSuite {
  private history: SensorSnapshot[] = [];
  private lastVision: VisionResult = { label: null, confidence: 0, candidates: [] };
  private lastVisionAt = -Infinity;
  private rng = new Rng();
  options: SensorOptions = { ...PREDICTABLE };

  reset() {
    this.history = [];
    this.lastVision = { label: null, confidence: 0, candidates: [] };
    this.lastVisionAt = -Infinity;
    this.rng = new Rng();
  }

  /** Obliga a recalcular la visión (por ejemplo, tras mover el robot a mano). */
  invalidateVision() {
    this.lastVisionAt = -Infinity;
    this.history = [];
  }

  /** Lectura real (sin retraso) en el instante `time` (s). */
  measure(world: World, r: RobotState, time: number): SensorSnapshot {
    const pts = lineSensorPoints(r);
    let covL = world.lines.coverage(pts.left[0], pts.left[1]);
    let covR = world.lines.coverage(pts.right[0], pts.right[1]);
    const sonar = measureSonar(world, r);
    let distance = sonarReading(sonar.raw);
    if (time * 1000 - this.lastVisionAt >= VISION.periodMs - 1e-6) {
      this.lastVision = computeVision(world, r, time);
      if (this.options.noise && this.lastVision.label && this.rng.next() < 0.05) this.lastVision = { ...this.lastVision, label: null, confidence: 0 };
      this.lastVisionAt = time * 1000;
    }
    let vision = this.lastVision;
    if (this.options.noise) {
      const n = () => this.rng.next();
      // Bordes de la línea: la lectura oscila; además, algún destello aislado.
      covL = Math.min(1, Math.max(0, covL + (n() - 0.5) * 0.5));
      covR = Math.min(1, Math.max(0, covR + (n() - 0.5) * 0.5));
      if (distance > 0) distance = Math.max(2, Math.round(distance + (n() - 0.5) * 3));
      if (n() < 0.02) distance = 0;
    }
    return {
      time,
      lineLeft: covL >= 0.5 ? 1 : 0,
      lineRight: covR >= 0.5 ? 1 : 0,
      coverageLeft: covL,
      coverageRight: covR,
      leftPoint: pts.left,
      rightPoint: pts.right,
      distance,
      sonarOrigin: sonar.origin,
      sonarHit: sonar.hit,
      sonarId: sonar.id,
      vision,
    };
  }

  /** Lectura que recibe el programa: con retraso si el modo avanzado lo pide. */
  read(world: World, r: RobotState, time: number): { now: SensorSnapshot; seen: SensorSnapshot } {
    const now = this.measure(world, r, time);
    this.history.push(now);
    const delay = this.options.delayMs / 1000;
    while (this.history.length > 2 && this.history[1].time <= time - delay) this.history.shift();
    const seen = delay > 0 ? this.history[0] : now;
    return { now, seen };
  }
}
