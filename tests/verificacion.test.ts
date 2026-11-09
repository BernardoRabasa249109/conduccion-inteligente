/**
 * Verificaciones pedidas para la primera versión (se ejecutan con `npm test`).
 */
import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { computeVision } from "../src/core/sensors";
import { createRobot } from "../src/core/robot";
import { validateScenario, type Scenario } from "../src/core/scenario";
import { World } from "../src/core/world";
import { compileWorkspace, type WorkspaceJson } from "../src/program/compile";
import * as B from "../src/program/dsl";
import { EXAMPLES, followLine } from "../src/program/examples";
import { basicScenario, cityScenario, SCENARIOS } from "../src/scenarios/defaults";

const run = (s: Scenario, ws: WorkspaceJson, secs: number) => {
  const sim = new Sim(s);
  sim.loadProgram(compileWorkspace(ws));
  sim.runProgram();
  for (let i = 0; i < secs * 50; i++) sim.tick();
  return sim;
};

describe("modificar los bloques cambia el comportamiento", () => {
  it("cambiar el tiempo de «esperar» cambia la distancia recorrida", () => {
    const corto = run(basicScenario(), B.workspace([B.onStart([B.motors(150, 150), B.wait(1000), B.stop()])]), 4);
    const largo = run(basicScenario(), B.workspace([B.onStart([B.motors(150, 150), B.wait(2000), B.stop()])]), 4);
    expect(largo.robot.odometer).toBeGreaterThan(corto.robot.odometer * 1.8);
  });
  it("invertir los giros del seguidor hace que el robot pierda la línea", () => {
    const bien = run(basicScenario(), B.workspace([B.forever([followLine(150, false)])]), 20);
    const mal = run(
      basicScenario(),
      B.workspace([B.forever([B.ifElse([[B.and(B.line("L"), B.line("R")), [B.motors(150, 150)]], [B.line("L"), [B.motors(150, 20)]], [B.line("R"), [B.motors(20, 150)]]], [B.stop()])])]),
      20,
    );
    expect(bien.robot.odometer).toBeGreaterThan(300);
    expect(mal.robot.odometer).toBeLessThan(bien.robot.odometer / 2);
    expect(mal.log.some((l) => l.text.includes("línea perdida"))).toBe(true);
  });
});

describe("el seguimiento de línea usa las lecturas de los sensores", () => {
  it("sin línea bajo el robot, el mismo programa no avanza", () => {
    const sinLinea = basicScenario();
    sinLinea.tiles = [];
    const sim = run(sinLinea, B.workspace([B.forever([followLine(150, false)])]), 5);
    expect(sim.robot.odometer).toBeLessThan(2);
  });
  it("las lecturas cambian al mover el robot sobre blanco y negro", () => {
    const sim = new Sim(basicScenario());
    expect([sim.now.lineLeft, sim.now.lineRight]).toEqual([1, 1]);
    sim.placeRobot(sim.robot.x, sim.robot.y - 12, 0);
    expect([sim.now.lineLeft, sim.now.lineRight]).toEqual([0, 0]);
    sim.placeRobot(sim.robot.x, sim.robot.y + 12 + 1.3, 0);
    expect([sim.now.lineLeft, sim.now.lineRight]).toEqual([1, 0]);
  });
});

describe("las señales fuera de la vista no se detectan", () => {
  const city = () => new World(cityScenario());
  const status = (w: World, x: number, y: number, heading: number, id: string) => computeVision(w, { ...createRobot({ x, y, heading }) }, 0).candidates.find((c) => c.id === id)!;
  it("de frente y a buena distancia: se reconoce", () => {
    const r = computeVision(city(), createRobot({ x: 30, y: 15, heading: 0 }), 0);
    expect(r.label).toBe("limite30");
  });
  it("detrás del robot: no se reconoce", () => {
    expect(status(city(), 100, 15, 0, "s-30").status).toBe("fuera del campo de visión");
  });
  it("demasiado lejos: no se reconoce", () => {
    const w = city();
    expect(status(w, 2, 15, 0, "s-fin30").status).not.toBe("reconocida");
  });
  it("vista desde atrás (de lado o de espaldas): no se reconoce", () => {
    expect(status(city(), 110, 15, Math.PI, "s-30").status).not.toBe("reconocida");
  });
  it("tapada por un objeto alto: no se reconoce", () => {
    const s = cityScenario();
    s.objects.push({ id: "muro", kind: "obstacle", shape: "caja", x: 50, y: 20, w: 4, d: 14, h: 20, rot: 0 });
    const c = computeVision(new World(s), createRobot({ x: 30, y: 15, heading: 0 }), 0).candidates.find((q) => q.id === "s-30")!;
    expect(c.status).toBe("tapada");
  });
  it("el programa solo recibe lo que la cámara ve", () => {
    const sim = new Sim(cityScenario());
    sim.placeRobot(100, 15, Math.PI);
    sim.tick();
    expect(sim.seen.vision.label).toBe(null);
  });
});

