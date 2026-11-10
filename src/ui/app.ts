/**
 * Controlador principal: crea la simulación compartida, la escena 3D y los
 * cuatro espacios (Explorar, Conducir, Programar, Prácticas).
 */
import { cloneScenario, validateScenario, type LightObject, type LightState, type Scenario } from "../core/scenario";
import { Sim } from "../core/sim";
import { Scene3D } from "../render/scene3d";
import { SCENARIOS, SCENARIO_LIST } from "../scenarios/defaults";
import { practiceScenario } from "../practices/practices";
import { ALL_CATEGORIES } from "../program/blocks";
import type { Example } from "../program/examples";
import { btn, h, icon, modal, store, svgEl, toast, ICON } from "./dom";
import { currentProfile, openProfile } from "./profile";
import { summarize } from "../practices/perfil";
import { DrivePanel } from "./drive";
import { StageUI } from "./stage";
import { ProgramPanel } from "./programPanel";
import { ExploreUI } from "./explore";
import { PracticesUI } from "./practicesPanel";
import { ScenarioEditor } from "./editor";
import { openMakeCode } from "./makecodeModal";

export type Tab = "explorar" | "conducir" | "programar" | "practicas";

export class App {
  sim: Sim;
  scene!: Scene3D;
  stage: StageUI;
  drive: DrivePanel;
  program: ProgramPanel;
  explore: ExploreUI;
  practices: PracticesUI;
  editor: ScenarioEditor;
  tab: Tab = "conducir";
  advanced = store.get("advanced", false);
  /** Modo docente: solo existe en la versión del docente (local, con las soluciones). */
  teacher = __DOCENTE__ && store.get("teacher", true);
  scenarioId = store.get("scenario", "basica");
  private workspaceEl: HTMLElement;
  private rightCol: HTMLElement;
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  /** «Perfil del alumno»: muestra el nombre y el avance de quien está registrado. */
  private profileBtn!: HTMLButtonElement;
  /** Número de la práctica activa, en la pestaña «Prácticas». */
  private practiceBadge = h("span", { class: "tab-badge hidden", "aria-hidden": "true" });
  private modeBadge: HTMLElement;
  private last = performance.now();
  private uiTimer = 0;
  /** Último toque, clic, rueda o tecla: tras ellos se dibuja a ritmo completo un momento. */
  private lastInput = performance.now();
  private lastPose = "";
  private restFrame = 0;
  private hornCtx: AudioContext | null = null;

