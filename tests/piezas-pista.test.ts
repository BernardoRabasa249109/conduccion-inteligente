/**
 * Piezas de pista nuevas: Y, calle sin salida, curva en S, desvío por obras,
 * bahía de parada, línea con corte y el retorno en U (dos curvas).
 */
import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { compileWorkspace } from "../src/program/compile";
import { EXAMPLES } from "../src/program/examples";
import { E, edgeClearance, LineMap, N, nearEdge, PEN_SHAPES, rotateMask, S, tileMask, uTurnOptions, W } from "../src/core/track";
import { TILE_TYPES, validateScenario, type Scenario, type TileSpec, type TileType } from "../src/core/scenario";
import { SCENARIOS } from "../src/scenarios/defaults";

const T = (c: number, r: number, type: TileType, rot = 0): TileSpec => ({ c, r, type, rot });
/** Escenario con una casilla vacía de margen alrededor (el robot no choca con el borde del tapete). */
const withMargin = (tiles: TileSpec[], cols: number, rows: number, start: Scenario["start"]): Scenario => ({
  version: 1, id: "prueba", name: "Prueba", cols: cols + 2, rows: rows + 2, tile: 30,
  tiles: tiles.map((t) => ({ ...t, c: t.c + 1, r: t.r + 1 })), objects: [], zones: [], start: { ...start, x: start.x + 30, y: start.y + 30 },
});
/** Vuelta de 3×3 con la pieza en el lado izquierdo (vertical, giro 0). */
const loopWith = (type: TileType, heading: number) =>
  withMargin([T(0, 0, "curve", 1), T(1, 0, "straight"), T(2, 0, "curve", 2), T(0, 1, type), T(2, 1, "straight", 1), T(0, 2, "curve"), T(1, 2, "straight"), T(2, 2, "curve", 3)], 3, 3, { x: 45, y: 75, heading });

function drive(s: Scenario, id: string, secs = 45) {
  const sim = new Sim(structuredClone(s));
  const map = new LineMap(s);
  sim.loadProgram(compileWorkspace(EXAMPLES.find((e) => e.id === id)!.build()));
  sim.runProgram();
  let near = 0;
  const cells = new Set<string>();
  for (let i = 0; i < secs * 50; i++) {
    sim.tick();
    if (map.distance(sim.robot.x, sim.robot.y) < 3) near++;
    cells.add(`${Math.floor(sim.robot.x / 30)},${Math.floor(sim.robot.y / 30)}`);
  }
  return { cm: sim.robot.odometer, onLine: near / (secs * 50), cells };
}

const NEW: TileType[] = ["lcorner", "fork", "deadend", "scurve", "detour", "bay", "parking", "gap"];

