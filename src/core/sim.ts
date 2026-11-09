/**
 * Simulación compartida por todas las vistas. Avanza con un paso fijo de
 * 20 ms: lee sensores → ejecuta el programa → mueve el robot → comprueba choques.
 */
import { ROBOT, SIM } from "./config";
import { chassisCenter, clampPwm, createRobot, stepMotors, type RobotState } from "./robot";
import { cloneScenario, VISION_LABEL_NAME, type Scenario, type VisionLabel } from "./scenario";
import { SensorSuite, type SensorSnapshot } from "./sensors";
import { World } from "./world";
import { Interpreter, type Host } from "../program/interpreter";
import { STATE_NAME, type Program, type StateName } from "../program/ast";

export type Mode = "manual" | "programa";

export interface LogEntry {
  t: number;
  kind: "decision" | "estado" | "evento" | "error";
  text: string;
}

export type SimEvent =
  | { type: "log"; entry: LogEntry }
  | { type: "mode"; mode: Mode }
  | { type: "run"; running: boolean }
  | { type: "reset" }
  | { type: "scenario" }
  | { type: "horn" }
  | { type: "melody"; name: string }
  | { type: "pause"; paused: boolean };

export class Sim {
  scenario: Scenario;
  world: World;
  robot: RobotState;
  readonly sensors = new SensorSuite();
  readonly interp: Interpreter;
  /** Tiempo de simulación (s) desde que se cargó o reinició el escenario. */
  time = 0;
  /** Momento (s) en que empezó el programa actual: su "tiempo desde el inicio". */
  programStart = 0;
  paused = false;
  mode: Mode = "manual";
  now!: SensorSnapshot;
  seen!: SensorSnapshot;
  decision: { text: string; t: number } | null = null;
  lastAction: { left: number; right: number; block: string | null } = { left: 0, right: 0, block: null };
  log: LogEntry[] = [];
  trail: [number, number][] = [];
  collisions = 0;
  /** Veces que sonó el claxon y que se pulsaron A y B desde «Ejecutar». */
  horns = 0;
  presses = { A: 0, B: 0 };
  program: Program | null = null;
  /** Se llama tras cada paso fijo (comprobaciones de las prácticas). */
  observers = new Set<(sim: Sim) => void>();
  private listeners = new Set<(e: SimEvent) => void>();
  private accumulator = 0;
  private lostSince: number | null = null;
  private lostLogged = false;
  private bumpedLogged: string | null = null;

  constructor(scenario: Scenario) {
    this.scenario = cloneScenario(scenario);
    this.world = new World(this.scenario);
    this.robot = createRobot(this.scenario.start);
    const sim = this;
    const host: Host = {
      now: () => (sim.time - sim.programStart) * 1000,
      lineBlack: (side) => (side === "L" ? sim.seen.lineLeft : sim.seen.lineRight) === 1,
      distance: () => sim.seen.distance,
      sign: () => sim.seen.vision.label,
      confidence: () => sim.seen.vision.confidence,
      motors: (l, r, block) => {
        sim.robot.cmd = { left: clampPwm(l), right: clampPwm(r) };
        sim.lastAction = { left: sim.robot.cmd.left, right: sim.robot.cmd.right, block };
      },
      icon: (name) => { sim.robot.icon = name; },
      lights: (color) => { sim.robot.lights = color; },
      horn: () => {
        sim.horns += 1;
        sim.emit({ type: "horn" });
      },
      melody: (name) => sim.emit({ type: "melody", name }),
      decide: (text) => sim.decide(text),
      stateChanged: (from, to) => sim.addLog("estado", `${from ? STATE_NAME[from] : "inicio"} → ${STATE_NAME[to]}`),
    };
    this.interp = new Interpreter(host);
    this.refreshSensors();
  }