  constructor(root: HTMLElement) {
    const sc = this.loadStoredScenario();
    this.sim = new Sim(sc);
    const simRef = () => this.sim;
    this.stage = new StageUI(simRef, (id, st) => this.setLight(id, st));
    this.drive = new DrivePanel(simRef, {
      loadScenario: (id) => this.loadScenario(id),
      resetPosition: () => this.resetWorld(),
      setPlacing: (on) => this.stage.setTool(on ? "place" : "view"),
      openEditor: () => this.editor.open(),
      resetScenario: () => this.resetScenario(),
      takeManual: () => {
        this.sim.setMode("manual");
        toast("Control manual activado.");
      },
      rotate: (deg) => this.stage.rotatePlaced(deg),
    });
    this.stage.onPlaceBlocked = () => toast("Un programa tiene el mando: detenlo para colocar el robot.", "warn");
    this.program = new ProgramPanel(simRef, () => this.resetWorld());
    this.program.onMakeCode = () => openMakeCode(this.program.compile(), this.program.example?.title ?? null);
    this.program.onExampleLoaded = (ex) => this.prepareExample(ex);
    this.program.onScenarioFromFile = (s) => this.applyScenario(s, "archivo");
    this.explore = new ExploreUI(simRef, (part) => this.scene?.highlight(part));
    this.practices = new PracticesUI(this);
    this.program.onRun = () => this.practices.onProgramRun();
    this.explore.onQuiz = (id) => this.practices.quizAnswer(id);
    this.explore.onFlow = (key) => this.practices.exploreFlow(key);
    this.editor = new ScenarioEditor(this);

    // Barra superior
    const brand = h("div", { class: "brand" }, svgEl(LOGO), h("div", { class: "brand-text" }, h("strong", {}, "Conducción Inteligente"), h("span", {}, "Laboratorio Tiny Pro")),
      __DOCENTE__ && h("span", { class: "docente-badge", title: "Versión del docente: solo en este equipo. Tiene el modo docente y las soluciones; no la compartas con el alumnado." }, "DOCENTE"),
    );
    const tabs = h("nav", { class: "tabs", role: "tablist", "aria-label": "Espacios" });
    const defs: [Tab, string, keyof typeof ICON][] = [["explorar", "Explorar el robot", "explore"], ["conducir", "Conducir", "drive"], ["programar", "Programar", "code"], ["practicas", "Prácticas", "flag"]];
    for (const [id, label, ic] of defs) {
      const b = h("button", { class: "tab", role: "tab", type: "button", "aria-selected": "false" }, icon(ic), h("span", {}, label));
      b.title = label;
      // Cambiar de sección a mano cierra la ventana de la práctica (sigue activa).
      b.addEventListener("click", () => {
        this.practices.follows = false;
        this.setTab(id);
      });
      if (id === "practicas") b.append(this.practiceBadge);
      this.tabBtns.set(id, b);
      tabs.append(b);
    }
    this.modeBadge = h("div", { class: "mode-badge", "data-mode": "manual", role: "status" }, h("span", { class: "dot" }), h("span", {}, "MANUAL"));
    const pauseBtn = btn("Pausa", "pause", () => this.sim.setPaused(!this.sim.paused), "small");
    pauseBtn.id = "pause-global";
    pauseBtn.title = "Pausar o continuar la simulación (tecla P)";
    // En portátiles solo se ve el ícono: el nombre accesible no depende de la etiqueta.
    pauseBtn.setAttribute("aria-label", "Pausar o continuar la simulación");
    const emergency = btn("PARADA", "stop", () => this.emergency(), "emergency");
    emergency.title = "Parada de emergencia (tecla Esc): motores a 0 y programa detenido";
    emergency.setAttribute("aria-label", "Parada de emergencia");
    this.profileBtn = btn("Perfil", "person", () => void openProfile(this), "small profile-btn");
    this.renderProfileButton();
    const settings = btn("", "gear", () => this.openSettings(), "small icon-only");
    settings.title = "Ajustes";
    settings.setAttribute("aria-label", "Ajustes");
    const full = btn("", "full", () => this.toggleFullscreen(), "small icon-only");
    full.title = "Pantalla completa";
    full.setAttribute("aria-label", "Pantalla completa");
    const top = h("header", { class: "topbar" }, brand, tabs, h("div", { class: "top-actions" }, this.modeBadge, pauseBtn, this.profileBtn, settings, full, emergency));

    this.workspaceEl = h("main", { class: "workspace" });
    this.rightCol = h("div", { class: "right-col pane" });
    root.append(top, this.workspaceEl);

    this.scene = new Scene3D(this.stage.host, this.stage.camHost);
    // La cuadrícula de piezas viene activada (solo se dibuja: los sensores no la ven).
    this.scene.showGrid = store.get("grid", true);
    this.stage.attach(this.scene);
    this.scene.setScenario(this.sim.scenario);
    this.stage.buildLightControl(this.sim);
    this.drive.setScenarioValue(this.scenarioId);
    this.applyAdvanced();

    this.sim.on((e) => {
      if (e.type === "mode") this.renderMode();
      if (e.type === "run") this.renderMode();
      if (e.type === "pause") pauseBtn.querySelector("span")!.textContent = e.paused ? "Continuar" : "Pausa";
      if (e.type === "horn") this.beep();
      if (e.type === "melody") this.jingle(e.name);
    });

    // Primera visita: el robot empieza fuera de la línea para invitar a conducir hasta ella.
    if (!store.get("visitado", false)) {
      store.set("visitado", true);
      if (this.scenarioId === "basica") this.sim.placeRobot(52, 84, 0.45);
    }

    this.bindKeys();
    for (const ev of ["pointerdown", "pointermove", "wheel", "keydown"]) window.addEventListener(ev, () => (this.lastInput = performance.now()), { capture: true, passive: true });
    this.setTab(store.get<Tab>("tab", "conducir"));
    requestAnimationFrame(() => {
      this.scene.center();
      this.loop();
    });
  }