describe("conexiones de las piezas nuevas", () => {
  it("los lados conectados giran con la pieza (N→E→S→W)", () => {
    expect(rotateMask(N, 1)).toBe(E);
    expect(rotateMask(W, 1)).toBe(N);
    expect(rotateMask(S | E | W, 2)).toBe(N | W | E);
    expect(tileMask("fork", 0)).toBe(S | E | W);
    expect(tileMask("deadend", 0)).toBe(S);
    expect(tileMask("lcorner", 0)).toBe(N | E);
    for (const t of ["scurve", "detour", "bay", "parking", "gap"] as TileType[]) expect(tileMask(t, 0)).toBe(N | S);
  });
  it("en cada giro, hay línea justo en los lados conectados y en ningún otro", () => {
    for (const type of NEW) {
      for (let rot = 0; rot < 4; rot++) {
        const s: Scenario = { version: 1, id: "x", name: "x", cols: 3, rows: 3, tile: 30, tiles: [T(1, 1, type, rot)], objects: [], zones: [], start: { x: 5, y: 5, heading: 0 } };
        const map = new LineMap(s);
        const mask = tileMask(type, rot);
        const probes: [number, number, number][] = [[N, 45, 30.6], [E, 59.4, 45], [S, 45, 59.4], [W, 30.6, 45]];
        for (const [side, x, y] of probes) expect(map.isBlack(x, y), `${type} giro ${rot} lado ${side}`).toBe(Boolean(mask & side));
      }
    }
  });
  it("cada pieza nueva está en la paleta y el validador la acepta", () => {
    for (const t of NEW) {
      expect(TILE_TYPES).toContain(t);
      expect(PEN_SHAPES[t]).toBeDefined();
    }
    expect(validateScenario(loopWith("scurve", 0))).toEqual([]);
  });
  it("la línea con corte deja un tramo sin línea y la bahía tiene su franja de parada", () => {
    const gap = new LineMap(withMargin([T(0, 0, "gap")], 1, 1, { x: 15, y: 15, heading: 0 }));
    expect(gap.isBlack(45, 45)).toBe(false);
    expect(gap.isBlack(45, 40)).toBe(true);
    const bay = new LineMap(withMargin([T(0, 0, "bay")], 1, 1, { x: 15, y: 15, heading: 0 }));
    expect(bay.isBlack(30 + 21, 45)).toBe(true); // bahía
    expect(bay.isBlack(30 + 23, 45)).toBe(true); // franja de parada que la cruza
  });
});

describe("un seguidor que recupera la línea recorre cada pieza en los dos sentidos", () => {
  for (const type of ["scurve", "detour", "bay", "parking", "gap"] as TileType[]) {
    for (const [dir, heading] of [["ida", 0], ["vuelta", Math.PI]] as const) {
      it(`${type} (${dir})`, () => {
        const r = drive(loopWith(type, heading), "seguidor-inteligente");
        expect(r.onLine).toBeGreaterThan(0.97);
        expect(r.cells.size).toBe(8);
        expect(r.cm).toBeGreaterThan(500);
      });
    }
  }
  it("esquina en L: vuelta con una L en cada esquina, en los dos sentidos", () => {
    for (const heading of [0, Math.PI]) {
      const s = withMargin([T(0, 0, "lcorner", 1), T(1, 0, "straight"), T(2, 0, "lcorner", 2), T(0, 1, "straight", 1), T(2, 1, "straight", 1), T(0, 2, "lcorner"), T(1, 2, "straight"), T(2, 2, "lcorner", 3)], 3, 3, { x: 45, y: 75, heading });
      const r = drive(s, "seguidor-inteligente");
      expect(r.onLine).toBeGreaterThan(0.97);
      expect(r.cells.size).toBe(8);
      expect(r.cm).toBeGreaterThan(500);
    }
  });
  it("bifurcación en Y: vuelta con un travesaño de Y a Y", () => {
    const s = withMargin([T(0, 0, "curve", 1), T(1, 0, "fork", 0), T(2, 0, "curve", 2), T(0, 1, "straight", 1), T(1, 1, "straight", 1), T(2, 1, "straight", 1), T(0, 2, "curve"), T(1, 2, "fork", 2), T(2, 2, "curve", 3)], 3, 3, { x: 15, y: 45, heading: Math.PI / 2 });
    const r = drive(s, "recuperar-linea");
    expect(r.onLine).toBeGreaterThan(0.97);
    expect(r.cells.size).toBe(9);
  });
  it("retorno en U (dos curvas): ida y vuelta entre dos carriles", () => {
    const s = withMargin([T(0, 0, "curve", 1), T(1, 0, "curve", 2), T(0, 1, "straight", 1), T(1, 1, "straight", 1), T(0, 2, "curve"), T(1, 2, "curve", 3)], 2, 3, { x: 15, y: 45, heading: Math.PI / 2 });
    const r = drive(s, "seguidor-inteligente");
    expect(r.onLine).toBeGreaterThan(0.97);
    expect(r.cells.size).toBe(6);
  });
  it("calle sin salida: llega al bucle y lo sigue sin perder la línea", () => {
    const s = withMargin([T(0, 0, "deadend", 3), T(1, 0, "straight"), T(2, 0, "straight"), T(3, 0, "deadend", 1)], 4, 1, { x: 60, y: 15, heading: 0 });
    const r = drive(s, "seguidor-inteligente");
    expect(r.onLine).toBeGreaterThan(0.97);
    expect(r.cm).toBeGreaterThan(300);
  });
});

