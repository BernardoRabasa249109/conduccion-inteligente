/** Personas: la cámara K210 (simulada) las reconoce y chocarlas no las hace desaparecer. */
import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { computeVision } from "../src/core/sensors";
import type { ObstacleObject, Scenario, WorldObject } from "../src/core/scenario";

const persona = (x: number, y: number, rot = 0): ObstacleObject => ({ id: "persona", kind: "obstacle", shape: "persona", x, y, w: 6, d: 6, h: 14, rot, leavesAfterStop: 2 });
const scenario = (objects: WorldObject[], heading = 0): Scenario => ({
  version: 1, id: "prueba", name: "Prueba", cols: 6, rows: 3, tile: 30, tiles: [], objects, zones: [], start: { x: 40, y: 45, heading },
});
const vision = (sim: Sim) => computeVision(sim.world, sim.robot, sim.time);
const tick = (sim: Sim, secs: number) => {
  for (let i = 0; i < secs * 50; i++) sim.tick();
};

describe("la cámara reconoce personas (ampliación educativa)", () => {
  it("una persona delante, a buena distancia, se reconoce", () => {
    const v = vision(new Sim(scenario([persona(70, 45)])));
    expect(v.label).toBe("persona");
    expect(v.confidence).toBeGreaterThan(0.6);
  });
  it("se reconoce desde cualquier lado: no tiene una cara que deba mirar a la cámara", () => {
    for (const rot of [0, Math.PI / 2, Math.PI]) expect(vision(new Sim(scenario([persona(70, 45, rot)]))).label).toBe("persona");
  });
  it("detrás del robot o demasiado lejos, no", () => {
    expect(vision(new Sim(scenario([persona(70, 45)], Math.PI))).label).toBeNull();
    expect(vision(new Sim(scenario([persona(170, 45)]))).candidates[0].status).toBe("demasiado lejos");
  });
  it("tapada por una caja alta, no", () => {
    const caja: WorldObject = { id: "caja", kind: "obstacle", shape: "caja", x: 58, y: 45, w: 8, d: 8, h: 18, rot: 0 };
    const v = vision(new Sim(scenario([caja, persona(75, 45)])));
    expect(v.label).toBeNull();
    expect(v.candidates.find((c) => c.id === "persona")?.status).toBe("tapada");
  });
  it("cuando la persona ya cruzó, la cámara deja de verla", () => {
    const sim = new Sim(scenario([persona(70, 45)]));
    sim.world.removed.add("persona");
    expect(vision(sim).label).toBeNull();
  });
});

describe("chocar con una persona no la hace desaparecer", () => {
  it("el robot la choca y espera: la persona sigue ahí", () => {
    const sim = new Sim(scenario([persona(70, 45)]));
    sim.setManual(150, 150);
    tick(sim, 3);
    expect(sim.robot.bumped).toBe("persona");
    sim.setManual(0, 0);
    tick(sim, 6);
    expect(sim.world.removed.has("persona")).toBe(false);
    expect(sim.log.some((l) => /no cruza mientras el robot la toca/.test(l.text))).toBe(true);
  });
  it("si retrocede y se detiene antes de tocarla, entonces sí cruza", () => {
    const sim = new Sim(scenario([persona(70, 45)]));
    sim.setManual(150, 150);
    tick(sim, 3);
    sim.setManual(-120, -120);
    tick(sim, 0.5);
    sim.setManual(0, 0);
    tick(sim, 3);
    expect(sim.world.removed.has("persona")).toBe(true);
  });
  it("detenerse antes de llegar (sin chocar) la deja cruzar, como siempre", () => {
    const sim = new Sim(scenario([persona(70, 45)]));
    sim.setManual(120, 120);
    tick(sim, 0.4);
    sim.setManual(0, 0);
    tick(sim, 3);
    expect(sim.robot.bumped).toBeNull();
    expect(sim.world.removed.has("persona")).toBe(true);
  });
});
