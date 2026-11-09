/**
 * Ejemplos resueltos y editables. Son programas de bloques reales: el
 * simulador los ejecuta igual que el programa del alumno.
 */
import type { BlockJson, WorkspaceJson } from "./compile";
import type { Pose, Scenario } from "../core/scenario";
import * as B from "./dsl";

export interface Example {
  id: string;
  title: string;
  summary: string;
  scenario: string;
  /** Salida sugerida del robot para este ejemplo. */
  start?: Pose;
  /** Cambios en el escenario que necesita el ejemplo (por ejemplo, un obstáculo). */
  setup?: (s: Scenario) => void;
  build: () => WorkspaceJson;
}

type Speed = number | BlockJson;

/** Seguir la línea con dos sensores (bloque "si / si no si / si no"). */
export function followLine(v: Speed, narrate = true, lostBody?: BlockJson[]): BlockJson {
  const turnSlow = typeof v === "number" ? Math.round(v * 0.15) : 20;
  const d = (t: string) => (narrate ? [B.decide(t)] : []);
  return B.ifElse(
    [
      [B.and(B.line("L", "black"), B.line("R", "black")), [B.motors(v, v), ...d("Los dos sensores ven negro: sigo recto")]],
      [B.line("L", "black"), [B.motors(turnSlow, v), ...d("La línea está a mi izquierda: giro a la izquierda")]],
      [B.line("R", "black"), [B.motors(v, turnSlow), ...d("La línea está a mi derecha: giro a la derecha")]],
    ],
    lostBody ?? [B.stop(), ...d("No veo la línea: me detengo")],
  );
}

const vel = () => B.get("velocidad");

/** Reacción a las señales de velocidad (memoria en la variable "velocidad"). */
const speedSigns = (): BlockJson[] => [
  B.when(B.and(B.signIs("limite30"), B.cmp(vel(), "NEQ", 70)), [B.set("velocidad", 70), B.decide("Vi la señal 30: reduzco a PWM 70 (no son km/h)")]),
  B.when(B.and(B.signIs("fin30"), B.cmp(vel(), "NEQ", 150)), [B.set("velocidad", 150), B.decide("Fin del límite: vuelvo a PWM 150")]),
];

const isRed = () => B.or(B.signIs("semaforo_rojo"), B.signIs("semaforo_amarillo"));

/** Caja sobre la recta inferior de la pista básica, delante de la salida. */
const boxOnBottom = (s: Scenario) => {
  s.objects.push({ id: "caja-ej", kind: "obstacle", shape: "caja", x: 125, y: 105, w: 8, d: 8, h: 8, rot: 0 });
};

/**
 * Rodear la caja por dentro de la pista con una secuencia por tiempos
 * («tiempo en este estado»): girar a la izquierda, avanzar, girar a la
 * derecha, avanzar junto a la caja, girar a la derecha y avanzar en diagonal
 * hasta volver a ver la línea.
 */
export function aroundObstacleProgram(t = { g1: 380, a1: 1150, g2: 1530, a2: 3600, g3: 3800 }): WorkspaceJson {
  const st = B.stateTime;
  return B.workspace([
    B.onStart([B.setState("SEGUIR_LINEA"), B.set("ultimoLado", "derecha")]),
    B.forever([
      B.ifElse(
        [
          [
            B.stateIs("RECUPERAR"),
            [
              B.ifElse(
                [
                  [B.cmp(st(), "LT", t.g1), [B.motors(-120, 120), B.decide("1. Giro a la izquierda para salir de la línea")]],
                  [B.cmp(st(), "LT", t.a1), [B.motors(120, 120), B.decide("2. Me aparto de la línea")]],
                  [B.cmp(st(), "LT", t.g2), [B.motors(120, -120), B.decide("3. Giro a la derecha")]],
                  [B.cmp(st(), "LT", t.a2), [B.motors(120, 120), B.decide("4. Paso junto a la caja")]],
                  [B.cmp(st(), "LT", t.g3), [B.motors(120, -120), B.decide("5. Giro hacia la línea")]],
                  [B.or(B.line("L"), B.line("R")), [B.setState("SEGUIR_LINEA"), B.set("ultimoLado", "izquierda"), B.decide("6. Encontré la línea: sigo")]],
                ],
                [B.motors(110, 110)],
              ),
            ],
          ],
          [B.obstacle(15), [B.stop(), B.setState("RECUPERAR"), B.decide("Caja delante: la rodeo")]],
          [B.and(B.line("L"), B.line("R")), [B.motors(140, 140)]],
          [B.line("L"), [B.motors(20, 140), B.set("ultimoLado", "izquierda")]],
          [B.line("R"), [B.motors(140, 20), B.set("ultimoLado", "derecha")]],
          [B.cmp(B.get("ultimoLado"), "EQ", "izquierda"), [B.motors(-70, 110)]],
        ],
        [B.motors(110, -70)],
      ),
    ]),
  ]);
}

