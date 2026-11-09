/**
 * Intérprete de programas. Cada "al iniciar" y cada "repetir continuamente" es
 * un hilo (generador). Los hilos solo ceden el control en las esperas, al final
 * de cada vuelta de "repetir continuamente" o al agotar su presupuesto de
 * operaciones, así la interfaz nunca se bloquea.
 *
 * El tiempo es el de la simulación (ms), no el reloj del ordenador.
 */
import { SIM } from "../core/config";
import type { VisionLabel } from "../core/scenario";
import { Rng } from "../core/sensors";
import type { ButtonName, DriveMode, Expr, Program, StateName, Stmt } from "./ast";

export interface Host {
  now(): number;
  lineBlack(side: "L" | "R"): boolean;
  distance(): number;
  sign(): VisionLabel | null;
  confidence(): number;
  motors(left: number, right: number, source: string): void;
  icon(name: string): void;
  lights(color: string): void;
  horn(): void;
  decide(text: string): void;
  stateChanged(from: StateName | null, to: StateName): void;
  melody(name: string): void;
}

/**
 * Tiempos de basic.showString / showNumber en MakeCode (intervalo 150 ms):
 * un solo carácter se muestra 5 intervalos; un texto más largo se desplaza
 * 6 columnas por carácter más 5 de salida.
 */
export const SHOW_INTERVAL_MS = 150;

/** Texto que muestra basic.showNumber para un número. */
export const numberText = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : "0");

type Event = { t: "block"; id: string } | { t: "sleep"; ms: number } | { t: "tick" };

interface Fiber {
  name: string;
  kind: "inicio" | "siempre" | "boton";
  /** Para hilos de botón: qué manejador ejecuta ("A0", "B1"…). */
  handler?: string;
  gen: Generator<Event, void, void>;
  wakeAt: number;
  current: string | null;
  done: boolean;
  /** El hilo ya avisó del bloque `current` pero aún no lo ha ejecutado. */
  parked: boolean;
}

/** Traducción de los modos oficiales de Tinybit.CarCtrlSpeed a PWM por motor. */
export function driveToPwm(mode: DriveMode, speed: number): [number, number] {
  const s = Math.max(0, Math.min(255, speed));
  switch (mode) {
    case "run": return [s, s];
    case "back": return [-s, -s];
    case "left": return [0, s]; // Car_Left: solo avanza el motor derecho
    case "right": return [s, 0]; // Car_Right: solo avanza el motor izquierdo
    case "spinleft": return [-s, s];
    case "spinright": return [s, -s];
  }
}

/**
 * Igual que la extensión oficial (Tinybit.car_sport y CarCtrlSpeed): cuando
 * cambia el patrón de sentido de los motores, la función hace basic.pause(100).
 * 0 = avanzar, 1 = retroceder, 2 = giro sobre sí a la izquierda, 3 = a la derecha.
 */
export function sportFlag(l: number, r: number): number | null {
  if (l >= 0 && r >= 0) return 0;
  if (l < 0 && r < 0) return 1;
  if (l > 0 && r < 0) return 2;
  if (l < 0 && r > 0) return 3;
  return null;
}
const DRIVE_FLAG: Record<DriveMode, number> = { run: 0, back: 1, left: 0, right: 0, spinleft: 2, spinright: 3 };

export class Interpreter {
  vars = new Map<string, number | string | boolean>();
  /** Último patrón de sentido de los motores (car_flag_old en la extensión). */
  private carFlag = 0;

  private directionChanged(flag: number | null): boolean {
    if (flag === null || flag === this.carFlag) return false;
    this.carFlag = flag;
    return true;
  }
  state: StateName | null = null;
  stateSince = 0;
  fibers: Fiber[] = [];
  running = false;
  error: string | null = null;
  private ops = 0;
  private cursor = 0;
  private startDone = false;
  private program: Program | null = null;
  /** Pulsaciones que llegaron mientras su manejador aún se ejecutaba (se atienden después). */
  private pending = new Set<string>();
  private depth = 0;
  private rng = new Rng(2024);

  constructor(private host: Host) {}

  load(program: Program) {
    this.program = program;
    this.reset();
  }

  /** Detiene todo y borra variables, estado y esperas pendientes. */
  reset() {
    this.vars = new Map();
    this.carFlag = 0;
    for (const v of this.program?.variables ?? []) this.vars.set(v, 0);
    this.state = null;
    this.stateSince = 0;
    this.fibers = [];
    this.running = false;
    this.error = null;
    this.startDone = false;
    this.cursor = 0;
    this.pending.clear();
    this.depth = 0;
    this.rng = new Rng(2024);
  }

