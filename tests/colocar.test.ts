/** Colocar objetos: zonas giradas, límite del tapete y semáforo apagado. */
import { describe, expect, it } from "vitest";
import { ROBOT } from "../src/core/config";
import { chassisCenter, clampToMat, createRobot } from "../src/core/robot";
import { inRect, lightAt, type LightObject, type Zone } from "../src/core/scenario";
import { computeVision } from "../src/core/sensors";
import { World } from "../src/core/world";
import { cityScenario } from "../src/scenarios/defaults";

describe("zonas giradas", () => {
  const zone: Zone = { id: "z", kind: "slow", label: "30", x: 80, y: 91, w: 40, d: 18 };
  it("sin giro, la zona es el rectángulo de siempre", () => {
    expect(inRect(zone, 115, 100)).toBe(true);
    expect(inRect(zone, 100, 115)).toBe(false);
  });
  it("girada 90°, lo largo queda en vertical", () => {
    const z = { ...zone, rot: Math.PI / 2 };
    expect(inRect(z, 100, 115)).toBe(true);
    expect(inRect(z, 115, 100)).toBe(false);
  });
  it("girada 45°, cuenta la diagonal y no las esquinas del rectángulo sin girar", () => {
    const z = { ...zone, rot: Math.PI / 4 };
    expect(inRect(z, 112, 112)).toBe(true);
    expect(inRect(z, 118, 82)).toBe(false);
  });
});

describe("colocar el robot sin salir del tapete", () => {
  it("el chasis queda entero dentro aunque se arrastre fuera", () => {
    for (const [x, y, heading] of [[-30, -30, 0], [400, 50, Math.PI], [90, 500, Math.PI / 2], [3, 60, -Math.PI / 3]]) {
      const p = clampToMat({ x, y, heading }, 180, 120);
      const [cx, cy] = chassisCenter(p);
      expect(cx).toBeGreaterThanOrEqual(ROBOT.collisionRadius - 1e-9);
      expect(cy).toBeGreaterThanOrEqual(ROBOT.collisionRadius - 1e-9);
      expect(cx).toBeLessThanOrEqual(180 - ROBOT.collisionRadius + 1e-9);
      expect(cy).toBeLessThanOrEqual(120 - ROBOT.collisionRadius + 1e-9);
      expect(p.heading).toBe(heading);
    }
  });
  it("dentro del tapete la pose no cambia", () => {
    expect(clampToMat({ x: 90, y: 60, heading: 1 }, 180, 120)).toEqual({ x: 90, y: 60, heading: 1 });
  });
});

describe("semáforo apagado", () => {
  const light = (): LightObject => ({ id: "l", kind: "light", x: 88, y: 27, facing: Math.PI, state: "apagado", cycle: { auto: false, rojo: 6, verde: 7, amarillo: 2 } });
  it("apagado a mano se queda apagado", () => {
    expect(lightAt(light(), 3)).toBe("apagado");
  });
  it("al pasar a automático desde apagado, el ciclo empieza en rojo", () => {
    const l = { ...light(), cycle: { auto: true, rojo: 6, verde: 7, amarillo: 2 } };
    expect(lightAt(l, 1)).toBe("rojo");
    expect(lightAt(l, 8)).toBe("verde");
  });
  it("la cámara no reconoce un semáforo apagado", () => {
    const s = cityScenario();
    // Sin la señal de límite que hay justo delante, para ver el semáforo despejado.
    s.objects = s.objects.filter((o) => o.id !== "s-30");
    const l = s.objects.find((o) => o.kind === "light") as LightObject;
    const robot = createRobot({ x: l.x - 30, y: l.y, heading: 0 });
    l.cycle.auto = false;
    l.state = "rojo";
    const seen = () => computeVision(new World(s), robot, 0).candidates.find((c) => c.id === l.id);
    expect(seen()).toMatchObject({ label: "semaforo_rojo", status: "reconocida" });
    l.state = "apagado";
    expect(seen()).toBeUndefined();
  });
});
