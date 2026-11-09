/**
 * Los tres escenarios iniciales. Piezas de 30 cm; la línea va por el centro de
 * cada pieza (x = 15, 45, 75…; y = 15, 45, 75…).
 */
import type { Scenario, TileSpec, TileType, WorldObject, Zone } from "../core/scenario";

const T = 30;
const tile = (c: number, r: number, type: TileType, rot = 0): TileSpec => ({ c, r, type, rot });
const h = (c: number, r: number) => tile(c, r, "straight", 0);
const v = (c: number, r: number) => tile(c, r, "straight", 1);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Óvalo perimetral de cols × rows piezas. */
function oval(cols: number, rows: number): TileSpec[] {
  const out: TileSpec[] = [tile(0, 0, "curve", 1), tile(cols - 1, 0, "curve", 2), tile(0, rows - 1, "curve", 0), tile(cols - 1, rows - 1, "curve", 3)];
  for (let c = 1; c < cols - 1; c++) out.push(h(c, 0), h(c, rows - 1));
  for (let r = 1; r < rows - 1; r++) out.push(v(0, r), v(cols - 1, r));
  return out;
}

export function basicScenario(): Scenario {
  return {
    version: 1,
    id: "basica",
    name: "Pista básica",
    cols: 6,
    rows: 4,
    tile: T,
    tiles: oval(6, 4),
    objects: [],
    zones: [],
    start: { x: 40, y: 105, heading: 0 },
  };
}

/** Red de ciudad: óvalo + calle vertical (columna 3) + calle horizontal (fila 2). */
function cityTiles(): TileSpec[] {
  const out: TileSpec[] = [
    tile(0, 0, "curve", 1), h(1, 0), h(2, 0), tile(3, 0, "tee", 0), h(4, 0), tile(5, 0, "curve", 2),
    v(0, 1), v(3, 1), v(5, 1),
    tile(0, 2, "tee", 3), h(1, 2), h(2, 2), tile(3, 2, "cross", 0), h(4, 2), tile(5, 2, "tee", 1),
    v(0, 3), v(3, 3), v(5, 3),
    tile(0, 4, "curve", 0), h(1, 4), h(2, 4), tile(3, 4, "tee", 2), h(4, 4), tile(5, 4, "curve", 3),
  ];
  return out;
}

const parkingZones = (): Zone[] => [
  { id: "plaza-1", kind: "parking", label: "1", x: 72, y: 104, w: 15, d: 22 },
  { id: "plaza-2", kind: "parking", label: "2", x: 118, y: 104, w: 15, d: 22 },
];

/** Señales de estacionamiento: cada una 6 cm antes (al oeste) de su plaza, mirando al este. */
const parkingSigns = (): WorldObject[] => [
  { id: "s-p2", kind: "sign", sign: "p2", x: 113, y: 123, facing: 0 },
  { id: "s-p1", kind: "sign", sign: "p1", x: 66, y: 123, facing: 0 },
];

/**
 * Ciudad: el óvalo se recorre en sentido antihorario visto desde arriba
 * (hacia el oeste por abajo, hacia el norte por la izquierda, hacia el este
 * por arriba y hacia el sur por la derecha). Todas las señales miran hacia
 * los robots que circulan en ese sentido.
 */
export function cityScenario(): Scenario {
  const objects: WorldObject[] = [
    ...parkingSigns(),
    // A 14 cm de la curva no se veía: quedaba fuera del campo de la cámara (como en el reto, va en y = 86).
    { id: "s-claxon", kind: "sign", sign: "claxon", x: 27, y: 86, facing: rad(90) },
    { id: "s-30", kind: "sign", sign: "limite30", x: 74, y: 27, facing: Math.PI },
    { id: "semaforo", kind: "light", x: 88, y: 27, facing: Math.PI, state: "rojo", cycle: { auto: true, rojo: 6, verde: 7, amarillo: 2 } },
    { id: "s-fin30", kind: "sign", sign: "fin30", x: 148, y: 27, facing: Math.PI },
    // Flechas para quien llega al final de una calle (columna 3 hacia el norte; fila 2 hacia el este).
    { id: "s-izq", kind: "sign", sign: "izquierda", x: 116, y: 50, facing: rad(90) },
    { id: "s-der", kind: "sign", sign: "derecha", x: 140, y: 87, facing: Math.PI },
    { id: "caja-1", kind: "obstacle", shape: "caja", x: 55, y: 75, w: 8, d: 8, h: 8, rot: 0 },
  ];
  return {
    version: 1,
    id: "ciudad",
    name: "Ciudad con señales y semáforo",
    cols: 6,
    rows: 5,
    tile: T,
    tiles: cityTiles(),
    objects,
    zones: [{ id: "zona-30", kind: "slow", label: "30", x: 78, y: 6, w: 40, d: 18 }, ...parkingZones()],
    start: { x: 150, y: 135, heading: Math.PI },
  };
}

/** Reto: sale por la calle central, cruza el semáforo, gira a la derecha, espera a la persona,
 *  respeta la zona 30, se estaciona en P2 y llega a la meta. */
export function challengeScenario(): Scenario {
  const objects: WorldObject[] = [
    { id: "semaforo", kind: "light", x: 88, y: 87, facing: Math.PI, state: "rojo", cycle: { auto: true, rojo: 5, verde: 8, amarillo: 2 } },
    { id: "s-der", kind: "sign", sign: "derecha", x: 140, y: 87, facing: Math.PI },
    { id: "persona", kind: "obstacle", shape: "persona", x: 165, y: 104, w: 6, d: 6, h: 14, rot: 0, leavesAfterStop: 2 },
    { id: "s-30", kind: "sign", sign: "limite30", x: 153, y: 116, facing: rad(-90) },
    ...parkingSigns().filter((o) => o.id === "s-p2"),
    { id: "s-fin30", kind: "sign", sign: "fin30", x: 40, y: 147, facing: 0 },
    { id: "s-claxon", kind: "sign", sign: "claxon", x: 27, y: 86, facing: rad(90) },
  ];
  return {
    version: 1,
    id: "reto",
    name: "Reto de conducción inteligente",
    cols: 6,
    rows: 5,
    tile: T,
    tiles: cityTiles(),
    objects,
    zones: [
      { id: "zona-30", kind: "slow", label: "30", x: 150, y: 100, w: 27, d: 46 },
      { id: "zona-30b", kind: "slow", label: "30", x: 75, y: 127, w: 75, d: 19 },
      ...parkingZones(),
      { id: "meta", kind: "target", label: "META", x: 4, y: 30, w: 22, d: 22 },
    ],
    start: { x: 30, y: 75, heading: 0 },
  };
}

export const SCENARIOS: Record<string, () => Scenario> = {
  basica: basicScenario,
  ciudad: cityScenario,
  reto: challengeScenario,
};

export const SCENARIO_LIST = [
  { id: "basica", name: "1 · Pista básica" },
  { id: "ciudad", name: "2 · Ciudad con señales y semáforo" },
  { id: "reto", name: "3 · Reto de conducción inteligente" },
];
