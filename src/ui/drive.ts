/**
 * Conducción manual: botones táctiles y teclado. Mientras se mantiene pulsado
 * un control, los motores reciben la orden; al soltarlo, se detienen.
 */
import type { Sim } from "../core/sim";
import { SCENARIO_LIST } from "../scenarios/defaults";
import { btn, h, icon, toast } from "./dom";

type Dir = "up" | "down" | "left" | "right";

export class DrivePanel {
  readonly el: HTMLElement;
  speed = 150;
  private held = new Set<Dir>();
  private motorHold = false;
  private padBtns = new Map<Dir, HTMLButtonElement>();
  private lockNote: HTMLElement;
  private advancedBox: HTMLElement;
  private leftIn: HTMLInputElement;
  private rightIn: HTMLInputElement;
  private scenarioSel: HTMLSelectElement;
  private placeBtn: HTMLButtonElement;
  private placeRow: HTMLElement;
  private angleOut: HTMLElement;
  readonly editBtn: HTMLButtonElement;

  constructor(
    private sim: () => Sim,
    private actions: {
      loadScenario: (id: string) => void;
      resetPosition: () => void;
      setPlacing: (on: boolean) => void;
      openEditor: () => void;
      resetScenario: () => void;
      takeManual: () => void;
      rotate: (deg: number) => void;
    },
  ) {
    // Escenario
    this.scenarioSel = h("select", { class: "select", "aria-label": "Escenario" }) as HTMLSelectElement;
    for (const s of SCENARIO_LIST) this.scenarioSel.append(h("option", { value: s.id }, s.name));
    this.scenarioSel.addEventListener("change", () => actions.loadScenario(this.scenarioSel.value));
    this.placeBtn = btn("Colocar robot", "move", () => {
      const on = this.placeBtn.getAttribute("aria-pressed") !== "true";
      this.placeBtn.setAttribute("aria-pressed", String(on));
      actions.setPlacing(on);
      this.placeRow.classList.toggle("hidden", !on);
      if (on) toast("Arrastra el robot para moverlo. Arrastra el tirador ámbar para girarlo.");
    }, "toggle");
    this.placeBtn.setAttribute("aria-pressed", "false");
    this.editBtn = btn("Editar escenario", "edit", () => actions.openEditor(), "");
    this.angleOut = h("b", {}, "0°");
    const rotL = btn("15°", "spinL", () => actions.rotate(-15), "small");
    rotL.title = "Girar 15° a la izquierda (tecla Q)";
    rotL.setAttribute("aria-label", "Girar 15 grados a la izquierda");
    const rotR = btn("15°", "rotate", () => actions.rotate(15), "small");
    rotR.title = "Girar 15° a la derecha (tecla E)";
    rotR.setAttribute("aria-label", "Girar 15 grados a la derecha");
    this.placeRow = h(
      "div",
      { class: "place-row hidden" },
      h("span", {}, "Ángulo"),
      this.angleOut,
      rotL,
      rotR,
      h("p", { class: "keys-hint", style: "margin:0;width:100%" }, "Arrastra el robot para moverlo y el tirador ámbar para girarlo. Shift: de 15 en 15°. Teclas ", h("kbd", {}, "Q"), " ", h("kbd", {}, "E"), "."),
    );
    const scen = h(
      "div",
      { class: "card" },
      h("div", { class: "section-title" }, icon("layers"), "Escenario"),
      this.scenarioSel,
      h("div", { class: "row", style: "margin-top:10px" }, btn("Reiniciar posición", "reset", () => actions.resetPosition()), this.placeBtn, this.editBtn),
      h(
        "div",
        { class: "row", style: "margin-top:8px" },
        btn("Restablecer escenario", "layers", () => actions.resetScenario(), "scenario-reset"),
      ),
      this.placeRow,
    );

    // Mando
    this.lockNote = h("div", { class: "note warn hidden" }, "Un programa tiene el mando. ", btn("Detener programa y conducir", "stop", () => actions.takeManual(), "small"));
    const pad = h("div", { class: "pad" });
    const cell = (d: Dir | null, label: string, ic: Parameters<typeof icon>[0] | null, cls = "") => {
      if (!d) {
        const stop = btn(label, "stop", () => this.release(), `stop ${cls}`);
        stop.title = "Detener (barra espaciadora)";
        return stop;
      }
      const b = h("button", { type: "button", class: `btn ${cls}`, "aria-label": label }, icon(ic!), h("span", {}, label));
      const press = (e: Event) => {
        e.preventDefault();
        this.press(d);
      };
      const lift = () => this.lift(d);
      b.addEventListener("pointerdown", (e) => {
        b.setPointerCapture(e.pointerId);
        press(e);
      });
      b.addEventListener("pointerup", lift);
      b.addEventListener("pointercancel", lift);
      b.addEventListener("lostpointercapture", lift);
      b.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) press(e);
      });
      b.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") lift();
      });
      this.padBtns.set(d, b);
      return b;
    };
    pad.append(
      h("span"), cell("up", "Avanzar", "up"), h("span"),
      cell("left", "Izquierda", "left"), cell(null, "Detener", null), cell("right", "Derecha", "right"),
      h("span"), cell("down", "Retroceder", "down"), h("span"),
    );
    const out = h("output", {}, String(this.speed));
    const range = h("input", { type: "range", min: 60, max: 255, step: 5, value: this.speed, "aria-label": "Velocidad" }) as HTMLInputElement;
    range.addEventListener("input", () => {
      this.speed = Number(range.value);
      out.textContent = range.value;
      this.apply();
    });
    const drive = h(
      "div",
      { class: "card" },
      h("div", { class: "section-title" }, icon("drive"), "Conducción manual"),
      this.lockNote,
      pad,
      h("div", { class: "range-row" }, h("label", {}, "Velocidad"), range, out),
      h("p", { class: "keys-hint" }, "Teclado: ", h("kbd", {}, "↑"), " ", h("kbd", {}, "↓"), " ", h("kbd", {}, "←"), " ", h("kbd", {}, "→"), " o ", h("kbd", {}, "W A S D"), ". Al soltar, el robot se detiene. ", h("kbd", {}, "Esc"), " = parada de emergencia."),
    );

    // Control de cada motor (modo avanzado)
    this.leftIn = h("input", { type: "number", min: -255, max: 255, value: 120, "aria-label": "PWM motor izquierdo" }) as HTMLInputElement;
    this.rightIn = h("input", { type: "number", min: -255, max: 255, value: 200, "aria-label": "PWM motor derecho" }) as HTMLInputElement;
    const hold = h("button", { type: "button", class: "btn primary", style: "width:100%;margin-top:10px" }, icon("play"), h("span", {}, "Mantén pulsado para aplicar"));
    const start = (e: PointerEvent) => {
      hold.setPointerCapture(e.pointerId);
      this.motorHold = true;
      hold.classList.add("held");
      this.apply();
    };
    const stop = () => {
      this.motorHold = false;
      hold.classList.remove("held");
      this.apply();
    };
    hold.addEventListener("pointerdown", start);
    hold.addEventListener("pointerup", stop);
    hold.addEventListener("pointercancel", stop);
    hold.addEventListener("lostpointercapture", stop);
    this.advancedBox = h(
      "div",
      { class: "card hidden" },
      h("div", { class: "section-title" }, icon("bolt"), "Cada motor por separado"),
      h("p", { class: "help" }, "Escribe la velocidad de cada rueda (−255 a 255) y mantén pulsado el botón."),
      h("div", { class: "motor-grid", style: "margin-top:10px" }, h("label", {}, "Motor izquierdo", this.leftIn), h("label", {}, "Motor derecho", this.rightIn)),
      hold,
    );
    this.el = h("div", { class: "side pane" }, drive, this.advancedBox, scen);
  }

  setScenarioValue(id: string) {
    if ([...this.scenarioSel.options].some((o) => o.value === id)) this.scenarioSel.value = id;
  }

  setAdvanced(on: boolean) {
    this.advancedBox.classList.toggle("hidden", !on);
  }

  setPlacingState(on: boolean) {
    this.placeBtn.setAttribute("aria-pressed", String(on));
    this.placeRow.classList.toggle("hidden", !on);
  }

  update(sim: Sim) {
    const locked = sim.mode !== "manual";
    this.lockNote.classList.toggle("hidden", !locked);
    const deg = `${Math.round((((sim.robot.heading * 180) / Math.PI) % 360 + 360) % 360)}°`;
    if (this.angleOut.textContent !== deg) this.angleOut.textContent = deg;
  }

  press(d: Dir) {
    if (this.sim().mode !== "manual") {
      toast("El programa tiene el mando. Detenlo para conducir a mano.", "warn");
      return;
    }
    this.held.add(d);
    this.apply();
  }

  lift(d: Dir) {
    this.held.delete(d);
    this.apply();
  }

  release() {
    this.held.clear();
    this.motorHold = false;
    this.apply();
  }

  /** Traduce los controles pulsados a PWM de cada motor. */
  private apply() {
    for (const [d, b] of this.padBtns) b.classList.toggle("held", this.held.has(d));
    const sim = this.sim();
    if (sim.mode !== "manual") return;
    if (this.motorHold) {
      sim.setManual(Number(this.leftIn.value) || 0, Number(this.rightIn.value) || 0);
      return;
    }
    const s = this.speed;
    const f = (this.held.has("up") ? 1 : 0) - (this.held.has("down") ? 1 : 0);
    const t = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    let l = 0, r = 0;
    if (f !== 0 && t !== 0) {
      // Curva: una rueda más rápida que la otra.
      l = f * s * (t > 0 ? 1 : 0.35);
      r = f * s * (t < 0 ? 1 : 0.35);
    } else if (f !== 0) {
      l = r = f * s;
    } else if (t !== 0) {
      // Giro sobre sí mismo: ruedas en sentidos opuestos.
      l = t * s * 0.55;
      r = -t * s * 0.55;
    }
    sim.setManual(l, r);
  }

  /** Teclado: devuelve true si la tecla se usó. */
  key(e: KeyboardEvent, down: boolean): boolean {
    const map: Record<string, Dir> = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const d = map[e.key];
    if (d) {
      if (down && !e.repeat) this.press(d);
      if (!down) this.lift(d);
      return true;
    }
    if (e.key === " " && down) {
      this.release();
      return true;
    }
    return false;
  }
}
