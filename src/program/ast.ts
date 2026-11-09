/**
 * Representación interna de un programa de bloques. Blockly se traduce a este
 * árbol (compile.ts); el intérprete y el exportador a MakeCode trabajan sobre él.
 */
import type { VisionLabel } from "../core/scenario";

export type Side = "L" | "R";
export type DriveMode = "run" | "back" | "left" | "right" | "spinleft" | "spinright";
export type StateName = "SEGUIR_LINEA" | "ESPERAR" | "GIRAR" | "ESTACIONAR" | "RECUPERAR";
export const STATES: StateName[] = ["SEGUIR_LINEA", "ESPERAR", "GIRAR", "ESTACIONAR", "RECUPERAR"];
export const STATE_NAME: Record<StateName, string> = {
  SEGUIR_LINEA: "Seguir línea",
  ESPERAR: "Esperar",
  GIRAR: "Girar",
  ESTACIONAR: "Estacionar",
  RECUPERAR: "Recuperar línea",
};

export type Expr =
  | { k: "num"; v: number }
  | { k: "bool"; v: boolean }
  | { k: "text"; v: string }
  | { k: "var"; name: string }
  | { k: "cmp"; op: "EQ" | "NEQ" | "LT" | "LTE" | "GT" | "GTE"; a: Expr; b: Expr }
  | { k: "logic"; op: "AND" | "OR"; a: Expr; b: Expr }
  | { k: "not"; a: Expr }
  | { k: "arith"; op: "ADD" | "MINUS" | "MULTIPLY" | "DIVIDE"; a: Expr; b: Expr }
  | { k: "line"; side: Side; color: "black" | "white" }
  | { k: "lineValue"; side: Side }
  | { k: "distance" }
  | { k: "obstacle"; limit: Expr }
  | { k: "time" }
  | { k: "sign" }
  | { k: "signIs"; label: VisionLabel }
  | { k: "confidence" }
  | { k: "stateIs"; state: StateName }
  | { k: "stateTime" }
  | { k: "join"; a: Expr; b: Expr }
  | { k: "random"; a: Expr; b: Expr }
  | { k: "minmax"; op: "min" | "max"; a: Expr; b: Expr }
  | { k: "abs"; a: Expr }
  | { k: "constrain"; x: Expr; a: Expr; b: Expr }
  | { k: "map"; x: Expr; fromLow: Expr; fromHigh: Expr; toLow: Expr; toHigh: Expr }
  | { k: "unknown"; type: string };

export type Stmt = { id: string; type: string } & (
  | { k: "wait"; ms: Expr }
  | { k: "repeat"; times: Expr; body: Stmt[] }
  | { k: "while"; until: boolean; cond: Expr; body: Stmt[] }
  | { k: "if"; branches: { cond: Expr; body: Stmt[] }[]; otherwise: Stmt[] | null }
  | { k: "set"; name: string; value: Expr }
  | { k: "change"; name: string; delta: Expr }
  | { k: "motors"; left: Expr; right: Expr }
  | { k: "drive"; mode: DriveMode; speed: Expr }
  | { k: "stop" }
  | { k: "icon"; icon: string }
  | { k: "arrow"; dir: string }
  | { k: "lights"; color: string }
  | { k: "horn" }
  | { k: "decide"; text: Expr }
  | { k: "state"; state: StateName }
  | { k: "showNumber"; value: Expr }
  | { k: "showString"; text: Expr }
  | { k: "melody"; name: string }
  | { k: "lightsRgb"; r: Expr; g: Expr; b: Expr }
  | { k: "call"; name: string }
  | { k: "unknown" }
);

export type ButtonName = "A" | "B";

export interface Program {
  onStart: Stmt[][];
  forevers: Stmt[][];
  /** «al presionar el botón A/B»: cada uno es un hilo nuevo al pulsar. */
  buttons: Record<ButtonName, Stmt[][]>;
  /** Funciones definidas con el bloque «función» (sin parámetros). */
  functions: Record<string, Stmt[]>;
  variables: string[];
  /** Tipos de bloque que el compilador no reconoce. */
  unknown: string[];
  /** Bloques sueltos (no conectados a "al iniciar" ni a "repetir continuamente"). */
  loose: number;
}

/** Recorre todas las instrucciones y expresiones de un programa. */
export function walk(p: Program, onStmt: (s: Stmt) => void, onExpr: (e: Expr) => void = () => {}) {
  const ex = (e: Expr) => {
    onExpr(e);
    // Recorre cualquier subexpresión (a, b, limit, x, fromLow…).
    for (const sub of Object.values(e)) if (sub && typeof sub === "object" && "k" in sub) ex(sub as Expr);
  };
  const st = (list: Stmt[]) => {
    for (const s of list) {
      onStmt(s);
      switch (s.k) {
        case "wait": ex(s.ms); break;
        case "repeat": ex(s.times); st(s.body); break;
        case "while": ex(s.cond); st(s.body); break;
        case "if":
          for (const b of s.branches) { ex(b.cond); st(b.body); }
          if (s.otherwise) st(s.otherwise);
          break;
        case "set": ex(s.value); break;
        case "change": ex(s.delta); break;
        case "motors": ex(s.left); ex(s.right); break;
        case "drive": ex(s.speed); break;
        case "decide": ex(s.text); break;
        case "showNumber": ex(s.value); break;
        case "showString": ex(s.text); break;
        case "lightsRgb": ex(s.r); ex(s.g); ex(s.b); break;
      }
    }
  };
  p.onStart.forEach(st);
  p.forevers.forEach(st);
  p.buttons.A.forEach(st);
  p.buttons.B.forEach(st);
  Object.values(p.functions).forEach(st);
}

/** ¿El programa usa algún bloque de un tipo dado? (para comprobaciones de prácticas) */
export function uses(p: Program, kind: string): boolean {
  let found = false;
  walk(p, (s) => { if (s.k === kind) found = true; }, (e) => { if (e.k === kind) found = true; });
  return found;
}
