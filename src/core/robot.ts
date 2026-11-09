/**
 * Estado y movimiento del robot: cinemática diferencial.
 * El robot no tiene volante: gira porque una rueda va más rápida que la otra.
 */
import { ROBOT } from "./config";
import type { Pose } from "./scenario";

export interface MotorCommand {
  /** PWM de cada motor, −255…255, como Tinybit.car_sport(izquierdo, derecho). */
  left: number;
  right: number;
}

export interface RobotState extends Pose {
  /** PWM pedido por el programa o por el control manual. */
  cmd: MotorCommand;
  /** Velocidad real de cada rueda (cm/s) tras el retardo del motor. */
  vLeft: number;
  vRight: number;
  /** Ángulo girado por cada rueda (rad), para animar las llantas. */
  spinLeft: number;
  spinRight: number;
  /** Distancia total recorrida por el centro del eje (cm). */
  odometer: number;
  /** Ángulo acumulado (rad), con signo: negativo = giro a la izquierda. */
  turned: number;
  /** Último contacto: con qué chocó o si salió del tapete. */
  bumped: string | null;
  /** Icono que muestra la matriz LED. */
  icon: string;
  /** Color de las luces RGB delanteras. */
  lights: string;
}

export function createRobot(start: Pose): RobotState {
  return {
    x: start.x,
    y: start.y,
    heading: start.heading,
    cmd: { left: 0, right: 0 },
    vLeft: 0,
    vRight: 0,
    spinLeft: 0,
    spinRight: 0,
    odometer: 0,
    turned: 0,
    bumped: null,
    icon: "",
    lights: "apagadas",
  };
}

export const clampPwm = (v: number) => Math.max(-ROBOT.maxPwm, Math.min(ROBOT.maxPwm, Math.round(Number.isFinite(v) ? v : 0)));

/** Velocidad de rueda en cm/s para un PWM dado (relación lineal, aproximación). */
export const pwmToSpeed = (pwm: number) => (clampPwm(pwm) / ROBOT.maxPwm) * ROBOT.maxWheelSpeed;

/** Vector hacia delante y hacia la izquierda del robot (y crece hacia abajo). */
export const forwardOf = (h: number): [number, number] => [Math.cos(h), Math.sin(h)];
export const leftOf = (h: number): [number, number] => [Math.sin(h), -Math.cos(h)];

/** Punto del robot a `fwd` cm hacia delante y `lat` cm a la izquierda del eje. */
export function bodyPoint(p: Pose, fwd: number, lat: number): [number, number] {
  const [fx, fy] = forwardOf(p.heading);
  const [lx, ly] = leftOf(p.heading);
  return [p.x + fx * fwd + lx * lat, p.y + fy * fwd + ly * lat];
}

export const chassisCenter = (p: Pose) => bodyPoint(p, ROBOT.chassisOffset, 0);

/** Ajusta una pose para que el chasis del robot quede entero dentro del tapete. */
export function clampToMat(p: Pose, width: number, height: number): Pose {
  const R = ROBOT.collisionRadius;
  const [cx, cy] = chassisCenter(p);
  const nx = Math.min(width - R, Math.max(R, cx)), ny = Math.min(height - R, Math.max(R, cy));
  return { x: p.x + (nx - cx), y: p.y + (ny - cy), heading: p.heading };
}

export interface Pending {
  x: number;
  y: number;
  heading: number;
  dist: number;
  dTheta: number;
}

/**
 * Avanza el estado de las ruedas y propone la nueva pose (sin aplicarla).
 * La pose se aplica después de comprobar colisiones.
 */
export function stepMotors(r: RobotState, dt: number, extraFactor = 1): Pending {
  const k = 1 - Math.exp(-dt / ROBOT.motorTau);
  const targetL = pwmToSpeed(r.cmd.left) * extraFactor;
  const targetR = pwmToSpeed(r.cmd.right) * extraFactor;
  r.vLeft += (targetL - r.vLeft) * k;
  r.vRight += (targetR - r.vRight) * k;
  if (Math.abs(r.vLeft) < 1e-3 && targetL === 0) r.vLeft = 0;
  if (Math.abs(r.vRight) < 1e-3 && targetR === 0) r.vRight = 0;
  r.spinLeft += (r.vLeft / ROBOT.wheelRadius) * dt;
  r.spinRight += (r.vRight / ROBOT.wheelRadius) * dt;

  const v = (r.vLeft + r.vRight) / 2;
  // Con y hacia abajo, un ángulo que decrece es un giro a la izquierda.
  const w = (r.vLeft - r.vRight) / ROBOT.trackWidth;
  const dTheta = w * dt;
  const mid = r.heading + dTheta / 2;
  return {
    x: r.x + Math.cos(mid) * v * dt,
    y: r.y + Math.sin(mid) * v * dt,
    heading: r.heading + dTheta,
    dist: Math.abs(v * dt),
    dTheta,
  };
}

export const normAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
