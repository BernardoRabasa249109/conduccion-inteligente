/**
 * Las veinticinco prácticas guiadas (1–15 y 16–25 de ampliación). Cada una tiene objetivo, escenario preparado,
 * pregunta de predicción, programa inicial (si procede), reto, pistas,
 * comprobación por comportamiento y solución.
 */
import { chassisCenter } from "../core/robot";
import { cloneScenario, type Scenario, type SignObject } from "../core/scenario";
import type { Sim } from "../core/sim";
import { uses, type Program } from "../program/ast";
import type { Category } from "../program/blocks";
import type { WorkspaceJson } from "../program/compile";
import * as B from "../program/dsl";
import { followLine, parkingProgram, EXAMPLES } from "../program/examples";
import { basicScenario, challengeScenario, cityScenario } from "../scenarios/defaults";
import { Hold, inZone, itemList, lightState, programDriving, SpeedMeter, stopped, watchCollisions, type Checker } from "./checks";

export type Space = "explorar" | "conducir" | "programar";

export interface Practice {
  n: number;
  title: string;
  space: Space;
  goal: string;
  scenario: () => Scenario;
  prediction: { q: string; options: string[]; answer: number; explain: string };
  challenge: string;
  hints: string[];
  toolbox?: Category[];
  starter?: () => WorkspaceJson;
  // La solución de cada práctica NO está aquí: solo en la versión del docente (ver soluciones.ts).
  /** Muestra el control de cada motor aunque no esté el modo avanzado. */
  motorControls?: boolean;
  /** Práctica que hay que completar para abrir esta (por omisión, la anterior). */
  after?: number;
  checker: () => Checker;
}

const BASIC_TOOLS: Category[] = ["inicio", "logica", "motores", "sensores", "luces"];
const ex = (id: string) => EXAMPLES.find((e) => e.id === id)!.build;

function withZone(s: Scenario, id: string, label: string, x: number, y: number, w: number, d: number): Scenario {
  s.zones.push({ id, kind: "target", label, x, y, w, d });
  return s;
}

