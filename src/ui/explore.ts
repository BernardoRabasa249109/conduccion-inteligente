/**
 * Espacio "Explorar el robot": el modelo 3D del Tiny:bit Pro (modelo3D/) sobre
 * un plano técnico, ficha de cada componente con botón «Probar» y la
 * demostración manual percibir → decidir → actuar.
 */
import type { Sim } from "../core/sim";
import { ExploreScene } from "../render/exploreScene";
import type { PartName } from "../render/robotModel";
import { iconPattern } from "../render/robotModel";
import { btn, h, icon, toast } from "./dom";

type Comp = "microbit" | "motorL" | "motorR" | "irL" | "irR" | "sonar" | "camera" | "leds";
type Role = "percibir" | "decidir" | "actuar";

const ROLE_COLOR: Record<Role, string> = { percibir: "#22d3ee", decidir: "#fbbf24", actuar: "#e879f9" };
const ROLE_NAME: Record<Role, string> = { percibir: "Percibe", decidir: "Decide", actuar: "Actúa" };

const COMPONENTS: Record<Comp, { name: string; role: Role; does: string; input: string; output: string }> = {
  microbit: {
    name: "micro:bit",
    role: "decidir",
    does: "Ejecuta tu programa: lee los sensores, decide y da órdenes.",
    input: "Lecturas de los sensores de línea y del ultrasonido, y el nombre de la señal que le envía el K210 por el puerto serie.",
    output: "Velocidad para cada motor, iconos en la matriz LED, luces y sonido.",
  },
  motorL: {
    name: "Motor izquierdo",
    role: "actuar",
    does: "Hace girar la rueda izquierda hacia delante o hacia atrás.",
    input: "Una velocidad de −255 a 255 enviada por la micro:bit (Tinybit.car_sport).",
    output: "Giro de la rueda. Si va más rápida que la derecha, el robot gira a la derecha.",
  },
  motorR: {
    name: "Motor derecho",
    role: "actuar",
    does: "Hace girar la rueda derecha hacia delante o hacia atrás.",
    input: "Una velocidad de −255 a 255 enviada por la micro:bit.",
    output: "Giro de la rueda. Si va más rápida que la izquierda, el robot gira a la izquierda.",
  },
  irL: {
    name: "Sensor de línea izquierdo",
    role: "percibir",
    does: "Ilumina el suelo con luz infrarroja y mide cuánta luz vuelve. El negro la absorbe.",
    input: "El reflejo del suelo justo debajo de él.",
    output: "1 si ve negro, 0 si ve blanco (pin P13).",
  },
  irR: {
    name: "Sensor de línea derecho",
    role: "percibir",
    does: "Igual que el izquierdo, a 1,4 cm de distancia. Juntos indican hacia dónde está la línea.",
    input: "El reflejo del suelo justo debajo de él.",
    output: "1 si ve negro, 0 si ve blanco (pin P14).",
  },
  sonar: {
    name: "Ultrasonido",
    role: "percibir",
    does: "Emite un pulso de sonido que no oímos y mide cuánto tarda en volver el eco.",
    input: "El eco del objeto que tiene delante (cono de unos 30°).",
    output: "La distancia en centímetros. Devuelve 0 si no vuelve ningún eco.",
  },
  camera: {
    name: "Cámara y módulo K210",
    role: "percibir",
    does: "Es otra placa con su propia cámara y su propio programa de visión. Reconoce señales y semáforos.",
    input: "Las imágenes de lo que tiene delante.",
    output: "El nombre de la señal reconocida, que envía a la micro:bit. En este simulador la visión es simulada.",
  },
  leds: {
    name: "Matriz LED",
    role: "actuar",
    does: "Las 25 luces de la micro:bit, para mostrar iconos y flechas.",
    input: "La orden «mostrar icono» de la micro:bit.",
    output: "Un dibujo visible. En la micro:bit real, mostrar un icono hace una pausa de 0,6 s.",
  },
};

const ORDER: Comp[] = ["microbit", "irL", "irR", "sonar", "camera", "motorL", "motorR", "leds"];

/** Preguntas de la práctica 1: id de la comprobación → componentes correctos. */
const QUIZ: { id: string; q: string; ok: Comp[] }[] = [
  { id: "linea", q: "¿Qué componente lee la línea negra del suelo?", ok: ["irL", "irR"] },
  { id: "distancia", q: "¿Qué componente mide la distancia a un obstáculo?", ok: ["sonar"] },
  { id: "senales", q: "¿Qué componente reconoce las señales de tráfico?", ok: ["camera"] },
  { id: "decide", q: "¿Qué componente ejecuta tu programa y decide?", ok: ["microbit"] },
  { id: "mueve", q: "¿Qué componente hace girar una rueda?", ok: ["motorL", "motorR"] },
  { id: "iconos", q: "¿Qué componente muestra iconos?", ok: ["leds"] },
];

