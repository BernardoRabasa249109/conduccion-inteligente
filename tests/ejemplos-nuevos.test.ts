/** Los cinco ejemplos resueltos de refuerzo: hacen lo que dicen en el simulador. */
import { describe, expect, it } from "vitest";
import { cloneScenario } from "../src/core/scenario";
import { Sim } from "../src/core/sim";
import { compileWorkspace } from "../src/program/compile";
import { EXAMPLES } from "../src/program/examples";
import { SCENARIOS } from "../src/scenarios/defaults";

const start = (id: string) => {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const s = cloneScenario(SCENARIOS[ex.scenario]());
  ex.setup?.(s);
  if (ex.start) s.start = ex.start;
  const sim = new Sim(s);
  sim.loadProgram(compileWorkspace(ex.build()));
  sim.runProgram();
  return sim;
};
const run = (sim: Sim, secs: number, each?: (sim: Sim) => void) => {
  for (let i = 0; i < secs * 50; i++) {
    sim.tick();
    each?.(sim);
  }
};
const rgb = (l: string) => l.slice(4).split(",").map(Number);

describe("ejemplos resueltos de refuerzo", () => {
  it("sensor de estacionamiento: frena poco a poco, se pone rojo y se detiene sin chocar", () => {
    const sim = start("sensor-estacionamiento");
    let far = 0, near = 0;
    run(sim, 12, (q) => {
      if (q.now.distance > 50) far = Math.max(far, q.speed);
      if (q.now.distance > 15 && q.now.distance < 25) near = Math.max(near, q.speed);
    });
    expect(near).toBeLessThan(far * 0.6);
    expect(Math.abs(sim.speed)).toBeLessThan(0.5);
    expect(sim.now.distance).toBeGreaterThanOrEqual(3);
    expect(sim.now.distance).toBeLessThanOrEqual(12);
    const [r, g] = rgb(sim.robot.lights);
    expect(r).toBeGreaterThan(220);
    expect(g).toBeLessThan(40);
    expect(sim.collisions).toBe(0);
  });

  it("media vuelta: ante la caja gira 180° y sigue la línea hacia el otro lado", () => {
    const sim = start("media-vuelta");
    run(sim, 6);
    expect(Math.cos(sim.robot.heading)).toBeLessThan(-0.9);
    const x = sim.robot.x;
    run(sim, 2);
    expect(sim.robot.x).toBeLessThan(x - 20);
    expect(sim.collisions).toBe(0);
  });

  it("cronómetro: mide el tiempo de una vuelta", () => {
    const sim = start("cronometro");
    run(sim, 45);
    const lap = sim.log.map((l) => /^Vuelta 1: ([\d.]+) s$/.exec(l.text)).find(Boolean);
    expect(lap).toBeTruthy();
    const secs = Number(lap![1]);
    expect(secs).toBeGreaterThan(15);
    expect(secs).toBeLessThan(30);
  });

  it("botones: A cambia la velocidad y B pausa o reanuda", () => {
    const sim = start("botones-velocidad");
    const avg = (secs: number) => {
      const o = sim.robot.odometer;
      run(sim, secs);
      return (sim.robot.odometer - o) / secs;
    };
    run(sim, 1);
    const slow = avg(2);
    sim.pressButton("A");
    sim.pressButton("A");
    run(sim, 1);
    expect(sim.interp.vars.get("modo")).toBe(3);
    const fast = avg(2);
    expect(fast).toBeGreaterThan(slow * 1.6);
    sim.pressButton("B");
    run(sim, 1);
    expect(avg(1)).toBeLessThan(0.5);
    sim.pressButton("B");
    run(sim, 0.5);
    expect(avg(1)).toBeGreaterThan(10);
  });

  it("rodear: esquiva la caja sin tocarla y vuelve a seguir la línea al otro lado", () => {
    const sim = start("rodear-obstaculo");
    let beyond = false;
    run(sim, 12, (q) => (beyond ||= q.robot.x > 140 && q.robot.y > 95 && (q.now.lineLeft === 1 || q.now.lineRight === 1)));
    expect(beyond).toBe(true);
    expect(sim.collisions).toBe(0);
    expect(sim.now.lineLeft || sim.now.lineRight).toBeTruthy();
  });
});