/** Programas iniciales parciales. */
const starters = {
  avance: () => B.workspace([B.onStart([B.motors(150, 150), B.wait(500), B.stop()])]),
  seguidor: () =>
    B.workspace([
      B.forever([
        B.ifElse([[B.and(B.line("L"), B.line("R")), [B.motors(150, 150), B.decide("Los dos sensores ven negro: sigo recto")]]], [B.stop(), B.decide("No sé qué hacer: me detengo")]),
      ]),
    ]),
  seguidorCompleto: () => B.workspace([B.forever([followLine(150)])]),
  semaforo: () => B.workspace([B.forever([followLine(150)])]),
  zona: () => B.workspace([B.onStart([B.set("velocidad", 150)]), B.forever([followLine(B.get("velocidad"))])]),
  giro: () =>
    B.workspace([
      B.onStart([B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA")]),
      B.forever([
        B.when(B.signIs("izquierda"), [B.set("giro", "izquierda")]),
        B.ifElse(
          [
            [B.stateIs("GIRAR"), [B.when(B.and(B.cmp(B.stateTime(), "GT", 150), B.or(B.line("L"), B.line("R"))), [B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA")])]],
            [
              B.and(B.line("L", "white"), B.line("R", "white")),
              [B.ifElse([[B.cmp(B.get("giro"), "EQ", "izquierda"), [B.setState("GIRAR"), B.motors(-90, 110), B.decide("Giro a la izquierda porque vi la flecha")]]], [B.stop(), B.decide("Fin de la calle: no sé hacia dónde ir")])],
            ],
          ],
          [followLine(140, false)],
        ),
      ]),
    ]),
  prioridadesMal: () =>
    B.workspace([
      B.onStart([B.set("velocidad", 150)]),
      B.forever([
        B.ifElse(
          [
            [B.or(B.line("L"), B.line("R")), [followLine(B.get("velocidad"), false), B.decide("Sigo la línea")]],
            [B.obstacle(15), [B.stop(), B.decide("Obstáculo: me detengo")]],
            [B.signIs("semaforo_rojo"), [B.stop(), B.decide("Rojo: me detengo")]],
          ],
          [B.stop()],
        ),
      ]),
    ]),
  mision: () =>
    B.workspace([
      B.onStart([B.set("velocidad", 150), B.set("giro", "ninguno"), B.set("estacionado", 0), B.setState("SEGUIR_LINEA")]),
      B.forever([B.decide("Completa la misión: añade semáforo, flecha, obstáculo, zona 30 y estacionamiento"), followLine(B.get("velocidad"), false)]),
    ]),
};

const cityAt = (x: number, y: number, heading: number, edit?: (s: Scenario) => void) => () => {
  const s = cityScenario();
  s.start = { x, y, heading };
  edit?.(s);
  return s;
};

/** Caja sobre la recta inferior de la pista básica, delante de la salida. */
const boxAhead = () => {
  const s = basicScenario();
  s.objects.push({ id: "caja", kind: "obstacle", shape: "caja", x: 125, y: 105, w: 8, d: 8, h: 8, rot: 0 });
  return s;
};

/** Posición x de las tres cajas del zigzag (práctica 17), todas en y = 60. */
const SLALOM = [60, 90, 120];

/** ¿Los faros están en ese color? (nombre de Tinybit.enColor o «rgb:r,g,b»). */
function lightIs(lights: string, c: "r" | "g"): boolean {
  if (lights === (c === "r" ? "Red" : "Green")) return true;
  if (!lights.startsWith("rgb:")) return false;
  const [r, g, b] = lights.slice(4).split(",").map(Number);
  return c === "r" ? r > 150 && g < 110 && b < 110 : g > 150 && r < 110 && b < 110;
}

const personOnRight = (s: Scenario) => {
  s.objects.push({ id: "persona", kind: "obstacle", shape: "persona", x: 165, y: 70, w: 6, d: 6, h: 14, rot: 0, leavesAfterStop: 2 });
};

export const PRACTICES: Practice[] = [
  {
    n: 1,
    title: "Reconocer los componentes",
    space: "explorar",
    goal: "Encuentra en el robot cada componente que se te pide.",
    scenario: basicScenario,
    prediction: {
      q: "¿La cámara y la micro:bit son el mismo componente?",
      options: ["Sí: la micro:bit tiene una cámara", "No: la cámara está en el módulo K210; la micro:bit ejecuta tu programa"],
      answer: 1,
      explain: "La micro:bit decide con tu programa. El módulo K210 tiene su propia cámara y su propio programa de visión; le envía a la micro:bit el nombre de la señal.",
    },
    challenge: "Responde las seis preguntas tocando el componente correcto en la figura o en la lista.",
    hints: ["Los sensores de línea están debajo, en la parte delantera.", "El ultrasonido parece dos «ojos» plateados.", "La matriz LED está en la micro:bit: 25 puntos de luz."],
    checker: () => {
      const L = itemList([
        ["linea", "Qué lee la línea negra"],
        ["distancia", "Qué mide la distancia a un obstáculo"],
        ["senales", "Qué reconoce las señales"],
        ["decide", "Qué ejecuta el programa y decide"],
        ["mueve", "Qué hace girar las ruedas"],
        ["iconos", "Qué muestra iconos"],
      ]);
      return { items: L.items, tick: () => {}, event: (name, data) => name === "quiz" && L.pass(String(data)) };
    },
  },
  {
    n: 2,
    title: "Manejar el robot manualmente",
    space: "conducir",
    goal: "Lleva el robot hasta la zona META sin chocar ni salir del tapete.",
    scenario: () => withZone(basicScenario(), "meta", "META", 132, 4, 26, 22),
    prediction: {
      q: "Si mantienes pulsada la flecha izquierda, ¿qué hace cada rueda?",
      options: ["Las dos avanzan igual", "La izquierda retrocede y la derecha avanza: gira sobre sí mismo", "Gira solo una rueda delantera, como un volante"],
      answer: 1,
      explain: "El robot no tiene volante: gira porque sus dos ruedas van a distinta velocidad o en sentidos opuestos.",
    },
    challenge: "Usa las flechas o los botones. Prueba a combinar «Avanzar» con «Izquierda» para hacer curvas.",
    hints: ["Al soltar el botón, el robot se detiene.", "Baja la velocidad para maniobrar con precisión.", "Arriba + izquierda hace una curva: una rueda va más rápida que la otra."],
    checker: () => {
      const L = itemList([
        ["manual", "Conduces en modo manual"],
        ["meta", "Llegaste a la zona META"],
        ["sin-choques", "Sin choques ni salidas del tapete"],
      ]);
      const meta = { x: 132, y: 4, w: 26, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.mode === "manual" && sim.robot.odometer > 5) L.pass("manual");
          watchCollisions(sim, L);
          if (L.is("manual") && inZone(sim, meta)) {
            L.pass("meta");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 3,
    title: "Comparar la velocidad de los motores",
    space: "conducir",
    goal: "Haz una curva amplia a la izquierda con las dos ruedas avanzando.",
    scenario: () => {
      const s = basicScenario();
      s.start = { x: 90, y: 62, heading: 0 };
      return s;
    },
    prediction: {
      q: "Motor izquierdo 120 y motor derecho 200. ¿Qué hace el robot?",
      options: ["Avanza recto", "Curva hacia la izquierda", "Curva hacia la derecha"],
      answer: 1,
      explain: "La rueda más rápida recorre más camino, así que el robot se curva hacia el lado de la rueda lenta.",
    },
    challenge: "En «Cada motor por separado», escribe dos velocidades positivas distintas y mantén pulsado «aplicar» hasta girar un cuarto de vuelta.",
    hints: ["Las dos velocidades deben ser mayores que 0.", "Para curvar a la izquierda, la rueda derecha debe ir más rápida.", "Cuanto más se parecen las velocidades, más amplia es la curva."],
    motorControls: true,
    checker: () => {
      const L = itemList([
        ["dos", "Las dos ruedas avanzan a la vez"],
        ["derecha", "La rueda derecha va más rápida"],
        ["curva", "El robot giró 90° a la izquierda en curva"],
      ]);
      let turned = 0;
      return {
        items: L.items,
        tick: (sim) => {
          const { left, right } = sim.robot.cmd;
          const curving = left > 0 && right > 0 && right > left;
          if (left > 0 && right > 0) L.pass("dos");
          if (curving) {
            L.pass("derecha");
            turned += Math.max(0, (sim.robot.vRight - sim.robot.vLeft) / 8.4) * 0.02;
            if (turned >= Math.PI / 2) L.pass("curva");
          }
        },
      };
    },
  },
  {
    n: 4,
    title: "Observar los sensores sobre blanco y negro",
    space: "conducir",
    goal: "Consigue las cuatro combinaciones de lectura de los dos sensores de línea.",
    scenario: basicScenario,
    prediction: {
      q: "Con el robot centrado sobre la línea, ¿qué leen los sensores?",
      options: ["1 y 1: los dos ven negro", "0 y 0: los dos ven blanco", "1 y 0"],
      answer: 0,
      explain: "La línea (2,4 cm) es más ancha que la separación de los sensores (1,4 cm). Ojo: «1 y 1» también ocurre en un cruce. Dos lecturas no siempre bastan para saber dónde estás.",
    },
    challenge: "Mueve el robot despacio sobre la línea y mira los dos recuadros de la esquina: 1 = negro, 0 = blanco.",
    hints: ["Activa «Sensores» para ver los puntos de lectura bajo el robot.", "Gira despacio sobre la línea: un sensor sale antes que el otro.", "Aléjate de la línea para ver 0 y 0."],
    checker: () => {
      const L = itemList([
        ["11", "Izquierdo 1 · derecho 1 (los dos sobre negro)"],
        ["10", "Izquierdo 1 · derecho 0"],
        ["01", "Izquierdo 0 · derecho 1"],
        ["00", "Izquierdo 0 · derecho 0 (línea perdida)"],
      ]);
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.mode !== "manual") return;
          L.pass(`${sim.now.lineLeft}${sim.now.lineRight}`);
        },
      };
    },
  },
  {
    n: 5,
    title: "Programar avance y parada",
    space: "programar",
    goal: "Programa el robot para que avance y se detenga dentro de la zona META.",
    scenario: () => withZone(basicScenario(), "meta", "META", 98, 94, 18, 22),
    prediction: {
      q: "Si duplicas el tiempo de «esperar», ¿qué distancia recorre?",
      options: ["La misma", "Aproximadamente el doble", "La mitad"],
      answer: 1,
      explain: "Mientras esperas, los motores mantienen su última orden: más tiempo es más distancia (casi proporcional, porque el motor tarda un poco en arrancar).",
    },
    challenge: "Cambia solo el número de «esperar» hasta que el robot pare dentro de la META.",
    hints: ["Con PWM 150 el robot recorre unos 23 cm por segundo.", "La META está a unos 65 cm de la salida.", "Prueba con valores entre 2500 y 3000 ms."],
    toolbox: ["inicio", "motores", "luces"],
    starter: starters.avance,
    checker: () => {
      const L = itemList([
        ["mueve", "Tu programa mueve el robot"],
        ["para", "El robot se detiene (velocidad 0 durante 1 s)"],
        ["meta", "Se detiene dentro de la META"],
      ]);
      const hold = new Hold(1);
      const meta = { x: 98, y: 94, w: 18, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.mode !== "programa") return;
          if (sim.robot.odometer > 5) L.pass("mueve");
          if (L.is("mueve") && hold.update(sim, stopped(sim) && sim.robot.cmd.left === 0 && sim.robot.cmd.right === 0)) {
            L.pass("para");
            if (inZone(sim, meta)) L.pass("meta");
          }
        },
      };
    },
  },
  {
    n: 6,
    title: "Crear un seguidor de línea básico",
    space: "programar",
    goal: "Completa el programa para que el robot siga la línea usando los dos sensores.",
    scenario: basicScenario,
    prediction: {
      q: "El sensor izquierdo ve negro y el derecho blanco. ¿Dónde está la línea?",
      options: ["A la izquierda: debo girar a la izquierda", "A la derecha: debo girar a la derecha", "Justo debajo del centro"],
      answer: 0,
      explain: "Solo el sensor izquierdo está sobre la línea, así que el robot se desvió a la derecha: debe corregir hacia la izquierda.",
    },
    challenge: "El programa ya sabe ir recto. Añade los casos «solo el izquierdo ve negro» y «solo el derecho ve negro».",
    hints: ["En «Condiciones y lógica» hay un bloque «si» con cuatro casos ya armados (también puedes añadir «si no, si» con el engranaje).","Para girar a la izquierda: motor izquierdo lento (20) y derecho rápido (150).", "Revisa el registro: ¿qué decisión tomó justo antes de perder la línea?"],
    toolbox: ["inicio", "logica", "motores", "sensores"],
    starter: starters.seguidor,
    checker: () => {
      const L = itemList([
        ["sensores", "El programa usa los sensores de línea"],
        ["curva", "Tomó al menos una curva siguiendo la línea"],
        ["distancia", "Recorrió 2 m sin perder la línea más de 1 s"],
      ]);
      let start = 0, lost = 0, turned = 0;
      return {
        items: L.items,
        program: (p) => {
          if (uses(p, "line") || uses(p, "lineValue")) L.pass("sensores");
        },
        tick: (sim) => {
          if (!programDriving(sim)) return;
          if (start === 0) start = sim.robot.odometer;
          const isLost = sim.now.lineLeft === 0 && sim.now.lineRight === 0;
          lost = isLost ? lost + 0.02 : 0;
          if (lost > 1) {
            start = sim.robot.odometer;
            turned = 0;
          }
          turned += Math.abs(sim.robot.vLeft - sim.robot.vRight) / 8.4 * 0.02;
          if (turned > Math.PI / 2 && sim.robot.odometer - start > 30) L.pass("curva");
          if (sim.robot.odometer - start > 200) L.pass("distancia");
        },
      };
    },
  },
  {
    n: 7,
    title: "Recuperarse cuando se pierde la línea",
    space: "programar",
    goal: "El robot empieza fuera de la línea. Haz que la busque, la encuentre y la siga.",
    scenario: () => {
      const s = basicScenario();
      s.start = { x: 60, y: 101, heading: -0.45 };
      return s;
    },
    prediction: {
      q: "Si el programa dice «si no veo la línea → detener», ¿qué hará el robot aquí?",
      options: ["Buscará la línea", "Se quedará quieto para siempre", "Avanzará recto"],
      answer: 1,
      explain: "El programa solo hace lo que le indicas. Si perder la línea significa detenerse, nunca la volverá a buscar.",
    },
    challenge: "Cambia lo que hace el robot cuando los dos sensores ven blanco para que busque la línea.",
    hints: ["Girar sobre sí mismo hace que los sensores barran un círculo alrededor del robot.", "Recuerda en una variable de qué lado viste la línea por última vez.", "Mira el ejemplo resuelto «Recuperar la línea perdida»."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores"],
    starter: starters.seguidorCompleto,
    checker: () => {
      const L = itemList([
        ["perdido", "Empezó sin ver la línea"],
        ["encontro", "Encontró la línea"],
        ["sigue", "Después la siguió 1 m"],
      ]);
      let from = -1;
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const onLine = sim.now.lineLeft === 1 || sim.now.lineRight === 1;
          if (!onLine && L.is("encontro") === null) L.pass("perdido");
          if (onLine && L.is("perdido")) {
            L.pass("encontro");
            if (from < 0) from = sim.robot.odometer;
          }
          if (from >= 0 && sim.robot.odometer - from > 100) L.pass("sigue");
        },
      };
    },
  },
  {
    n: 8,
    title: "Detenerse ante un obstáculo",
    space: "programar",
    goal: "Sigue la línea y detente antes de chocar con la caja.",
    scenario: () => {
      const s = basicScenario();
      s.objects.push({ id: "caja", kind: "obstacle", shape: "caja", x: 125, y: 105, w: 8, d: 8, h: 8, rot: 0 });
      return s;
    },
    prediction: {
      q: "¿Qué devuelve el ultrasonido si no hay nada delante?",
      options: ["0: no vuelve el eco", "400", "Un número negativo"],
      answer: 0,
      explain: "La función oficial devuelve 0 cuando no recibe eco. Por eso el bloque «obstáculo a menos de» comprueba que la distancia sea mayor que 0.",
    },
    challenge: "Añade la condición del obstáculo. Debe ir antes que el seguidor de línea para que tenga prioridad.",
    hints: ["Usa «obstáculo a menos de 15 cm» en el primer «si».", "Si la condición del obstáculo va después del seguimiento, nunca se llega a comprobar.", "Anota la decisión para ver la distancia: «unir … distancia …»."],
    toolbox: ["inicio", "logica", "motores", "sensores", "luces"],
    starter: starters.seguidorCompleto,
    checker: () => {
      const L = itemList([
        ["sonar", "El programa usa el ultrasonido"],
        ["para", "Se detuvo antes de chocar (entre 3 y 20 cm)"],
        ["quieto", "Siguió detenido 2 s"],
        ["sin-choques", "Sin choques"],
      ]);
      const hold = new Hold(2);
      return {
        items: L.items,
        program: (p) => {
          if (uses(p, "distance") || uses(p, "obstacle")) L.pass("sonar");
        },
        tick: (sim) => {
          watchCollisions(sim, L);
          if (!programDriving(sim)) return;
          const near = sim.now.sonarId === "caja" && sim.now.distance >= 3 && sim.now.distance <= 20;
          if (near && stopped(sim)) L.pass("para");
          if (hold.update(sim, near && stopped(sim))) {
            L.pass("quieto");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 9,
    title: "Explorar qué puede ver la cámara",
    space: "conducir",
    goal: "Conduce por la ciudad y averigua qué señales reconoce la visión y cuáles no.",
    scenario: cityAt(30, 15, 0, (s) => {
      s.objects.push({ id: "caja-alta", kind: "obstacle", shape: "caja", x: 128, y: 104, w: 8, d: 8, h: 18, rot: 0 });
    }),
    prediction: {
      q: "Una señal está detrás de una caja alta. ¿La reconocerá la cámara?",
      options: ["Sí, si está dentro del campo de visión", "No: si algo la tapa, no la ve"],
      answer: 1,
      explain: "La visión simulada solo reconoce señales visibles: dentro del campo de visión, de frente, a una distancia razonable y sin nada delante.",
    },
    challenge: "Logra que se reconozcan tres señales distintas y encuentra una que no se reconozca. Lee el motivo en la vista de la cámara.",
    hints: ["Activa la ayuda «Cámara» para ver su campo de visión.", "Una señal vista de lado no se reconoce.", "Busca la caja alta cerca de los estacionamientos."],
    checker: () => {
      const L = itemList([
        ["tres", "La visión reconoció 3 señales distintas"],
        ["no", "Viste una señal que NO se reconoce (lejos, de lado o tapada)"],
      ]);
      const seen = new Set<string>();
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.mode !== "manual") return;
          const v = sim.now.vision;
          if (v.label) seen.add(v.label.startsWith("semaforo") ? "semaforo" : v.label);
          if (seen.size >= 3) L.pass("tres");
          if (v.candidates.some((c) => c.px && ["demasiado lejos", "de lado", "tapada"].includes(c.status) && c.distance < 90)) L.pass("no");
        },
      };
    },
  },
  {
    n: 10,
    title: "Respetar rojo y verde",
    space: "programar",
    goal: "Sigue la línea, detente con el semáforo en rojo y continúa con el verde.",
    scenario: cityAt(30, 15, 0),
    prediction: {
      q: "El semáforo está en rojo pero el robot ya está tan cerca que la cámara no lo ve. ¿Qué pasa?",
      options: ["Se detiene igual", "Sigue: el programa solo conoce lo que la cámara ve"],
      answer: 1,
      explain: "El programa no sabe nada que el robot no pueda observar. Por eso conviene detenerse también con el amarillo.",
    },
    challenge: "Añade la condición «la cámara ve semáforo en rojo» antes del seguidor de línea.",
    hints: ["La condición del semáforo va primero, el seguidor en «si no».", "Anota la decisión: «Me detengo porque detecté rojo».", "Usa «o» para detenerte también con amarillo (ampliación educativa)."],
    toolbox: ["inicio", "logica", "motores", "sensores", "vision", "luces"],
    starter: starters.semaforo,
    checker: () => {
      const L = itemList([
        ["rojo", "Se detuvo con el semáforo en rojo"],
        ["no-cruza", "No entró en el cruce con rojo"],
        ["verde", "Continuó y pasó el semáforo"],
      ]);
      const cross = { x: 92, y: 4, w: 28, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const st = lightState(sim);
          const [x] = chassisCenter(sim.robot);
          if (st === "rojo" && stopped(sim) && x > 20 && x < 92 && sim.robot.y < 30) L.pass("rojo");
          if (st === "rojo" && inZone(sim, cross)) L.fail("no-cruza");
          if (x > 125 && sim.robot.y < 30 && L.is("rojo")) {
            L.pass("verde");
            if (L.is("no-cruza") !== false) L.pass("no-cruza");
          }
        },
      };
    },
  },
  {
    n: 11,
    title: "Reducir velocidad ante una señal",
    space: "programar",
    goal: "Al ver la señal 30, reduce la velocidad en la zona marcada. Al ver el fin del límite, vuelve a la normal.",
    scenario: cityAt(15, 72, -Math.PI / 2, (s) => {
      const l = s.objects.find((o) => o.kind === "light");
      if (l && l.kind === "light") {
        l.cycle.auto = false;
        l.state = "verde";
      }
    }),
    prediction: {
      q: "¿Qué significa la señal «30» en este ejercicio?",
      options: ["Que el robot vaya a 30 km/h", "Que use una velocidad reducida (PWM 70)", "Que avance 30 cm"],
      answer: 1,
      explain: "El robot no puede ir a 30 km/h. En el ejercicio, «30» es una orden: usar la velocidad reducida acordada (PWM 70).",
    },
    challenge: "El seguidor ya usa la variable «velocidad». Cámbiala cuando la cámara vea «límite 30» y «fin del límite».",
    hints: ["Usa «asignar velocidad a 70» dentro de «si la cámara ve límite 30».", "La variable recuerda la señal aunque ya no se vea.", "Con «fin del límite», vuelve a 150."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision"],
    starter: starters.zona,
    checker: () => {
      const L = itemList([
        ["antes", "Velocidad normal antes de la zona"],
        ["zona", "Velocidad reducida dentro de la ZONA 30"],
        ["despues", "Volvió a la velocidad normal después"],
      ]);
      const before = new SpeedMeter(), inside = new SpeedMeter(), after = new SpeedMeter();
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const [x, y] = chassisCenter(sim.robot);
          const top = y < 30;
          before.add(sim, x < 25 && y > 32 && y < 68);
          inside.add(sim, top && x > 80 && x < 108);
          after.add(sim, top && x > 125 && x < 150);
          if (before.t > 0.8 && before.avg > 15) L.pass("antes");
          if (inside.t > 1 && x > 110 && inside.avg < before.avg * 0.65 && inside.avg > 3) L.pass("zona");
          if (after.t > 0.5 && x > 148 && L.is("zona") && after.avg > inside.avg * 1.5) L.pass("despues");
        },
      };
    },
  },
  {
    n: 12,
    title: "Elegir izquierda o derecha en un cruce",
    space: "programar",
    goal: "Al final de la calle, gira hacia donde indicó la última flecha que viste.",
    scenario: cityAt(105, 118, -Math.PI / 2, (s) => {
      const sign = s.objects.find((o) => o.id === "s-izq") as SignObject;
      sign.sign = "derecha";
    }),
    prediction: {
      q: "Cuando el robot llega al final de la calle, la flecha ya no se ve. ¿Cómo sabe hacia dónde girar?",
      options: ["La cámara la sigue viendo", "La recordó en una variable cuando la vio", "Gira al azar"],
      answer: 1,
      explain: "Las señales se ven antes de la maniobra. El programa guarda lo que vio (memoria) y lo usa después; al terminar, lo olvida para no repetir el giro.",
    },
    challenge: "El programa inicial solo entiende «izquierda». Esta vez la flecha dice «derecha»: añade ese caso.",
    hints: ["Copia el «si la cámara ve izquierda» y cambia el texto a derecha.", "Para girar a la derecha: motor izquierdo 110, derecho −90.", "Tras girar, el programa vuelve a «Seguir línea» y olvida la flecha."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "estados"],
    starter: starters.giro,
    checker: () => {
      const L = itemList([
        ["vio", "La cámara vio la flecha"],
        ["giro", "Giró hacia el lado indicado"],
        ["sigue", "Siguió por la nueva calle"],
      ]);
      let want: "izquierda" | "derecha" | null = null;
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const lab = sim.now.vision.label;
          if (lab === "izquierda" || lab === "derecha") {
            want = lab;
            L.pass("vio");
          }
          const [x, y] = chassisCenter(sim.robot);
          if (!want || y > 30) return;
          if ((want === "derecha" && x > 118) || (want === "izquierda" && x < 92)) L.pass("giro");
          if ((want === "derecha" && x > 140) || (want === "izquierda" && x < 70)) {
            if (sim.now.lineLeft || sim.now.lineRight) L.pass("sigue");
          }
        },
      };
    },
  },
  {
    n: 13,
    title: "Estacionarse en una zona indicada",
    space: "programar",
    goal: "Estaciónate en la plaza 1, espera 2 segundos y vuelve al recorrido.",
    scenario: cityAt(150, 135, Math.PI, (s) => {
      s.objects = s.objects.filter((o) => o.id !== "s-p2");
    }),
    prediction: {
      q: "La señal P se reconoce antes de llegar a la plaza. ¿Cuándo conviene empezar a girar?",
      options: ["En cuanto se reconoce", "Cuando la señal deja de verse y el robot avanzó un poco más", "Nunca: el robot se estaciona solo"],
      answer: 1,
      explain: "Igual que en el ejemplo oficial, la maniobra es una secuencia por tiempos. Hay que empezarla en el lugar correcto; en el robot real habrá que calibrar los tiempos.",
    },
    challenge: "El programa inicial se estaciona en P2. Aquí solo existe la señal P1: adapta el programa.",
    hints: ["Cambia todas las «la cámara ve estacionamiento 2» por «estacionamiento 1».", "Las dos plazas están a la misma distancia de su señal: los tiempos sirven.", "La variable «estacionado» evita que repita la maniobra."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "estados"],
    starter: () => parkingProgram("p2"),
    checker: () => {
      const L = itemList([
        ["dentro", "Entró en la plaza 1"],
        ["espera", "Esperó detenido dentro (unos 2 s)"],
        ["vuelve", "Volvió a la línea"],
        ["correcta", "No usó la plaza equivocada"],
      ]);
      const hold = new Hold(1.6);
      const p1 = { x: 72, y: 104, w: 15, d: 22 }, p2 = { x: 118, y: 104, w: 15, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          if (inZone(sim, p2, -1) && stopped(sim)) L.fail("correcta");
          if (inZone(sim, p1, -1)) L.pass("dentro");
          if (hold.update(sim, inZone(sim, p1, -1) && stopped(sim))) L.pass("espera");
          if (L.is("espera") && sim.robot.y > 128 && (sim.now.lineLeft || sim.now.lineRight)) {
            L.pass("vuelve");
            if (L.is("correcta") !== false) L.pass("correcta");
          }
        },
      };
    },
  },
  {
    n: 14,
    title: "Resolver instrucciones simultáneas mediante prioridades",
    space: "programar",
    goal: "Una persona cruza y hay un semáforo. Ordena las conductas para que el robot sea seguro.",
    scenario: cityAt(30, 15, 0, personOnRight),
    prediction: {
      q: "Si «seguir la línea» es la primera condición del «si», ¿qué pasa al aparecer una persona?",
      options: ["Se detiene igual", "Sigue la línea y choca: la parada nunca se comprueba", "Se detiene solo si va despacio"],
      answer: 1,
      explain: "En un «si / si no si», gana la primera condición que se cumple. Las paradas de seguridad deben ir antes que el seguimiento de línea.",
    },
    challenge: "El programa tiene las prioridades al revés. Reordénalas: obstáculo, semáforo y, al final, seguir la línea.",
    hints: ["Arrastra el bloque de la condición de obstáculo al primer lugar.", "La condición «sensor ve negro» es casi siempre verdadera: por eso tapa a las demás.", "Mira el ejemplo resuelto «Prioridades entre conductas»."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "luces"],
    starter: starters.prioridadesMal,
    checker: () => {
      const L = itemList([
        ["rojo", "No cruzó con el semáforo en rojo"],
        ["persona", "Se detuvo ante la persona"],
        ["continua", "Continuó cuando el camino quedó libre"],
        ["sin-choques", "Sin choques"],
      ]);
      const cross = { x: 92, y: 4, w: 28, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          watchCollisions(sim, L);
          if (!programDriving(sim)) return;
          if (lightState(sim) === "rojo" && inZone(sim, cross)) L.fail("rojo");
          if (sim.now.sonarId === "persona" && stopped(sim) && sim.now.distance > 0 && sim.now.distance < 25) L.pass("persona");
          const [x, y] = chassisCenter(sim.robot);
          if (L.is("persona") && sim.world.removed.has("persona") && x > 150 && y > 95) {
            L.pass("continua");
            if (L.is("rojo") !== false) L.pass("rojo");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 15,
    title: "Completar una misión de conducción inteligente",
    space: "programar",
    goal: "Semáforo, flecha, persona, zona 30, estacionamiento en P2 y llegada a la META.",
    scenario: challengeScenario,
    prediction: {
      q: "¿Qué ventaja tiene usar estados (Seguir línea, Girar, Estacionar…)?",
      options: ["Ninguna, es solo decoración", "Cada estado tiene reglas claras y una condición para terminar", "Hace que el robot vaya más rápido"],
      answer: 1,
      explain: "Una máquina de estados evita que las maniobras se mezclen o se repitan: cada estado sabe cuándo empieza y cuándo termina.",
    },
    challenge: "Construye la misión paso a paso. Comprueba cada hito antes de pasar al siguiente.",
    hints: ["Empieza por el semáforo y la flecha: copia ideas de las prácticas 10 y 12.", "Usa la variable «estacionado» para no repetir la maniobra.", "El ejemplo resuelto «Misión completa» muestra una solución posible."],
    starter: starters.mision,
    checker: () => {
      const L = itemList([
        ["semaforo", "Respetó el semáforo"],
        ["giro", "Giró a la derecha al final de la calle central"],
        ["persona", "Esperó a la persona sin chocar"],
        ["zona", "Fue más despacio en la ZONA 30"],
        ["plaza", "Se estacionó en P2 (unos 2 s detenido)"],
        ["meta", "Llegó a la META"],
      ]);
      const cross = { x: 92, y: 64, w: 28, d: 22 };
      const hold = new Hold(1.6);
      const normal = new SpeedMeter(), slow = new SpeedMeter();
      const p2 = { x: 118, y: 104, w: 15, d: 22 };
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.robot.bumped) L.fail("persona");
          if (!programDriving(sim)) return;
          const [x, y] = chassisCenter(sim.robot);
          if (lightState(sim) === "rojo" && inZone(sim, cross)) L.fail("semaforo");
          if (x > 125 && Math.abs(y - 75) < 12 && L.is("semaforo") !== false) L.pass("semaforo");
          if (x > 158 && y > 85 && y < 100) L.pass("giro");
          if (sim.world.removed.has("persona") && y > 112 && x > 150 && L.is("persona") !== false) L.pass("persona");
          normal.add(sim, y < 85 && x > 40 && x < 150);
          slow.add(sim, y > 128 && x > 80 && x < 112);
          if (slow.t > 1 && x < 78 && y > 125 && slow.avg < normal.avg * 0.65) L.pass("zona");
          if (hold.update(sim, inZone(sim, p2, -1) && stopped(sim))) L.pass("plaza");
          if (inZone(sim, { x: 4, y: 30, w: 22, d: 22 }) && L.is("plaza")) L.pass("meta");
        },
      };
    },
  },
  // ───────── Prácticas de ampliación (16–25) ─────────
  {
    n: 16,
    title: "Percibir, decidir y actuar paso a paso",
    space: "explorar",
    after: 1,
    goal: "Con la regleta de «Explorar», pon la línea en cuatro posiciones y observa qué decide la micro:bit en cada una.",
    scenario: basicScenario,
    prediction: {
      q: "Si los dos sensores ven blanco, ¿qué decide el programa de la figura?",
      options: ["Sigue recto", "Gira a la izquierda", "Se detiene: no ve la línea"],
      answer: 2,
      explain: "Con 0 y 0 el robot no sabe dónde está la línea. Este programa decide detenerse; otros programas la buscan (práctica 7).",
    },
    challenge: "Usa los botones de la tarjeta «Percibir → decidir → actuar»: línea centrada, a la izquierda, a la derecha y sin línea. Espera a que se iluminen los tres pasos.",
    hints: ["Los botones están debajo de la ficha del componente, en «Explorar».", "Cada vez que cambia la lectura, el ciclo empieza otra vez: percibir, decidir, actuar.", "«Sin línea» deja los dos sensores sobre blanco."],
    checker: () => {
      const L = itemList([
        ["11", "Los dos sensores sobre la línea: sigue recto"],
        ["10", "Solo el izquierdo: gira a la izquierda"],
        ["01", "Solo el derecho: gira a la derecha"],
        ["00", "Ninguno: se detiene"],
      ]);
      return { items: L.items, tick: () => {}, event: (name, data) => name === "flujo" && L.pass(String(data)) };
    },
  },
  {
    n: 17,
    title: "Conducir en zigzag entre cajas",
    space: "conducir",
    goal: "Pasa en zigzag entre las tres cajas y llega a la META sin tocar ninguna.",
    scenario: () => {
      const s = withZone(basicScenario(), "meta", "META", 140, 48, 22, 24);
      s.start = { x: 28, y: 60, heading: 0 };
      for (const [i, x] of SLALOM.entries()) s.objects.push({ id: `caja-${i + 1}`, kind: "obstacle", shape: "caja", x, y: 60, w: 8, d: 8, h: 8, rot: 0 });
      return s;
    },
    prediction: {
      q: "Para rodear una caja sin tocarla, ¿qué conviene?",
      options: ["Ir rápido y girar al final", "Bajar la velocidad y empezar a girar antes de llegar", "Girar sobre sí mismo junto a la caja"],
      answer: 1,
      explain: "El robot ocupa unos 11 cm de ancho y necesita espacio para girar. Despacio y con tiempo, la maniobra es más precisa.",
    },
    challenge: "Pasa la 1.ª caja por arriba (del lado de la recta superior), la 2.ª por abajo y la 3.ª otra vez por arriba. Termina dentro de la META.",
    hints: ["La vista «Superior» ayuda a ver de qué lado pasas cada caja.", "Baja la velocidad a unos 100.", "Si tocas una caja, pulsa «Reiniciar escenario» y vuelve a empezar."],
    checker: () => {
      const L = itemList([
        ["c1", "La 1.ª caja, por arriba"],
        ["c2", "La 2.ª caja, por abajo"],
        ["c3", "La 3.ª caja, por arriba"],
        ["meta", "Llegaste a la META"],
        ["sin-choques", "Sin tocar ninguna caja"],
      ]);
      const meta = { x: 140, y: 48, w: 22, d: 24 };
      let px: number | null = null;
      return {
        items: L.items,
        tick: (sim) => {
          if (sim.mode !== "manual") return;
          watchCollisions(sim, L);
          const { x, y } = sim.robot;
          if (px !== null) {
            SLALOM.forEach((bx, i) => {
              if (px! < bx && x >= bx) {
                const id = `c${i + 1}`, wantUp = i !== 1;
                if (i > 0 && L.is(`c${i}`) !== true) return;
                if (wantUp ? y < 53 : y > 67) L.pass(id);
                else L.fail(id);
              }
            });
          }
          px = x;
          if (L.is("c3") && inZone(sim, meta)) {
            L.pass("meta");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 18,
    title: "Arrancar y parar con los botones A y B",
    space: "programar",
    goal: "El robot espera quieto. Con el botón A sigue la línea; con el botón B se detiene.",
    scenario: basicScenario,
    prediction: {
      q: "Pulsas A y el programa guarda «andar = 1». ¿Cómo se entera «repetir continuamente»?",
      options: ["No se entera: son programas separados", "Lee la variable «andar» en cada vuelta", "El botón mueve los motores directamente para siempre"],
      answer: 1,
      explain: "Los botones y «repetir continuamente» se ejecutan a la vez. Una variable es la forma de que se comuniquen.",
    },
    challenge: "Usa «al presionar el botón A» y «al presionar el botón B» para cambiar la variable «andar». En «repetir continuamente», sigue la línea solo si «andar» es 1.",
    hints: ["Los botones A y B aparecen junto a «Ejecutar» cuando el programa los usa.", "En «al iniciar», pon «andar» a 0: así el robot espera.", "Con B, pon «andar» a 0 y detén los motores."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores"],
    starter: () => B.workspace([B.forever([followLine(150)])]),
    checker: () => {
      const L = itemList([
        ["espera", "Antes de pulsar A, el robot no se mueve"],
        ["a", "Con A, sigue la línea (al menos 50 cm)"],
        ["b", "Con B, se detiene y se queda quieto 2 s"],
      ]);
      let base: number | null = null, fromA: number | null = null;
      const hold = new Hold(2);
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          base ??= sim.robot.odometer;
          if (sim.presses.A === 0) {
            if (sim.robot.odometer - base > 3) L.fail("espera");
            return;
          }
          if (L.is("espera") === null) L.pass("espera");
          fromA ??= sim.robot.odometer;
          if (sim.robot.odometer - fromA > 50 && (sim.now.lineLeft || sim.now.lineRight)) L.pass("a");
          if (L.is("a") && sim.presses.B > 0 && hold.update(sim, stopped(sim))) L.pass("b");
        },
      };
    },
  },
  {
    n: 19,
    title: "Luces que avisan",
    space: "programar",
    goal: "Faros en verde mientras el robot sigue la línea; en rojo cuando se detiene ante la caja.",
    scenario: boxAhead,
    prediction: {
      q: "¿Dónde va el bloque «luces RGB rojo» para que se encienda al detenerse?",
      options: ["En «al iniciar»", "En el mismo caso que «detener motores» (el del obstáculo)", "Al final de «repetir continuamente»"],
      answer: 1,
      explain: "Cada caso del «si» es una situación distinta. Las luces deben cambiar en el caso que corresponde a esa situación.",
    },
    challenge: "El programa ya se detiene ante la caja. Añade «luces RGB verde» al seguir la línea y «luces RGB rojo» al detenerse.",
    hints: ["«Luces RGB» está en «Luces y acciones».", "El verde va en el «si no», junto al seguidor de línea.", "El rojo va junto a «detener motores»."],
    toolbox: ["inicio", "logica", "motores", "sensores", "luces"],
    starter: ex("obstaculo"),
    checker: () => {
      const L = itemList([
        ["verde", "Faros verdes mientras avanza (1 s)"],
        ["rojo", "Faros rojos al detenerse ante la caja (1 s)"],
        ["sin-choques", "Sin choques"],
      ]);
      const holdG = new Hold(1), holdR = new Hold(1);
      return {
        items: L.items,
        tick: (sim) => {
          watchCollisions(sim, L);
          if (!programDriving(sim)) return;
          if (holdG.update(sim, sim.speed > 5 && lightIs(sim.robot.lights, "g"))) L.pass("verde");
          const near = sim.now.sonarId === "caja" && sim.now.distance >= 3 && sim.now.distance <= 20;
          if (holdR.update(sim, near && stopped(sim) && lightIs(sim.robot.lights, "r"))) {
            L.pass("rojo");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 20,
    title: "Frenar poco a poco según la distancia",
    space: "programar",
    goal: "Avanza hacia la caja cada vez más despacio y detente cerca, sin chocar.",
    scenario: boxAhead,
    prediction: {
      q: "«convertir distancia de 8–60 a 0–180». Si la distancia es 34 cm, ¿qué velocidad da?",
      options: ["34", "90", "180"],
      answer: 1,
      explain: "34 está justo a la mitad entre 8 y 60, así que da la mitad entre 0 y 180: 90. Más cerca, menos velocidad.",
    },
    challenge: "Calcula la velocidad a partir de la distancia con «convertir» y «restringir», y úsala en los dos motores.",
    hints: ["«convertir … de 8 – 60 a 0 – 180» está en «Matemáticas».", "«restringir … entre 0 y 180» evita velocidades negativas o demasiado altas.", "Si la distancia es 0 (no hay eco), no hay nada delante: usa la velocidad máxima."],
    toolbox: ["inicio", "logica", "matematicas", "variables", "motores", "sensores"],
    starter: () => B.workspace([B.forever([B.ifElse([[B.obstacle(15), [B.stop()]]], [B.motors(150, 150)])])]),
    checker: () => {
      const L = itemList([
        ["rapido", "Lejos de la caja va rápido"],
        ["lento", "Entre 15 y 25 cm va mucho más despacio, sin parar"],
        ["para", "Se detiene a menos de 14 cm"],
        ["sin-choques", "Sin choques"],
      ]);
      const far = new SpeedMeter(), mid = new SpeedMeter();
      const hold = new Hold(1);
      return {
        items: L.items,
        tick: (sim) => {
          watchCollisions(sim, L);
          if (!programDriving(sim)) return;
          const d = sim.now.sonarId === "caja" ? sim.now.distance : 0;
          far.add(sim, d > 45);
          mid.add(sim, d > 15 && d < 25);
          if (far.t > 0.4 && far.avg > 12) L.pass("rapido");
          if (L.is("rapido") && mid.t > 0.4 && d < 15 && mid.avg < far.avg * 0.6 && mid.avg > 1) L.pass("lento");
          if (hold.update(sim, d >= 3 && d <= 14 && stopped(sim))) {
            L.pass("para");
            if (L.is("sin-choques") !== false) L.pass("sin-choques");
          }
        },
      };
    },
  },
  {
    n: 21,
    title: "Tocar el claxon una sola vez",
    space: "programar",
    goal: "Al ver la señal de claxon, pita una vez (no muchas) y sigue la línea.",
    scenario: cityAt(75, 135, Math.PI),
    prediction: {
      q: "La cámara ve la señal durante 2 s y el programa pita cada vez que la ve. ¿Cuántas veces pita?",
      options: ["Una", "Muchas: en cada vuelta de «repetir»", "Ninguna"],
      answer: 1,
      explain: "«Repetir continuamente» pregunta otra vez en cada vuelta. Para reaccionar una sola vez, hay que recordar que ya pitaste (una variable).",
    },
    challenge: "El programa pita sin parar mientras ve la señal. Usa la variable «pitado» para pitar solo la primera vez.",
    hints: ["Pon «pitado» a 0 en «al iniciar».", "Pita solo si la cámara ve claxon Y «pitado» es 0; después pon «pitado» a 1.", "El ejemplo «Misión completa» lo hace así."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "luces"],
    starter: () => B.workspace([B.forever([B.when(B.signIs("claxon"), [B.horn(), B.decide("Veo la señal de claxon: pito")]), followLine(140, false)])]),
    checker: () => {
      const L = itemList([
        ["vio", "La cámara vio la señal de claxon"],
        ["una", "Pitó exactamente una vez"],
        ["sigue", "Siguió la línea después"],
      ]);
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          if (sim.now.vision.label === "claxon") L.pass("vio");
          if (sim.horns > 1) L.fail("una");
          const [x, y] = chassisCenter(sim.robot);
          if (L.is("vio") && x < 30 && y < 70 && (sim.now.lineLeft || sim.now.lineRight)) {
            L.pass("sigue");
            if (sim.horns === 1) L.pass("una");
            else L.fail("una");
          }
        },
      };
    },
  },
  {
    n: 22,
    title: "Respetar la señal de ALTO",
    space: "programar",
    goal: "Al ver ALTO, detente unos 2 segundos y continúa. Solo una vez.",
    scenario: () => {
      const s = basicScenario();
      s.objects.push({ id: "s-alto", kind: "sign", sign: "alto", x: 110, y: 93, facing: Math.PI });
      return s;
    },
    prediction: {
      q: "Después de esperar, el robot todavía ve la señal ALTO. ¿Qué pasa si el programa solo dice «si veo ALTO → detenerse»?",
      options: ["Sigue sin problema", "Se vuelve a detener y nunca avanza", "Retrocede"],
      answer: 1,
      explain: "La señal sigue a la vista. El programa debe recordar que ya se detuvo por ella y olvidarlo solo cuando la deje atrás.",
    },
    challenge: "Usa el estado «Esperar» y «tiempo en este estado» para esperar 2 s, y una variable para no detenerte otra vez por la misma señal.",
    hints: ["Al ver ALTO (y «visto» = 0): detener, «visto» = 1 y cambiar a estado Esperar.", "En estado Esperar, cuando «tiempo en este estado» > 2000, vuelve a Seguir línea.", "Pon «visto» a 0 solo cuando la cámara deje de ver ALTO."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "estados"],
    starter: () => B.workspace([B.forever([B.ifElse([[B.signIs("alto"), [B.stop(), B.decide("ALTO: me detengo")]]], [followLine(140, false)])])]),
    checker: () => {
      const L = itemList([
        ["para", "Se detuvo antes de la señal"],
        ["espera", "Esperó unos 2 s (entre 1,5 y 3,5 s)"],
        ["sigue", "Continuó y dejó atrás la señal"],
        ["una", "Se detuvo una sola vez"],
      ]);
      let since: number | null = null, stops = 0;
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const x = sim.robot.x, onBottom = sim.robot.y > 90;
          const still = stopped(sim) && sim.robot.odometer > 5;
          if (still && onBottom && x < 125) since ??= sim.time;
          if (!still && since !== null) {
            const t = sim.time - since;
            since = null;
            if (t >= 1) {
              stops += 1;
              L.pass("para");
              if (t >= 1.5 && t <= 3.5) L.pass("espera");
              else L.fail("espera");
            }
          }
          if (stops > 1) L.fail("una");
          if (L.is("espera") && x > 135 && onBottom) {
            L.pass("sigue");
            if (L.is("una") !== false) L.pass("una");
          }
        },
      };
    },
  },
  {
    n: 23,
    title: "Contar vueltas con una variable",
    space: "programar",
    goal: "Cuenta las veces que pasas junto a la señal de claxon, muestra el número y detente en la tercera.",
    scenario: () => {
      const s = basicScenario();
      s.objects.push({ id: "s-marca", kind: "sign", sign: "claxon", x: 130, y: 93, facing: Math.PI });
      return s;
    },
    prediction: {
      q: "La cámara ve la señal durante unos segundos en cada pasada. Si sumas 1 cada vez que la ve, ¿cuánto cuenta en una pasada?",
      options: ["1", "Muchísimo: suma en cada vuelta de «repetir»", "0"],
      answer: 1,
      explain: "Hay que contar el momento en que la señal aparece, no el tiempo que se ve. Para eso se recuerda si ya se estaba viendo.",
    },
    challenge: "Suma 1 a «pasadas» solo cuando la señal aparece (si «vista» era 0). Muestra el número y detente cuando «pasadas» llegue a 3.",
    hints: ["Si la cámara ve la señal y «vista» es 0: suma 1, pon «vista» a 1 y muestra el número.", "Si la cámara NO ve la señal, pon «vista» a 0.", "Con «pasadas» ≥ 3, detén los motores en lugar de seguir la línea."],
    toolbox: ["inicio", "logica", "matematicas", "variables", "motores", "sensores", "vision", "luces"],
    starter: () =>
      B.workspace([
        B.onStart([B.set("pasadas", 0)]),
        B.forever([B.when(B.signIs("claxon"), [B.change("pasadas", 1)]), B.ifElse([[B.cmp(B.get("pasadas"), "GTE", 3), [B.stop(), B.decide("Llegué a 3: me detengo")]]], [followLine(150, false)])]),
      ]),
    checker: () => {
      const L = itemList([
        ["p1", "1.ª pasada junto a la señal"],
        ["p2", "2.ª pasada"],
        ["para", "Se detuvo en la 3.ª pasada (ni antes ni después)"],
        ["numero", "La matriz mostró el número de pasadas"],
      ]);
      let passes = 0, unseen = 99, early = false;
      const hold = new Hold(1.5);
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const seen = sim.now.vision.label === "claxon";
          if (seen && unseen > 1) passes += 1;
          unseen = seen ? 0 : unseen + 0.02;
          if (passes >= 1) L.pass("p1");
          if (passes >= 2) L.pass("p2");
          if (sim.robot.icon === `letra:${Math.min(passes, 9)}` && passes >= 2) L.pass("numero");
          const still = hold.update(sim, stopped(sim) && sim.robot.odometer > 5);
          if (still && passes < 3) early = true;
          if (early) L.fail("para");
          if (still && passes === 3 && !early) L.pass("para");
          if (passes > 3) L.fail("para");
        },
      };
    },
  },
  {
    n: 24,
    title: "Ordenar el programa con funciones",
    space: "programar",
    goal: "Agrupa el seguidor de línea en una función y la parada en otra; úsalas desde «repetir continuamente».",
    scenario: boxAhead,
    prediction: {
      q: "¿Qué cambia en lo que hace el robot si mueves bloques a una función y la llamas?",
      options: ["Nada: hace lo mismo, pero el programa es más fácil de leer", "Va más rápido", "Ya no puede usar sensores"],
      answer: 0,
      explain: "Una función es un nombre para un grupo de bloques. El robot hace lo mismo; tú entiendes y cambias el programa más fácilmente.",
    },
    challenge: "Crea las funciones «seguirLinea» y «alto». En «repetir continuamente» deja solo un «si»: si hay obstáculo, llama a «alto»; si no, llama a «seguirLinea».",
    hints: ["En «Funciones», crea una función y cámbiale el nombre.", "Arrastra el bloque «si» del seguidor dentro de la función «seguirLinea».", "En «alto» pon «detener motores» y «mostrar icono».", "Las llamadas aparecen en «Funciones» cuando ya existe la función."],
    toolbox: ["inicio", "logica", "funciones", "motores", "sensores", "luces"],
    starter: ex("obstaculo"),
    checker: () => {
      const L = itemList([
        ["funciones", "El programa tiene dos funciones y las llama"],
        ["sigue", "Siguió la línea"],
        ["para", "Se detuvo ante la caja sin chocar"],
      ]);
      let base: number | null = null;
      const hold = new Hold(1);
      return {
        items: L.items,
        program: (p) => {
          if (Object.keys(p.functions).length >= 2 && uses(p, "call")) L.pass("funciones");
        },
        tick: (sim) => {
          if (sim.robot.bumped) L.fail("para");
          if (!programDriving(sim)) return;
          base ??= sim.robot.odometer;
          if (sim.robot.odometer - base > 40 && (sim.now.lineLeft || sim.now.lineRight)) L.pass("sigue");
          const near = sim.now.sonarId === "caja" && sim.now.distance >= 3 && sim.now.distance <= 20;
          if (L.is("para") !== false && hold.update(sim, near && stopped(sim))) L.pass("para");
        },
      };
    },
  },
  {
    n: 25,
    title: "El amarillo: frenar sin detenerse",
    space: "programar",
    goal: "Con el semáforo en amarillo, baja la velocidad pero no te detengas; con rojo, sí.",
    scenario: cityAt(30, 15, 0, (s) => {
      const l = s.objects.find((o) => o.kind === "light");
      if (l && l.kind === "light") {
        l.cycle.auto = false;
        l.state = "amarillo";
      }
    }),
    prediction: {
      q: "El programa de la práctica 10 se detiene con rojo O amarillo. Si el semáforo se queda en amarillo, ¿qué pasa?",
      options: ["Pasa despacio", "Se queda detenido mientras lo vea", "Acelera"],
      answer: 1,
      explain: "Detenerse con amarillo es prudente, pero aquí se pide otra regla: con amarillo, ir más despacio. Cada color, su conducta. (El amarillo es una ampliación educativa.)",
    },
    challenge: "Separa los casos: rojo → detener; amarillo → velocidad 70; si no → velocidad 150. El seguidor usa la variable «velocidad».",
    hints: ["Cambia la variable «velocidad» según lo que ve la cámara, antes del seguidor.", "Rojo y amarillo ya no van juntos con «o».", "Cuando el semáforo sale de la vista, vuelve a 150."],
    toolbox: ["inicio", "logica", "variables", "motores", "sensores", "vision", "luces"],
    starter: ex("semaforo"),
    checker: () => {
      const L = itemList([
        ["frena", "Con amarillo va más despacio"],
        ["no-para", "No se detiene con amarillo"],
        ["pasa", "Pasa el semáforo y recupera la velocidad"],
      ]);
      const slow = new SpeedMeter(), after = new SpeedMeter();
      const hold = new Hold(1);
      return {
        items: L.items,
        tick: (sim) => {
          if (!programDriving(sim)) return;
          const yellow = sim.now.vision.label === "semaforo_amarillo";
          const [x, y] = chassisCenter(sim.robot);
          slow.add(sim, yellow);
          after.add(sim, x > 125 && x < 155 && y < 30);
          if (hold.update(sim, yellow && stopped(sim))) L.fail("no-para");
          if (after.t > 0.5 && x > 155) {
            if (slow.t > 0.6 && slow.avg < after.avg * 0.65) L.pass("frena");
            else L.fail("frena");
            L.pass("pasa");
            if (L.is("no-para") !== false) L.pass("no-para");
          }
        },
      };
    },
  },
];

export function practiceScenario(p: Practice): Scenario {
  return cloneScenario(p.scenario());
}

export type { Sim };
