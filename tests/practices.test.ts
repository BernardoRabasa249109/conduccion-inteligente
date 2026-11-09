import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { chassisCenter } from "../src/core/robot";
import { compileWorkspace } from "../src/program/compile";
import { PRACTICES, practiceScenario } from "../src/practices/practices";
import { done } from "../src/practices/checks";

function runProgram(n: number, which: "solution" | "starter", secs = 60) {
  const p = PRACTICES[n - 1];
  const sim = new Sim(practiceScenario(p));
  const checker = p.checker();
  sim.observers.add((s) => checker.tick(s));
  const prog = compileWorkspace((which === "solution" ? p.solution! : p.starter!)());
  sim.loadProgram(prog);
  sim.runProgram();
  checker.program?.(prog);
  for (let i = 0; i < secs * 50 && !done(checker); i++) sim.tick();
  return { sim, checker };
}

const summary = (c: { items: { id: string; ok: boolean | null }[] }) => c.items.map((i) => `${i.id}:${i.ok}`).join(" ");

describe("las prácticas de programación comprueban comportamiento real", () => {
  for (const n of [5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 19, 20, 21, 22, 23, 24, 25]) {
    it(`práctica ${n}: la solución la completa`, () => {
      const { checker } = runProgram(n, "solution", 90);
      expect(done(checker), summary(checker)).toBe(true);
    });
    it(`práctica ${n}: el programa inicial NO la completa`, () => {
      const { checker } = runProgram(n, "starter", 60);
      expect(done(checker), summary(checker)).toBe(false);
    });
  }
});

/** Un "conductor" que maneja con setManual hacia un punto, como haría un alumno. */
function driveTo(sim: Sim, tx: number, ty: number, secs = 30) {
  for (let i = 0; i < secs * 50; i++) {
    const r = sim.robot;
    const want = Math.atan2(ty - r.y, tx - r.x);
    const err = Math.atan2(Math.sin(want - r.heading), Math.cos(want - r.heading));
    const dist = Math.hypot(tx - r.x, ty - r.y);
    if (dist < 2) break;
    if (Math.abs(err) > 0.5) sim.setManual(err > 0 ? 90 : -90, err > 0 ? -90 : 90);
    else sim.setManual(140 + 90 * err, 140 - 90 * err);
    sim.tick();
  }
  sim.setManual(0, 0);
  for (let i = 0; i < 25; i++) sim.tick();
}

describe("las prácticas manuales y de exploración", () => {
  const start = (n: number) => {
    const p = PRACTICES[n - 1];
    const sim = new Sim(practiceScenario(p));
    const checker = p.checker();
    sim.observers.add((s) => checker.tick(s));
    return { sim, checker };
  };
  it("práctica 1: el cuestionario se completa con respuestas correctas", () => {
    const { checker } = start(1);
    for (const id of ["linea", "distancia", "senales", "decide", "mueve"]) checker.event!("quiz", id);
    expect(done(checker)).toBe(false);
    checker.event!("quiz", "iconos");
    expect(done(checker)).toBe(true);
  });
  it("práctica 2: conducir a mano hasta la META", () => {
    const { sim, checker } = start(2);
    driveTo(sim, 145, 15, 30);
    expect(done(checker), summary(checker)).toBe(true);
  });
  it("práctica 2: no basta con moverse un poco", () => {
    const { sim, checker } = start(2);
    driveTo(sim, 80, 105, 10);
    expect(done(checker)).toBe(false);
  });
  it("práctica 3: curva amplia con motores 100 / 200", () => {
    const { sim, checker } = start(3);
    for (let i = 0; i < 50 * 4; i++) { sim.setManual(100, 200); sim.tick(); }
    expect(done(checker), summary(checker)).toBe(true);
  });
  it("práctica 3: girar sobre sí mismo no cuenta como curva amplia", () => {
    const { sim, checker } = start(3);
    for (let i = 0; i < 50 * 4; i++) { sim.setManual(-120, 120); sim.tick(); }
    expect(done(checker)).toBe(false);
  });
  it("práctica 4: las cuatro combinaciones de lectura", () => {
    const { sim, checker } = start(4);
    const spin = (l: number, r: number, cond: () => boolean) => { for (let i = 0; i < 300 && !cond(); i++) { sim.setManual(l, r); sim.tick(); } sim.setManual(0, 0); for (let i = 0; i < 10; i++) sim.tick(); };
    spin(0, 0, () => false);
    spin(60, -60, () => sim.now.lineLeft === 1 && sim.now.lineRight === 0);
    spin(-60, 60, () => sim.now.lineLeft === 0 && sim.now.lineRight === 1);
    spin(-60, 60, () => sim.now.lineLeft === 0 && sim.now.lineRight === 0);
    expect(done(checker), summary(checker)).toBe(true);
  });
  it("práctica 9: la cámara reconoce tres señales y hay una que no", () => {
    const { sim, checker } = start(9);
    driveTo(sim, 150, 15, 20);
    driveTo(sim, 165, 60, 10);
    expect(done(checker), summary(checker)).toBe(true);
  });
});

describe("prácticas de ampliación (16–25)", () => {
  const start = (n: number) => {
    const p = PRACTICES[n - 1];
    const sim = new Sim(practiceScenario(p));
    const checker = p.checker();
    sim.observers.add((s) => checker.tick(s));
    return { p, sim, checker };
  };
  const run = (sim: Sim, secs: number) => {
    for (let i = 0; i < secs * 50; i++) sim.tick();
  };
  it("hay 25 prácticas numeradas del 1 al 25", () => {
    expect(PRACTICES.map((p) => p.n)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
  it("práctica 16: las cuatro lecturas de la regleta", () => {
    const { checker } = start(16);
    for (const k of ["11", "10", "01"]) checker.event!("flujo", k);
    expect(done(checker)).toBe(false);
    checker.event!("flujo", "00");
    expect(done(checker)).toBe(true);
  });
  it("práctica 17: zigzag entre las cajas hasta la META", () => {
    const { sim, checker } = start(17);
    for (const [x, y] of [[45, 40], [75, 40], [75, 80], [105, 80], [105, 40], [135, 40], [150, 60]]) driveTo(sim, x, y, 12);
    expect(done(checker), summary(checker)).toBe(true);
  });
  it("práctica 17: pasar todas las cajas por el mismo lado no cuenta", () => {
    const { sim, checker } = start(17);
    for (const [x, y] of [[45, 40], [135, 40], [150, 60]]) driveTo(sim, x, y, 12);
    expect(done(checker)).toBe(false);
  });
  it("práctica 18: espera, arranca con A y se detiene con B", () => {
    const { p, sim, checker } = start(18);
    const prog = compileWorkspace(p.solution!());
    sim.loadProgram(prog);
    sim.runProgram();
    run(sim, 2);
    expect(sim.robot.odometer).toBeLessThan(1);
    sim.pressButton("A");
    run(sim, 5);
    sim.pressButton("B");
    run(sim, 3);
    expect(done(checker), summary(checker)).toBe(true);
  });
  it("práctica 18: el programa inicial arranca sin esperar a A", () => {
    const { p, sim, checker } = start(18);
    sim.loadProgram(compileWorkspace(p.starter!()));
    sim.runProgram();
    run(sim, 2);
    sim.pressButton("A");
    run(sim, 5);
    sim.pressButton("B");
    run(sim, 3);
    expect(done(checker)).toBe(false);
  });
});

it("chassis helper exists", () => expect(chassisCenter({ x: 0, y: 0, heading: 0 })[0]).toBeGreaterThan(0));