  start() {
    if (!this.program) return;
    this.reset();
    this.running = true;
    this.fibers = this.program.onStart.map((body, i) => this.fiber(`al iniciar ${i + 1}`, this.runBlock(body), "inicio"));
    if (this.fibers.length === 0) this.spawnForevers();
  }

  private spawnForevers() {
    if (this.startDone || !this.program) return;
    this.startDone = true;
    this.program.forevers.forEach((body, i) => {
      this.fibers.push(this.fiber(`repetir continuamente ${i + 1}`, this.foreverLoop(body), "siempre"));
    });
  }

  private fiber(name: string, gen: Generator<Event, void, void>, kind: Fiber["kind"], handler?: string): Fiber {
    return { name, kind, handler, gen, wakeAt: this.host.now(), current: null, done: false, parked: false };
  }

  /** ¿El programa tiene bloques «al presionar el botón»? */
  get hasButtons(): boolean {
    return !!this.program && this.program.buttons.A.length + this.program.buttons.B.length > 0;
  }

  /**
   * Pulsación del botón A o B de la micro:bit: cada manejador corre en un hilo
   * propio. Si ese manejador todavía se está ejecutando, la pulsación espera.
   */
  press(button: ButtonName): boolean {
    if (!this.running || !this.program) return false;
    const handlers = this.program.buttons[button];
    handlers.forEach((body, i) => {
      const key = `${button}${i}`;
      if (this.fibers.some((f) => f.handler === key && !f.done)) this.pending.add(key);
      else this.fibers.push(this.fiber(`botón ${button}`, this.runBlock(body), "boton", key));
    });
    return handlers.length > 0;
  }

  /** Bloques que se están ejecutando (para resaltarlos). */
  activeBlocks(): string[] {
    return this.fibers.filter((f) => !f.done && f.current).map((f) => f.current as string);
  }

  /** Ejecuta todos los hilos listos durante un paso de simulación. */
  tick() {
    if (!this.running) return;
    const now = this.host.now();
    this.ops = 0;
    for (const f of [...this.fibers]) {
      if (f.done || f.wakeAt > now + 1e-6) continue;
      this.advance(f, Infinity);
      if (this.error) return;
    }
    this.afterRun();
  }

  /**
   * Modo paso a paso: ejecuta exactamente un bloque del siguiente hilo listo.
   * Devuelve "time" si ese bloque necesita que pase tiempo (esperar o fin de
   * vuelta), para que la simulación avance hasta que el hilo despierte.
   */
  stepOne(): { status: "ok" | "time" | "idle"; fiber?: string } {
    if (!this.running) return { status: "idle" };
    const now = this.host.now();
    const ready = this.fibers.filter((f) => !f.done && f.wakeAt <= now + 1e-6);
    if (ready.length === 0) return { status: "time" };
    const f = ready[this.cursor % ready.length];
    this.cursor += 1;
    this.ops = 0;
    const before = f.wakeAt;
    this.advance(f, 1);
    this.afterRun();
    if (f.wakeAt > before && f.wakeAt > now) return { status: "time", fiber: f.name };
    return { status: "ok", fiber: f.name };
  }

  /** ¿Hay algún hilo listo para ejecutar en este instante? */
  hasReady(): boolean {
    const now = this.host.now();
    return this.fibers.some((f) => !f.done && f.wakeAt <= now + 1e-6);
  }

  /** Deja cada hilo listo detenido justo antes de su siguiente bloque (para resaltarlo). */
  prime() {
    const now = this.host.now();
    for (const f of this.fibers) if (!f.done && !f.parked && f.wakeAt <= now + 1e-6) this.advance(f, 0);
    this.afterRun();
  }

  private afterRun() {
    // Pulsaciones en cola cuyo manejador ya terminó.
    for (const key of [...this.pending]) {
      if (this.fibers.some((f) => f.handler === key && !f.done)) continue;
      this.pending.delete(key);
      const body = this.program?.buttons[key[0] as ButtonName][Number(key.slice(1))];
      if (body) this.fibers.push(this.fiber(`botón ${key[0]}`, this.runBlock(body), "boton", key));
    }
    if (!this.startDone) {
      // Cuando todos los "al iniciar" terminan, comienzan los "repetir continuamente".
      if (this.fibers.filter((f) => f.kind === "inicio").every((f) => f.done)) {
        this.fibers = this.fibers.filter((f) => !f.done);
        this.spawnForevers();
      }
      return;
    }
    this.fibers = this.fibers.filter((f) => !f.done);
    // Sin "repetir continuamente" ni botones, el programa termina; los motores
    // conservan su última orden, igual que en la micro:bit real. Con botones,
    // sigue esperando pulsaciones.
    if (this.fibers.length === 0 && !this.hasButtons) this.running = false;
  }