  // ───────── Escenarios ─────────

  private loadStoredScenario(): Scenario {
    const custom = store.get<Scenario | null>("scenario:custom", null);
    if (this.scenarioId === "personalizado" && custom && validateScenario(custom).length === 0) return custom;
    return (SCENARIOS[this.scenarioId] ?? SCENARIOS.basica)();
  }

  /**
   * Restablece el mapa original (pista, objetos, zonas y tamaño) y vuelve a
   * poner el robot en su salida. Si hay una práctica abierta, vuelve a su
   * escenario preparado.
   */
  async resetScenario() {
    const practice = this.practices.active;
    const base = practice ? `la práctica ${practice.n}` : (SCENARIO_LIST.find((s) => s.id === store.get("scenario:last", "basica"))?.name ?? "la pista básica");
    const ok = await modal({
      title: "¿Restablecer el escenario?",
      narrow: true,
      body: [h("p", {}, `Se quitarán todos los cambios del mapa (piezas, señales, obstáculos, zonas y tamaño) y volverá el escenario original de ${base}. El robot regresará a su salida.`)],
      actions: [
        { label: "Cancelar", value: "no" },
        { label: "Restablecer", value: "si", cls: "danger", icon: "reset" },
      ],
    });
    if (ok !== "si") return;
    if (this.editor.isOpen) this.editor.discard();
    this.sim.stopProgram();
    this.drive.release();
    store.del("scenario:custom");
    if (practice) {
      this.scenarioId = "practica";
      this.applyScenario(practiceScenario(practice), "practica");
    } else {
      this.loadScenario(store.get("scenario:last", "basica"));
    }
    this.resetWorld();
    this.setTab(this.tab);
    toast("Escenario restablecido: mapa original y robot en la salida.", "ok");
  }

  loadScenario(id: string) {
    const make = SCENARIOS[id];
    if (!make) return;
    this.scenarioId = id;
    store.set("scenario", id);
    store.set("scenario:last", id);
    this.applyScenario(make(), id);
  }

  /** Aplica un escenario (de la lista, de un archivo, de una práctica o del editor). */
  applyScenario(s: Scenario, source: string) {
    this.sim.setScenario(s);
    this.scene.setScenario(this.sim.scenario);
    this.stage.buildLightControl(this.sim);
    this.scene.center();
    if (source === "archivo" || source === "editor") {
      this.scenarioId = "personalizado";
      store.set("scenario", "personalizado");
      store.set("scenario:custom", this.sim.scenario);
    }
    this.drive.setScenarioValue(this.scenarioId);
  }

  resetWorld() {
    this.sim.resetWorld();
    this.drive.release();
    this.practices.onReset();
  }

  private setLight(id: string, st: LightState | "auto") {
    const l = this.sim.scenario.objects.find((o) => o.id === id) as LightObject | undefined;
    if (!l) return;
    if (st === "auto") {
      l.cycle.auto = true;
      // El ciclo automático empieza en rojo si estaba apagado.
      if (l.state === "apagado") l.state = "rojo";
    } else {
      l.cycle.auto = false;
      l.state = st;
    }
    toast(st === "auto" ? "Semáforo en modo automático." : st === "apagado" ? "Semáforo apagado." : `Semáforo en ${st}.`);
  }

