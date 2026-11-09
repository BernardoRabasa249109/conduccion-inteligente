/**
 * Comprobaciones basadas en el comportamiento observado. Cada práctica crea un
 * "verificador" que mira la simulación en cada paso de 20 ms y marca hechos:
 * detenerse, no chocar, llegar a una zona, reducir la velocidad…
 * Pulsar "Ejecutar" no basta: lo que cuenta es lo que hace el robot.
 */
import { ROBOT } from "../core/config";
import { chassisCenter } from "../core/robot";
import { inRect, type LightObject, type Rect } from "../core/scenario";
import type { Sim } from "../core/sim";
import type { Program } from "../program/ast";

export interface CheckItem {
  id: string;
  text: string;
  /** null = aún sin decidir; false = incumplido (por ejemplo, hubo un choque). */
  ok: boolean | null;
}

export interface Checker {
  items: CheckItem[];
  /** Se llama en cada paso fijo de la simulación. */
  tick(sim: Sim): void;
  /** Eventos de la interfaz (respuestas del cuestionario, etc.). */
  event?(name: string, data?: unknown): void;
  /** El programa que se acaba de ejecutar (para comprobaciones de estructura). */
  program?(p: Program): void;
}

export const done = (c: Checker) => c.items.length > 0 && c.items.every((i) => i.ok === true);

/** Ayudante: crea la lista y devuelve funciones para marcar. */
export function itemList(defs: [string, string][]) {
  const items: CheckItem[] = defs.map(([id, text]) => ({ id, text, ok: null }));
  const get = (id: string) => items.find((i) => i.id === id)!;
  return {
    items,
    pass: (id: string) => {
      const it = get(id);
      if (it.ok === null) it.ok = true;
    },
    fail: (id: string) => {
      get(id).ok = false;
    },
    is: (id: string) => get(id).ok,
  };
}

export const stopped = (sim: Sim) => Math.abs(sim.robot.vLeft) < 0.4 && Math.abs(sim.robot.vRight) < 0.4;
export const inZone = (sim: Sim, r: Rect, margin = 0) => {
  const [x, y] = chassisCenter(sim.robot);
  return inRect(r, x, y, margin);
};

/** Seguimiento de "detenido durante N s" dentro de una condición. */
export class Hold {
  private since: number | null = null;
  constructor(private seconds: number) {}
  update(sim: Sim, cond: boolean): boolean {
    if (!cond) {
      this.since = null;
      return false;
    }
    if (this.since === null) this.since = sim.time;
    return sim.time - this.since >= this.seconds;
  }
}

/** Promedio de velocidad de avance mientras se cumple una condición. */
export class SpeedMeter {
  sum = 0;
  t = 0;
  add(sim: Sim, cond: boolean, dt = 0.02) {
    if (!cond) return;
    this.sum += Math.max(0, sim.speed) * dt;
    this.t += dt;
  }
  get avg() {
    return this.t > 0 ? this.sum / this.t : 0;
  }
}

/** Marca "sin choques" como incumplido si el robot choca. */
export function watchCollisions(sim: Sim, list: ReturnType<typeof itemList>, id = "sin-choques") {
  if (sim.robot.bumped) list.fail(id);
}

export function lightState(sim: Sim, id = "semaforo") {
  const l = sim.scenario.objects.find((o) => o.id === id) as LightObject | undefined;
  return l ? sim.world.lightState(l, sim.time) : null;
}

/** ¿El programa en marcha controla el robot (y no la mano)? */
export const programDriving = (sim: Sim) => sim.mode === "programa" && sim.interp.running;

export const SONAR_FACE = ROBOT.sonarForward;