/** Sensores de línea a ±7 mm del centro; la línea mide 24 mm (como en la pista). */
const SENSOR_MM = 7;
const LINE_HALF_MM = 12;

const LINE_POS: { label: string; u: number }[] = [
  { label: "Línea a la izquierda", u: 10 },
  { label: "Línea centrada", u: 0 },
  { label: "Línea a la derecha", u: -10 },
  { label: "Sin línea", u: 30 },
];

export class ExploreUI {
  readonly figurePane: HTMLElement;
  readonly side: HTMLElement;
  onQuiz: (id: string) => void = () => {};
  /** Se llama al completar percibir → decidir → actuar con una lectura («11», «10», «01», «00»). */
  onFlow: (key: string) => void = () => {};
  private card: HTMLElement;
  private view = new ExploreScene();
  private readout: HTMLElement;
  private info: HTMLElement;
  private infoCard: HTMLElement;
  private infoHelp = h("p", { class: "help" }, "Elige un componente para ver qué hace, qué recibe y qué produce.");
  private compBtns = new Map<Comp, HTMLButtonElement>();
  private selected: Comp | null = null;
  private quizCard: HTMLElement;
  private quizIndex = -1;
  private pda: { p: HTMLElement; d: HTMLElement; a: HTMLElement };
  private slider: HTMLInputElement;
  // Estado animado de la figura
  private u = 0;
  private uTarget = 0;
  private wheelSpeed = { motorL: 0, motorR: 0 };
  private flow: { stage: number; t: number; key: string } = { stage: 3, t: 0, key: "" };
  private test: { comp: Comp | null; t: number } = { comp: null, t: 0 };
  private icon = "";

  constructor(private sim: () => Sim, private highlight3d: (p: PartName | null) => void) {
    this.readout = h("span", { class: "fig-corner br", "aria-live": "polite" }, "");
    const loading = h("div", { class: "explore-loading" }, "Cargando el modelo 3D…");
    const home = btn("Vista inicial", "center", () => this.view.resetView(), "small ghost explore-home");
    home.title = "Volver a la vista de frente";
    this.card = h(
      "div",
      { class: "fig-card", role: "group", "aria-label": "Modelo 3D del robot Tiny:bit Pro. Arrastra para girarlo y toca un componente." },
      this.view.el,
      loading,
      h("span", { class: "fig-corner tl" }, "Modelo 3D"),
      h("span", { class: "fig-corner tr" }, "Tiny:bit Pro · plano técnico"),
      h("span", { class: "fig-corner bl" }, "Toca un componente · arrastra para girar"),
      home,
      this.readout,
    );
    this.view.onPick = (c) => (c ? this.select(c) : this.deselect());
    this.view.ready.then(
      () => loading.remove(),
      () => (loading.textContent = "No se pudo cargar el modelo 3D. Usa la lista de componentes de la derecha."),
    );
    this.figurePane = h("div", { class: "pane explore-fig" }, this.card);

    // Lista de componentes
    const list = h("div", { class: "comp-list" });
    for (const c of ORDER) {
      const info = COMPONENTS[c];
      const b = h("button", { class: "comp", type: "button", "aria-pressed": "false" }, h("i", { style: `background:${ROLE_COLOR[info.role]}` }), info.name);
      b.addEventListener("click", () => this.select(c));
      this.compBtns.set(c, b);
      list.append(b);
    }
    this.info = h("div", { class: "comp-info" }, this.infoHelp);
    const legend = h(
      "div",
      { class: "row", style: "gap:14px;margin-top:10px;font-size:14px;color:var(--text-2)" },
      ...(["percibir", "decidir", "actuar"] as Role[]).map((r) => h("span", {}, h("i", { style: `display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;background:${ROLE_COLOR[r]}` }), ROLE_NAME[r])),
    );

    // Percibir → decidir → actuar
    const step = (cls: string, title: string) => {
      const span = h("span", {}, "—");
      const el = h("div", { class: `step ${cls}` }, h("b", {}, title), span);
      return { el, span };
    };
    const p = step("p", "Percibir"), d = step("d", "Decidir"), a = step("a", "Actuar");
    this.pda = { p: p.el, d: d.el, a: a.el };
    const posRow = h("div", { class: "row" });
    for (const pos of LINE_POS) posRow.append(btn(pos.label, null, () => this.moveLine(pos.u), "small"));
    this.slider = h("input", { type: "range", min: -30, max: 30, step: 1, value: 0, "aria-label": "Mover la línea bajo los sensores" }) as HTMLInputElement;
    this.slider.addEventListener("input", () => this.moveLine(Number(this.slider.value)));
    const pdaCard = h(
      "div",
      { class: "card" },
      h("div", { class: "section-title" }, icon("bolt"), "Percibir → decidir → actuar"),
      h("p", { class: "help" }, "Mueve la regleta: los sensores leen la línea, la micro:bit decide y las ruedas responden."),
      h("div", { class: "pda" }, p.el, d.el, a.el),
      h("div", { style: "margin-top:10px" }, posRow),
      h("div", { class: "range-row" }, h("label", {}, "Regleta"), this.slider, h("output", {}, "")),
      h("p", { class: "help", style: "margin-top:8px;font-size:14.5px" }, "La línea la leen los sensores de abajo. La cámara del K210 no sigue la línea: reconoce señales."),
    );

    this.quizCard = h("div", { class: "card hidden" });
    this.infoCard = h("div", { class: "card" }, this.info);
    this.side = h(
      "div",
      { class: "side pane" },
      this.quizCard,
      h("div", { class: "card" }, h("div", { class: "section-title" }, icon("explore"), "Componentes"), list, legend),
      this.infoCard,
      pdaCard,
    );
    this.moveLine(0, true);

    // Tocar fuera de los componentes quita la selección. La ficha del
    // componente (con «Probar») cuenta como parte de la selección.
    document.addEventListener("pointerdown", (e) => {
      const t = e.target;
      if (!this.selected || !this.figurePane.isConnected || !(t instanceof Element)) return;
      if ([...this.compBtns.values()].some((b) => b.contains(t))) return;
      if (this.view.el.contains(t)) return; // el modelo 3D atiende sus propios toques
      if (this.infoCard.contains(t)) return;
      this.deselect();
    });
  }

