/**
 * Pequeño constructor de programas de bloques en formato JSON de Blockly.
 * Sirve para escribir los ejemplos y las pruebas sin dibujar bloques a mano.
 */
import type { BlockJson, WorkspaceJson } from "./compile";
import type { DriveMode, Side, StateName } from "./ast";
import type { VisionLabel } from "../core/scenario";

let counter = 0;
const nid = (p = "b") => `${p}${(++counter).toString(36)}`;

type In = number | string | boolean | BlockJson;

const shadowNum = (v: number): BlockJson => ({ type: "math_number", id: nid("s"), fields: { NUM: v } });
const shadowText = (v: string): BlockJson => ({ type: "text", id: nid("s"), fields: { TEXT: v } });

function numIn(v: In) {
  if (typeof v === "number") return { shadow: shadowNum(v) };
  if (typeof v === "string") return { block: text(v), shadow: shadowNum(0) };
  if (typeof v === "boolean") return { block: bool(v) };
  return { block: v, shadow: shadowNum(0) };
}
function textIn(v: In) {
  if (typeof v === "string") return { shadow: shadowText(v) };
  if (typeof v === "number") return { shadow: shadowText(String(v)) };
  if (typeof v === "boolean") return { block: bool(v) };
  return { block: v, shadow: shadowText("") };
}
function boolIn(v: In) {
  if (typeof v === "boolean") return { block: bool(v) };
  if (typeof v === "number") return { block: num(v) };
  if (typeof v === "string") return { block: text(v) };
  return { block: v };
}

/** Enlaza una lista de bloques de instrucción mediante "next". */
export function seq(list: BlockJson[]): BlockJson | undefined {
  if (list.length === 0) return undefined;
  const copy = list.map((b) => ({ ...b }));
  for (let i = 0; i < copy.length - 1; i++) copy[i].next = { block: copy[i + 1] };
  return copy[0];
}
const stmts = (list: BlockJson[]) => {
  const first = seq(list);
  return first ? { block: first } : {};
};

// ── Valores ──
export const num = (v: number): BlockJson => ({ type: "math_number", id: nid(), fields: { NUM: v } });
export const bool = (v: boolean): BlockJson => ({ type: "logic_boolean", id: nid(), fields: { BOOL: v ? "TRUE" : "FALSE" } });
export const text = (v: string): BlockJson => ({ type: "text", id: nid(), fields: { TEXT: v } });
export const get = (name: string): BlockJson => ({ type: "variables_get", id: nid(), fields: { VAR: { id: `var-${name}` } } });
export const cmp = (a: In, op: "EQ" | "NEQ" | "LT" | "LTE" | "GT" | "GTE", b: In): BlockJson => ({
  type: "logic_compare", id: nid(), fields: { OP: op }, inputs: { A: numIn(a), B: numIn(b) },
});
export const and = (a: In, b: In): BlockJson => ({ type: "logic_operation", id: nid(), fields: { OP: "AND" }, inputs: { A: boolIn(a), B: boolIn(b) } });
export const or = (a: In, b: In): BlockJson => ({ type: "logic_operation", id: nid(), fields: { OP: "OR" }, inputs: { A: boolIn(a), B: boolIn(b) } });
export const not = (a: In): BlockJson => ({ type: "logic_negate", id: nid(), inputs: { BOOL: boolIn(a) } });
export const arith = (a: In, op: "ADD" | "MINUS" | "MULTIPLY" | "DIVIDE", b: In): BlockJson => ({
  type: "math_arithmetic", id: nid(), fields: { OP: op }, inputs: { A: numIn(a), B: numIn(b) },
});
export const join = (a: In, b: In): BlockJson => ({ type: "tp_join", id: nid(), inputs: { A: textIn(a), B: textIn(b) } });

// ── Sensores ──
export const line = (side: Side, color: "black" | "white" = "black"): BlockJson => ({ type: "tp_line", id: nid(), fields: { SIDE: side, COLOR: color } });
export const lineValue = (side: Side): BlockJson => ({ type: "tp_line_value", id: nid(), fields: { SIDE: side } });
export const distance = (): BlockJson => ({ type: "tp_distance", id: nid() });
export const obstacle = (limit: In = 15): BlockJson => ({ type: "tp_obstacle", id: nid(), inputs: { LIMIT: numIn(limit) } });
export const time = (): BlockJson => ({ type: "tp_time", id: nid() });
export const sign = (): BlockJson => ({ type: "tp_sign", id: nid() });
export const signIs = (label: VisionLabel): BlockJson => ({ type: "tp_sign_is", id: nid(), fields: { LABEL: label } });
export const confidence = (): BlockJson => ({ type: "tp_confidence", id: nid() });
export const stateIs = (s: StateName): BlockJson => ({ type: "tp_state_is", id: nid(), fields: { STATE: s } });
export const stateTime = (): BlockJson => ({ type: "tp_state_time", id: nid() });

