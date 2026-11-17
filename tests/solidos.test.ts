/** Objetos sólidos: no se atraviesan en el editor ni al colocar el robot. */
import { describe, expect, it } from "vitest";
import { blocked, nearestFree, objectSolid, overlap, robotSolid, solidMove, solidsOf, type Place, type Solid } from "../src/core/solid";
import { PROPS } from "../src/core/world";
import type { Scenario, WorldObject } from "../src/core/scenario";
import { SCENARIOS } from "../src/scenarios/defaults";
import { PRACTICES, practiceScenario } from "../src/practices/practices";
import { EXAMPLES } from "../src/program/examples";

const circle = (x: number, y: number, r: number): Solid => ({ kind: "circle", x, y, r });
const box = (x: number, y: number, w: number, d: number, rot = 0): Solid => ({ kind: "box", x, y, w, d, rot });
const sign = (id: string, x: number, y: number): WorldObject => ({ id, kind: "sign", sign: "alto", x, y, facing: 0 });
const caja = (id: string, x: number, y: number, rot = 0): WorldObject => ({ id, kind: "obstacle", shape: "caja", x, y, w: 8, d: 8, h: 8, rot });

describe("formas que se enciman", () => {
  it("círculos: tocarse está permitido, encimarse no", () => {
    expect(overlap(circle(0, 0, 3), circle(5.9, 0, 3))).toBe(true);
    expect(overlap(circle(0, 0, 3), circle(6, 0, 3))).toBe(false);
  });
  it("círculo y caja girada", () => {
    expect(overlap(circle(7, 0, 3), box(0, 0, 8, 8))).toBe(false);
    // Girada 45°, la esquina de la caja llega a 5.66 cm del centro.
    expect(overlap(circle(7, 0, 2), box(0, 0, 8, 8, Math.PI / 4))).toBe(true);
  });
  it("dos cajas giradas (ejes separadores)", () => {
    expect(overlap(box(0, 0, 8, 8), box(9, 0, 8, 8))).toBe(false);
    expect(overlap(box(0, 0, 8, 8), box(9, 0, 8, 8, Math.PI / 4))).toBe(true);
    expect(overlap(box(0, 0, 8, 8), box(0, 13, 8, 8, Math.PI / 4))).toBe(false);
  });
});

describe("mover sin atravesar", () => {
  const shapeSign = (p: Place) => circle(p.x, p.y, PROPS.signBaseR);
  it("se detiene al tocar: no pasa a través", () => {
    const others = [circle(50, 20, PROPS.signBaseR)];
    const end = solidMove({ x: 20, y: 20, a: 0 }, { x: 80, y: 20, a: 0 }, shapeSign, others);
    expect(end.x).toBeLessThan(50);
    expect(blocked(shapeSign(end), others)).toBe(false);
    expect(50 - end.x).toBeCloseTo(PROPS.signBaseR * 2, 0);
  });
  it("se desliza por el costado en lugar de quedarse pegado", () => {
    const wall = [box(50, 20, 4, 40)];
    const end = solidMove({ x: 30, y: 10, a: 0 }, { x: 70, y: 30, a: 0 }, shapeSign, wall);
    expect(blocked(shapeSign(end), wall)).toBe(false);
    expect(end.y).toBeCloseTo(30, 1); // avanzó todo lo que pudo en y
    expect(end.x).toBeLessThan(50);
  });
  it("una caja no gira si al girar se encima con otra", () => {
    const shape = (p: Place) => box(p.x, p.y, 8, 8, p.a);
    const others = [box(9, 0, 8, 8)];
    const end = solidMove({ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: Math.PI / 4 }, shape, others);
    expect(end.a).toBeLessThan(Math.PI / 4);
    expect(blocked(shape(end), others)).toBe(false);
  });
  it("si ya estaba encimado (escenario viejo), se le deja salir", () => {
    const others = [circle(20, 20, 3)];
    const end = solidMove({ x: 21, y: 20, a: 0 }, { x: 60, y: 20, a: 0 }, shapeSign, others);
    expect(end.x).toBe(60);
  });
  it("lugar libre más cercano para un objeto nuevo", () => {
    const others = [circle(20, 20, 3)];
    const p = nearestFree({ x: 20, y: 20, a: 0 }, shapeSign, others, () => true)!;
    expect(blocked(shapeSign(p), others)).toBe(false);
    expect(Math.hypot(p.x - 20, p.y - 20)).toBeLessThan(7);
  });
  it("el robot también es sólido para los objetos", () => {
    const s = { objects: [sign("a", 100, 100)] } as Scenario;
    const robot = { x: 40, y: 40, a: 0 };
    const others = solidsOf(s, { robot });
    expect(blocked(objectSolid(caja("c", 40, 40))!, others)).toBe(true);
    expect(blocked(robotSolid({ x: 100, y: 100, a: 0 }), solidsOf(s))).toBe(true);
  });
});

describe("lo que trae el simulador no tiene nada encimado", () => {
  const check = (name: string, s: Scenario) => {
    const sol = s.objects.map((o) => [o, objectSolid(o)] as const).filter(([, x]) => x);
    for (let i = 0; i < sol.length; i++) {
      for (let j = i + 1; j < sol.length; j++) expect(overlap(sol[i][1]!, sol[j][1]!), `${name}: ${sol[i][0].id} y ${sol[j][0].id}`).toBe(false);
      expect(overlap(sol[i][1]!, robotSolid({ x: s.start.x, y: s.start.y, a: s.start.heading })), `${name}: robot y ${sol[i][0].id}`).toBe(false);
    }
  };
  it("escenarios", () => {
    for (const [id, make] of Object.entries(SCENARIOS)) check(id, make());
  });
  it("prácticas", () => {
    for (const p of PRACTICES) check(`práctica ${p.n}`, practiceScenario(p));
  });
  it("ejemplos resueltos", () => {
    for (const e of EXAMPLES) {
      const s = SCENARIOS[e.scenario ?? "basica"]?.();
      if (!s) continue;
      e.setup?.(s);
      check(`ejemplo ${e.id}`, s);
    }
  });
});
