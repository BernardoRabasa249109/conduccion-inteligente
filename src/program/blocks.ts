/**
 * Bloques de Blockly en español y caja de herramientas progresiva.
 * Colores con significado: cian = percibir, ámbar = decidir, fucsia = actuar.
 */
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as Es from "blockly/msg/es";
import { STATES, STATE_NAME } from "./ast";

export const COLORS = {
  inicio: "#3f72e6",
  decidir: "#d99a0b",
  variables: "#d9466f",
  matematicas: "#2f9e6a",
  actuar: "#c43bd4",
  luces: "#a63ab8",
  percibir: "#0aa5c2",
  vision: "#1784d1",
  estados: "#7c5ce0",
  funciones: "#5b5bd6",
};

export const ICONS: [string, string][] = [
  ["corazón", "Heart"],
  ["feliz", "Happy"],
  ["triste", "Sad"],
  ["sí ✓", "Yes"],
  ["no ✗", "No"],
  ["cuadrado", "Square"],
  ["diamante", "Diamond"],
  ["diana", "Target"],
  ["dormido", "Asleep"],
  ["sorprendido", "Surprised"],
];

export const ARROWS: [string, string][] = [
  ["arriba ↑", "North"],
  ["derecha →", "East"],
  ["abajo ↓", "South"],
  ["izquierda ←", "West"],
];

/** Colores de Tinybit.enColor (nombres oficiales de la extensión). */
export const LIGHT_COLORS: [string, string][] = [
  ["apagadas", "OFF"],
  ["rojo", "Red"],
  ["verde", "Green"],
  ["azul", "Blue"],
  ["blanco", "White"],
  ["cian", "Cyan"],
  ["rosa", "Pinkish"],
  ["amarillo", "Yellow"],
];

/** Melodías de Tinybit.enMusic (nombres oficiales de la extensión). */
export const MELODIES = ["dadadum", "entertainer", "prelude", "ode", "nyan", "ringtone", "funk", "blues", "birthday", "wedding", "funereal", "punchline", "baddy", "chase", "ba_ding", "wawawawaa", "jump_up", "jump_down", "power_up", "power_down"];

export const SIGN_OPTIONS: [string, string][] = [
  ["semáforo en rojo", "semaforo_rojo"],
  ["semáforo en verde", "semaforo_verde"],
  ["semáforo en amarillo*", "semaforo_amarillo"],
  ["girar izquierda", "izquierda"],
  ["girar derecha", "derecha"],
  ["límite 30", "limite30"],
  ["fin del límite", "fin30"],
  ["claxon", "claxon"],
  ["estacionamiento 1", "p1"],
  ["estacionamiento 2", "p2"],
  ["alto*", "alto"],
];

const STATE_OPTIONS: [string, string][] = STATES.map((s) => [STATE_NAME[s], s]);

let defined = false;