// ── Instrucciones ──
export const wait = (ms: In): BlockJson => ({ type: "tp_wait", id: nid(), inputs: { MS: numIn(ms) } });
export const motors = (l: In, r: In): BlockJson => ({ type: "tp_motors", id: nid(), inputs: { LEFT: numIn(l), RIGHT: numIn(r) } });
export const drive = (mode: DriveMode, speed: In): BlockJson => ({ type: "tp_drive", id: nid(), fields: { MODE: mode }, inputs: { SPEED: numIn(speed) } });
export const stop = (): BlockJson => ({ type: "tp_stop", id: nid() });
export const icon = (name: string): BlockJson => ({ type: "tp_icon", id: nid(), fields: { ICON: name } });
export const arrow = (dir: string): BlockJson => ({ type: "tp_arrow", id: nid(), fields: { DIR: dir } });
export const lights = (color: string): BlockJson => ({ type: "tp_lights", id: nid(), fields: { COLOR: color } });
export const horn = (): BlockJson => ({ type: "tp_horn", id: nid() });
export const decide = (t: In): BlockJson => ({ type: "tp_decide", id: nid(), inputs: { TEXT: textIn(t) } });
export const setState = (s: StateName): BlockJson => ({ type: "tp_state_set", id: nid(), fields: { STATE: s } });
export const set = (name: string, value: In): BlockJson => ({ type: "variables_set", id: nid(), fields: { VAR: { id: `var-${name}` } }, inputs: { VALUE: numIn(value) } });
export const change = (name: string, delta: In): BlockJson => ({ type: "math_change", id: nid(), fields: { VAR: { id: `var-${name}` } }, inputs: { DELTA: numIn(delta) } });
export const repeat = (times: In, body: BlockJson[]): BlockJson => ({ type: "controls_repeat_ext", id: nid(), inputs: { TIMES: numIn(times), DO: stmts(body) } });
export const whileDo = (cond: In, body: BlockJson[]): BlockJson => ({ type: "controls_whileUntil", id: nid(), fields: { MODE: "WHILE" }, inputs: { BOOL: boolIn(cond), DO: stmts(body) } });
export const untilDo = (cond: In, body: BlockJson[]): BlockJson => ({ type: "controls_whileUntil", id: nid(), fields: { MODE: "UNTIL" }, inputs: { BOOL: boolIn(cond), DO: stmts(body) } });

/** si / si no si / si no. `branches` es una lista de [condición, cuerpo]. */
export function ifElse(branches: [In, BlockJson[]][], otherwise?: BlockJson[]): BlockJson {
  const inputs: Record<string, { block?: BlockJson; shadow?: BlockJson }> = {};
  branches.forEach(([c, body], i) => {
    inputs[`IF${i}`] = boolIn(c);
    inputs[`DO${i}`] = stmts(body);
  });
  if (otherwise) inputs.ELSE = stmts(otherwise);
  return { type: "controls_if", id: nid(), extraState: { elseIfCount: branches.length - 1, hasElse: Boolean(otherwise) }, inputs } as BlockJson;
}
export const when = (c: In, body: BlockJson[], otherwise?: BlockJson[]) => ifElse([[c, body]], otherwise);

// ── Eventos y espacio de trabajo ──
export const onStart = (body: BlockJson[], x = 20, y = 20): BlockJson => ({ type: "tp_on_start", id: nid("h"), x, y, inputs: { DO: stmts(body) } });
export const forever = (body: BlockJson[], x = 20, y = 260): BlockJson => ({ type: "tp_forever", id: nid("h"), x, y, inputs: { DO: stmts(body) } });

export function workspace(top: BlockJson[]): WorkspaceJson {
  const names = new Set<string>();
  const scan = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const b = o as Record<string, unknown>;
    if (b.fields && typeof b.fields === "object") {
      const v = (b.fields as Record<string, unknown>).VAR as { id?: string } | undefined;
      if (v && typeof v.id === "string" && v.id.startsWith("var-")) names.add(v.id.slice(4));
    }
    for (const val of Object.values(b)) if (val && typeof val === "object") scan(val);
  };
  top.forEach(scan);
  return {
    blocks: { languageVersion: 0, blocks: top },
    variables: [...names].map((n) => ({ name: n, id: `var-${n}` })),
  };
}

// ── Bloques añadidos: botones, funciones, matriz LED, sonido, RGB y matemáticas ──
export const onButton = (button: "A" | "B", body: BlockJson[], x = 320, y = 20): BlockJson => ({ type: "tp_on_button", id: nid("h"), x, y, fields: { BUTTON: button }, inputs: { DO: stmts(body) } });
export const funcDef = (name: string, body: BlockJson[], x = 320, y = 260): BlockJson => ({ type: "tp_func_def", id: nid("h"), x, y, fields: { NAME: name }, inputs: { DO: stmts(body) } });
export const call = (name: string): BlockJson => ({ type: "tp_func_call", id: nid(), fields: { NAME: name } });
export const showNumber = (v: In): BlockJson => ({ type: "tp_show_number", id: nid(), inputs: { NUM: numIn(v) } });
export const showString = (t: In): BlockJson => ({ type: "tp_show_string", id: nid(), inputs: { TEXT: textIn(t) } });
export const melody = (name: string): BlockJson => ({ type: "tp_melody", id: nid(), fields: { MELODY: name } });
export const lightsRgb = (r: In, g: In, b: In): BlockJson => ({ type: "tp_lights_rgb", id: nid(), inputs: { R: numIn(r), G: numIn(g), B: numIn(b) } });
export const random = (a: In, b: In): BlockJson => ({ type: "tp_random", id: nid(), inputs: { FROM: numIn(a), TO: numIn(b) } });
export const minmax = (op: "min" | "max", a: In, b: In): BlockJson => ({ type: "tp_minmax", id: nid(), fields: { OP: op }, inputs: { A: numIn(a), B: numIn(b) } });
export const abs = (a: In): BlockJson => ({ type: "tp_abs", id: nid(), inputs: { A: numIn(a) } });
export const constrain = (x: In, lo: In, hi: In): BlockJson => ({ type: "tp_constrain", id: nid(), inputs: { X: numIn(x), LOW: numIn(lo), HIGH: numIn(hi) } });
export const mapRange = (x: In, fl: In, fh: In, tl: In, th: In): BlockJson => ({ type: "tp_map", id: nid(), inputs: { X: numIn(x), FL: numIn(fl), FH: numIn(fh), TL: numIn(tl), TH: numIn(th) } });