  private prepareExample(ex: Example) {
    if (this.practices.active) {
      toast("Ejemplo cargado. El escenario de la práctica no cambia.");
      return;
    }
    const s = (SCENARIOS[ex.scenario] ?? SCENARIOS.basica)();
    ex.setup?.(s);
    if (ex.start) s.start = { ...ex.start };
    this.scenarioId = ex.scenario;
    this.applyScenario(s, "ejemplo");
    toast(`Escenario preparado para el ejemplo: ${ex.title}.`);
  }

  // ───────── Espacios ─────────

  setTab(tab: Tab) {
    this.tab = tab;
    store.set("tab", tab);
    for (const [id, b] of this.tabBtns) b.setAttribute("aria-selected", String(id === tab));
    this.workspaceEl.dataset.tab = tab;
    this.stage.el.classList.toggle("compact", tab === "programar");
    this.workspaceEl.replaceChildren();
    if (tab !== "conducir") {
      this.drive.release();
      this.stage.setTool(this.editor.isOpen ? "edit" : "view");
      this.drive.setPlacingState(false);
    }
    if (tab === "explorar") {
      this.workspaceEl.append(this.explore.figurePane, this.explore.side);
      this.explore.onShow();
    } else if (tab === "conducir") {
      this.workspaceEl.append(this.stage.el, this.editor.isOpen ? this.editor.side : this.drive.el);
    } else if (tab === "programar") {
      this.rightCol.replaceChildren(this.stage.el, this.program.debug);
      this.workspaceEl.append(this.program.left, this.rightCol);
      this.program.mount();
    } else {
      this.workspaceEl.append(this.stage.el, this.practices.side);
    }
    // En «Programar» el escenario es pequeño: la práctica va arriba del panel de lecturas, no encima del escenario.
    if (tab === "programar") this.practices.placeDrawer(this.program.debug, true);
    else this.practices.placeDrawer(tab === "explorar" ? this.explore.figurePane : this.stage.el);
    this.syncPractice();
    // El escenario cambió de sitio y de tamaño: la cámara se queda dentro de él.
    this.stage.placeCam();
    requestAnimationFrame(() => {
      this.scene.resize();
      this.program.resize();
      this.explore.resize();
    });
    this.renderMode();
  }

  renderProfileButton() {
    const p = currentProfile();
    const label = this.profileBtn.querySelector("span");
    if (label) label.textContent = p ? p.nombre.split(" ")[0] : "Perfil";
    this.profileBtn.classList.toggle("anon", !p);
    if (!p) {
      this.profileBtn.title = "Perfil del alumno: registra tu correo para guardar tu avance y tus calificaciones";
      return;
    }
    const s = summarize(this.practices?.records() ?? {});
    this.profileBtn.title = `Perfil del alumno · ${p.nombre} ${p.apellidos} · ${s.completadas} de ${s.total} prácticas (${s.avancePct} %)`;
  }

  /**
   * Modo práctica: la pestaña «Prácticas» muestra qué práctica sigue activa y,
   * mientras su ventana está a la vista (Prácticas, Conducir y Programar), la
   * cámara queda fija abajo a la derecha y al 90 % para no cruzarse con ella.
   */
  syncPractice() {
    this.stage.setCamLocked(Boolean(this.practices.active) && !this.practices.drawer.classList.contains("hidden") && this.tab !== "explorar");
    const p = this.practices.active;
    this.practiceBadge.textContent = p ? String(p.n) : "";
    this.practiceBadge.classList.toggle("hidden", !p);
    this.tabBtns.get("practicas")?.setAttribute("title", p ? `Prácticas · práctica ${p.n} activa` : "Prácticas");
  }

  private renderMode() {
    const m = this.sim.mode;
    this.modeBadge.dataset.mode = m;
    this.modeBadge.lastElementChild!.textContent = m === "manual" ? "MANUAL" : this.sim.interp.running ? "PROGRAMA EN MARCHA" : "PROGRAMA";
  }

