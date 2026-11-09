/**
 * Superposiciones del escenario 3D: objetivo, herramientas de vista, decisión
 * actual, lecturas de sensores, cámara de a bordo y control del semáforo.
 * También gestiona el puntero: acercar, desplazar y colocar el robot.
 */
import { clampToMat } from "../core/robot";
import type { LightObject, LightState, Pose, VisionLabel } from "../core/scenario";
import { Steady } from "../core/steady";
import type { Sim } from "../core/sim";
import { STATE_NAME } from "../program/ast";
import type { Scene3D } from "../render/scene3d";
import { btn, h, icon, store, svgEl, ICON } from "./dom";

export type StageTool = "view" | "place" | "edit";

/** Ocho colores para el rastro, visibles sobre el tapete claro. */
export const TRAIL_COLORS: [string, number][] = [
  ["Fucsia", 0xd946ef],
  ["Cian", 0x06b6d4],
  ["Verde", 0x16a34a],
  ["Ámbar", 0xf59e0b],
  ["Naranja", 0xf97316],
  ["Rojo", 0xef4444],
  ["Azul", 0x2563eb],
  ["Violeta", 0x7c3aed],
];

export { Steady };

/** Color del punto del botón «Semáforo» según la luz encendida. */
const LIGHT_DOT: Record<LightState, string> = { rojo: "#ef4444", amarillo: "#f59e0b", verde: "#22c55e", apagado: "#334155" };

/** La ventana de la cámara se puede encoger hasta un 10 % menos; nunca crece. */
export const CAM_MIN_SCALE = 0.9;
/** Separación mínima entre la ventana de la cámara y el borde del escenario (px). */
const CAM_MARGIN = 12;
const clampScale = (s: number) => Math.round(Math.min(1, Math.max(CAM_MIN_SCALE, s)) * 1000) / 1000;

export interface PointerDelegate {
  down(x: number, y: number, e: PointerEvent): boolean;
  move(x: number, y: number, e: PointerEvent): void;
  up(x: number, y: number, e: PointerEvent): void;
  hover?(x: number, y: number, e?: PointerEvent): void;
}

export class StageUI {
  readonly el: HTMLElement;
  readonly host: HTMLElement;
  readonly camHost: HTMLElement;
  scene!: Scene3D;
  tool: StageTool = "view";
  editDelegate: PointerDelegate | null = null;
  private decideChip: HTMLElement;
  private actChip: HTMLElement;
  private stateChip: HTMLElement;
  private hud: HTMLElement;
  private camDet: HTMLElement;
  private camBox: HTMLElement;
  private camBar: HTMLElement;
  private camGrip: HTMLElement;
  /**
   * Ventana de la cámara. `pos` guarda dónde está como fracción del espacio
   * libre (0 = izquierda/arriba, 1 = derecha/abajo), así sigue en su sitio
   * cuando el escenario cambia de tamaño. Sin `pos`, va en su esquina.
   */
  private cam: { scale: number; pos: { fx: number; fy: number } | null } = { scale: 1, pos: null };
  private camWatch = new ResizeObserver(() => this.placeCam());
  /** En modo práctica la cámara queda fija abajo a la derecha y al 90 %: no se cruza con la ventana de la práctica. */
  private camLocked = false;
  /** Semáforo: un botón en la barra de ayudas con su menú (no un panel fijo que tape). */
  private lightBtn!: HTMLButtonElement;
  private lightDot = h("i", { class: "trail-dot light-dot", "aria-hidden": "true" });
  private lightMenu = h("div", { class: "trail-menu light-menu hidden", role: "group", "aria-label": "Semáforo" });
  private camMinBtn!: HTMLButtonElement;
  private viewSeg: HTMLElement;
  private followBtn!: HTMLButtonElement;
  private overlayBtns = new Map<string, HTMLButtonElement>();
  private cache = new Map<string, string>();
  private hudRefs: { swL: HTMLElement; swR: HTMLElement; txtL: HTMLElement; txtR: HTMLElement; dist: HTMLElement; vision: HTMLElement; motors: HTMLElement };
  private lastPaint = 0;
  /** Cuánto se mantiene cada dato en pantalla antes de cambiar (ms). */
  private hold = {
    lineL: new Steady<0 | 1>(0, 0, 150),
    lineR: new Steady<0 | 1>(0, 0, 150),
    dist: new Steady<number>(0, 0, 300),
    vision: new Steady<VisionLabel | null>(null, 150, 600),
    motors: new Steady<string>("I 0 · D 0", 0, 300),
    decision: new Steady<string>("", 0, 700),
  };
  private placing: { mode: "move" | "rotate"; id: number; dx: number; dy: number; angOff: number } | null = null;
  /** Pose hacia la que va el robot mientras se coloca (el robot la sigue con suavidad). */
  private placeTarget: Pose | null = null;
  /** Última pose que puso la colocación: si el robot ya no está ahí, otro lo movió (reiniciar, salida…). */
  private placedAt: Pose | null = null;
  /** Etiqueta con el ángulo mientras se gira el robot. */
  private angleTag = h("div", { class: "angle-tag hidden", "aria-live": "polite" });
  /** Aviso cuando un programa tiene el mando y no se puede colocar el robot. */
  onPlaceBlocked: () => void = () => {};
  private trailDot = h("i", { class: "trail-dot", "aria-hidden": "true" });
  private trailMenu = h("div", { class: "trail-menu hidden", role: "group", "aria-label": "Opciones del rastro" });
  private trailBtn: HTMLButtonElement | null = null;
  private panning: { x: number; y: number; id: number; moved: boolean } | null = null;

