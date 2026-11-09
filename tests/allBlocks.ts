/** Programa que usa todos los bloques con traducción verificada (pruebas y MakeCode real). */
import * as B from "../src/program/dsl";

export const allBlocksWorkspace = () =>
  B.workspace([
    B.onStart([B.set("velocidad", 150), B.set("lado", "izquierda"), B.lights("Green"), B.icon("Happy"), B.arrow("North"), B.setState("SEGUIR_LINEA")]),
    B.forever([
      B.ifElse(
        [
          [B.obstacle(15), [B.stop(), B.decide("obstáculo"), B.horn()]],
          [B.and(B.line("L"), B.line("R", "black")), [B.motors(B.get("velocidad"), B.get("velocidad"))]],
          [B.cmp(B.lineValue("L"), "EQ", 1), [B.drive("left", 120), B.set("lado", "izquierda")]],
          [B.cmp(B.lineValue("R"), "EQ", 1), [B.drive("right", 120), B.set("lado", "derecha")]],
          [B.not(B.line("R", "white")), [B.drive("spinright", 100)]],
        ],
        [B.when(B.cmp(B.get("lado"), "EQ", "izquierda"), [B.motors(-70, 110)], [B.motors(110, -70)])],
      ),
      B.when(B.and(B.stateIs("SEGUIR_LINEA"), B.cmp(B.stateTime(), "GT", 5000)), [B.setState("ESPERAR")]),
      B.when(B.and(B.stateIs("ESPERAR"), B.cmp(B.stateTime(), "GT", 1000)), [B.setState("SEGUIR_LINEA")]),
      B.when(B.cmp(B.distance(), "GT", B.arith(10, "MULTIPLY", 2)), [B.change("velocidad", 1)]),
      B.repeat(2, [B.wait(10)]),
      B.whileDo(B.cmp(B.time(), "LT", 0), [B.drive("back", 50)]),
      B.when(B.cmp(B.join("a", "b"), "EQ", "ab"), [B.drive("run", 80), B.drive("spinleft", 80)]),
      B.set("velocidad", B.constrain(B.mapRange(B.distance(), 0, 50, 0, 200), 0, 255)),
      B.set("lado", B.join("v", B.abs(B.minmax("max", B.random(1, 6), B.minmax("min", 2, 3))))),
      B.call("saludar"),
    ]),
    B.funcDef("saludar", [B.showNumber(B.get("velocidad")), B.showString("OK"), B.melody("power_up"), B.lightsRgb(255, 120, 0)]),
    B.onButton("A", [B.motors(150, 150)]),
    B.onButton("B", [B.stop()], 320, 140),
  ]);