  /**
   * Hace avanzar un hilo. `blocks` limita cuántos bloques nuevos puede ejecutar
   * (1 en modo paso a paso, infinito en ejecución normal).
   */
  private advance(f: Fiber, blocks: number) {
    let executed = 0;
    while (true) {
      if (this.ops > SIM.opBudget) {
        // Bucle sin esperas: cede el resto de este paso para no congelar la página.
        return;
      }
      if (f.parked) {
        if (executed >= blocks) return;
        f.parked = false;
        executed += 1;
      }
      let res: IteratorResult<Event, void>;
      try {
        res = f.gen.next();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
        this.running = false;
        return;
      }
      if (res.done) {
        f.done = true;
        f.current = null;
        return;
      }
      const ev = res.value;
      this.ops += 1;
      if (ev.t === "block") {
        f.current = ev.id;
        f.parked = true;
        continue;
      }
      if (ev.t === "sleep") {
        f.wakeAt = this.host.now() + ev.ms;
        return;
      }
      if (ev.t === "tick") {
        f.wakeAt = this.host.now() + SIM.foreverPauseMs;
        return;
      }
    }
  }

  private *foreverLoop(body: Stmt[]): Generator<Event, void, void> {
    while (true) {
      yield* this.runBlock(body);
      yield { t: "tick" };
    }
  }

  private *runBlock(list: Stmt[]): Generator<Event, void, void> {
    for (const s of list) yield* this.exec(s);
  }

  private *exec(s: Stmt): Generator<Event, void, void> {
    yield { t: "block", id: s.id };
    switch (s.k) {
      case "wait": {
        const ms = Math.max(0, Number(this.eval(s.ms)) || 0);
        yield { t: "sleep", ms };
        return;
      }
      case "repeat": {
        const n = Math.max(0, Math.floor(Number(this.eval(s.times)) || 0));
        for (let i = 0; i < n; i++) yield* this.runBlock(s.body);
        return;
      }
      case "while": {
        while (Boolean(this.eval(s.cond)) !== s.until) {
          yield* this.runBlock(s.body);
          this.ops += 1;
        }
        return;
      }
      case "if": {
        for (const b of s.branches) {
          if (this.eval(b.cond)) {
            yield* this.runBlock(b.body);
            return;
          }
        }
        if (s.otherwise) yield* this.runBlock(s.otherwise);
        return;
      }
      case "set":
        this.vars.set(s.name, this.eval(s.value));
        return;
      case "change":
        this.vars.set(s.name, (Number(this.vars.get(s.name)) || 0) + (Number(this.eval(s.delta)) || 0));
        return;
      case "motors": {
        const l = Number(this.eval(s.left)) || 0, r = Number(this.eval(s.right)) || 0;
        this.host.motors(l, r, s.id);
        if (this.directionChanged(sportFlag(l, r))) yield { t: "sleep", ms: SIM.directionPauseMs };
        return;
      }
      case "drive": {
        const [l, r] = driveToPwm(s.mode, Number(this.eval(s.speed)) || 0);
        this.host.motors(l, r, s.id);
        if (this.directionChanged(DRIVE_FLAG[s.mode])) yield { t: "sleep", ms: SIM.directionPauseMs };
        return;
      }
      case "stop":
        this.host.motors(0, 0, s.id);
        return;
      case "icon":
        this.host.icon(s.icon);
        yield { t: "sleep", ms: SIM.showIconPauseMs };
        return;
      case "arrow":
        this.host.icon(`flecha-${s.dir}`);
        yield { t: "sleep", ms: SIM.showIconPauseMs };
        return;
      case "lights":
        this.host.lights(s.color);
        return;
      case "horn":
        this.host.horn();
        yield { t: "sleep", ms: SIM.hornMs };
        return;
      case "decide":
        this.host.decide(String(this.eval(s.text)));
        return;
      case "state":
        if (this.state !== s.state) {
          const from = this.state;
          this.state = s.state;
          this.stateSince = this.host.now();
          this.host.stateChanged(from, s.state);
        }
        return;
      case "showNumber":
        yield* this.showText(numberText(Number(this.eval(s.value)) || 0));
        return;
      case "showString":
        yield* this.showText(String(this.eval(s.text)));
        return;
      case "melody":
        // Tinybit.Music_Car usa music.beginMelody: suena de fondo, no detiene el programa.
        this.host.melody(s.name);
        return;
      case "lightsRgb": {
        const c = (e: Expr) => Math.max(0, Math.min(255, Math.round(Number(this.eval(e)) || 0)));
        this.host.lights(`rgb:${c(s.r)},${c(s.g)},${c(s.b)}`);
        return;
      }
      case "call": {
        const body = this.program?.functions[s.name];
        if (!body) throw new Error(`La función «${s.name}» no existe.`);
        if (this.depth >= 32) throw new Error(`Demasiadas llamadas seguidas a «${s.name}»: ¿la función se llama a sí misma sin parar?`);
        this.depth += 1;
        try {
          yield* this.runBlock(body);
        } finally {
          this.depth -= 1;
        }
        return;
      }
      case "unknown":
        return;
    }
  }

