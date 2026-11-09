/**
 * Exportación a MakeCode (vista JavaScript/TypeScript) para el subconjunto
 * de bloques cuya traducción está verificada contra el código fuente de:
 *   - Tiny-bitLib (namespace Tinybit), github.com/YahboomTechnology/Tiny-bitLib, main.ts v2.0.3
 *   - Núcleo de micro:bit en MakeCode (basic, input, music)
 * Si el programa usa un bloque sin traducción verificada, NO se entrega código
 * como compatible: se informa qué bloques faltan.
 */
import type { Expr, Program, Stmt } from "./ast";

export const TINYBIT_EXT = "https://github.com/YahboomTechnology/Tiny-bitLib";
export const K210_EXT = "https://github.com/YahboomTechnology/K210-Module";

export type MicrobitVersion = "V2" | "V1";

export interface MapRow {
  block: string;
  official: string;
  status: "verificado" | "comentario" | "sin traducción";
  note: string;
}

/** Tabla de correspondencia entre nuestros bloques y los oficiales. */
export const MAPPING: MapRow[] = [
  { block: "al iniciar", official: "on start (código de nivel superior)", status: "verificado", note: "" },
  { block: "repetir continuamente", official: "basic.forever(() => { … })", status: "verificado", note: "Cada vuelta dura al menos 20 ms en ambos." },
  { block: "esperar N ms", official: "basic.pause(N)", status: "verificado", note: "" },
  { block: "repetir N veces / mientras", official: "for / while", status: "verificado", note: "" },
  { block: "si / si no si / si no", official: "if / else if / else", status: "verificado", note: "" },
  { block: "comparaciones, y / o / no, + − × ÷", official: "== != < <= > >= && || ! + - * /", status: "verificado", note: "" },
  { block: "variables (asignar, cambiar)", official: "let x = …; x = …; x += …", status: "verificado", note: "Una variable debe guardar siempre el mismo tipo (número o texto)." },
  { block: "motores izquierdo L derecho R", official: "Tinybit.car_sport(L, R)", status: "verificado", note: "Bloque oficial «Tinybit motor pid motor_left motor_right». Pausa 100 ms al cambiar de sentido (también en el simulador)." },
  { block: "mover … a velocidad V", official: "Tinybit.CarCtrlSpeed(Tinybit.CarState.Car_Run, V)", status: "verificado", note: "Car_Run, Car_Back, Car_Left, Car_Right, Car_SpinLeft, Car_SpinRight." },
  { block: "detener motores", official: "Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)", status: "verificado", note: "" },
  { block: "sensor de línea … ve negro/blanco", official: "Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)", status: "verificado", note: "Lee P13 (izquierdo) y P14 (derecho)." },
  { block: "lectura del sensor (1 = negro)", official: "función auxiliar con Tinybit.Line_Sensor(…, Black): devuelve 1 o 0", status: "verificado", note: "Se usa una función (y no el operador ?:) para que MakeCode pueda mostrarla en bloques." },
  { block: "distancia del ultrasonido (cm)", official: "Tinybit.Ultrasonic_CarV2()  ·  V1: Tinybit.Ultrasonic_Car()", status: "verificado", note: "Devuelve 0 si no hay eco." },
  { block: "obstáculo a menos de N cm", official: "función auxiliar: d > 0 && d < N", status: "verificado", note: "Se genera una función con el ultrasonido oficial." },
  { block: "tiempo desde el inicio (ms)", official: "input.runningTime()", status: "verificado", note: "" },
  { block: "mostrar icono", official: "basic.showIcon(IconNames.Heart)", status: "verificado", note: "Pausa 600 ms (igual en el simulador)." },
  { block: "mostrar flecha", official: "basic.showArrow(ArrowNames.North)", status: "verificado", note: "Pausa 600 ms." },
  { block: "luces RGB", official: "Tinybit.RGB_Car_Big(Tinybit.enColor.Red)", status: "verificado", note: "" },
  { block: "tocar claxon", official: "music.playTone(523, music.beat(BeatFraction.Half))", status: "verificado", note: "Bloque del núcleo de MakeCode, no de la extensión." },
  { block: "estados (cambiar, es, tiempo)", official: "función cambiarEstado(…), variables estado / tEstado + input.runningTime()", status: "verificado", note: "Ampliación educativa traducida con bloques básicos." },
  { block: "unir textos", official: "a + b (texto)", status: "verificado", note: "" },
  { block: "al presionar el botón A / B", official: "input.onButtonPressed(Button.A, () => { … })", status: "verificado", note: "En el simulador, los botones A y B aparecen junto a «Ejecutar»." },
  { block: "función … / llamar …", official: "function nombre() { … } / nombre()", status: "verificado", note: "Funciones sin parámetros, como las de MakeCode." },
  { block: "mostrar número / mostrar texto", official: "basic.showNumber(n) / basic.showString(texto)", status: "verificado", note: "Mismos tiempos en el simulador: una cifra 0,75 s; cada letra que se desplaza 0,9 s." },
  { block: "tocar melodía", official: "Tinybit.Music_Car(Tinybit.enMusic.dadadum)", status: "verificado", note: "Suena de fondo. El simulador solo toca un aviso corto, no la melodía real." },
  { block: "luces RGB rojo verde azul", official: "Tinybit.RGB_Car_Big2(r, g, b)", status: "verificado", note: "Valores de 0 a 255." },
  { block: "número al azar entre A y B", official: "randint(A, B)", status: "verificado", note: "En el simulador la secuencia se repite en cada ejecución (para que sea predecible)." },
  { block: "mínimo / máximo, valor absoluto", official: "Math.min, Math.max, Math.abs", status: "verificado", note: "" },
  { block: "restringir / convertir de una escala a otra", official: "Math.constrain(x, a, b) / Math.map(x, de1, de2, a1, a2)", status: "verificado", note: "" },
  { block: "anotar decisión", official: "— (comentario)", status: "comentario", note: "Solo existe en el simulador; se exporta como comentario." },
  { block: "la cámara ve … / señal que ve la cámara", official: "k210_models.object_detect() + comparación de texto", status: "sin traducción", note: "No se publican en texto las etiquetas que envía el programa oficial del K210 (3.12_Autopilot.py + tinybit_AI.kmodel). Sin ellas no se puede generar una comparación verificada." },
  { block: "confianza simulada (%)", official: "—", status: "sin traducción", note: "Valor inventado por el simulador; el K210 no lo envía a la micro:bit en el protocolo documentado." },
];