export const EXAMPLES: Example[] = [
  {
    id: "avanzar-parar",
    title: "Avanzar y parar",
    summary: "Avanza 1,5 s y se detiene. Cambia el tiempo de espera para llegar más lejos.",
    scenario: "basica",
    build: () => B.workspace([B.onStart([B.motors(150, 150), B.wait(1500), B.stop(), B.icon("Yes")])]),
  },
  {
    id: "seguidor-basico",
    title: "Seguidor de línea básico",
    summary: "Dos sensores, cuatro casos. Si pierde la línea, se detiene.",
    scenario: "basica",
    build: () => B.workspace([B.forever([followLine(150)])]),
  },
  {
    id: "recuperar-linea",
    title: "Recuperar la línea perdida",
    summary: "Recuerda de qué lado vio la línea por última vez y gira hacia ese lado para buscarla.",
    scenario: "basica",
    build: () =>
      B.workspace([
        B.onStart([B.set("ultimoLado", "izquierda")]),
        B.forever([
          B.ifElse(
            [
              [B.and(B.line("L"), B.line("R")), [B.motors(150, 150), B.decide("Sigo la línea")]],
              [B.line("L"), [B.set("ultimoLado", "izquierda"), B.motors(20, 150)]],
              [B.line("R"), [B.set("ultimoLado", "derecha"), B.motors(150, 20)]],
            ],
            [
              B.ifElse(
                [[B.cmp(B.get("ultimoLado"), "EQ", "izquierda"), [B.motors(-70, 110), B.decide("Perdí la línea: la busco a la izquierda, donde la vi por última vez")]]],
                [B.motors(110, -70), B.decide("Perdí la línea: la busco a la derecha, donde la vi por última vez")],
              ),
            ],
          ),
        ]),
      ]),
  },
  {
    id: "obstaculo",
    title: "Detenerse ante un obstáculo",
    summary: "La parada por obstáculo va primero: el seguidor de línea no puede anularla.",
    scenario: "basica",
    setup: (s) => { s.objects.push({ id: "caja-ej", kind: "obstacle", shape: "caja", x: 120, y: 105, w: 8, d: 8, h: 8, rot: 0 }); },
    build: () =>
      B.workspace([
        B.forever([
          B.ifElse([[B.obstacle(15), [B.stop(), B.decide(B.join(B.join("Me detengo: obstáculo a ", B.distance()), " cm"))]]], [followLine(150)]),
        ]),
      ]),
  },
  {
    id: "semaforo",
    title: "Respetar el semáforo",
    summary: "Rojo (o amarillo) detiene al robot; con verde sigue la línea.",
    scenario: "ciudad",
    start: { x: 30, y: 15, heading: 0 },
    build: () =>
      B.workspace([
        B.forever([B.ifElse([[isRed(), [B.stop(), B.decide("Me detengo porque detecté rojo")]]], [followLine(150)])]),
      ]),
  },
  {
    id: "zona-30",
    title: "Reducir velocidad ante la señal 30",
    summary: "La variable 'velocidad' recuerda la última señal vista. 30 = PWM 70 en este ejercicio.",
    scenario: "ciudad",
    start: { x: 30, y: 15, heading: 0 },
    build: () => B.workspace([B.onStart([B.set("velocidad", 150)]), B.forever([...speedSigns(), followLine(vel())])]),
  },
  {
    id: "elegir-giro",
    title: "Elegir el giro en el siguiente cruce",
    summary: "Recuerda la flecha vista y la usa al llegar al final de la calle. Luego la olvida.",
    scenario: "ciudad",
    start: { x: 105, y: 118, heading: -Math.PI / 2 },
    build: () =>
      B.workspace([
        B.onStart([B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA")]),
        B.forever([
          B.when(B.signIs("izquierda"), [B.set("giro", "izquierda")]),
          B.when(B.signIs("derecha"), [B.set("giro", "derecha")]),
          B.ifElse(
            [
              [
                B.stateIs("GIRAR"),
                [
                  B.ifElse(
                    [[B.and(B.cmp(B.stateTime(), "GT", 150), B.or(B.line("L"), B.line("R"))), [B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA"), B.decide("Encontré la nueva calle: olvido la flecha")]]],
                  ),
                ],
              ],
              [
                B.and(B.line("L", "white"), B.line("R", "white")),
                [
                  B.ifElse(
                    [
                      [B.cmp(B.get("giro"), "EQ", "izquierda"), [B.setState("GIRAR"), B.motors(-90, 110), B.decide("Fin de la calle: giro a la izquierda porque vi la flecha")]],
                      [B.cmp(B.get("giro"), "EQ", "derecha"), [B.setState("GIRAR"), B.motors(110, -90), B.decide("Fin de la calle: giro a la derecha porque vi la flecha")]],
                    ],
                    [B.stop(), B.decide("Fin de la calle y no recuerdo ninguna flecha: me detengo")],
                  ),
                ],
              ],
            ],
            [followLine(140, false)],
          ),
        ]),
      ]),
  },
  {
    id: "estacionar",
    title: "Estacionarse en P2 y volver",
    summary: "Máquina de estados: seguir → estacionar (maniobra por tiempos) → esperar 2 s → salir → seguir.",
    scenario: "ciudad",
    build: () => parkingProgram("p2"),
  },
  {
    id: "prioridades",
    title: "Prioridades entre conductas",
    summary: "Obstáculo > semáforo > señales > seguir línea. La primera condición que se cumple gana.",
    scenario: "ciudad",
    start: { x: 30, y: 15, heading: 0 },
    setup: (s) => { s.objects.push({ id: "persona", kind: "obstacle", shape: "persona", x: 165, y: 70, w: 6, d: 6, h: 14, rot: 0, leavesAfterStop: 2 }); },
    build: () =>
      B.workspace([
        B.onStart([B.set("velocidad", 150)]),
        B.forever([
          ...speedSigns(),
          B.ifElse(
            [
              [B.obstacle(15), [B.stop(), B.decide("Prioridad 1: obstáculo delante, me detengo")]],
              [isRed(), [B.stop(), B.decide("Prioridad 2: semáforo en rojo, me detengo")]],
            ],
            [followLine(vel(), false), B.decide("Prioridad 3: no hay peligro, sigo la línea")],
          ),
        ]),
      ]),
  },
  {
    id: "seguidor-inteligente",
    title: "Seguidor inteligente: flechas, semáforo y obstáculos",
    summary: "Sigue la línea; recuerda la flecha y gira en el siguiente fin de calle; se detiene ante una persona, una caja o el rojo; frena con el amarillo.",
    scenario: "reto",
    build: () => smartFollowerProgram(),
  },
  {
    id: "sensor-estacionamiento",
    title: "Sensor de estacionamiento: luces y velocidad según la distancia",
    summary: "«convertir» pasa la distancia a velocidad y a color: lejos, verde y rápido; cerca, rojo y despacio, hasta detenerse.",
    scenario: "basica",
    setup: boxOnBottom,
    build: () =>
      B.workspace([
        B.forever([
          B.set("d", B.distance()),
          B.when(B.cmp(B.get("d"), "EQ", 0), [B.set("d", 100)]),
          B.set("velocidad", B.constrain(B.mapRange(B.get("d"), 8, 60, 0, 160), 0, 160)),
          B.set("rojo", B.constrain(B.mapRange(B.get("d"), 10, 50, 255, 0), 0, 255)),
          B.lightsRgb(B.get("rojo"), B.arith(255, "MINUS", B.get("rojo")), 0),
          B.motors(B.get("velocidad"), B.get("velocidad")),
          B.decide(B.join(B.join("Caja a ", B.get("d")), " cm: cuanto más cerca, más lento y más rojo")),
        ]),
      ]),
  },
  {
    id: "media-vuelta",
    title: "Media vuelta ante un obstáculo",
    summary: "Estado Girar: da media vuelta sobre sí mismo y, cuando vuelve a encontrar la línea, la sigue en sentido contrario.",
    scenario: "basica",
    setup: boxOnBottom,
    build: () =>
      B.workspace([
        B.onStart([B.setState("SEGUIR_LINEA")]),
        B.forever([
          B.ifElse(
            [
              [
                B.stateIs("GIRAR"),
                [
                  B.ifElse(
                    [[B.and(B.cmp(B.stateTime(), "GT", 450), B.or(B.line("L"), B.line("R"))), [B.setState("SEGUIR_LINEA"), B.decide("Ya di media vuelta: sigo la línea hacia el otro lado")]]],
                    [B.motors(-120, 120)],
                  ),
                ],
              ],
              [B.obstacle(15), [B.stop(), B.setState("GIRAR"), B.decide("Obstáculo delante: doy media vuelta")]],
            ],
            [followLine(140, false)],
          ),
        ]),
      ]),
  },
  {
    id: "cronometro",
    title: "Cronómetro de vuelta",
    summary: "Mide cuánto tarda una vuelta: guarda el «tiempo desde el inicio» al pasar junto a la señal y resta en la pasada siguiente.",
    scenario: "basica",
    setup: (s) => {
      s.objects.push({ id: "s-marca", kind: "sign", sign: "claxon", x: 130, y: 93, facing: Math.PI });
    },
    build: () =>
      B.workspace([
        B.onStart([B.set("vista", 0), B.set("inicio", -1), B.set("vueltas", 0)]),
        B.forever([
          B.when(B.and(B.signIs("claxon"), B.cmp(B.get("vista"), "EQ", 0)), [
            B.set("vista", 1),
            B.when(B.cmp(B.get("inicio"), "GTE", 0), [
              B.change("vueltas", 1),
              B.decide(B.join(B.join("Vuelta ", B.get("vueltas")), B.join(": ", B.join(B.arith(B.arith(B.time(), "MINUS", B.get("inicio")), "DIVIDE", 1000), " s")))),
            ]),
            B.set("inicio", B.time()),
          ]),
          B.when(B.not(B.signIs("claxon")), [B.set("vista", 0)]),
          followLine(150, false),
        ]),
      ]),
  },
  {
    id: "botones-velocidad",
    title: "Cambiar la velocidad con los botones",
    summary: "El botón A pasa por tres velocidades (1, 2, 3) y muestra cuál; el botón B pausa o reanuda la marcha.",
    scenario: "basica",
    build: () =>
      B.workspace([
        B.onStart([B.set("modo", 1), B.set("andar", 1), B.set("velocidad", 100), B.showNumber(1)]),
        B.onButton("A", [
          B.change("modo", 1),
          B.when(B.cmp(B.get("modo"), "GT", 3), [B.set("modo", 1)]),
          B.set("velocidad", B.arith(50, "ADD", B.arith(50, "MULTIPLY", B.get("modo")))),
          B.showNumber(B.get("modo")),
        ]),
        B.onButton("B", [B.ifElse([[B.cmp(B.get("andar"), "EQ", 1), [B.set("andar", 0)]]], [B.set("andar", 1)])], 320, 220),
        B.forever([B.ifElse([[B.cmp(B.get("andar"), "EQ", 1), [followLine(B.get("velocidad"), false)]]], [B.stop()])]),
      ]),
  },
  {
    id: "rodear-obstaculo",
    title: "Rodear un obstáculo y volver a la línea",
    summary: "Maniobra por tiempos en el estado Recuperar: sale de la línea, rodea la caja, vuelve en diagonal y sigue. En el robot real hay que calibrar los tiempos.",
    scenario: "basica",
    setup: boxOnBottom,
    build: () => aroundObstacleProgram(),
  },
  {
    id: "mision",
    title: "Misión completa con máquina de estados",
    summary: "Semáforo, giro indicado, persona que cruza, zona 30, estacionamiento en P2 y llegada a la meta.",
    scenario: "reto",
    build: () => missionProgram(),
  },
];

/** Maniobra de estacionamiento en la plaza indicada (por tiempos, como en el ejemplo oficial). */
export function parkingProgram(plaza: "p1" | "p2"): WorkspaceJson {
  return B.workspace([B.onStart([B.set("estacionado", 0), B.set("vistaP", 0), B.setState("SEGUIR_LINEA")]), B.forever(parkingLogic(plaza, [followLine(130, false)]))]);
}

/**
 * Lógica de estacionamiento:
 * 1. Al ver la señal P, la recuerda (vistaP = 1).
 * 2. Cuando la señal sale de la vista, avanza un poco, gira 90° a la derecha,
 *    entra en la plaza, espera 2 s, sale marcha atrás y gira 90° a la izquierda.
 * 3. "estacionado = 1" evita repetir la maniobra.
 */
function parkingLogic(plaza: "p1" | "p2", normal: BlockJson[]): BlockJson[] {
  const t = B.stateTime;
  return [
    B.when(B.and(B.stateIs("SEGUIR_LINEA"), B.and(B.signIs(plaza), B.cmp(B.get("estacionado"), "EQ", 0))), [B.set("vistaP", 1)]),
    B.ifElse(
      [
        [
          B.and(B.stateIs("SEGUIR_LINEA"), B.and(B.cmp(B.get("vistaP"), "EQ", 1), B.not(B.signIs(plaza)))),
          [B.setState("ESTACIONAR"), B.set("vistaP", 0), B.decide(`Pasé la señal ${plaza.toUpperCase()}: empiezo a estacionarme`)],
        ],
        [
          B.stateIs("ESTACIONAR"),
          [
            B.ifElse(
              [
                [B.cmp(t(), "LT", 700), [B.motors(110, 110)]],
                [B.cmp(t(), "LT", 1080), [B.motors(110, -110), B.decide("Giro 90° a la derecha hacia la plaza")]],
                [B.cmp(t(), "LT", 2080), [B.motors(110, 110), B.decide("Entro en la plaza")]],
              ],
              [B.stop(), B.setState("ESPERAR"), B.decide("Estacionado: espero 2 segundos")],
            ),
          ],
        ],
        [B.and(B.stateIs("ESPERAR"), B.cmp(B.get("estacionado"), "EQ", 0)), [B.when(B.cmp(t(), "GT", 2000), [B.set("estacionado", 1), B.setState("RECUPERAR"), B.decide("Salgo de la plaza")])]],
        [
          B.stateIs("RECUPERAR"),
          [
            B.ifElse(
              [
                [B.cmp(t(), "LT", 1000), [B.motors(-110, -110)]],
                [B.cmp(t(), "LT", 1380), [B.motors(-110, 110), B.decide("Giro a la izquierda para volver al recorrido")]],
                [B.or(B.line("L"), B.line("R")), [B.setState("SEGUIR_LINEA"), B.decide("De vuelta en la línea")]],
              ],
              [B.motors(90, 90)],
            ),
          ],
        ],
      ],
      normal,
    ),
  ];
}

/**
 * Seguidor inteligente, en cuatro partes que se repiten:
 * 1. Recordar la flecha que ve la cámara (variable "giro").
 * 2. Ajustar la velocidad: con amarillo baja poco a poco; si no, se recupera.
 * 3. Prioridades: obstáculo > rojo > girar > fin de la calle > seguir la línea.
 * 4. Al girar, busca la calle nueva y luego olvida la flecha.
 */
export function smartFollowerProgram(): WorkspaceJson {
  const giro = () => B.get("giro");
  const lado = () => B.get("ultimoLado");
  const turn = (side: "izquierda" | "derecha", why: string): BlockJson[] => [
    B.setState("GIRAR"),
    side === "izquierda" ? B.motors(-90, 110) : B.motors(110, -90),
    B.decide(why),
  ];
  return B.workspace([
    B.onStart([B.set("velocidad", 150), B.set("giro", "ninguno"), B.set("ultimoLado", "derecha"), B.setState("SEGUIR_LINEA"), B.lights("White")]),
    B.forever([
      // 1. La flecha se ve antes del cruce: se recuerda hasta usarla.
      B.when(B.signIs("izquierda"), [B.set("giro", "izquierda")]),
      B.when(B.signIs("derecha"), [B.set("giro", "derecha")]),
      // 2. Amarillo: frena poco a poco (hasta PWM 60). Sin amarillo, recupera la velocidad.
      B.ifElse(
        [[B.signIs("semaforo_amarillo"), [B.set("velocidad", B.minmax("max", 60, B.arith(vel(), "MINUS", 4))), B.decide("Semáforo en amarillo: voy frenando")]]],
        [B.set("velocidad", B.minmax("min", 150, B.arith(vel(), "ADD", 5)))],
      ),
      B.when(B.signIs("semaforo_verde"), [B.decide("Semáforo en verde: sigo avanzando")]),
      // 3. La primera condición que se cumple gana.
      B.ifElse(
        [
          [B.obstacle(15), [B.stop(), B.decide("Prioridad 1: persona o caja delante: alto")]],
          [B.signIs("semaforo_rojo"), [B.stop(), B.decide("Prioridad 2: semáforo en rojo: alto")]],
          [
            B.stateIs("GIRAR"),
            [
              B.ifElse(
                [
                  [
                    B.and(B.cmp(B.stateTime(), "GT", 250), B.or(B.line("L"), B.line("R"))),
                    [B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA"), B.decide("Encontré la calle nueva: sigo la línea y olvido la flecha")],
                  ],
                  [B.cmp(giro(), "EQ", "izquierda"), [B.motors(-90, 110)]],
                ],
                [B.motors(110, -90)],
              ),
            ],
          ],
          [
            B.and(B.line("L", "white"), B.line("R", "white")),
            [
              B.ifElse(
                [
                  [B.cmp(giro(), "EQ", "izquierda"), turn("izquierda", "Se acabó la calle y vi la flecha: giro a la izquierda")],
                  [B.cmp(giro(), "EQ", "derecha"), turn("derecha", "Se acabó la calle y vi la flecha: giro a la derecha")],
                  [B.cmp(lado(), "EQ", "izquierda"), [B.motors(-70, 110), B.decide("Perdí la línea: la busco a la izquierda")]],
                ],
                [B.motors(110, -70), B.decide("Perdí la línea: la busco a la derecha")],
              ),
            ],
          ],
        ],
        // 4. Seguir la línea (y recordar de qué lado la vi por última vez).
        [
          B.ifElse(
            [
              [B.and(B.line("L"), B.line("R")), [B.motors(vel(), vel())]],
              [B.line("L"), [B.motors(20, vel()), B.set("ultimoLado", "izquierda")]],
            ],
            [B.motors(vel(), 20), B.set("ultimoLado", "derecha")],
          ),
        ],
      ),
    ]),
  ]);
}

/** Programa de la misión: combina todas las conductas con prioridades y estados. */
export function missionProgram(): WorkspaceJson {
  const normal: BlockJson[] = [
    ...speedSigns(),
    B.when(B.signIs("derecha"), [B.set("giro", "derecha")]),
    B.when(B.signIs("izquierda"), [B.set("giro", "izquierda")]),
    B.when(B.and(B.signIs("claxon"), B.cmp(B.get("pitado"), "EQ", 0)), [B.set("pitado", 1), B.horn(), B.decide("Vi la señal de claxon: pito una vez")]),
    B.ifElse(
      [
        [B.obstacle(15), [B.stop(), B.decide("Prioridad 1: algo delante, espero")]],
        [isRed(), [B.stop(), B.decide("Prioridad 2: semáforo en rojo, espero")]],
        [
          B.and(B.line("L", "white"), B.line("R", "white")),
          [
            B.ifElse(
              [
                [B.cmp(B.get("giro"), "EQ", "derecha"), [B.setState("GIRAR"), B.motors(110, -90), B.decide("Fin de la calle: giro a la derecha (flecha)")]],
                [B.cmp(B.get("giro"), "EQ", "izquierda"), [B.setState("GIRAR"), B.motors(-90, 110), B.decide("Fin de la calle: giro a la izquierda (flecha)")]],
              ],
              [B.motors(-60, 90), B.decide("Perdí la línea: la busco")],
            ),
          ],
        ],
      ],
      [followLine(vel(), false)],
    ),
  ];
  const turning: BlockJson = B.when(B.and(B.stateIs("GIRAR"), B.or(B.line("L"), B.line("R"))), [B.set("giro", "ninguno"), B.setState("SEGUIR_LINEA"), B.decide("Nueva calle encontrada: olvido la flecha")]);
  return B.workspace([
    B.onStart([B.set("velocidad", 150), B.set("giro", "ninguno"), B.set("pitado", 0), B.set("estacionado", 0), B.set("vistaP", 0), B.setState("SEGUIR_LINEA"), B.lights("White")]),
    B.forever([turning, ...parkingLogic("p2", normal)]),
  ]);
}

export function exampleById(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
