/** Ejemplo «Seguidor inteligente» en el escenario 3: flechas, semáforo y obstáculos. */
import { describe, expect, it } from "vitest";
import type { LightObject, Scenario } from "../src/core/scenario";
import { Sim } from "../src/core/sim";
import { compileWorkspace } from "../src/program/compile";
import { smartFollowerProgram } from "../src/program/examples";
import { challengeScenario } from "../src/scenarios/defaults";

const start = (s: Scenario) => {
  const sim = new Sim(s);
  sim.loadProgram(compileWorkspace(smartFollowerProgram()));
  sim.runProgram();
  return sim;
};
const run = (sim: Sim, secs: number, each?: (sim: Sim) => void) => {
  for (let i = 0; i < secs * 50; i++) {
    sim.tick();
    each?.(sim);
  }
};
const said = (sim: Sim, text: string) => sim.log.some((l) => l.text.includes(text));
const light = (s: Scenario) => s.objects.find((o) => o.kind === "light") as LightObject;
const fixLight = (s: Scenario, state: LightObject["state"]) => {
  const l = light(s);
  l.cycle.auto = false;
  l.state = state;
};

describe("seguidor inteligente en el escenario 3", () => {
  it("rojo: se detiene; verde: sigue", () => {
    const s = challengeScenario();
    fixLight(s, "rojo");
    const sim = start(s);
    run(sim, 4);
    expect(sim.robot.x).toBeLessThan(60);
    expect(Math.abs(sim.speed)).toBeLessThan(0.5);
    expect(said(sim, "semáforo en rojo")).toBe(true);
    light(sim.scenario).state = "verde";
    run(sim, 3);
    expect(sim.robot.x).toBeGreaterThan(80);
  });

  it("amarillo: va frenando pero no se detiene", () => {
    const s = challengeScenario();
    fixLight(s, "amarillo");
    const sim = start(s);
    let minVel = 999;
    run(sim, 3, (q) => (minVel = Math.min(minVel, Number(q.interp.vars.get("velocidad")))));
    expect(said(sim, "voy frenando")).toBe(true);
    expect(minVel).toBe(60);
    expect(sim.robot.x).toBeGreaterThan(60);
  });

  it("flecha a la derecha: gira en el fin de la calle y se detiene ante la persona", () => {
    const s = challengeScenario();
    fixLight(s, "verde");
    const sim = start(s);
    // Baja por la calle de la derecha, más allá de donde estaba la persona.
    let bajo = false;
    run(sim, 14, (q) => (bajo ||= q.robot.x > 155 && q.robot.y > 112));
    expect(said(sim, "giro a la derecha")).toBe(true);
    expect(said(sim, "persona o caja delante")).toBe(true);
    expect(bajo).toBe(true);
    expect(sim.collisions).toBe(0);
  });

  it("flecha a la izquierda: gira hacia el otro lado y sigue la nueva calle", () => {
    const s = challengeScenario();
    fixLight(s, "verde");
    s.objects = s.objects.filter((o) => o.id !== "s-der");
    s.objects.push({ id: "s-izq", kind: "sign", sign: "izquierda", x: 140, y: 63, facing: Math.PI });
    const sim = start(s);
    // Sube por la calle de la derecha (hacia el norte) y nunca baja hacia la persona.
    let subio = false, bajo = false;
    run(sim, 10, (q) => {
      subio ||= q.robot.x > 155 && q.robot.y < 45;
      bajo ||= q.robot.x > 155 && q.robot.y > 95;
    });
    expect(said(sim, "giro a la izquierda")).toBe(true);
    expect(subio).toBe(true);
    expect(bajo).toBe(false);
    expect(sim.collisions).toBe(0);
  });

  it("una caja chica en la línea: se detiene antes y no choca", () => {
    const s = challengeScenario();
    fixLight(s, "verde");
    s.objects.push({ id: "caja", kind: "obstacle", shape: "caja", x: 125, y: 75, w: 8, d: 8, h: 8, rot: 0 });
    const sim = start(s);
    run(sim, 12);
    expect(sim.robot.x).toBeLessThan(118);
    expect(Math.abs(sim.speed)).toBeLessThan(0.5);
    expect(sim.collisions).toBe(0);
  });

  it("da vueltas completas sin perder la línea ni chocar", () => {
    const sim = start(challengeScenario());
    run(sim, 90);
    expect(sim.collisions).toBe(0);
    expect(sim.robot.odometer).toBeGreaterThan(1500);
  });
});