  constructor(private sim: () => Sim, private onLightChange: (id: string, state: LightState | "auto") => void) {
    this.host = h("div", { class: "stage-host" });
    this.host.style.cssText = "position:absolute;inset:0";

    this.viewSeg = h("div", { class: "seg", role: "group", "aria-label": "Vista" });
    for (const [v, label] of [["iso", "Isométrica"], ["top", "Superior"]] as const) {
      const b = h("button", { type: "button", "aria-pressed": v === "iso" ? "true" : "false", "data-view": v }, svgEl(v === "iso" ? ICON.layers : ICON.tile), label);
      b.addEventListener("click", () => this.setView(v));
      this.viewSeg.append(b);
    }
    const zin = btn("", "zoomIn", () => this.scene.zoom(0.8), "small icon-only");
    zin.setAttribute("aria-label", "Acercar");
    zin.title = "Acercar";
    const zout = btn("", "zoomOut", () => this.scene.zoom(1.25), "small icon-only");
    zout.setAttribute("aria-label", "Alejar");
    zout.title = "Alejar";
    const center = btn("Centrar", "center", () => {
      this.scene.follow = false;
      this.followBtn.setAttribute("aria-pressed", "false");
      this.scene.center();
    }, "small");
    this.followBtn = btn("Seguir", "follow", () => {
      this.scene.follow = !this.scene.follow;
      this.followBtn.setAttribute("aria-pressed", String(this.scene.follow));
      if (this.scene.follow) this.scene.focusRobot(this.sim(), 75);
    }, "small toggle");
    this.followBtn.setAttribute("aria-pressed", "false");
    const rot = btn("", "rotate", () => this.scene.rotateView(), "small icon-only");
    rot.title = "Girar la vista 90°";
    rot.setAttribute("aria-label", "Girar la vista 90 grados");
    const ovSeg = h("div", { class: "seg", role: "group", "aria-label": "Ayudas visuales" });
    for (const [k, label, ic] of [["sensors", "Sensores", ICON.sensor], ["sonar", "Ultrasonido", ICON.wave], ["camera", "Cámara", ICON.camera], ["trail", "Rastro", ICON.trail]] as const) {
      const b = h("button", { type: "button", "aria-pressed": "false", title: `Mostrar u ocultar: ${label}` }, svgEl(ic), label);
      if (k === "trail") {
        // «Rastro» abre un menú con mostrar/ocultar y la paleta de colores.
        b.title = "Rastro: mostrar u ocultar y elegir color";
        b.setAttribute("aria-haspopup", "true");
        b.setAttribute("aria-expanded", "false");
        b.append(this.trailDot);
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleTrailMenu(b);
        });
      } else {
        b.addEventListener("click", () => {
          const ov = this.scene.overlays as unknown as Record<string, boolean>;
          ov[k] = !ov[k];
          b.setAttribute("aria-pressed", String(ov[k]));
        });
      }
      this.overlayBtns.set(k, b);
      ovSeg.append(b);
    }
    // Semáforo: aparece solo si el escenario tiene uno.
    this.lightBtn = h("button", { type: "button", class: "hidden", "aria-haspopup": "true", "aria-expanded": "false", title: "Semáforo: automático, rojo, amarillo, verde o apagado" }, svgEl(ICON.light), "Semáforo", this.lightDot) as HTMLButtonElement;
    this.lightBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleLightMenu();
    });
    ovSeg.append(this.lightBtn);
    const tools = h("div", { class: "view-tools" }, this.viewSeg, zin, zout, center, this.followBtn, rot, ovSeg);
    const top = h("div", { class: "stage-top" }, tools);

    this.decideChip = h("div", { class: "chip decide hidden" });
    this.actChip = h("div", { class: "chip act hidden" });
    this.stateChip = h("div", { class: "chip state hidden" });
    const decision = h("div", { class: "stage-decision", "aria-live": "polite" }, this.stateChip, this.decideChip, this.actChip);

    // Lecturas: los nodos se crean una vez; luego solo cambian sus textos.
    const lineChip = (side: string) => {
      const sw = h("div", { class: "sw", "data-v": "0" }, "0");
      const txt = h("span", {}, `${side} · blanco`);
      return { el: h("div", { class: "line-chip" }, sw, txt), sw, txt };
    };
    const left = lineChip("Izq"), right = lineChip("Der");
    const cell = (iconName: keyof typeof ICON, title: string, value: HTMLElement, cls = "") =>
      h("div", { class: `hud-cell ${cls}`.trim() }, h("div", { class: "k", html: `${ICON[iconName]}${title}` }), value);
    this.hudRefs = {
      swL: left.sw, swR: right.sw, txtL: left.txt, txtR: right.txt,
      dist: h("div", { class: "v" }, "0"),
      vision: h("div", { class: "v small" }, "ninguna"),
      motors: h("div", { class: "v small" }, "I 0 · D 0"),
    };
    this.hud = h(
      "div",
      { class: "hud", "aria-label": "Lecturas de sensores" },
      h("div", { class: "hud-cell" }, h("div", { class: "k", html: `${ICON.sensor}Sensores de línea` }), h("div", { class: "line-pair" }, left.el, right.el)),
      cell("wave", "Ultrasonido", this.hudRefs.dist),
      cell("camera", "Visión simulada", this.hudRefs.vision),
      cell("bolt", "Motores (PWM)", this.hudRefs.motors, "motor"),
    );

    this.camHost = h("div", { class: "cam-view" });
    this.camDet = h("span", { class: "det" }, "ninguna");
    // Asa de la esquina: solo encoge la ventana (hasta un 10 % menos), nunca la agranda.
    this.camGrip = h("div", {
      class: "cam-grip",
      role: "slider",
      tabindex: "0",
      title: "Arrastra hacia abajo a la izquierda para hacerla más pequeña",
      "aria-label": "Tamaño de la cámara",
      "aria-valuemin": String(CAM_MIN_SCALE * 100),
      "aria-valuemax": "100",
      html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2h9v9M9 2h5v5M13 2h1v1"/></svg>',
    });
    this.camHost.append(this.camGrip);
    this.camMinBtn = h("button", { type: "button", class: "cam-min", "aria-pressed": "false", title: "Minimizar la cámara", "aria-label": "Minimizar la cámara" }, svgEl(ICON.chevron)) as HTMLButtonElement;
    this.camMinBtn.addEventListener("click", () => this.toggleCamMin());
    this.camBar = h("div", { class: "cam-bar", tabindex: "0", "aria-label": "Cámara K210: arrástrala o usa las flechas para moverla; doble clic la regresa a su lugar" }, h("span", { class: "tag" }, "Cámara K210"), this.camDet, this.camMinBtn);
    this.camBox = h("div", { class: "cam-box", title: "Cámara del módulo K210 (simulada). Arrástrala para moverla; doble clic la regresa a su lugar." }, this.camHost, this.camBar);

    this.el = h("div", { class: "stage card" }, this.host, top, decision, this.hud, this.camBox, this.trailMenu, this.lightMenu, this.angleTag);
    // Cerrar los menús del rastro y del semáforo al pulsar fuera de ellos.
    document.addEventListener("pointerdown", (e) => {
      const t = e.target as Node;
      if (!this.trailMenu.classList.contains("hidden") && !this.trailMenu.contains(t) && !this.trailBtn?.contains(t)) this.closeTrailMenu();
      if (!this.lightMenu.classList.contains("hidden") && !this.lightMenu.contains(t) && !this.lightBtn.contains(t)) this.closeLightMenu();
    });
    this.lightMenu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.closeLightMenu();
        this.lightBtn.focus();
      }
    });
    this.trailMenu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.closeTrailMenu();
        this.trailBtn?.focus();
      }
    });
    this.bindPointer();
    this.bindCamBox();
  }

  attach(scene: Scene3D) {
    this.scene = scene;
    for (const [k, b] of this.overlayBtns) b.setAttribute("aria-pressed", String((scene.overlays as unknown as Record<string, boolean>)[k]));
    this.applyTrail(store.get("trailVisible", true), store.get("trailColor", TRAIL_COLORS[0][1]));
  }

  // ───────── Menú del rastro ─────────

  /** Muestra u oculta el rastro y cambia su color; lo recuerda en este navegador. */
  applyTrail(visible: boolean, color: number) {
    this.scene.overlays.trail = visible;
    this.scene.setTrailColor(color);
    store.set("trailVisible", visible);
    store.set("trailColor", color);
    this.trailDot.style.background = `#${color.toString(16).padStart(6, "0")}`;
    this.overlayBtns.get("trail")?.setAttribute("aria-pressed", String(visible));
  }

  private toggleTrailMenu(b: HTMLButtonElement) {
    this.trailBtn = b;
    if (!this.trailMenu.classList.contains("hidden")) {
      this.closeTrailMenu();
      return;
    }
    this.renderTrailMenu();
    this.closeLightMenu();
    this.trailMenu.classList.remove("hidden");
    this.placeMenu(this.trailMenu, b);
    b.setAttribute("aria-expanded", "true");
    this.trailMenu.querySelector<HTMLButtonElement>("button")?.focus();
  }

  /** Coloca un menú justo debajo de su botón, sin salirse del escenario. */
  private placeMenu(menu: HTMLElement, b: HTMLElement) {
    const sr = this.el.getBoundingClientRect(), br = b.getBoundingClientRect();
    const mw = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(br.right - sr.left - mw, sr.width - mw - 8))}px`;
    menu.style.top = `${br.bottom - sr.top + 6}px`;
  }

  // ───────── Menú del semáforo ─────────

  private toggleLightMenu() {
    if (!this.lightMenu.classList.contains("hidden")) {
      this.closeLightMenu();
      return;
    }
    this.buildLightControl(this.sim());
    this.closeTrailMenu();
    this.lightMenu.classList.remove("hidden");
    this.placeMenu(this.lightMenu, this.lightBtn);
    this.lightBtn.setAttribute("aria-expanded", "true");
    (this.lightMenu.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? this.lightMenu.querySelector("button"))?.focus();
  }

  private closeLightMenu() {
    this.lightMenu.classList.add("hidden");
    this.lightBtn?.setAttribute("aria-expanded", "false");
  }

  /** Color del punto del botón: la luz encendida ahora mismo. */
  private paintLightDot(sim: Sim) {
    const l = sim.scenario.objects.find((o): o is LightObject => o.kind === "light");
    if (!l) return;
    const st = sim.world.lightState(l, sim.time);
    this.lightDot.style.background = LIGHT_DOT[st];
  }

  private closeTrailMenu() {
    this.trailMenu.classList.add("hidden");
    this.trailBtn?.setAttribute("aria-expanded", "false");
  }

  private renderTrailMenu() {
    const visible = this.scene.overlays.trail;
    const color = store.get("trailColor", TRAIL_COLORS[0][1]);
    const toggle = h("button", { type: "button", class: "btn small trail-toggle", "aria-pressed": String(visible) }, icon(visible ? "eye" : "x"), h("span", {}, visible ? "Rastro visible" : "Rastro oculto"));
    toggle.title = visible ? "Ocultar el rastro" : "Mostrar el rastro";
    toggle.addEventListener("click", () => {
      this.applyTrail(!this.scene.overlays.trail, store.get("trailColor", color));
      this.renderTrailMenu();
      this.trailMenu.querySelector<HTMLButtonElement>(".trail-toggle")?.focus();
    });
    const swatches = h("div", { class: "trail-swatches", role: "radiogroup", "aria-label": "Color del rastro" });
    for (const [name, hex] of TRAIL_COLORS) {
      const on = hex === color;
      const sw = h("button", { type: "button", class: "trail-swatch", role: "radio", "aria-checked": String(on), "aria-label": name, title: name, style: `background:#${hex.toString(16).padStart(6, "0")}` }, on ? icon("check") : "");
      sw.addEventListener("click", () => {
        this.applyTrail(true, hex);
        this.renderTrailMenu();
        this.trailMenu.querySelector<HTMLButtonElement>('.trail-swatch[aria-checked="true"]')?.focus();
      });
      swatches.append(sw);
    }
    this.trailMenu.replaceChildren(h("div", { class: "k" }, "Rastro del robot"), toggle, h("div", { class: "k" }, "Color"), swatches);
  }

  setView(v: "iso" | "top") {
    this.scene.view = v;
    if (!this.scene.follow) this.scene.center();
    this.viewSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  }

  setTool(t: StageTool) {
    // Al salir de «Colocar robot», el robot termina de llegar a su sitio.
    const pending = this.placeTarget;
    if (t !== "place" && pending && this.sim().mode === "manual") this.sim().placeRobot(pending.x, pending.y, pending.heading);
    if (t !== "place") this.placeTarget = null;
    this.tool = t;
    this.el.dataset.tool = t;
    this.scene?.setPlaceGizmo(t === "place");
    this.canvasCursor("");
  }

  /** Cursor del lienzo 3D (vacío = el que marca la herramienta). */
  canvasCursor(c: string) {
    if (this.scene) this.scene.renderer.domElement.style.cursor = c;
  }

  /** Ángulo del robot en grados, 0° = hacia la derecha del tapete, en sentido horario. */
  static degrees(heading: number): number {
    return Math.round((((heading * 180) / Math.PI) % 360 + 360) % 360);
  }

  /** Pose actual de colocación: la de destino si el robot aún va hacia ella. */
  private placeBase(): Pose {
    const r = this.sim().robot;
    return this.placeTarget ?? { x: r.x, y: r.y, heading: r.heading };
  }

  /** Fija adónde va el robot; el chasis nunca pasa del borde morado del tapete. */
  private aimRobot(x: number, y: number, heading: number) {
    const sim = this.sim(), w = sim.world;
    if (!this.placeTarget) this.placedAt = { x: sim.robot.x, y: sim.robot.y, heading: sim.robot.heading };
    this.placeTarget = clampToMat({ x, y, heading }, w.width, w.height);
  }

  /** Cada fotograma: el robot se desliza hacia su pose de destino. */
  tick(dt: number) {
    const t = this.placeTarget;
    if (!t) return;
    const sim = this.sim(), r = sim.robot, at = this.placedAt;
    if (sim.mode !== "manual" || (at && (at.x !== r.x || at.y !== r.y || at.heading !== r.heading))) {
      this.placeTarget = null;
      return;
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) / 0.075);
    const dh = Math.atan2(Math.sin(t.heading - r.heading), Math.cos(t.heading - r.heading));
    const nx = r.x + (t.x - r.x) * k, ny = r.y + (t.y - r.y) * k, nh = r.heading + dh * k;
    if (Math.hypot(t.x - nx, t.y - ny) < 0.03 && Math.abs(dh) * (1 - k) < 0.001) {
      sim.placeRobot(t.x, t.y, t.heading);
      this.placeTarget = null;
    } else sim.placeRobot(nx, ny, nh);
    this.placedAt = { x: r.x, y: r.y, heading: r.heading };
  }

  showAngle(clientX: number, clientY: number, heading: number) {
    const sr = this.el.getBoundingClientRect();
    this.angleTag.textContent = `${StageUI.degrees(heading)}°`;
    this.angleTag.style.left = `${clientX - sr.left + 16}px`;
    this.angleTag.style.top = `${clientY - sr.top - 34}px`;
    this.angleTag.classList.remove("hidden");
  }

  /** Gira el robot un número de grados (botones y teclas Q/E del modo colocar). */
  rotatePlaced(deg: number) {
    const sim = this.sim();
    if (sim.mode !== "manual") {
      this.onPlaceBlocked();
      return;
    }
    const step = Math.PI / 12;
    const b = this.placeBase();
    const h0 = Math.round(b.heading / step) * step;
    this.aimRobot(b.x, b.y, h0 + (deg * Math.PI) / 180);
  }

  /** Muestra u oculta el botón del semáforo y prepara su menú (para el docente). */
  buildLightControl(sim: Sim) {
    const lights = sim.scenario.objects.filter((o): o is LightObject => o.kind === "light");
    this.lightMenu.replaceChildren();
    this.lightBtn.classList.toggle("hidden", lights.length === 0);
    if (!lights.length) return this.closeLightMenu();
    const l = lights[0];
    this.paintLightDot(sim);
    this.lightMenu.append(h("div", { class: "k" }, "Semáforo"));
    const opts: [LightState | "auto", string, string][] = [["auto", "Automático", "#94a3b8"], ["rojo", "Rojo", "#ef4444"], ["amarillo", "Amarillo", "#f59e0b"], ["verde", "Verde", "#22c55e"], ["apagado", "Apagado", "#1f2937"]];
    for (const [v, label, color] of opts) {
      const pressed = v === "auto" ? l.cycle.auto : !l.cycle.auto && l.state === v;
      const b = h("button", { type: "button", "aria-pressed": String(pressed) }, h("i", { style: `background:${color}` }), label);
      b.addEventListener("click", () => {
        this.onLightChange(l.id, v);
        this.buildLightControl(this.sim());
        this.closeLightMenu();
        this.lightBtn.focus();
      });
      this.lightMenu.append(b);
    }
  }

  private set(el: HTMLElement, key: string, html: string) {
    if (this.cache.get(key) === html) return;
    this.cache.set(key, html);
    el.innerHTML = html;
  }

  /** Cambia un texto solo si es distinto (sin recrear nodos). */
  private text(el: HTMLElement, value: string) {
    if (el.textContent !== value) el.textContent = value;
  }

  /**
   * Actualiza los textos según la simulación. Las lecturas cambian cada 20 ms;
   * en pantalla se refrescan unas 8 veces por segundo y cada valor se mantiene
   * un momento para que se pueda leer. El programa sigue recibiendo los datos
   * exactos: esto solo afecta a lo que se muestra.
   */
  update(sim: Sim) {
    const now = performance.now();
    if (now - this.lastPaint < 120) return;
    this.lastPaint = now;
    if (!this.lightBtn.classList.contains("hidden")) this.paintLightDot(sim);
    const s = sim.seen;
    const r = this.hudRefs;
    const l = this.hold.lineL.push(s.lineLeft, now), rr = this.hold.lineR.push(s.lineRight, now);
    for (const [sw, txt, v, side] of [[r.swL, r.txtL, l, "Izq"], [r.swR, r.txtR, rr, "Der"]] as const) {
      if (sw.dataset.v !== String(v)) {
        sw.dataset.v = String(v);
        sw.textContent = String(v);
      }
      this.text(txt, `${side} · ${v ? "negro" : "blanco"}`);
    }
    const dist = this.hold.dist.push(s.distance, now);
    this.set(r.dist, "dist", dist > 0 ? `${dist}<small> cm</small>` : `0 <small>sin eco</small>`);
    const label = this.hold.vision.push(s.vision.label, now);
    if (this.scene) this.scene.shownLabel = label;
    const vision = label ? sim.visionText(label) : "ninguna";
    this.text(r.vision, vision);
    const motors = this.hold.motors.push(`I ${sim.robot.cmd.left} · D ${sim.robot.cmd.right}`, now);
    this.text(r.motors, motors);
    const conf = label && label === s.vision.label ? ` · ${Math.round(s.vision.confidence * 100)}% (simulada)` : "";
    this.text(this.camDet, label ? `${vision}${conf}` : "sin señal reconocida");

    const recent = sim.decision && sim.time - sim.decision.t < 4 && sim.mode === "programa";
    this.decideChip.classList.toggle("hidden", !recent);
    if (recent) this.set(this.decideChip, "dec", `${ICON.brain}<span>${escapeHtml(this.hold.decision.push(sim.decision!.text, now))}</span>`);
    const act = sim.mode === "programa" && sim.interp.running;
    this.actChip.classList.toggle("hidden", !act);
    if (act) this.set(this.actChip, "act", `${ICON.bolt}<span>${motors}</span>`);
    const st = sim.interp.state;
    this.stateChip.classList.toggle("hidden", !st || !act);
    if (st) this.set(this.stateChip, "st", `<span>Estado: ${STATE_NAME[st]}</span>`);
  }

  // ───────── Ventana de la cámara: mover y encoger ─────────

  private bindCamBox() {
    this.cam.scale = clampScale(store.get("cam:scale", 1));
    this.cam.pos = store.get<{ fx: number; fy: number } | null>("cam:pos", null);
    this.applyCamScale();
    // Se recoloca si cambia el escenario (pestañas, ventana) o si la ventana reaparece.
    this.camWatch.observe(this.el);
    this.camWatch.observe(this.camBox);

    // Mover: se arrastra desde cualquier parte de la ventana, menos el asa.
    let drag: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    this.camBox.addEventListener("pointerdown", (e) => {
      if (this.camLocked || e.button !== 0 || this.camGrip.contains(e.target as Node) || this.camMinBtn.contains(e.target as Node)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: this.camBox.offsetLeft, top: this.camBox.offsetTop, moved: false };
      this.camBox.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.camBox.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      this.camBox.classList.add("dragging");
      this.moveCam(drag.left + dx, drag.top + dy);
    });
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) this.saveCam();
      drag = null;
      this.camBox.classList.remove("dragging");
    };
    this.camBox.addEventListener("pointerup", endDrag);
    this.camBox.addEventListener("pointercancel", endDrag);
    this.camBox.addEventListener("dblclick", (e) => {
      if (!this.camLocked && !this.camGrip.contains(e.target as Node) && !this.camMinBtn.contains(e.target as Node)) this.resetCam();
    });
    this.camBar.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 40 : 12;
      const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
      if (!d || this.camLocked) return;
      // Las flechas mueven la ventana, no el robot.
      e.preventDefault();
      e.stopPropagation();
      this.moveCam(this.camBox.offsetLeft + d[0], this.camBox.offsetTop + d[1]);
      this.saveCam();
    });

    // Encoger: el asa de la esquina. Hacia abajo a la izquierda encoge; hacia
    // arriba a la derecha vuelve al tamaño original, pero no pasa de él.
    let size: { id: number; x: number; y: number; scale: number; baseW: number } | null = null;
    this.camGrip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      size = { id: e.pointerId, x: e.clientX, y: e.clientY, scale: this.cam.scale, baseW: this.camBox.offsetWidth / this.cam.scale };
      this.camGrip.setPointerCapture(e.pointerId);
      this.camBox.classList.add("resizing");
    });
    this.camGrip.addEventListener("pointermove", (e) => {
      if (!size || e.pointerId !== size.id) return;
      const grow = (e.clientX - size.x - (e.clientY - size.y)) / 2;
      this.resizeCam(size.scale + grow / size.baseW);
    });
    const endSize = (e: PointerEvent) => {
      if (!size || e.pointerId !== size.id) return;
      size = null;
      this.camBox.classList.remove("resizing");
      this.saveCam();
    };
    this.camGrip.addEventListener("pointerup", endSize);
    this.camGrip.addEventListener("pointercancel", endSize);
    this.camGrip.addEventListener("dblclick", (e) => e.stopPropagation());
    this.camGrip.addEventListener("keydown", (e) => {
      const d = ({ ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, Home: -1, End: 1 } as Record<string, number>)[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      this.resizeCam(this.cam.scale + d);
      this.saveCam();
    });
  }

  /** Fija la cámara (modo práctica) o la deja libre para moverla y encogerla. */
  setCamLocked(on: boolean) {
    if (on === this.camLocked) return;
    this.camLocked = on;
    this.camBox.classList.toggle("locked", on);
    this.camBox.title = on ? "Cámara del módulo K210 (simulada). Durante la práctica queda fija en esta esquina." : "Cámara del módulo K210 (simulada). Arrástrala para moverla; doble clic la regresa a su lugar.";
    this.applyCamScale();
    this.placeCam();
  }

  private applyCamScale() {
    this.camBox.style.setProperty("--cam-scale", String(this.camLocked ? CAM_MIN_SCALE : this.cam.scale));
    this.camGrip.setAttribute("aria-valuenow", String(Math.round(this.cam.scale * 100)));
    this.camGrip.setAttribute("aria-valuetext", `${Math.round(this.cam.scale * 100)} % del tamaño original`);
  }

  /** Cambia el tamaño (entre 90 % y 100 %) sin moverla de su sitio. */
  private resizeCam(scale: number) {
    const s = clampScale(scale);
    if (s === this.cam.scale) return;
    this.cam.scale = s;
    this.applyCamScale();
    this.placeCam();
  }

  /** Lleva la ventana a (left, top) dentro del escenario, sin salirse de él. */
  private moveCam(left: number, top: number) {
    const freeX = Math.max(0, this.el.clientWidth - this.camBox.offsetWidth - 2 * CAM_MARGIN);
    const freeY = Math.max(0, this.el.clientHeight - this.camBox.offsetHeight - 2 * CAM_MARGIN);
    const frac = (v: number, free: number) => (free ? Math.min(1, Math.max(0, (v - CAM_MARGIN) / free)) : 0);
    this.cam.pos = { fx: frac(left, freeX), fy: frac(top, freeY) };
    this.placeCam();
  }

  /** «Programar» y «Conducir» recuerdan por separado si la cámara está minimizada. */
  private camMinKey() {
    return this.el.classList.contains("compact") ? "cam:min:programar" : "cam:min";
  }

  private syncCamMin() {
    const min = store.get(this.camMinKey(), false);
    this.camBox.classList.toggle("min", min);
    this.camMinBtn.setAttribute("aria-pressed", String(min));
    const label = min ? "Mostrar la imagen de la cámara" : "Minimizar la cámara";
    this.camMinBtn.title = label;
    this.camMinBtn.setAttribute("aria-label", label);
  }

  /** Minimiza la cámara a su barra de título (o la vuelve a mostrar). */
  private toggleCamMin() {
    store.set(this.camMinKey(), !this.camBox.classList.contains("min"));
    this.placeCam();
  }

  /** Coloca la ventana de la cámara donde se dejó (o en su esquina). */
  placeCam() {
    this.syncCamMin();
    const st = this.camBox.style;
    // Sin posición guardada (o fija por la práctica): su esquina de abajo a la derecha.
    if (!this.cam.pos || this.camLocked) {
      st.left = st.top = st.right = st.bottom = "";
      return;
    }
    const w = this.camBox.offsetWidth, hh = this.camBox.offsetHeight;
    if (!w) return; // oculta (por ejemplo, en el editor)
    const freeX = Math.max(0, this.el.clientWidth - w - 2 * CAM_MARGIN);
    const freeY = Math.max(0, this.el.clientHeight - hh - 2 * CAM_MARGIN);
    st.left = `${Math.round(CAM_MARGIN + this.cam.pos.fx * freeX)}px`;
    st.top = `${Math.round(CAM_MARGIN + this.cam.pos.fy * freeY)}px`;
    st.right = st.bottom = "auto";
  }

  private saveCam() {
    store.set("cam:pos", this.cam.pos);
    store.set("cam:scale", this.cam.scale);
  }

  /** Doble clic: vuelve a su esquina y a su tamaño original. */
  resetCam() {
    this.cam = { scale: 1, pos: null };
    this.applyCamScale();
    this.placeCam();
    store.del("cam:pos");
    store.del("cam:scale");
  }

  private bindPointer() {
    const canvasTarget = () => this.scene?.renderer.domElement;
    this.el.addEventListener(
      "wheel",
      (e) => {
        if (!this.scene || !(e.target instanceof HTMLCanvasElement) || e.target !== canvasTarget()) return;
        e.preventDefault();
        this.scene.zoomAt(e.deltaY > 0 ? 1.12 : 0.89, e.clientX, e.clientY);
      },
      { passive: false },
    );
    this.el.addEventListener("pointerdown", (e) => {
      if (!this.scene || e.target !== canvasTarget()) return;
      const g = this.scene.groundAt(e.clientX, e.clientY);
      if (!g) return;
      if (this.tool === "edit" && this.editDelegate && e.button === 0) {
        if (this.editDelegate.down(g[0], g[1], e)) {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
      if (this.tool === "place" && e.button === 0) {
        const sim = this.sim();
        if (sim.mode !== "manual") {
          this.onPlaceBlocked();
          return;
        }
        const hit = this.scene.pick(e.clientX, e.clientY);
        const r = sim.robot;
        const b = this.placeBase();
        if (hit.handle) {
          // Girar: el robot gira sobre sí mismo siguiendo al puntero, sin saltos.
          this.placing = { mode: "rotate", id: e.pointerId, dx: 0, dy: 0, angOff: b.heading - Math.atan2(g[1] - b.y, g[0] - b.x) };
        } else if (hit.robot || Math.hypot(g[0] - r.x, g[1] - r.y) < 9) {
          // Mover: se agarra el robot por donde se pulsó.
          this.placing = { mode: "move", id: e.pointerId, dx: b.x - g[0], dy: b.y - g[1], angOff: 0 };
        } else {
          // Clic en el suelo libre: el robot se desliza hasta allí conservando su orientación.
          this.aimRobot(g[0], g[1], b.heading);
          this.placing = { mode: "move", id: e.pointerId, dx: 0, dy: 0, angOff: 0 };
        }
        this.canvasCursor(this.placing.mode === "rotate" ? "grabbing" : "move");
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      this.panning = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    });
    this.el.addEventListener("pointermove", (e) => {
      if (!this.scene || e.target !== canvasTarget()) return;
      const g = this.scene.groundAt(e.clientX, e.clientY);
      if (this.tool === "edit" && this.editDelegate && g) {
        this.editDelegate.move(g[0], g[1], e);
        this.editDelegate.hover?.(g[0], g[1], e);
      }
      if (this.placing && g && this.placing.id === e.pointerId) {
        const p = this.placing, b = this.placeBase();
        if (p.mode === "rotate") {
          let heading = Math.atan2(g[1] - b.y, g[0] - b.x) + p.angOff;
          if (e.shiftKey) heading = Math.round(heading / (Math.PI / 12)) * (Math.PI / 12);
          this.aimRobot(b.x, b.y, heading);
          this.showAngle(e.clientX, e.clientY, heading);
        } else {
          this.aimRobot(g[0] + p.dx, g[1] + p.dy, b.heading);
        }
      } else if (this.tool === "place" && g && !this.panning) {
        // Cursor según lo que hay debajo: tirador = girar, robot = mover.
        const hit = this.scene.pick(e.clientX, e.clientY);
        const r = this.sim().robot;
        this.canvasCursor(hit.handle ? "grab" : hit.robot || Math.hypot(g[0] - r.x, g[1] - r.y) < 9 ? "move" : "crosshair");
      }
      if (this.panning && this.panning.id === e.pointerId) {
        const a = this.scene.groundAt(this.panning.x, this.panning.y);
        if (a && g) {
          this.scene.pan(a[0] - g[0], a[1] - g[1]);
          if (Math.hypot(e.clientX - this.panning.x, e.clientY - this.panning.y) > 3) this.panning.moved = true;
          this.panning.x = e.clientX;
          this.panning.y = e.clientY;
          if (this.panning.moved && this.scene.follow) {
            this.scene.follow = false;
            this.followBtn.setAttribute("aria-pressed", "false");
          }
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (this.tool === "edit" && this.editDelegate && this.scene) {
        const g = this.scene.groundAt(e.clientX, e.clientY);
        if (g) this.editDelegate.up(g[0], g[1], e);
      }
      if (this.placing) this.canvasCursor("");
      this.placing = null;
      this.panning = null;
      this.angleTag.classList.add("hidden");
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