  on(fn: (e: SimEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: SimEvent) {
    for (const fn of this.listeners) fn(e);
  }

  addLog(kind: LogEntry["kind"], text: string) {
    const entry = { t: this.time, kind, text };
    this.log.push(entry);
    if (this.log.length > 80) this.log.shift();
    this.emit({ type: "log", entry });
  }

  decide(text: string) {
    const changed = !this.decision || this.decision.text !== text;
    this.decision = { text, t: this.time };
    if (changed) this.addLog("decision", text);
  }

  refreshSensors() {
    const { now, seen } = this.sensors.read(this.world, this.robot, this.time);
    this.now = now;
    this.seen = seen;
  }

  // ───────────── Escenario y robot ─────────────

  setScenario(s: Scenario) {
    this.stopProgram();
    this.scenario = cloneScenario(s);
    this.world = new World(this.scenario);
    this.resetWorld();
    this.emit({ type: "scenario" });
  }

  /** Vuelve a construir el entorno tras editar el escenario (conserva el robot). */
  rebuildWorld() {
    const removed = this.world.removed;
    this.world = new World(this.scenario);
    this.world.removed = removed;
    this.sensors.invalidateVision();
    this.refreshSensors();
    this.emit({ type: "scenario" });
  }

  /** Robot a la salida, tiempo a cero, objetos restaurados, programa detenido. */
  resetWorld() {
    this.interp.reset();
    this.robot = createRobot(this.scenario.start);
    this.world.reset();
    this.sensors.reset();
    this.time = 0;
    this.programStart = 0;
    this.accumulator = 0;
    this.trail = [];
    this.decision = null;
    this.lastAction = { left: 0, right: 0, block: null };
    this.collisions = 0;
    this.lostSince = null;
    this.lostLogged = false;
    this.bumpedLogged = null;
    this.log = [];
    this.refreshSensors();
    this.emit({ type: "reset" });
    this.emit({ type: "run", running: false });
  }

  placeRobot(x: number, y: number, heading: number) {
    this.robot.x = x;
    this.robot.y = y;
    this.robot.heading = heading;
    this.robot.vLeft = this.robot.vRight = 0;
    this.trail = [];
    this.sensors.invalidateVision();
    this.refreshSensors();
  }

  // ───────────── Modos y control ─────────────

  setMode(mode: Mode) {
    if (this.mode === mode) return;
    if (mode === "manual") this.stopProgram();
    this.robot.cmd = { left: 0, right: 0 };
    this.mode = mode;
    this.emit({ type: "mode", mode });
  }

  /** Órdenes del control manual. Se ignoran si un programa tiene el mando. */
  setManual(left: number, right: number): boolean {
    if (this.mode !== "manual") return false;
    this.robot.cmd = { left: clampPwm(left), right: clampPwm(right) };
    this.lastAction = { left: this.robot.cmd.left, right: this.robot.cmd.right, block: null };
    return true;
  }

  loadProgram(p: Program) {
    this.program = p;
    this.interp.load(p);
    this.emit({ type: "run", running: false });
  }

  /** Ejecuta el programa desde la posición actual del robot. */
  runProgram() {
    if (!this.program) return;
    this.setMode("programa");
    this.robot.cmd = { left: 0, right: 0 };
    this.robot.icon = "";
    this.robot.lights = "apagadas";
    this.decision = null;
    this.horns = 0;
    this.presses = { A: 0, B: 0 };
    this.programStart = this.time;
    this.interp.load(this.program);
    this.interp.start();
    this.paused = false;
    this.addLog("evento", "Programa en marcha");
    this.emit({ type: "run", running: true });
    this.emit({ type: "pause", paused: false });
  }

  /** Detiene el programa y los motores; no quedan esperas pendientes. */
  stopProgram() {
    const was = this.interp.running;
    this.interp.reset();
    this.robot.cmd = { left: 0, right: 0 };
    if (was) {
      this.addLog("evento", "Programa detenido");
      this.emit({ type: "run", running: false });
    }
  }

  emergencyStop() {
    this.interp.reset();
    this.robot.cmd = { left: 0, right: 0 };
    this.robot.vLeft = 0;
    this.robot.vRight = 0;
    this.addLog("evento", "PARADA DE EMERGENCIA: motores a 0 y programa detenido");
    this.emit({ type: "run", running: false });
    if (this.mode !== "manual") {
      this.mode = "manual";
      this.emit({ type: "mode", mode: "manual" });
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.accumulator = 0;
    this.emit({ type: "pause", paused: p });
  }

  /**
   * Depuración paso a paso: ejecuta un bloque. El tiempo solo avanza si ese
   * bloque es una espera o el final de una vuelta de "repetir continuamente".
   */
  stepProgram(): string {
    if (!this.interp.running) return "El programa no está en marcha.";
    this.paused = true;
    let r = this.interp.stepOne();
    let advanced = 0;
    if (r.status === "time") {
      for (let i = 0; i < 3000; i++) {
        this.refreshSensors();
        this.physics();
        advanced += SIM.dt;
        if (this.interp.hasReady()) break;
      }
      this.interp.prime();
      r = { status: "ok" };
    }
    this.refreshSensors();
    return advanced > 0 ? `Avanzó ${Math.round(advanced * 1000)} ms de simulación.` : "Bloque ejecutado (sin avanzar el tiempo).";
  }

  // ───────────── Bucle ─────────────

  /** Avanza el tiempo real transcurrido (s) en pasos fijos. */
  update(realDt: number, speed = 1) {
    if (this.paused) return;
    this.accumulator += Math.min(realDt, 0.1) * speed;
    let steps = 0;
    while (this.accumulator >= SIM.dt && steps < 12) {
      this.tick();
      this.accumulator -= SIM.dt;
      steps += 1;
    }
  }

  /** Un paso fijo completo. */
  tick() {
    this.refreshSensors();
    if (this.mode === "programa" && this.interp.running) {
      this.interp.tick();
      if (this.interp.error) this.addLog("error", `Error del programa: ${this.interp.error}`);
      if (!this.interp.running) this.emit({ type: "run", running: false });
    }
    this.physics();
  }

  /** Movimiento, choques, semáforos y obstáculos (sin ejecutar el programa). */
  physics() {
    const dt = SIM.dt;
    const r = this.robot;
    const next = stepMotors(r, dt);
    const [cx, cy] = chassisCenter(next);
    const hit = this.world.collide(cx, cy, ROBOT.collisionRadius);
    if (hit) {
      // El chasis no atraviesa nada: el movimiento se bloquea y las ruedas se frenan.
      r.vLeft = 0;
      r.vRight = 0;
      r.bumped = hit;
      if (this.bumpedLogged !== hit) {
        this.collisions += 1;
        this.addLog("evento", `¡Choque con ${hit}!`);
        this.bumpedLogged = hit;
      }
    } else {
      r.x = next.x;
      r.y = next.y;
      r.heading = next.heading;
      r.odometer += next.dist;
      r.turned += next.dTheta;
      if (r.bumped && Math.hypot(r.vLeft, r.vRight) > 0.5) {
        r.bumped = null;
        this.bumpedLogged = null;
      }
    }
    this.time += dt;
    this.updateObstacles(dt);
    this.trackLine();
    if (this.trail.length === 0 || Math.hypot(r.x - this.trail[this.trail.length - 1][0], r.y - this.trail[this.trail.length - 1][1]) > 1) {
      this.trail.push([r.x, r.y]);
      if (this.trail.length > 3000) this.trail.shift();
    }
    for (const fn of this.observers) fn(this);
  }

  private updateObstacles(dt: number) {
    const speed = Math.abs(this.robot.vLeft) + Math.abs(this.robot.vRight);
    for (const o of this.world.obstacles()) {
      if (!o.leavesAfterStop || this.world.removed.has(o.id)) continue;
      const facing = this.now.sonarId === o.id && this.now.distance > 0 && this.now.distance < 35;
      if (facing && speed < 1) {
        const w = (this.world.waitedBy.get(o.id) ?? 0) + dt;
        this.world.waitedBy.set(o.id, w);
        if (w >= o.leavesAfterStop) {
          this.world.removed.add(o.id);
          this.addLog("evento", "La persona terminó de cruzar");
        }
      }
    }
  }

  private trackLine() {
    const lost = this.now.lineLeft === 0 && this.now.lineRight === 0;
    if (lost) {
      if (this.lostSince === null) this.lostSince = this.time;
      if (!this.lostLogged && this.time - this.lostSince > 0.6) {
        this.addLog("evento", "Los dos sensores ven blanco: línea perdida");
        this.lostLogged = true;
      }
    } else {
      if (this.lostLogged) this.addLog("evento", "Línea encontrada otra vez");
      this.lostSince = null;
      this.lostLogged = false;
    }
  }

  /** Botón A o B de la micro:bit (solo con un programa en marcha). */
  pressButton(button: "A" | "B"): boolean {
    if (this.mode !== "programa" || !this.interp.running) return false;
    const used = this.interp.press(button);
    if (used) {
      this.presses[button] += 1;
      this.addLog("evento", `Botón ${button} pulsado`);
    }
    return used;
  }

  /** Velocidad de avance del robot (cm/s). */
  get speed(): number {
    return (this.robot.vLeft + this.robot.vRight) / 2;
  }

  get programTimeMs(): number {
    return (this.time - this.programStart) * 1000;
  }

  visionText(label: VisionLabel | null): string {
    return label ? VISION_LABEL_NAME[label] : "ninguna";
  }

  get state(): StateName | null {
    return this.interp.state;
  }
}