describe("las paradas tienen prioridad", () => {
  it("con el obstáculo primero, el robot se detiene sin chocar", () => {
    const ex = EXAMPLES.find((e) => e.id === "obstaculo")!;
    const s = basicScenario();
    ex.setup!(s);
    const sim = run(s, ex.build(), 10);
    expect(sim.collisions).toBe(0);
    expect(sim.now.distance).toBeGreaterThan(0);
    expect(sim.now.distance).toBeLessThan(16);
  });
  it("si el seguidor va primero, la parada nunca se comprueba y choca", () => {
    const s = basicScenario();
    s.objects.push({ id: "caja", kind: "obstacle", shape: "caja", x: 120, y: 105, w: 8, d: 8, h: 8, rot: 0 });
    const ws = B.workspace([B.forever([B.ifElse([[B.or(B.line("L"), B.line("R")), [followLine(150, false)]], [B.obstacle(15), [B.stop()]]])])]);
    const sim = run(s, ws, 10);
    expect(sim.collisions).toBeGreaterThan(0);
  });
  it("un semáforo en rojo detiene al robot aunque vea la línea", () => {
    const s = cityScenario();
    s.start = { x: 30, y: 15, heading: 0 };
    const l = s.objects.find((o) => o.kind === "light")!;
    if (l.kind === "light") {
      l.cycle.auto = false;
      l.state = "rojo";
    }
    const ex = EXAMPLES.find((e) => e.id === "prioridades")!;
    const sim = run(s, ex.build(), 12);
    expect(sim.robot.x).toBeLessThan(90);
    expect(Math.abs(sim.speed)).toBeLessThan(0.5);
  });
});

describe("pausar y reiniciar no dejan acciones pendientes", () => {
  const ws = B.workspace([B.onStart([B.set("vueltas", 7), B.wait(1500), B.motors(200, 200)])]);
  it("reiniciar durante una espera borra la espera, las variables y los motores", () => {
    const sim = new Sim(basicScenario());
    sim.loadProgram(compileWorkspace(ws));
    sim.runProgram();
    for (let i = 0; i < 25; i++) sim.tick();
    expect(sim.interp.vars.get("vueltas")).toBe(7);
    sim.setPaused(true);
    sim.resetWorld();
    expect(sim.interp.running).toBe(false);
    expect(sim.interp.fibers.length).toBe(0);
    expect(sim.robot.cmd).toEqual({ left: 0, right: 0 });
    sim.setPaused(false);
    for (let i = 0; i < 150; i++) sim.tick();
    expect(sim.robot.odometer).toBe(0);
    expect(sim.robot.cmd).toEqual({ left: 0, right: 0 });
  });
  it("en pausa no avanza el tiempo; al continuar, la espera termina donde quedó", () => {
    const sim = new Sim(basicScenario());
    sim.loadProgram(compileWorkspace(ws));
    sim.runProgram();
    for (let i = 0; i < 50; i++) sim.update(0.02);
    sim.setPaused(true);
    const t = sim.time;
    for (let i = 0; i < 200; i++) sim.update(0.02);
    expect(sim.time).toBe(t);
    expect(sim.robot.cmd.left).toBe(0);
    sim.setPaused(false);
    for (let i = 0; i < 40; i++) sim.update(0.02);
    expect(sim.robot.cmd.left).toBe(200);
  });
  it("la parada de emergencia detiene programa y ruedas al instante", () => {
    const sim = run(basicScenario(), B.workspace([B.forever([B.motors(150, 150)])]), 1);
    sim.emergencyStop();
    expect(sim.interp.running).toBe(false);
    expect(sim.robot.vLeft).toBe(0);
    const odo = sim.robot.odometer;
    for (let i = 0; i < 50; i++) sim.tick();
    expect(sim.robot.odometer).toBe(odo);
    expect(sim.mode).toBe("manual");
  });
  it("paso a paso: un bloque instantáneo no hace avanzar el tiempo; «esperar» sí", () => {
    const sim = new Sim(basicScenario());
    sim.loadProgram(compileWorkspace(B.workspace([B.onStart([B.motors(100, 100), B.wait(500), B.stop()])])));
    sim.runProgram();
    sim.setPaused(true);
    sim.interp.prime();
    const t0 = sim.time;
    sim.stepProgram(); // motores
    expect(sim.time).toBe(t0);
    expect(sim.robot.cmd.left).toBe(100);
    sim.stepProgram(); // esperar 500 ms
    expect(sim.time - t0).toBeGreaterThanOrEqual(0.49);
  });
});

describe("guardar y cargar conserva el proyecto", () => {
  it("el programa y el escenario sobreviven a un archivo JSON", () => {
    const ws = EXAMPLES.find((e) => e.id === "mision")!.build();
    const file = { tipo: "conduccion-inteligente-proyecto", version: 1, nombre: "x", fecha: "", practica: null, programa: ws, escenario: SCENARIOS.reto() };
    const back = JSON.parse(JSON.stringify(file));
    expect(validateScenario(back.escenario)).toEqual([]);
    expect(compileWorkspace(back.programa)).toEqual(compileWorkspace(ws));
    const a = run(file.escenario, ws, 15), b = run(back.escenario, back.programa, 15);
    expect(b.robot.x).toBeCloseTo(a.robot.x, 6);
    expect(b.robot.y).toBeCloseTo(a.robot.y, 6);
  });
  it("un archivo que no es escenario se rechaza con un motivo", () => {
    expect(validateScenario({ hola: 1 }).length).toBeGreaterThan(0);
  });
});
