/** Comportamiento de los bloques añadidos: botones, funciones, matriz LED, luces y matemáticas. */
import { describe, expect, it } from "vitest";
import { Sim } from "../src/core/sim";
import { basicScenario } from "../src/scenarios/defaults";
import { compileWorkspace, type WorkspaceJson } from "../src/program/compile";
import { exportMakeCode } from "../src/program/makecode";
import * as B from "../src/program/dsl";

const start = (ws: WorkspaceJson) => {
  const sim = new Sim(basicScenario());
  sim.loadProgram(compileWorkspace(ws));
  sim.runProgram();
  return sim;
};
const run = (sim: Sim, ms: number) => {
  for (let i = 0; i < ms / 20; i++) sim.tick();
};

describe("botones A y B", () => {
  it("el programa espera la pulsación y luego ejecuta su bloque", () => {
    const sim = start(B.workspace([B.onButton("A", [B.motors(120, 120)]), B.onButton("B", [B.stop()], 320, 140)]));
    run(sim, 500);
    expect(sim.interp.running).toBe(true);
    expect(sim.robot.cmd.left).toBe(0);
    expect(sim.pressButton("A")).toBe(true);
    run(sim, 100);
    expect(sim.robot.cmd).toEqual({ left: 120, right: 120 });
    sim.pressButton("B");
    run(sim, 100);
    expect(sim.robot.cmd).toEqual({ left: 0, right: 0 });
  });
  it("una pulsación durante el bloque se atiende después, no se pierde", () => {
    const sim = start(B.workspace([B.onButton("A", [B.change("n", 1), B.wait(500)])]));
    sim.pressButton("A");
    run(sim, 100);
    sim.pressButton("A");
    run(sim, 1200);
    expect(sim.interp.vars.get("n")).toBe(2);
  });
  it("sin programa en marcha, el botón no hace nada", () => {
    const sim = new Sim(basicScenario());
    expect(sim.pressButton("A")).toBe(false);
  });
});

describe("funciones", () => {
  it("«llamar» ejecuta los bloques de la función", () => {
    const sim = start(B.workspace([B.onStart([B.call("avanzar")]), B.funcDef("avanzar", [B.motors(90, 110)])]));
    run(sim, 100);
    expect(sim.robot.cmd).toEqual({ left: 90, right: 110 });
  });
  it("una función que no existe da un error claro", () => {
    const sim = start(B.workspace([B.onStart([B.call("noExiste")])]));
    run(sim, 60);
    expect(sim.interp.error).toContain("noExiste");
  });
  it("una función que se llama a sí misma se detiene con un aviso", () => {
    const sim = start(B.workspace([B.onStart([B.call("bucle")]), B.funcDef("bucle", [B.call("bucle")])]));
    run(sim, 60);
    expect(sim.interp.error).toContain("se llama a sí misma");
  });
});

describe("matriz LED: mismos tiempos que la micro:bit", () => {
  it("una cifra dura 0,75 s; un número de dos cifras se desplaza (≈2,55 s)", () => {
    const uno = start(B.workspace([B.onStart([B.showNumber(7), B.motors(100, 100)])]));
    run(uno, 700);
    expect(uno.robot.cmd.left).toBe(0);
    expect(uno.robot.icon).toBe("letra:7");
    run(uno, 100);
    expect(uno.robot.cmd.left).toBe(100);
    const dos = start(B.workspace([B.onStart([B.showNumber(23), B.motors(100, 100)])]));
    run(dos, 2500);
    expect(dos.robot.cmd.left).toBe(0);
    run(dos, 100);
    expect(dos.robot.cmd.left).toBe(100);
  });
});

describe("luces, melodía y matemáticas", () => {
  it("luces RGB con valores (limitados a 0–255)", () => {
    const sim = start(B.workspace([B.onStart([B.lightsRgb(255, 300, -5)])]));
    run(sim, 40);
    expect(sim.robot.lights).toBe("rgb:255,255,0");
  });
  it("la melodía suena de fondo y no detiene el programa", () => {
    const sim = start(B.workspace([B.onStart([B.melody("birthday"), B.motors(80, 80)])]));
    const heard: string[] = [];
    sim.on((e) => {
      if (e.type === "melody") heard.push(e.name);
    });
    run(sim, 40);
    expect(heard).toEqual(["birthday"]);
    expect(sim.robot.cmd.left).toBe(80);
  });
  it("mínimo, máximo, absoluto, restringir y convertir", () => {
    const sim = start(
      B.workspace([
        B.onStart([B.set("a", B.minmax("min", 4, 9)), B.set("b", B.minmax("max", 4, 9)), B.set("c", B.abs(-40)), B.set("d", B.constrain(300, 0, 255)), B.set("e", B.mapRange(25, 0, 50, 0, 200))]),
      ]),
    );
    run(sim, 40);
    expect(["a", "b", "c", "d", "e"].map((k) => sim.interp.vars.get(k))).toEqual([4, 9, 40, 255, 100]);
  });
  it("número al azar: dentro del rango y repetible en cada ejecución", () => {
    const ws = B.workspace([B.onStart([B.set("serie", ""), B.repeat(20, [B.set("x", B.random(1, 6)), B.set("serie", B.join(B.get("serie"), B.get("x")))])])]);
    const a = start(ws), b = start(ws);
    run(a, 40);
    run(b, 40);
    const serie = String(a.interp.vars.get("serie"));
    expect(serie).toBe(String(b.interp.vars.get("serie")));
    expect(serie).toMatch(/^[1-6]{20}$/);
  });
});

describe("exportación de los bloques nuevos", () => {
  it("se traducen a funciones reales de MakeCode", () => {
    const res = exportMakeCode(
      compileWorkspace(
        B.workspace([
          B.onStart([B.call("f")]),
          B.funcDef("f", [B.showNumber(B.random(1, 9)), B.showString("Hola"), B.melody("power_up"), B.lightsRgb(1, 2, 3)]),
          B.onButton("A", [B.set("v", B.constrain(B.mapRange(5, 0, 10, 0, 100), 0, 255))]),
        ]),
      ),
    );
    expect(res.compatible).toBe(true);
    const expected = [
      "function f() {",
      "basic.showNumber(randint(1, 9))",
      "basic.showString(\"Hola\")",
      "Tinybit.Music_Car(Tinybit.enMusic.power_up)",
      "Tinybit.RGB_Car_Big2(1, 2, 3)",
      "input.onButtonPressed(Button.A, function () {",
      "Math.constrain(Math.map(5, 0, 10, 0, 100), 0, 255)",
    ];
    for (const frag of expected) expect(res.code).toContain(frag);
  });
  it("llamar a una función inexistente no se marca como compatible", () => {
    expect(exportMakeCode(compileWorkspace(B.workspace([B.onStart([B.call("fantasma")])]))).compatible).toBe(false);
  });
});
