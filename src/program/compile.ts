/**
 * Traduce el JSON de Blockly (Blockly.serialization.workspaces.save) al árbol
 * del intérprete. No depende de Blockly, así que también funciona en las pruebas.
 */
import type { VisionLabel } from "../core/scenario";
import type { DriveMode, Expr, Program, Side, StateName, Stmt } from "./ast";

export interface BlockJson {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block?: BlockJson };
  extraState?: Record<string, unknown>;
  deletable?: boolean;
  movable?: boolean;
}

export interface WorkspaceJson {
  blocks?: { languageVersion?: number; blocks?: BlockJson[] };
  variables?: { name: string; id: string }[];
}

export function compileWorkspace(ws: WorkspaceJson): Program {
  const varNames = new Map<string, string>();
  for (const v of ws.variables ?? []) varNames.set(v.id, v.name);
  const unknown = new Set<string>();
  let uid = 0;

  const varName = (field: unknown): string => {
    if (field && typeof field === "object") {
      const f = field as { id?: string; name?: string };
      if (f.id && varNames.has(f.id)) return varNames.get(f.id)!;
      if (f.name) return f.name;
      if (f.id) return f.id;
    }
    return String(field ?? "x");
  };

  const inputBlock = (b: BlockJson, name: string): BlockJson | undefined => b.inputs?.[name]?.block ?? b.inputs?.[name]?.shadow;
  const field = (b: BlockJson, name: string) => b.fields?.[name];

  const expr = (b: BlockJson | undefined, fallback: Expr): Expr => {
    if (!b) return fallback;
    const val = (name: string, fb: Expr) => expr(inputBlock(b, name), fb);
    switch (b.type) {
      case "math_number": return { k: "num", v: Number(field(b, "NUM")) || 0 };
      case "logic_boolean": return { k: "bool", v: field(b, "BOOL") === "TRUE" };
      case "text": return { k: "text", v: String(field(b, "TEXT") ?? "") };
      case "variables_get": return { k: "var", name: varName(field(b, "VAR")) };
      case "logic_compare": return { k: "cmp", op: (field(b, "OP") as never) ?? "EQ", a: val("A", { k: "num", v: 0 }), b: val("B", { k: "num", v: 0 }) };
      case "logic_operation": return { k: "logic", op: field(b, "OP") === "OR" ? "OR" : "AND", a: val("A", { k: "bool", v: false }), b: val("B", { k: "bool", v: false }) };
      case "logic_negate": return { k: "not", a: val("BOOL", { k: "bool", v: false }) };
      case "math_arithmetic": {
        const op = String(field(b, "OP") ?? "ADD");
        if (!["ADD", "MINUS", "MULTIPLY", "DIVIDE"].includes(op)) unknown.add(`math_arithmetic:${op}`);
        return { k: "arith", op: (["ADD", "MINUS", "MULTIPLY", "DIVIDE"].includes(op) ? op : "ADD") as never, a: val("A", { k: "num", v: 0 }), b: val("B", { k: "num", v: 0 }) };
      }
      case "tp_line": return { k: "line", side: (field(b, "SIDE") as Side) ?? "L", color: field(b, "COLOR") === "white" ? "white" : "black" };
      case "tp_line_value": return { k: "lineValue", side: (field(b, "SIDE") as Side) ?? "L" };
      case "tp_distance": return { k: "distance" };
      case "tp_obstacle": return { k: "obstacle", limit: val("LIMIT", { k: "num", v: 15 }) };
      case "tp_time": return { k: "time" };
      case "tp_sign": return { k: "sign" };
      case "tp_sign_is": return { k: "signIs", label: String(field(b, "LABEL") ?? "izquierda") as VisionLabel };
      case "tp_confidence": return { k: "confidence" };
      case "tp_state_is": return { k: "stateIs", state: String(field(b, "STATE") ?? "SEGUIR_LINEA") as StateName };
      case "tp_state_time": return { k: "stateTime" };
      case "tp_join": return { k: "join", a: val("A", { k: "text", v: "" }), b: val("B", { k: "text", v: "" }) };
      case "tp_random": return { k: "random", a: val("FROM", { k: "num", v: 0 }), b: val("TO", { k: "num", v: 10 }) };
      case "tp_minmax": return { k: "minmax", op: field(b, "OP") === "max" ? "max" : "min", a: val("A", { k: "num", v: 0 }), b: val("B", { k: "num", v: 0 }) };
      case "tp_abs": return { k: "abs", a: val("A", { k: "num", v: 0 }) };
      case "tp_constrain": return { k: "constrain", x: val("X", { k: "num", v: 0 }), a: val("LOW", { k: "num", v: 0 }), b: val("HIGH", { k: "num", v: 0 }) };
      case "tp_map":
        return { k: "map", x: val("X", { k: "num", v: 0 }), fromLow: val("FL", { k: "num", v: 0 }), fromHigh: val("FH", { k: "num", v: 1 }), toLow: val("TL", { k: "num", v: 0 }), toHigh: val("TH", { k: "num", v: 1 }) };
      default:
        unknown.add(b.type);
        return { k: "unknown", type: b.type };
    }
  };

  const stmt = (b: BlockJson): Stmt => {
    const id = b.id ?? `b${++uid}`;
    const base = { id, type: b.type };
    const val = (name: string, fb: Expr) => expr(inputBlock(b, name), fb);
    const body = (name: string) => chain(b.inputs?.[name]?.block);
    switch (b.type) {
      case "tp_wait": return { ...base, k: "wait", ms: val("MS", { k: "num", v: 0 }) };
      case "controls_repeat_ext": return { ...base, k: "repeat", times: val("TIMES", { k: "num", v: 0 }), body: body("DO") };
      case "controls_whileUntil": return { ...base, k: "while", until: field(b, "MODE") === "UNTIL", cond: val("BOOL", { k: "bool", v: false }), body: body("DO") };
      case "controls_if": {
        const extra = b.extraState ?? {};
        const elseIfs = Number(extra.elseIfCount ?? 0);
        const branches = [];
        for (let i = 0; i <= elseIfs; i++) branches.push({ cond: val(`IF${i}`, { k: "bool", v: false }), body: body(`DO${i}`) });
        return { ...base, k: "if", branches, otherwise: extra.hasElse ? body("ELSE") : null };
      }
      case "variables_set": return { ...base, k: "set", name: varName(field(b, "VAR")), value: val("VALUE", { k: "num", v: 0 }) };
      case "math_change": return { ...base, k: "change", name: varName(field(b, "VAR")), delta: val("DELTA", { k: "num", v: 1 }) };
      case "tp_motors": return { ...base, k: "motors", left: val("LEFT", { k: "num", v: 0 }), right: val("RIGHT", { k: "num", v: 0 }) };
      case "tp_drive": return { ...base, k: "drive", mode: (field(b, "MODE") as DriveMode) ?? "run", speed: val("SPEED", { k: "num", v: 0 }) };
      case "tp_stop": return { ...base, k: "stop" };
      case "tp_icon": return { ...base, k: "icon", icon: String(field(b, "ICON") ?? "Heart") };
      case "tp_arrow": return { ...base, k: "arrow", dir: String(field(b, "DIR") ?? "North") };
      case "tp_lights": return { ...base, k: "lights", color: String(field(b, "COLOR") ?? "OFF") };
      case "tp_horn": return { ...base, k: "horn" };
      case "tp_decide": return { ...base, k: "decide", text: val("TEXT", { k: "text", v: "" }) };
      case "tp_state_set": return { ...base, k: "state", state: String(field(b, "STATE") ?? "SEGUIR_LINEA") as StateName };
      case "tp_show_number": return { ...base, k: "showNumber", value: val("NUM", { k: "num", v: 0 }) };
      case "tp_show_string": return { ...base, k: "showString", text: val("TEXT", { k: "text", v: "" }) };
      case "tp_melody": return { ...base, k: "melody", name: String(field(b, "MELODY") ?? "dadadum") };
      case "tp_lights_rgb": return { ...base, k: "lightsRgb", r: val("R", { k: "num", v: 0 }), g: val("G", { k: "num", v: 0 }), b: val("B", { k: "num", v: 0 }) };
      case "tp_func_call": return { ...base, k: "call", name: String(field(b, "NAME") ?? "") };
      default:
        unknown.add(b.type);
        return { ...base, k: "unknown" };
    }
  };

  const chain = (first: BlockJson | undefined): Stmt[] => {
    const out: Stmt[] = [];
    let b = first;
    while (b) {
      out.push(stmt(b));
      b = b.next?.block;
    }
    return out;
  };

  const program: Program = { onStart: [], forevers: [], buttons: { A: [], B: [] }, functions: {}, variables: [...varNames.values()], unknown: [], loose: 0 };
  for (const top of ws.blocks?.blocks ?? []) {
    if (top.type === "tp_on_start") program.onStart.push(chain(top.inputs?.DO?.block));
    else if (top.type === "tp_forever") program.forevers.push(chain(top.inputs?.DO?.block));
    else if (top.type === "tp_on_button") program.buttons[field(top, "BUTTON") === "B" ? "B" : "A"].push(chain(top.inputs?.DO?.block));
    else if (top.type === "tp_func_def") program.functions[String(field(top, "NAME") ?? "").trim() || "sinNombre"] = chain(top.inputs?.DO?.block);
    else program.loose += 1;
  }
  program.unknown = [...unknown];
  return program;
}