  /** Muestra un texto en la matriz LED con los tiempos de la micro:bit. */
  private *showText(text: string): Generator<Event, void, void> {
    if (text.length <= 1) {
      this.host.icon(text ? `letra:${text}` : "");
      yield { t: "sleep", ms: SHOW_INTERVAL_MS * 5 };
      return;
    }
    for (const ch of text) {
      this.host.icon(`letra:${ch}`);
      yield { t: "sleep", ms: SHOW_INTERVAL_MS * 6 };
    }
    this.host.icon("");
    yield { t: "sleep", ms: SHOW_INTERVAL_MS * 5 };
  }

  eval(e: Expr): number | string | boolean {
    this.ops += 1;
    switch (e.k) {
      case "num": return e.v;
      case "bool": return e.v;
      case "text": return e.v;
      case "var": return this.vars.get(e.name) ?? 0;
      case "cmp": {
        const a = this.eval(e.a), b = this.eval(e.b);
        switch (e.op) {
          case "EQ": return a == b; // eslint-disable-line eqeqeq
          case "NEQ": return a != b; // eslint-disable-line eqeqeq
          case "LT": return Number(a) < Number(b);
          case "LTE": return Number(a) <= Number(b);
          case "GT": return Number(a) > Number(b);
          case "GTE": return Number(a) >= Number(b);
        }
        return false;
      }
      case "logic":
        return e.op === "AND" ? Boolean(this.eval(e.a)) && Boolean(this.eval(e.b)) : Boolean(this.eval(e.a)) || Boolean(this.eval(e.b));
      case "not": return !this.eval(e.a);
      case "arith": {
        const a = Number(this.eval(e.a)) || 0, b = Number(this.eval(e.b)) || 0;
        if (e.op === "ADD") return a + b;
        if (e.op === "MINUS") return a - b;
        if (e.op === "MULTIPLY") return a * b;
        return b === 0 ? 0 : a / b;
      }
      case "line": {
        const black = this.host.lineBlack(e.side);
        return e.color === "black" ? black : !black;
      }
      case "lineValue": return this.host.lineBlack(e.side) ? 1 : 0;
      case "distance": return this.host.distance();
      case "obstacle": {
        const d = this.host.distance();
        return d > 0 && d < (Number(this.eval(e.limit)) || 0);
      }
      case "time": return Math.floor(this.host.now());
      case "sign": return this.host.sign() ?? "ninguna";
      case "signIs": return this.host.sign() === e.label;
      case "confidence": return Math.round(this.host.confidence() * 100);
      case "stateIs": return this.state === e.state;
      case "stateTime": return this.state ? Math.floor(this.host.now() - this.stateSince) : 0;
      case "join": return `${this.eval(e.a)}${this.eval(e.b)}`;
      case "random": {
        // Como randint de MakeCode: entero entre los dos valores, ambos incluidos.
        const a = Math.round(Number(this.eval(e.a)) || 0), b = Math.round(Number(this.eval(e.b)) || 0);
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return lo + Math.floor(this.rng.next() * (hi - lo + 1));
      }
      case "minmax": {
        const a = Number(this.eval(e.a)) || 0, b = Number(this.eval(e.b)) || 0;
        return e.op === "max" ? Math.max(a, b) : Math.min(a, b);
      }
      case "abs": return Math.abs(Number(this.eval(e.a)) || 0);
      case "constrain": {
        const x = Number(this.eval(e.x)) || 0, lo = Number(this.eval(e.a)) || 0, hi = Number(this.eval(e.b)) || 0;
        return Math.min(Math.max(x, lo), hi);
      }
      case "map": {
        const x = Number(this.eval(e.x)) || 0, fl = Number(this.eval(e.fromLow)) || 0, fh = Number(this.eval(e.fromHigh)) || 0;
        const tl = Number(this.eval(e.toLow)) || 0, th = Number(this.eval(e.toHigh)) || 0;
        return fh === fl ? tl : ((x - fl) * (th - tl)) / (fh - fl) + tl;
      }
      case "unknown": return 0;
    }
  }
}