export function defineBlocks() {
  if (defined) return;
  defined = true;
  Blockly.setLocale(Es as unknown as { [key: string]: string });
  Blockly.common.defineBlocksWithJsonArray([
    // ── Inicio y repetición ──
    { type: "tp_on_start", message0: "al iniciar %1 %2", args0: [{ type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: COLORS.inicio, tooltip: "Se ejecuta una vez cuando empieza el programa." },
    { type: "tp_forever", message0: "repetir continuamente %1 %2", args0: [{ type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: COLORS.inicio, tooltip: "Repite sin fin. Cada vuelta dura al menos 20 ms, como en MakeCode." },
    { type: "tp_wait", message0: "esperar %1 ms", args0: [{ type: "input_value", name: "MS", check: "Number" }], previousStatement: null, nextStatement: null, colour: COLORS.inicio, inputsInline: true, tooltip: "Pausa este programa. Los motores siguen con la última orden." },

    // ── Motores (actuar) ──
    { type: "tp_motors", message0: "motores  izquierdo %1  derecho %2", args0: [{ type: "input_value", name: "LEFT", check: "Number" }, { type: "input_value", name: "RIGHT", check: "Number" }], previousStatement: null, nextStatement: null, colour: COLORS.actuar, inputsInline: true, tooltip: "Velocidad de cada rueda de −255 (atrás) a 255 (adelante). Equivale a Tinybit.car_sport." },
    {
      type: "tp_drive", message0: "mover %1 a velocidad %2",
      args0: [{ type: "field_dropdown", name: "MODE", options: [["adelante", "run"], ["atrás", "back"], ["a la izquierda", "left"], ["a la derecha", "right"], ["girar sobre sí a la izquierda", "spinleft"], ["girar sobre sí a la derecha", "spinright"]] }, { type: "input_value", name: "SPEED", check: "Number" }],
      previousStatement: null, nextStatement: null, colour: COLORS.actuar, inputsInline: true, tooltip: "Movimientos de la extensión oficial (CarCtrlSpeed). 'A la izquierda' solo mueve la rueda derecha.",
    },
    { type: "tp_stop", message0: "detener motores", previousStatement: null, nextStatement: null, colour: COLORS.actuar, tooltip: "Pone los dos motores a 0." },

    // ── Sensores (percibir) ──
    { type: "tp_line", message0: "sensor de línea %1 ve %2", args0: [{ type: "field_dropdown", name: "SIDE", options: [["izquierdo", "L"], ["derecho", "R"]] }, { type: "field_dropdown", name: "COLOR", options: [["negro", "black"], ["blanco", "white"]] }], output: "Boolean", colour: COLORS.percibir, tooltip: "Verdadero si el sensor infrarrojo ve ese color debajo del robot." },
    { type: "tp_line_value", message0: "lectura del sensor %1 (1 = negro)", args0: [{ type: "field_dropdown", name: "SIDE", options: [["izquierdo", "L"], ["derecho", "R"]] }], output: "Number", colour: COLORS.percibir, tooltip: "1 si ve negro, 0 si ve blanco." },
    { type: "tp_distance", message0: "distancia del ultrasonido (cm)", output: "Number", colour: COLORS.percibir, tooltip: "Distancia al objeto de enfrente. 0 significa que no volvió el eco (no hay objeto al alcance)." },
    { type: "tp_obstacle", message0: "obstáculo a menos de %1 cm", args0: [{ type: "input_value", name: "LIMIT", check: "Number" }], output: "Boolean", colour: COLORS.percibir, inputsInline: true, tooltip: "Verdadero si la distancia es mayor que 0 y menor que el límite." },
    { type: "tp_time", message0: "tiempo desde el inicio (ms)", output: "Number", colour: COLORS.percibir, tooltip: "Milisegundos desde que empezó el programa." },

    // ── Visión (percibir, simulada) ──
    { type: "tp_sign", message0: "señal que ve la cámara", output: "String", colour: COLORS.vision, tooltip: "Visión simulada: devuelve el nombre de la señal reconocida o 'ninguna'." },
    { type: "tp_sign_is", message0: "la cámara ve %1", args0: [{ type: "field_dropdown", name: "LABEL", options: SIGN_OPTIONS }], output: "Boolean", colour: COLORS.vision, tooltip: "Visión simulada. * = ampliación educativa, no forma parte del ejemplo oficial." },
    { type: "tp_confidence", message0: "confianza simulada (%)", output: "Number", colour: COLORS.vision, tooltip: "Valor inventado por el simulador a partir de distancia y ángulo. No lo calcula un modelo K210." },

    // ── Luces y acciones (actuar) ──
    { type: "tp_icon", message0: "mostrar icono %1", args0: [{ type: "field_dropdown", name: "ICON", options: ICONS }], previousStatement: null, nextStatement: null, colour: COLORS.luces, tooltip: "Muestra un icono en la matriz LED. Como en la micro:bit real, hace una pausa de 0,6 s." },
    { type: "tp_arrow", message0: "mostrar flecha %1", args0: [{ type: "field_dropdown", name: "DIR", options: ARROWS }], previousStatement: null, nextStatement: null, colour: COLORS.luces, tooltip: "Muestra una flecha en la matriz LED (pausa de 0,6 s)." },
    { type: "tp_lights", message0: "luces RGB %1", args0: [{ type: "field_dropdown", name: "COLOR", options: LIGHT_COLORS }], previousStatement: null, nextStatement: null, colour: COLORS.luces, tooltip: "Enciende los dos faros RGB delanteros (Tinybit.RGB_Car_Big)." },
    { type: "tp_horn", message0: "tocar claxon", previousStatement: null, nextStatement: null, colour: COLORS.luces, tooltip: "Un pitido de 0,25 s." },
    { type: "tp_decide", message0: "anotar decisión %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, colour: COLORS.decidir, inputsInline: true, tooltip: "Muestra en pantalla por qué el robot hace lo que hace. Solo existe en el simulador." },

    // ── Estados ──
    { type: "tp_state_set", message0: "cambiar a estado %1", args0: [{ type: "field_dropdown", name: "STATE", options: STATE_OPTIONS }], previousStatement: null, nextStatement: null, colour: COLORS.estados, tooltip: "Cambia el estado de la máquina de estados. Reinicia el reloj del estado." },
    { type: "tp_state_is", message0: "estado es %1", args0: [{ type: "field_dropdown", name: "STATE", options: STATE_OPTIONS }], output: "Boolean", colour: COLORS.estados, tooltip: "Verdadero si la máquina está en ese estado." },
    { type: "tp_state_time", message0: "tiempo en este estado (ms)", output: "Number", colour: COLORS.estados, tooltip: "Milisegundos desde el último cambio de estado." },

    // ── Texto ──
    { type: "tp_join", message0: "unir %1 %2", args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }], output: "String", colour: COLORS.variables, inputsInline: true, tooltip: "Une dos textos o números." },

    // ── Botones de la micro:bit ──
    { type: "tp_on_button", message0: "al presionar el botón %1 %2 %3", args0: [{ type: "field_dropdown", name: "BUTTON", options: [["A", "A"], ["B", "B"]] }, { type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: COLORS.inicio, tooltip: "Se ejecuta cada vez que pulsas ese botón (en el simulador: los botones A y B junto a «Ejecutar»)." },

    // ── Funciones (sin parámetros) ──
    { type: "tp_func_def", message0: "función %1 %2 %3", args0: [{ type: "field_input", name: "NAME", text: "miFuncion" }, { type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: COLORS.funciones, tooltip: "Agrupa bloques con un nombre. Luego úsalos con «llamar»." },
    { type: "tp_func_call", message0: "llamar %1", args0: [{ type: "field_label_serializable", name: "NAME", text: "miFuncion" }], previousStatement: null, nextStatement: null, colour: COLORS.funciones, tooltip: "Ejecuta los bloques de esa función y después continúa." },

    // ── Matriz LED, sonido y luces ──
    { type: "tp_show_number", message0: "mostrar número %1", args0: [{ type: "input_value", name: "NUM", check: "Number" }], previousStatement: null, nextStatement: null, colour: COLORS.luces, inputsInline: true, tooltip: "Como en la micro:bit: una cifra se ve 0,75 s; un número más largo se desplaza (más lento)." },
    { type: "tp_show_string", message0: "mostrar texto %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, colour: COLORS.luces, inputsInline: true, tooltip: "El texto se desplaza por la matriz LED: cada letra tarda 0,9 s." },
    { type: "tp_melody", message0: "tocar melodía %1", args0: [{ type: "field_dropdown", name: "MELODY", options: MELODIES.map((m) => [m.replace(/_/g, " "), m]) }], previousStatement: null, nextStatement: null, colour: COLORS.luces, tooltip: "Melodía de la extensión oficial (Tinybit.Music_Car). Suena de fondo; el simulador toca solo un aviso corto." },
    { type: "tp_lights_rgb", message0: "luces RGB rojo %1 verde %2 azul %3", args0: [{ type: "input_value", name: "R", check: "Number" }, { type: "input_value", name: "G", check: "Number" }, { type: "input_value", name: "B", check: "Number" }], previousStatement: null, nextStatement: null, colour: COLORS.luces, inputsInline: true, tooltip: "Mezcla el color de los faros con valores de 0 a 255 (Tinybit.RGB_Car_Big2)." },

    // ── Matemáticas ──
    { type: "tp_random", message0: "número al azar entre %1 y %2", args0: [{ type: "input_value", name: "FROM", check: "Number" }, { type: "input_value", name: "TO", check: "Number" }], output: "Number", colour: COLORS.matematicas, inputsInline: true, tooltip: "Un entero entre los dos valores (incluidos). En el simulador la secuencia se repite en cada ejecución." },
    { type: "tp_minmax", message0: "%1 de %2 y %3", args0: [{ type: "field_dropdown", name: "OP", options: [["mínimo", "min"], ["máximo", "max"]] }, { type: "input_value", name: "A", check: "Number" }, { type: "input_value", name: "B", check: "Number" }], output: "Number", colour: COLORS.matematicas, inputsInline: true, tooltip: "El menor o el mayor de dos números." },
    { type: "tp_abs", message0: "valor absoluto de %1", args0: [{ type: "input_value", name: "A", check: "Number" }], output: "Number", colour: COLORS.matematicas, inputsInline: true, tooltip: "El número sin signo: −40 → 40." },
    { type: "tp_constrain", message0: "restringir %1 entre %2 y %3", args0: [{ type: "input_value", name: "X", check: "Number" }, { type: "input_value", name: "LOW", check: "Number" }, { type: "input_value", name: "HIGH", check: "Number" }], output: "Number", colour: COLORS.matematicas, inputsInline: true, tooltip: "Mantiene un valor dentro de unos límites (por ejemplo, la velocidad entre 0 y 255)." },
    { type: "tp_map", message0: "convertir %1 de %2 – %3 a %4 – %5", args0: [{ type: "input_value", name: "X", check: "Number" }, { type: "input_value", name: "FL", check: "Number" }, { type: "input_value", name: "FH", check: "Number" }, { type: "input_value", name: "TL", check: "Number" }, { type: "input_value", name: "TH", check: "Number" }], output: "Number", colour: COLORS.matematicas, inputsInline: true, tooltip: "Pasa un valor de una escala a otra; por ejemplo, una distancia de 0–50 cm a una velocidad de 0–200." },
  ]);
}

export type Category = "inicio" | "logica" | "matematicas" | "variables" | "funciones" | "motores" | "sensores" | "vision" | "luces" | "estados";
export const ALL_CATEGORIES: Category[] = ["inicio", "logica", "matematicas", "variables", "funciones", "motores", "sensores", "vision", "luces", "estados"];

const n = (v: number) => ({ shadow: { type: "math_number", fields: { NUM: v } } });
const t = (v: string) => ({ shadow: { type: "text", fields: { TEXT: v } } });

export function toolbox(cats: Category[] = ALL_CATEGORIES) {
  const all: Record<Category, object> = {
    inicio: {
      kind: "category", name: "Inicio y repetición", colour: COLORS.inicio,
      contents: [
        { kind: "block", type: "tp_on_start" },
        { kind: "block", type: "tp_forever" },
        { kind: "block", type: "tp_on_button" },
        { kind: "block", type: "tp_wait", inputs: { MS: n(500) } },
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: n(4) } },
        { kind: "block", type: "controls_whileUntil" },
      ],
    },
    logica: {
      kind: "category", name: "Condiciones y lógica", colour: COLORS.decidir,
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "controls_if", extraState: { hasElse: true } },
        // Cuatro casos ya armados (si / si no si / si no si / si no): el seguidor de línea sin usar el engranaje.
        { kind: "block", type: "controls_if", extraState: { elseIfCount: 2, hasElse: true } },
        { kind: "block", type: "logic_compare", inputs: { A: n(0), B: n(15) } },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "tp_decide", inputs: { TEXT: t("Sigo recto porque veo la línea") } },
      ],
    },
    variables: {
      kind: "category", name: "Variables", colour: COLORS.variables, custom: "VARIABLE",
    },
    motores: {
      kind: "category", name: "Motores", colour: COLORS.actuar,
      contents: [
        { kind: "block", type: "tp_motors", inputs: { LEFT: n(150), RIGHT: n(150) } },
        { kind: "block", type: "tp_drive", inputs: { SPEED: n(150) } },
        { kind: "block", type: "tp_stop" },
      ],
    },
    sensores: {
      kind: "category", name: "Sensores", colour: COLORS.percibir,
      contents: [
        { kind: "block", type: "tp_line" },
        { kind: "block", type: "tp_line_value" },
        { kind: "block", type: "tp_distance" },
        { kind: "block", type: "tp_obstacle", inputs: { LIMIT: n(15) } },
        { kind: "block", type: "tp_time" },
      ],
    },
    vision: {
      kind: "category", name: "Visión (simulada)", colour: COLORS.vision,
      contents: [
        { kind: "block", type: "tp_sign_is" },
        { kind: "block", type: "tp_sign" },
        { kind: "block", type: "tp_confidence" },
      ],
    },
    luces: {
      kind: "category", name: "Luces y acciones", colour: COLORS.luces,
      contents: [
        { kind: "block", type: "tp_icon" },
        { kind: "block", type: "tp_arrow" },
        { kind: "block", type: "tp_lights" },
        { kind: "block", type: "tp_horn" },
        { kind: "block", type: "tp_show_number", inputs: { NUM: n(5) } },
        { kind: "block", type: "tp_show_string", inputs: { TEXT: t("Hola") } },
        { kind: "block", type: "tp_melody" },
        { kind: "block", type: "tp_lights_rgb", inputs: { R: n(255), G: n(120), B: n(0) } },
        { kind: "block", type: "text", fields: { TEXT: "" } },
        { kind: "block", type: "tp_join", inputs: { A: t("distancia: "), B: t("") } },
      ],
    },
    matematicas: {
      kind: "category", name: "Matemáticas", colour: COLORS.matematicas,
      contents: [
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic", inputs: { A: n(1), B: n(1) } },
        { kind: "block", type: "tp_random", inputs: { FROM: n(1), TO: n(10) } },
        { kind: "block", type: "tp_minmax", inputs: { A: n(0), B: n(100) } },
        { kind: "block", type: "tp_abs", inputs: { A: n(-40) } },
        { kind: "block", type: "tp_constrain", inputs: { X: n(300), LOW: n(0), HIGH: n(255) } },
        { kind: "block", type: "tp_map", inputs: { X: n(25), FL: n(0), FH: n(50), TL: n(0), TH: n(200) } },
      ],
    },
    funciones: {
      kind: "category", name: "Funciones", colour: COLORS.funciones, custom: "TP_FUNCIONES",
    },
    estados: {
      kind: "category", name: "Estados", colour: COLORS.estados,
      contents: [
        { kind: "block", type: "tp_state_set" },
        { kind: "block", type: "tp_state_is" },
        { kind: "block", type: "tp_state_time" },
      ],
    },
  };
  return { kind: "categoryToolbox", contents: cats.map((c) => all[c]) } as unknown as Blockly.utils.toolbox.ToolboxDefinition;
}

/**
 * Contenido de la categoría «Funciones»: el bloque para crear una función y
 * un bloque «llamar» por cada función que ya existe en el espacio de trabajo.
 */
export function functionsFlyout(ws: Blockly.WorkspaceSvg): object[] {
  const names = [...new Set(ws.getBlocksByType("tp_func_def", false).map((b) => String(b.getFieldValue("NAME"))))];
  let next = "miFuncion";
  for (let i = 2; names.includes(next); i++) next = `miFuncion${i}`;
  const items: object[] = [
    { kind: "label", text: "1. Crea una función:" },
    { kind: "block", type: "tp_func_def", fields: { NAME: next } },
  ];
  if (names.length) {
    items.push({ kind: "label", text: "2. Llámala donde la necesites:" });
    for (const name of names) items.push({ kind: "block", type: "tp_func_call", fields: { NAME: name } });
  }
  return items;
}