const BLOCK_NAME: Record<string, string> = {
  tp_sign: "señal que ve la cámara",
  tp_sign_is: "la cámara ve …",
  tp_confidence: "confianza simulada (%)",
};

export interface ExportResult {
  compatible: boolean;
  code: string;
  missing: { block: string; reason: string; count: number }[];
  extensions: string[];
  notes: string[];
}

const DRIVE: Record<string, string> = { run: "Car_Run", back: "Car_Back", left: "Car_Left", right: "Car_Right", spinleft: "Car_SpinLeft", spinright: "Car_SpinRight" };
/** Nombre de variable válido en TypeScript (sin tildes ni espacios). */
export function safeName(name: string): string {
  let n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "_");
  if (!n || /^[0-9]/.test(n)) n = "v_" + n;
  if (["estado", "tEstado", "hayObstaculo", "cambiarEstado", "lecturaIzquierda", "lecturaDerecha", "nuevo", "let", "function", "if", "else", "for", "while", "return"].includes(n)) n = n + "_";
  return n;
}

const OPS: Record<string, string> = { EQ: "==", NEQ: "!=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" };

export function exportMakeCode(p: Program, version: MicrobitVersion = "V2"): ExportResult {
  const missing = new Map<string, { block: string; reason: string; count: number }>();
  const notes = new Set<string>();
  const types = new Map<string, "number" | "string" | "boolean">();
  let usesObstacle = false, usesState = false;
  const usesLineValue = new Set<"L" | "R">();
  const sonar = version === "V2" ? "Tinybit.Ultrasonic_CarV2()" : "Tinybit.Ultrasonic_Car()";

  const miss = (type: string, reason: string) => {
    const key = BLOCK_NAME[type] ?? type;
    const m = missing.get(key) ?? { block: key, reason, count: 0 };
    m.count += 1;
    missing.set(key, m);
  };
  const str = (s: string) => JSON.stringify(s);
  const kindOf = (e: Expr): "number" | "string" | "boolean" => {
    switch (e.k) {
      case "text": case "join": case "sign": return "string";
      case "bool": case "cmp": case "logic": case "not": case "line": case "obstacle": case "signIs": case "stateIs": return "boolean";
      case "var": return types.get(e.name) ?? "number";
      default: return "number";
    }
  };

  const ex = (e: Expr): string => {
    switch (e.k) {
      case "num": return String(e.v);
      case "bool": return e.v ? "true" : "false";
      case "text": return str(e.v);
      case "var": return safeName(e.name);
      case "cmp": return `${ex(e.a)} ${OPS[e.op]} ${ex(e.b)}`;
      case "logic": return `(${ex(e.a)}) ${e.op === "AND" ? "&&" : "||"} (${ex(e.b)})`;
      case "not": return `!(${ex(e.a)})`;
      case "arith": return `(${ex(e.a)} ${{ ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" }[e.op]} ${ex(e.b)})`;
      case "line": return `Tinybit.Line_Sensor(Tinybit.enPos.${e.side === "L" ? "LeftState" : "RightState"}, Tinybit.enLineState.${e.color === "black" ? "Black" : "White"})`;
      case "lineValue": usesLineValue.add(e.side); return e.side === "L" ? "lecturaIzquierda()" : "lecturaDerecha()";
      case "distance": return sonar;
      case "obstacle": usesObstacle = true; return `hayObstaculo(${ex(e.limit)})`;
      case "time": return "input.runningTime()";
      case "stateIs": usesState = true; return `estado == ${str(e.state)}`;
      case "stateTime": usesState = true; return "(input.runningTime() - tEstado)";
      case "join": return `"" + ${ex(e.a)} + ${ex(e.b)}`;
      case "random": return `randint(${ex(e.a)}, ${ex(e.b)})`;
      case "minmax": return `Math.${e.op}(${ex(e.a)}, ${ex(e.b)})`;
      case "abs": return `Math.abs(${ex(e.a)})`;
      case "constrain": return `Math.constrain(${ex(e.x)}, ${ex(e.a)}, ${ex(e.b)})`;
      case "map": return `Math.map(${ex(e.x)}, ${ex(e.fromLow)}, ${ex(e.fromHigh)}, ${ex(e.toLow)}, ${ex(e.toHigh)})`;
      case "sign": case "signIs": case "confidence":
        miss(e.k === "sign" ? "tp_sign" : e.k === "signIs" ? "tp_sign_is" : "tp_confidence", e.k === "confidence" ? "Valor solo del simulador." : "Etiquetas del K210 no verificadas.");
        return "false /* SIN TRADUCCIÓN */";
      case "unknown": miss(e.type, "Bloque desconocido."); return "0";
    }
  };

  // Primera pasada: tipos de variables.
  const scanTypes = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === "set") {
        const t = kindOf(s.value);
        const prev = types.get(s.name);
        if (prev && prev !== t) notes.add(`La variable «${s.name}» guarda valores de tipos distintos; MakeCode lo rechazaría.`);
        if (!prev) types.set(s.name, t);
      }
      if (s.k === "repeat" || s.k === "while") scanTypes(s.body);
      if (s.k === "if") {
        s.branches.forEach((b) => scanTypes(b.body));
        if (s.otherwise) scanTypes(s.otherwise);
      }
    }
  };
  p.onStart.forEach(scanTypes);
  p.forevers.forEach(scanTypes);
  p.buttons.A.forEach(scanTypes);
  p.buttons.B.forEach(scanTypes);
  Object.values(p.functions).forEach(scanTypes);
  for (const v of p.variables) if (!types.has(v)) types.set(v, "number");

  let loop = 0;
  const st = (list: Stmt[], ind: string): string[] => {
    const out: string[] = [];
    for (const s of list) {
      switch (s.k) {
        case "wait": out.push(`${ind}basic.pause(${ex(s.ms)})`); break;
        case "repeat": {
          const i = `index${loop++ || ""}`;
          out.push(`${ind}for (let ${i} = 0; ${i} < ${ex(s.times)}; ${i}++) {`, ...st(s.body, ind + "    "), `${ind}}`);
          break;
        }
        case "while": out.push(`${ind}while (${s.until ? `!(${ex(s.cond)})` : ex(s.cond)}) {`, ...st(s.body, ind + "    "), `${ind}}`); break;
        case "if":
          s.branches.forEach((b, i) => out.push(`${ind}${i === 0 ? "if" : "} else if"} (${ex(b.cond)}) {`, ...st(b.body, ind + "    ")));
          if (s.otherwise) out.push(`${ind}} else {`, ...st(s.otherwise, ind + "    "));
          out.push(`${ind}}`);
          break;
        case "set": out.push(`${ind}${safeName(s.name)} = ${ex(s.value)}`); break;
        case "change": out.push(`${ind}${safeName(s.name)} += ${ex(s.delta)}`); break;
        case "motors": out.push(`${ind}Tinybit.car_sport(${ex(s.left)}, ${ex(s.right)})`); break;
        case "drive": out.push(`${ind}Tinybit.CarCtrlSpeed(Tinybit.CarState.${DRIVE[s.mode]}, ${ex(s.speed)})`); break;
        case "stop": out.push(`${ind}Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)`); break;
        case "icon": out.push(`${ind}basic.showIcon(IconNames.${s.icon})`); break;
        case "arrow": out.push(`${ind}basic.showArrow(ArrowNames.${s.dir})`); break;
        case "lights": out.push(`${ind}Tinybit.RGB_Car_Big(Tinybit.enColor.${s.color})`); break;
        case "horn": out.push(`${ind}music.playTone(523, music.beat(BeatFraction.Half))`); break;
        case "decide": {
          const t = s.text.k === "text" ? s.text.v : "(texto calculado)";
          out.push(`${ind}// Decisión (solo en el simulador): ${t.replace(/\n/g, " ")}`);
          break;
        }
        case "state":
          usesState = true;
          out.push(`${ind}cambiarEstado(${str(s.state)})`);
          break;
        case "showNumber": out.push(`${ind}basic.showNumber(${ex(s.value)})`); break;
        case "showString": out.push(`${ind}basic.showString(${ex(s.text)})`); break;
        case "melody": out.push(`${ind}Tinybit.Music_Car(Tinybit.enMusic.${s.name})`); break;
        case "lightsRgb": out.push(`${ind}Tinybit.RGB_Car_Big2(${ex(s.r)}, ${ex(s.g)}, ${ex(s.b)})`); break;
        case "call":
          if (!(s.name in p.functions)) notes.add(`Se llama a la función «${s.name}», pero no existe: MakeCode lo rechazaría.`);
          out.push(`${ind}${safeName(s.name)}()`);
          break;
        case "unknown": miss(s.type, "Bloque desconocido."); out.push(`${ind}// SIN TRADUCCIÓN: ${s.type}`); break;
      }
    }
    return out;
  };

  const functionLines = Object.entries(p.functions).flatMap(([name, body]) => [`function ${safeName(name)}() {`, ...st(body, "    "), "}"]);
  const buttonLines = (["A", "B"] as const).flatMap((b) => p.buttons[b].flatMap((body) => [`input.onButtonPressed(Button.${b}, function () {`, ...st(body, "    "), "})"]));
  const startLines = p.onStart.flatMap((list) => st(list, ""));
  const foreverBlocks = p.forevers.map((list) => ["basic.forever(function () {", ...st(list, "    "), "})"]);

  const header = [
    "// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».",
    `// Extensión necesaria en MakeCode: ${TINYBIT_EXT}`,
    `// Placa: micro:bit ${version} (${sonar}).`,
    "// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.",
    "// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.",
  ];
  const decls: string[] = [];
  for (const [name, t] of types) decls.push(`let ${safeName(name)}${t === "string" ? ' = ""' : t === "boolean" ? " = false" : " = 0"}`);
  if (usesState) decls.push('let estado = ""', "let tEstado = 0");
  const helpers: string[] = [];
  for (const side of usesLineValue) {
    const name = side === "L" ? "lecturaIzquierda" : "lecturaDerecha";
    helpers.push(`function ${name}(): number {`, `    if (Tinybit.Line_Sensor(Tinybit.enPos.${side === "L" ? "LeftState" : "RightState"}, Tinybit.enLineState.Black)) {`, "        return 1", "    }", "    return 0", "}");
  }
  if (usesState) helpers.push("function cambiarEstado(nuevo: string) {", "    if (estado != nuevo) {", "        estado = nuevo", "        tEstado = input.runningTime()", "    }", "}");
  if (usesObstacle) helpers.push("function hayObstaculo(limite: number): boolean {", `    let d = ${sonar}`, "    return d > 0 && d < limite", "}");

  const code = [...header, ...decls, ...helpers, ...functionLines, ...buttonLines, ...startLines, ...foreverBlocks.flat()].join("\n") + "\n";
  if (p.loose > 0) notes.add(`Hay ${p.loose} bloque(s) suelto(s) que no se exportan (no están dentro de «al iniciar» ni «repetir continuamente»).`);
  if (p.forevers.length > 1) notes.add("Hay varios «repetir continuamente»: en la micro:bit se ejecutan intercalados, como en el simulador.");
  return {
    compatible: missing.size === 0 && ![...notes].some((n) => n.includes("rechazaría")),
    code,
    missing: [...missing.values()],
    extensions: [TINYBIT_EXT],
    notes: [...notes],
  };
}
