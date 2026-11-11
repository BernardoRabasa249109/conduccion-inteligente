/** Piezas de pista «Glorieta» y «Glorieta de retorno». */
import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { compileWorkspace } from "../src/program/compile";
import { EXAMPLES } from "../src/program/examples";
import { E, LineMap, N, ROUNDABOUT, S, tileMask, W } from "../src/core/track";
import { validateScenario, type Scenario, type TileSpec } from "../src/core/scenario";

const T = (c: number, r: number, type: TileSpec["type"], rot = 0): TileSpec => ({ c, r, type, rot });
const scenario = (tiles: TileSpec[], cols: number, rows: number, start: Scenario["start"]): Scenario => ({ version: 1, id: "prueba", name: "Prueba", cols, rows, tile: 30, tiles, objects: [], zones: [], start });

/** Vuelta de 3×3 con una glorieta en la recta de arriba. */
const loop = scenario(
  [T(0, 0, "curve", 1), T(1, 0, "roundabout", 0), T(2, 0, "curve", 2), T(0, 1, "straight", 1), T(2, 1, "straight", 1), T(0, 2, "curve", 0), T(1, 2, "straight", 0), T(2, 2, "curve", 3)],
  3, 3, { x: 45, y: 75, heading: 0 },
);
/** Recta con una glorieta de retorno en cada extremo. */
const shuttle = scenario([T(0, 0, "turnaround", 1), T(1, 0, "straight", 0), T(2, 0, "straight", 0), T(3, 0, "turnaround", 3)], 4, 1, { x: 60, y: 15, heading: 0 });

describe("conexiones", () => {
  it("la glorieta conecta dos lados opuestos, como la recta", () => {
    expect(tileMask("roundabout", 0)).toBe(E | W);
    expect(tileMask("roundabout", 1)).toBe(N | S);
  });
  it("la glorieta de retorno tiene una sola entrada, que gira con la pieza", () => {
    expect([0, 1, 2, 3].map((r) => tileMask("turnaround", r))).toEqual([N, E, S, W]);
  });
});

describe("lo que leen los sensores coincide con el dibujo", () => {
  const map = new LineMap(shuttle);
  const R = ROUNDABOUT.ring * 30;
  const [cx, cy] = [15, 15];
  it("el anillo negro se lee como línea en toda la vuelta", () => {
    for (let a = 0; a < 360; a += 15) {
      const t = (a * Math.PI) / 180;
      expect(map.isBlack(cx + Math.cos(t) * R, cy + Math.sin(t) * R), `${a}°`).toBe(true);
    }
  });
  it("dentro del anillo es blanco: también la dona morada (es decoración)", () => {
    expect(map.isBlack(cx, cy)).toBe(false);
    expect(map.isBlack(cx + ((ROUNDABOUT.donutOuter + ROUNDABOUT.donutInner) / 2) * 30, cy)).toBe(false);
  });
  it("hay tramo solo hacia la entrada", () => {
    expect(map.isBlack(cx + R + 3, cy)).toBe(true); // hacia el este: la entrada (giro 1)
    expect(map.isBlack(cx - R - 3, cy)).toBe(false);
    expect(map.isBlack(cx, cy + R + 3)).toBe(false);
  });
});

describe("validación de escenarios", () => {
  it("acepta las piezas nuevas y rechaza una pieza desconocida", () => {
    expect(validateScenario(loop)).toEqual([]);
    expect(validateScenario(shuttle)).toEqual([]);
    expect(validateScenario({ ...loop, tiles: [...loop.tiles, { c: 1, r: 1, type: "rampa", rot: 0 }] })[0]).toContain("rampa");
  });
});

describe("un seguidor que recupera la línea las recorre", () => {
  const drive = (s: Scenario, secs: number) => {
    const sim = new Sim(structuredClone(s));
    const map = new LineMap(s);
    sim.loadProgram(compileWorkspace(EXAMPLES.find((e) => e.id === "seguidor-inteligente")!.build()));
    sim.runProgram();
    let near = 0;
    const cells = new Set<string>();
    for (let i = 0; i < secs * 50; i++) {
      sim.tick();
      if (map.distance(sim.robot.x, sim.robot.y) < 3) near++;
      cells.add(`${Math.floor(sim.robot.x / 30)},${Math.floor(sim.robot.y / 30)}`);
    }
    return { cm: sim.robot.odometer, onLine: near / (secs * 50), cells };
  };
  it("pasa por la glorieta y sigue dando vueltas", () => {
    const r = drive(loop, 40);
    expect(r.onLine).toBeGreaterThan(0.98);
    expect(r.cells.size).toBe(8);
    expect(r.cm).toBeGreaterThan(500);
  });
  it("da la vuelta en cada glorieta de retorno y va de un extremo al otro", () => {
    const r = drive(shuttle, 40);
    expect(r.onLine).toBeGreaterThan(0.98);
    expect(r.cells.has("0,0") && r.cells.has("3,0")).toBe(true);
  });
});