describe("retorno en U en el editor", () => {
  const empty = { tiles: [] as TileSpec[], cols: 4, rows: 3 };
  it("sin vecinas, abre hacia arriba con la segunda casilla a la derecha", () => {
    expect(uTurnOptions(empty, 1, 1)[0]).toEqual([T(1, 1, "curve", 0), T(2, 1, "curve", 3)]);
  });
  it("en la última columna, la segunda casilla va a la izquierda", () => {
    const first = uTurnOptions(empty, 3, 1)[0];
    expect(first.every((t) => t.c >= 0 && t.c < 4)).toBe(true);
    expect(first.map((t) => t.c).sort()).toEqual([2, 3]);
  });
  it("se orienta para unir dos carriles que ya existen (abajo)", () => {
    const s = { ...empty, tiles: [T(1, 2, "straight", 1), T(2, 2, "straight", 1)] };
    const first = uTurnOptions(s, 1, 1)[0];
    expect(first).toEqual([T(1, 1, "curve", 1), T(2, 1, "curve", 2)]);
  });
  it("ofrece las ocho formas posibles para cambiar con otro clic", () => {
    expect(uTurnOptions(empty, 1, 1)).toHaveLength(8);
  });
});

describe("aviso de borde del tapete", () => {
  it("una curva en S en la columna del borde lleva la línea demasiado cerca del borde", () => {
    const s = { tile: 30, cols: 3, rows: 3, tiles: [T(0, 1, "scurve")] };
    expect(edgeClearance(s.tiles[0], s)).toBeLessThan(7);
    expect(nearEdge(s)).not.toBeNull();
  });
  it("en el centro del tapete no hay aviso", () => {
    expect(nearEdge({ tile: 30, cols: 3, rows: 3, tiles: [T(1, 1, "scurve")] })).toBeNull();
  });
  it("los escenarios que trae el simulador no dan el aviso", () => {
    for (const [id, make] of Object.entries(SCENARIOS)) expect(nearEdge(make()), id).toBeNull();
  });
});

describe("retorno en U: no pisa piezas", () => {
  it("prefiere una casilla libre aunque otra forma conecte con una vecina", () => {
    // Arriba de la casilla elegida hay una pieza; abrir hacia la derecha la pisaría.
    const s = { cols: 6, rows: 4, tiles: [T(3, 0, "detour", 1), T(4, 0, "bay", 1)] };
    const first = uTurnOptions(s, 3, 1)[0];
    expect(first.some((t) => s.tiles.some((q) => q.c === t.c && q.r === t.r))).toBe(false);
  });
});

describe("aparcamiento", () => {
  const map = new LineMap(withMargin([T(0, 0, "parking")], 1, 1, { x: 15, y: 15, heading: 0 }));
  it("cuatro ramales que llegan a su barra de tope, a los dos lados de la recta", () => {
    for (const y of [10.5, 21]) {
      for (const x of [10, 20]) expect(map.isBlack(30 + x, 30 + y), `ramal ${x},${y}`).toBe(true);
      for (const x of [7.2, 22.8]) expect(map.isBlack(30 + x, 30 + y + 1.5), `tope ${x},${y}`).toBe(true);
      for (const x of [3.6, 26.4]) expect(map.isBlack(30 + x, 30 + y), `número ${x},${y}`).toBe(false);
    }
  });
  it("en la columna del borde del tapete no da el aviso de borde", () => {
    expect(nearEdge({ tile: 30, cols: 3, rows: 3, tiles: [T(0, 1, "parking")] })).toBeNull();
  });
});
