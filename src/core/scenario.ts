/**
 * Modelo de datos del entorno: pista por piezas, objetos y zonas.
 * Coordenadas en cm sobre el tapete: x hacia la derecha, y hacia abajo
 * (como en la vista superior). Los ángulos se miden desde +x hacia +y.
 */

export type TileType = "straight" | "curve" | "tee" | "cross";

export interface TileSpec {
  c: number;
  r: number;
  type: TileType;
  /** Giro en pasos de 90° en sentido horario (0–3). */
  rot: number;
}

/** Señales que reconoce el ejemplo oficial "Autopilot" (curso 3.12.2). */
export const OFFICIAL_SIGNS = ["izquierda", "derecha", "limite30", "fin30", "claxon", "p1", "p2"] as const;
/** Señales añadidas como ampliación educativa (no forman parte del ejemplo oficial). */
export const EXTRA_SIGNS = ["alto"] as const;

export type SignType = (typeof OFFICIAL_SIGNS)[number] | (typeof EXTRA_SIGNS)[number];
export type LightState = "rojo" | "amarillo" | "verde" | "apagado";
/** Las tres luces del semáforo («apagado» no enciende ninguna). */
export type LampColor = Exclude<LightState, "apagado">;

/** Etiquetas que puede devolver la visión simulada. */
export type VisionLabel = SignType | "semaforo_rojo" | "semaforo_verde" | "semaforo_amarillo";

export const SIGN_INFO: Record<SignType, { name: string; official: boolean; meaning: string }> = {
  izquierda: { name: "Girar a la izquierda", official: true, meaning: "Preferir la izquierda en el siguiente cruce." },
  derecha: { name: "Girar a la derecha", official: true, meaning: "Preferir la derecha en el siguiente cruce." },
  limite30: { name: "Límite 30", official: true, meaning: "Entrar en zona de velocidad reducida (no son 30 km/h)." },
  fin30: { name: "Fin del límite", official: true, meaning: "Volver a la velocidad normal del ejercicio." },
  claxon: { name: "Claxon", official: true, meaning: "Tocar el claxon una vez." },
  p1: { name: "Estacionamiento 1", official: true, meaning: "Estacionarse en el espacio 1." },
  p2: { name: "Estacionamiento 2", official: true, meaning: "Estacionarse en el espacio 2." },
  alto: { name: "Alto (ampliación)", official: false, meaning: "Detenerse 2 s y continuar. Ampliación educativa." },
};

export const VISION_LABEL_NAME: Record<VisionLabel, string> = {
  izquierda: "girar izquierda",
  derecha: "girar derecha",
  limite30: "límite 30",
  fin30: "fin del límite",
  claxon: "claxon",
  p1: "estacionamiento 1",
  p2: "estacionamiento 2",
  alto: "alto",
  semaforo_rojo: "semáforo en rojo",
  semaforo_verde: "semáforo en verde",
  semaforo_amarillo: "semáforo en amarillo",
};

export interface SignObject {
  id: string;
  kind: "sign";
  sign: SignType;
  x: number;
  y: number;
  /** Dirección hacia la que mira la cara de la señal. */
  facing: number;
}

export interface LightCycle {
  /** Si es verdadero, el semáforo cambia solo; si no, lo cambia el docente. */
  auto: boolean;
  rojo: number;
  verde: number;
  amarillo: number;
}

export interface LightObject {
  id: string;
  kind: "light";
  x: number;
  y: number;
  facing: number;
  state: LightState;
  cycle: LightCycle;
}

export interface ObstacleObject {
  id: string;
  kind: "obstacle";
  shape: "caja" | "persona";
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  /** Se retira sola tras N s con el robot detenido delante (práctica de prioridades). */
  leavesAfterStop?: number;
}

/** Franja negra transversal pintada en el suelo (también la leen los sensores). */
export interface MarkObject {
  id: string;
  kind: "mark";
  x: number;
  y: number;
  rot: number;
  length: number;
}

export type WorldObject = SignObject | LightObject | ObstacleObject | MarkObject;

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
  /** Giro alrededor de su centro (radianes, mismo sentido que el robot). */
  rot?: number;
}

export interface Zone extends Rect {
  id: string;
  kind: "slow" | "parking" | "target";
  label: string;
}

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface Scenario {
  version: 1;
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Lado de cada pieza de pista en cm. */
  tile: number;
  tiles: TileSpec[];
  objects: WorldObject[];
  zones: Zone[];
  start: Pose;
}

export const matWidth = (s: Scenario) => s.cols * s.tile;
export const matHeight = (s: Scenario) => s.rows * s.tile;

export function cloneScenario(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Comprueba un escenario cargado desde un archivo. Devuelve los errores encontrados. */
export function validateScenario(data: unknown): string[] {
  const errors: string[] = [];
  const s = data as Partial<Scenario>;
  if (!s || typeof s !== "object") return ["El archivo no contiene un escenario."];
  if (s.version !== 1) errors.push("Versión de escenario desconocida.");
  for (const key of ["cols", "rows", "tile"] as const) {
    if (typeof s[key] !== "number" || !(s[key]! > 0)) errors.push(`Falta un número válido en "${key}".`);
  }
  if (!Array.isArray(s.tiles)) errors.push("Falta la lista de piezas de pista.");
  if (!Array.isArray(s.objects)) errors.push("Falta la lista de objetos.");
  if (!Array.isArray(s.zones)) errors.push("Falta la lista de zonas.");
  if (!s.start || typeof s.start.x !== "number") errors.push("Falta la posición inicial del robot.");
  return errors;
}

export function lightAt(obj: LightObject, time: number): LightState {
  if (!obj.cycle.auto) return obj.state;
  const { rojo, verde, amarillo } = obj.cycle;
  const total = rojo + verde + amarillo;
  const order: LampColor[] = ["rojo", "verde", "amarillo"];
  const start = Math.max(0, order.indexOf(obj.state as LampColor));
  let t = time % total;
  for (let i = 0; i < 3; i++) {
    const st = order[(start + i) % 3];
    const len = obj.cycle[st];
    if (t < len) return st;
    t -= len;
  }
  return obj.state;
}

export function inRect(r: Rect, x: number, y: number, margin = 0): boolean {
  if (!r.rot) return x >= r.x - margin && x <= r.x + r.w + margin && y >= r.y - margin && y <= r.y + r.d + margin;
  // Rectángulo girado: el punto se lleva a los ejes del rectángulo.
  const dx = x - (r.x + r.w / 2), dy = y - (r.y + r.d / 2);
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  return Math.abs(lx) <= r.w / 2 + margin && Math.abs(ly) <= r.d / 2 + margin;
}