  onShow() {
    this.resize();
  }

  resize() {
    this.view.resize();
  }

  setQuiz(on: boolean) {
    this.quizIndex = on ? 0 : -1;
    this.renderQuiz();
  }

  private renderQuiz() {
    this.quizCard.classList.toggle("hidden", this.quizIndex < 0);
    if (this.quizIndex < 0) return;
    if (this.quizIndex >= QUIZ.length) {
      this.quizCard.replaceChildren(h("div", { class: "done-banner" }, icon("trophy"), "¡Reconociste todos los componentes!"));
      return;
    }
    const q = QUIZ[this.quizIndex];
    this.quizCard.replaceChildren(h("div", { class: "section-title" }, icon("question"), `Pregunta ${this.quizIndex + 1} de ${QUIZ.length}`), h("p", { style: "font-size:19px;font-weight:700" }, q.q), h("p", { class: "help", style: "margin-top:6px" }, "Toca el componente en la figura o en la lista."));
  }

  select(c: Comp) {
    const quiz = this.quizIndex >= 0 && this.quizIndex < QUIZ.length;
    // Tocar otra vez el componente elegido lo deselecciona (durante el
    // cuestionario no, para que cada toque cuente como respuesta).
    if (c === this.selected && !quiz) {
      this.deselect();
      return;
    }
    this.selected = c;
    const info = COMPONENTS[c];
    for (const [k, b] of this.compBtns) b.setAttribute("aria-pressed", String(k === c));
    this.card.dataset.selected = c;
    this.card.style.setProperty("--sel", ROLE_COLOR[info.role]);
    this.view.setSelected(c, ROLE_COLOR[info.role]);
    this.highlight3d(c as PartName);
    this.info.replaceChildren(
      h("span", { class: `role ${info.role}` }, ROLE_NAME[info.role]),
      h("h3", {}, info.name),
      h("p", {}, info.does),
      h("div", { class: "io" }, h("div", {}, h("b", {}, info.role === "actuar" ? "Recibe la orden" : "Recibe"), info.input), h("div", {}, h("b", {}, info.role === "percibir" ? "Entrega" : "Produce"), info.output)),
      btn("Probar", "play", () => this.tryComp(c), "primary"),
    );
    if (this.quizIndex >= 0 && this.quizIndex < QUIZ.length) {
      const q = QUIZ[this.quizIndex];
      if (q.ok.includes(c)) {
        this.onQuiz(q.id);
        toast(`¡Correcto! ${info.name}.`, "ok");
        this.quizIndex += 1;
        this.renderQuiz();
      } else toast(`Ese es «${info.name}». Prueba otra vez.`, "warn");
    }
  }

  /** Quita la selección: botones, figura, robot 3D y ficha vuelven al inicio. */
  deselect() {
    if (!this.selected) return;
    this.selected = null;
    this.test = { comp: null, t: 0 };
    for (const b of this.compBtns.values()) b.setAttribute("aria-pressed", "false");
    delete this.card.dataset.selected;
    this.card.style.removeProperty("--sel");
    this.view.setSelected(null);
    this.highlight3d(null);
    this.info.replaceChildren(this.infoHelp);
  }

