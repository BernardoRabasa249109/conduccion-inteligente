/**
 * Parámetros físicos del simulador.
 *
 * Unidades: centímetros, segundos y radianes. El fabricante no publica todas
 * las medidas del Tiny:bit Pro, así que los valores marcados como
 * "aproximación" se estimaron a partir de fotografías y de la extensión oficial
 * de MakeCode. Todos se pueden ajustar aquí; docs/APROXIMACIONES.md los explica.
 */

export const ROBOT = {
  /** Diámetro de rueda ≈ 4.3 cm (aproximación a partir de fotografías). */
  wheelRadius: 2.15,
  /** Distancia entre los centros de las dos ruedas (aproximación). */
  trackWidth: 8.4,
  /** Velocidad lineal de una rueda con PWM 255 (aproximación, motores N20). */
  maxWheelSpeed: 40,
  /** PWM máximo admitido por Tinybit.car_sport (dato documentado: −255…255). */
  maxPwm: 255,
  /** Retardo de respuesta del motor (constante de tiempo de primer orden). */
  motorTau: 0.06,
  /** El centro del chasis está por delante del eje de las ruedas. */
  chassisOffset: 1.6,
  /** Radio del círculo de colisión del chasis (aproximación). */
  collisionRadius: 5.6,
  /** Sensores infrarrojos de línea: distancia hacia delante desde el eje. */
  lineSensorForward: 4.6,
  /** Separación lateral entre los dos sensores de línea (aproximación). */
  lineSensorSpacing: 1.4,
  /** Ultrasonido HC-SR04 al frente del chasis. */
  sonarForward: 5.4,
  sonarHeight: 3.4,
  /** Medio ángulo del cono de detección (≈15°, típico del HC-SR04). */
  sonarHalfAngle: (15 * Math.PI) / 180,
  /** Los postes delgados (señales, semáforos) solo devuelven eco cerca del eje (aproximación). */
  sonarThinHalfAngle: (8 * Math.PI) / 180,
  /** Alcance útil. Fuera de él la función oficial devuelve 0 (sin eco). */
  sonarMaxRange: 400,
  sonarMinRange: 2,
  /** Cámara del módulo K210: altura y posición aproximadas sobre el soporte. */
  cameraForward: 1.2,
  cameraHeight: 12.5,
  /** Inclinación de la cámara hacia abajo (aproximación). */
  cameraPitch: (8 * Math.PI) / 180,
  /** Campo de visión horizontal de la cámara (aproximación, OV2640 ≈ 60°). */
  cameraHFov: (60 * Math.PI) / 180,
  cameraVFov: (46 * Math.PI) / 180,
  cameraWidthPx: 320,
  cameraHeightPx: 240,
} as const;

export const VISION = {
  /** Frecuencia de actualización simulada del reconocimiento (≈10 por segundo). */
  periodMs: 100,
  /** Distancias de reconocimiento simuladas (cm) entre cámara y señal. */
  minDistance: 7,
  maxDistance: 55,
  /** Ángulo máximo entre la cara de la señal y la cámara. */
  maxFacingAngle: (55 * Math.PI) / 180,
  /** Tamaño mínimo aparente de la señal en la imagen (px de 320). */
  minPixels: 22,
};

export const LINE = {
  /** Ancho de la línea negra (aproximación; cinta de ≈2.4 cm). */
  width: 2.4,
  /** Ancho de la franja blanca de carretera (decorativa). */
  roadWidth: 9,
};

export const SIM = {
  /** Paso fijo de la simulación: 20 ms (50 Hz). */
  dt: 0.02,
  /** Duración mínima de una vuelta de "repetir continuamente" (como MakeCode). */
  foreverPauseMs: 20,
  /** Pausa que hace la micro:bit real tras mostrar un icono (dato de MakeCode). */
  showIconPauseMs: 600,
  /** Pausa de la extensión oficial al cambiar el sentido de los motores (basic.pause(100)). */
  directionPauseMs: 100,
  /** Duración del claxon (media pulsación a 120 ppm en MakeCode). */
  hornMs: 250,
  /** Píxeles por centímetro de la superficie muestreada por los sensores. */
  floorPxPerCm: 8,
  /** Operaciones máximas por paso antes de ceder (evita bloquear la interfaz). */
  opBudget: 4000,
};

/** Velocidad equivalente al recorrer la "zona 30" del ejercicio. */
export const SLOW_ZONE = {
  /** Una señal "30" significa en el ejercicio: usar PWM ≤ 30 % del máximo
   *  habitual. No representa 30 km/h. */
  suggestedPwm: 70,
};