  emergency() {
    this.drive.release();
    this.sim.emergencyStop();
    toast("Parada de emergencia: motores a 0.", "warn");
  }

  // ───────── Ajustes ─────────

  applyAdvanced() {
    this.drive.setAdvanced(this.advanced);
    this.sim.sensors.options.noise = this.advanced && store.get("noise", false);
    this.sim.sensors.options.delayMs = this.advanced ? store.get("delay", 0) : 0;
  }

  async openSettings() {
    const sw = (key: string, title: string, desc: string, value: boolean) => {
      const input = h("input", { type: "checkbox" }) as HTMLInputElement;
      input.checked = value;
      input.dataset.key = key;
      return h("label", { class: "switch" }, h("span", {}, h("b", {}, title), h("small", {}, desc)), input);
    };
    const delay = h("input", { type: "range", min: 0, max: 400, step: 50, value: store.get("delay", 0) }) as HTMLInputElement;
    const delayOut = h("output", {}, `${delay.value} ms`);
    delay.addEventListener("input", () => (delayOut.textContent = `${delay.value} ms`));
    const body = h(
      "div",
      {},
      sw("advanced", "Modo avanzado", "Control de cada motor, editor de escenarios, ruido y retraso de sensores.", this.advanced),
      sw("noise", "Ruido en los sensores (avanzado)", "Lecturas imperfectas como en el robot real. El modo inicial es predecible.", store.get("noise", false)),
      h("div", { class: "switch" }, h("span", {}, h("b", {}, "Retraso de los sensores (avanzado)"), h("small", {}, "El programa recibe lecturas antiguas.")), h("div", { class: "row" }, delay, delayOut)),
      __DOCENTE__ && sw("teacher", "Modo docente", "Desbloquea todas las prácticas, muestra las soluciones y verifica los reportes de los alumnos. Apágalo para ver el simulador como un alumno.", this.teacher),
      sw("grid", "Cuadrícula de piezas en el tapete", "Ayuda a colocar piezas de pista. Solo se dibuja: no cambia lo que leen los sensores.", this.scene.showGrid),
    );
    const res = await modal({
      title: "Ajustes",
      narrow: true,
      body: [body, h("p", { class: "help" }, "Los ajustes y tu progreso se guardan en este navegador.")],
      actions: [
        { label: "Borrar progreso", value: "reset", cls: "ghost" },
        { label: "Aplicar", value: "ok", cls: "primary", icon: "check" },
      ],
    });
    if (res === "reset") {
      if ((await modal({ title: "¿Borrar progreso?", narrow: true, body: ["Se borrarán las prácticas completadas y los programas guardados en este navegador."], actions: [{ label: "Cancelar", value: "no" }, { label: "Borrar", value: "si", cls: "danger" }] })) === "si") {
        Object.keys(localStorage).filter((k) => k.startsWith("tinypro:")).forEach((k) => localStorage.removeItem(k));
        location.reload();
      }
      return;
    }
    if (res !== "ok") return;
    const get = (k: string) => (body.querySelector(`input[data-key="${k}"]`) as HTMLInputElement).checked;
    this.advanced = get("advanced");
    store.set("advanced", this.advanced);
    if (__DOCENTE__) {
      this.teacher = get("teacher");
      store.set("teacher", this.teacher);
    }
    store.set("noise", get("noise"));
    store.set("delay", Number(delay.value));
    this.scene.showGrid = get("grid");
    store.set("grid", this.scene.showGrid);
    this.scene.refreshFloor();
    this.applyAdvanced();
    this.practices.render();
    toast("Ajustes aplicados.", "ok");
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => toast("El navegador no permitió la pantalla completa.", "warn"));
  }

  /**
   * Sonido corto para «tocar melodía». Es una aproximación: no reproduce la
   * melodía real de MakeCode, solo avisa de que el robot la tocaría.
   */
  /** Contexto de sonido listo para sonar (Safari lo crea suspendido). */
  private audio(): AudioContext {
    // Safari antiguo (iPad viejos) solo tiene el nombre con prefijo.
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.hornCtx ??= new AC();
    if (this.hornCtx.state === "suspended") void this.hornCtx.resume();
    return this.hornCtx;
  }

  private jingle(name: string) {
    try {
      const ctx = this.audio();
      let seed = 0;
      for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
      const base = 392 + (seed % 7) * 44;
      [0, 4, 7, 12].forEach((semi, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const t = ctx.currentTime + i * 0.12;
        o.type = "triangle";
        o.frequency.value = base * Math.pow(2, (name.includes("down") || name.includes("funereal") ? -semi : semi) / 12);
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.12);
      });
    } catch {
      /* sin audio */
    }
  }

  private beep() {
    try {
      const ctx = this.audio();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 523;
      o.type = "square";
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    } catch {
      /* sin audio */
    }
  }

  // ───────── Teclado y bucle ─────────

  private bindKeys() {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t instanceof Element && t.closest("input, textarea, select, .blocklyDiv, .blocklyWidgetDiv, [contenteditable]") !== null;
    };
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.querySelector(".modal-back")) {
        this.emergency();
        return;
      }
      if (typing(e) || document.querySelector(".modal-back")) return;
      if ((e.key === "p" || e.key === "P") && !e.repeat) {
        this.sim.setPaused(!this.sim.paused);
        return;
      }
      if (this.stage.tool === "place" && (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E")) {
        this.stage.rotatePlaced(e.key.toLowerCase() === "q" ? -15 : 15);
        e.preventDefault();
        return;
      }
      if (this.tab === "conducir" || this.tab === "practicas") {
        if (this.drive.key(e, true)) e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (this.drive.key(e, false)) e.preventDefault();
    });
    window.addEventListener("blur", () => this.drive.release());
  }

  private loop = () => {
    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now;
    this.sim.update(dt, this.program.speed);
    // Colocar el robot y mover objetos en el editor: siguen al puntero con suavidad.
    this.stage.tick(dt);
    this.editor.tick(dt);
    const stageVisible = this.tab !== "explorar";
    if (stageVisible) {
      // En reposo (nada se mueve, no hay programa y nadie toca la pantalla) el
      // escenario se dibuja una de cada cuatro veces: ahorra tarjeta gráfica y batería.
      const r = this.sim.robot;
      const pose = `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.heading.toFixed(3)}`;
      const busy = pose !== this.lastPose || (this.sim.interp.running && !this.sim.paused) || now - this.lastInput < 1500;
      this.lastPose = pose;
      this.restFrame = busy ? 0 : (this.restFrame + 1) % 4;
      if (this.restFrame === 0) {
        this.scene.sync(this.sim);
        this.scene.render(this.sim);
      }
      this.stage.update(this.sim);
    }
    this.uiTimer += dt;
    if (this.uiTimer > 0.15) {
      this.uiTimer = 0;
      this.drive.update(this.sim);
      if (this.tab === "programar") this.program.update(this.sim);
      this.practices.update(this.sim);
      this.renderMode();
    }
    if (this.tab === "explorar") this.explore.update(this.sim, dt);
    requestAnimationFrame(this.loop);
  };

  /** Categorías de bloques disponibles (las prácticas las limitan). */
  setToolbox(cats = ALL_CATEGORIES) {
    this.program.setCategories(cats);
  }

  freshScenario(id: string): Scenario {
    return cloneScenario((SCENARIOS[id] ?? SCENARIOS.basica)());
  }
}

const LOGO = `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#131c33" stroke="#33436b"/><path d="M8 29c6-10 10 4 16-6s7-9 8-9" fill="none" stroke="#e8edf8" stroke-width="2.4" stroke-linecap="round"/><rect x="13" y="9" width="12" height="8" rx="2" fill="#fbbf24"/><circle cx="12" cy="29" r="4" fill="#22d3ee"/><circle cx="27" cy="29" r="4" fill="#e879f9"/></svg>`;