  /** «Probar»: una pequeña demostración del componente en la figura. */
  private tryComp(c: Comp) {
    this.test = { comp: c, t: 0 };
    if (c === "irL") this.moveLine(12);
    if (c === "irR") this.moveLine(-12);
    if (c === "microbit" || c === "leds") this.icon = "Heart";
  }

  private moveLine(u: number, instant = false) {
    this.uTarget = Math.max(-30, Math.min(30, u));
    this.slider.value = String(Math.round(this.uTarget));
    if (instant) this.u = this.uTarget;
  }

  /** Lectura de los sensores sobre la regleta (la misma regla que en la pista). */
  private readings(): [0 | 1, 0 | 1] {
    const half = LINE_HALF_MM, s = SENSOR_MM;
    return [Math.abs(s - this.u) <= half ? 1 : 0, Math.abs(-s - this.u) <= half ? 1 : 0];
  }

  update(_sim: Sim, dt: number) {
    // Regleta: sigue al objetivo con suavidad.
    this.u += (this.uTarget - this.u) * (1 - Math.exp(-dt / 0.18));
    if (Math.abs(this.uTarget - this.u) < 0.05) this.u = this.uTarget;
    this.view.setLine(this.u);
    const [l, r] = this.readings();

    // Percibir → decidir → actuar, paso a paso cada vez que cambia la lectura.
    const key = `${l}${r}`;
    if (key !== this.flow.key && Math.abs(this.uTarget - this.u) < 0.5) this.flow = { stage: 0, t: 0, key };
    this.flow.t += dt;
    if (this.flow.stage < 3 && this.flow.t > 0.55) {
      this.flow.stage += 1;
      this.flow.t = 0;
      if (this.flow.stage === 3) this.onFlow(this.flow.key);
    }
    const st = this.flow.stage;
    const dec = this.decide(l, r);
    this.pda.p.classList.toggle("on", st === 0 || st === 3);
    this.pda.d.classList.toggle("on", st === 1 || st === 3);
    this.pda.a.classList.toggle("on", st >= 2);
    (this.pda.p.lastChild as HTMLElement).textContent = `Izq ${l} · Der ${r}`;
    (this.pda.d.lastChild as HTMLElement).textContent = st >= 1 ? dec.text : "…";
    (this.pda.a.lastChild as HTMLElement).textContent = st >= 2 ? `Izq ${dec.l} · Der ${dec.r}` : "…";
    this.view.setIr(l, r, st === 0 || this.test.comp === "irL", st === 0 || this.test.comp === "irR");

    // Ruedas: la velocidad que decidió el programa (o la prueba de un motor).
    let target = st >= 2 ? { motorL: dec.l, motorR: dec.r } : this.wheelSpeed;
    let led = st >= 2 ? dec.icon : this.icon;
    if (this.test.comp) {
      this.test.t += dt;
      if (this.test.comp === "motorL") target = { motorL: 180, motorR: 0 };
      if (this.test.comp === "motorR") target = { motorL: 0, motorR: 180 };
      if (this.test.comp === "microbit" || this.test.comp === "leds") led = ["Heart", "Happy", "Yes", "Diamond"][Math.floor(this.test.t / 0.7) % 4];
      if (this.test.t > 3) this.test = { comp: null, t: 0 };
    }
    this.wheelSpeed = target;
    this.view.spinWheels(this.wheelSpeed, dt);
    this.view.setLeds(iconPattern(led));
    this.view.setDemo(this.test.comp === "sonar" || this.test.comp === "camera" ? this.test.comp : null);
    this.view.render(dt);

    let text = `Sensores ${l} · ${r} — motores ${dec.l} · ${dec.r}`;
    if (this.test.comp === "sonar") text = `Ultrasonido: eco a ${this.view.sonarCm} cm de la pared`;
    if (this.test.comp === "camera") text = "Visión simulada: reconoce «girar a la izquierda»";
    if (this.readout.textContent !== text) this.readout.textContent = text;
  }

  private decide(l: 0 | 1, r: 0 | 1): { text: string; l: number; r: number; icon: string } {
    if (l && r) return { text: "Los dos ven negro → sigo recto", l: 150, r: 150, icon: "flecha-North" };
    if (l) return { text: "La línea está a mi izquierda → giro a la izquierda", l: 20, r: 150, icon: "flecha-West" };
    if (r) return { text: "La línea está a mi derecha → giro a la derecha", l: 150, r: 20, icon: "flecha-East" };
    return { text: "No veo la línea → me detengo", l: 0, r: 0, icon: "No" };
  }
}
