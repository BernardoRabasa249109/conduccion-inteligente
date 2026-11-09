/**
 * Espacio "Programar": editor de bloques, controles de ejecución, depuración
 * paso a paso, variables, sensores y registro de decisiones.
 *
 * Hay dos clases de documento: "mi programa" (se guarda solo, una copia por
 * práctica) y los "ejemplos resueltos" (se pueden editar, pero no sustituyen
 * al programa del alumno salvo que se copien).
 */
import * as Blockly from "blockly/core";
import type { Scenario } from "../core/scenario";
import type { Sim } from "../core/sim";
import { STATE_NAME, type Program } from "../program/ast";
import { ALL_CATEGORIES, defineBlocks, functionsFlyout, toolbox, type Category } from "../program/blocks";
import { compileWorkspace, type WorkspaceJson } from "../program/compile";
import { EXAMPLES, exampleById, type Example } from "../program/examples";
import { btn, download, h, icon, modal, pickFile, store, toast, ICON } from "./dom";
import { escapeHtml } from "./stage";

export const EMPTY_PROGRAM: WorkspaceJson = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: "tp_on_start", id: "inicio", x: 30, y: 30 },
      { type: "tp_forever", id: "siempre", x: 30, y: 170 },
    ],
  },
  variables: [],
};

export interface ProjectFile {
  tipo: "conduccion-inteligente-proyecto";
  version: 1;
  nombre: string;
  fecha: string;
  practica: string | null;
  programa: WorkspaceJson;
  escenario?: Scenario;
}

export class ProgramPanel {
  readonly left: HTMLElement;
  readonly debug: HTMLElement;
  workspace!: Blockly.WorkspaceSvg;
  slot = "libre";
  example: Example | null = null;
  dirty = false;
  private blocklyDiv: HTMLElement;
  private banner: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stepBtn!: HTMLButtonElement;
  private buttonsBox!: HTMLElement;
  private exampleSel!: HTMLSelectElement;
  private kvSensors: HTMLElement;
  private kvVars: HTMLElement;
  private kvState: HTMLElement;
  private logEl: HTMLElement;
  private stepNote: HTMLElement;
  private pendingNote: HTMLElement;
  private lastHighlight = "";
  private lastLogLen = -1;
  private loading = false;
  private saveTimer = 0;
  private categories: Category[] = ALL_CATEGORIES;
  private changedSinceRun = false;
  speed = 1;
  onRun: () => void = () => {};
  onMakeCode: () => void = () => {};
  onExampleLoaded: (ex: Example) => void = () => {};

  constructor(private sim: () => Sim, private resetWorld: () => void) {
    defineBlocks();
    this.blocklyDiv = h("div", { class: "blockly-div" });
    this.banner = h("div", { class: "doc-banner mine" });
    this.pendingNote = h("span", { class: "badge hidden", style: "border-color:var(--decidir);color:#fcd34d" }, "Cambios sin aplicar: pulsa Ejecutar");

    this.runBtn = btn("Ejecutar", "play", () => this.toggleRun(), "run");
    this.pauseBtn = btn("Pausar", "pause", () => this.togglePause());
    this.stepBtn = btn("Paso", "step", () => this.step());
    this.stepBtn.title = "Ejecuta un solo bloque";
    const resetBtn = btn("Reiniciar", "reset", () => {
      this.resetWorld();
      toast("Robot en la salida y programa detenido.");
    });
    resetBtn.title = "Detiene el programa y vuelve el robot a la salida";
    this.exampleSel = h("select", { class: "select", "aria-label": "Ejemplos resueltos" }) as HTMLSelectElement;
    this.exampleSel.append(h("option", { value: "" }, "Ejemplos resueltos…"));
    for (const ex of EXAMPLES) this.exampleSel.append(h("option", { value: ex.id }, ex.title));
    this.exampleSel.addEventListener("change", () => {
      const ex = exampleById(this.exampleSel.value);
      this.exampleSel.value = "";
      if (ex) this.openExample(ex);
    });
    const speedSel = h("select", { class: "select", "aria-label": "Velocidad de simulación", title: "Velocidad de la simulación" }) as HTMLSelectElement;
    for (const [v, l] of [["0.5", "×0,5"], ["1", "×1"], ["2", "×2"]]) speedSel.append(h("option", { value: v, selected: v === "1" }, l));
    speedSel.addEventListener("change", () => (this.speed = Number(speedSel.value)));
    const saveBtn = btn("Guardar", "save", () => this.saveFile());
    saveBtn.title = "Descargar el proyecto (programa + escenario) en un archivo JSON";
    const openBtn = btn("Abrir", "open", () => this.openFile());
    const mcBtn = btn("MakeCode", "external", () => this.onMakeCode(), "amber");
    mcBtn.title = "Correspondencia con MakeCode y código compatible";
    // Botones A y B de la micro:bit: solo aparecen si el programa en marcha los usa.
    const mbBtn = (b: "A" | "B") => {
      const el = h("button", { type: "button", class: "btn mb-btn", title: `Pulsar el botón ${b} de la micro:bit`, "aria-label": `Pulsar el botón ${b} de la micro:bit` }, b);
      el.addEventListener("click", () => {
        if (!this.sim().pressButton(b)) toast(`El programa no tiene «al presionar el botón ${b}».`, "warn");
      });
      return el;
    };
    this.buttonsBox = h("div", { class: "mb-buttons hidden", role: "group", "aria-label": "Botones de la micro:bit" }, h("span", {}, "micro:bit"), mbBtn("A"), mbBtn("B"));
    const bar = h("div", { class: "prog-bar" }, this.runBtn, this.pauseBtn, this.stepBtn, resetBtn, this.buttonsBox, speedSel, this.exampleSel, saveBtn, openBtn, mcBtn);
    this.left = h("div", { class: "prog pane" }, bar, this.banner, h("div", { class: "blockly-host" }, this.blocklyDiv));

    this.kvSensors = h("div", { class: "kv" });
    this.kvVars = h("div", { class: "kv" });
    this.kvState = h("div", { class: "kv" });
    this.logEl = h("div", { class: "log", "aria-live": "polite" });
    this.stepNote = h("p", { class: "step-help" }, "Paso a paso: cada clic ejecuta un bloque. El tiempo solo avanza con «esperar», con «mostrar icono» o al final de cada vuelta de «repetir continuamente» (20 ms).");
    this.debug = h(
      "div",
      { class: "card debug" },
      h("div", {}, h("h4", { html: `${ICON.sensor}Lo que lee el programa` }), this.kvSensors),
      h("div", {}, h("h4", { html: `${ICON.brain}Variables y estado` }), this.kvState, this.kvVars),
      h("div", { style: "grid-column:1/-1" }, h("h4", { html: `${ICON.book}Registro de decisiones` }), this.logEl),
      this.stepNote,
    );
  }

  /** Inyecta Blockly (cuando el contenedor ya es visible). */
  mount() {
    if (this.workspace) return;
    const theme = Blockly.Theme.defineTheme("laboratorio", {
      name: "laboratorio",
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#0e1529",
        toolboxBackgroundColour: "#101830",
        toolboxForegroundColour: "#dbe3f5",
        flyoutBackgroundColour: "#16203c",
        flyoutForegroundColour: "#dbe3f5",
        flyoutOpacity: 0.97,
        scrollbarColour: "#3a4a75",
        insertionMarkerColour: "#ffffff",
        insertionMarkerOpacity: 0.3,
        cursorColour: "#d0d0d0",
      },
      fontStyle: { family: "Segoe UI, system-ui, sans-serif", weight: "600", size: 12.5 },
    });
    this.workspace = Blockly.inject(this.blocklyDiv, {
      toolbox: toolbox(this.categories),
      renderer: "zelos",
      theme,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.82, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 28, length: 2, colour: "#1d2846", snap: true },
      sounds: false,
    });
    this.workspace.addChangeListener(Blockly.Events.disableOrphans);
    this.workspace.registerToolboxCategoryCallback("TP_FUNCIONES", (ws) => functionsFlyout(ws) as never);
    // Al renombrar una función, sus bloques «llamar» se renombran también.
    this.workspace.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.type !== Blockly.Events.BLOCK_CHANGE) return;
      const ch = e as Blockly.Events.BlockChange;
      const block = ch.blockId ? this.workspace.getBlockById(ch.blockId) : null;
      if (!block || block.type !== "tp_func_def" || ch.element !== "field" || ch.name !== "NAME") return;
      for (const call of this.workspace.getBlocksByType("tp_func_call", false)) {
        if (call.getFieldValue("NAME") === ch.oldValue) call.setFieldValue(String(ch.newValue), "NAME");
      }
    });
    this.workspace.addChangeListener((e: Blockly.Events.Abstract) => {
      if (this.loading || e.isUiEvent) return;
      this.dirty = true;
      if (this.sim().interp.running) this.changedSinceRun = true;
      if (!this.example) {
        clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => this.saveSlot(), 600);
      }
    });
    this.loadSlot(this.slot);
  }

  resize() {
    if (this.workspace) Blockly.svgResize(this.workspace);
  }

  setCategories(cats: Category[]) {
    this.categories = cats;
    if (this.workspace) this.workspace.updateToolbox(toolbox(cats));
  }

  // ───────── Documentos ─────────

  current(): WorkspaceJson {
    if (!this.workspace) return store.get<WorkspaceJson>(`prog:${this.slot}`, EMPTY_PROGRAM);
    return Blockly.serialization.workspaces.save(this.workspace) as WorkspaceJson;
  }

  compile(): Program {
    return compileWorkspace(this.current());
  }

  private load(ws: WorkspaceJson) {
    if (!this.workspace) return;
    this.loading = true;
    try {
      this.workspace.clear();
      Blockly.serialization.workspaces.load(ws as object, this.workspace);
      this.workspace.scrollCenter();
    } catch (err) {
      console.error(err);
      toast("No se pudo cargar el programa.", "warn");
    } finally {
      this.loading = false;
    }
    this.dirty = false;
  }

  /** Guarda "mi programa" en el navegador (una copia por práctica). */
  saveSlot() {
    if (this.example || !this.workspace) return;
    store.set(`prog:${this.slot}`, this.current());
  }

  /** Borra el programa guardado en una ranura (al reiniciar una práctica). */
  dropSlot(slot: string) {
    store.del(`prog:${slot}`);
  }

  hasSlot(slot: string): boolean {
    return store.get<WorkspaceJson | null>(`prog:${slot}`, null) !== null;
  }

  /** ¿El programa guardado en esta ranura tiene bloques además de los vacíos? */
  slotHasWork(slot: string): boolean {
    const ws = store.get<WorkspaceJson | null>(`prog:${slot}`, null);
    if (!ws) return false;
    const count = JSON.stringify(ws).split('"type"').length - 1;
    return count > 2;
  }

  loadSlot(slot: string, fallback: WorkspaceJson = EMPTY_PROGRAM) {
    this.slot = slot;
    this.example = null;
    const ws = store.get<WorkspaceJson | null>(`prog:${slot}`, null) ?? fallback;
    if (this.workspace) this.load(ws);
    store.set(`prog:${slot}`, ws);
    this.renderBanner();
  }

  /** Reemplaza "mi programa" pidiendo confirmación si tiene trabajo. */
  async replaceMine(ws: WorkspaceJson, reason: string): Promise<boolean> {
    if (this.slotHasWork(this.slot) && !this.example) {
      const choice = await modal({
        title: "¿Conservar tu programa?",
        narrow: true,
        body: [h("p", {}, `Vas a ${reason}. Tu programa actual se perdería.`)],
        actions: [
          { label: "Guardar copia en archivo y continuar", value: "save", icon: "save", cls: "primary" },
          { label: "Reemplazar sin guardar", value: "replace", cls: "danger" },
          { label: "Cancelar", value: "cancel" },
        ],
      });
      if (choice === "cancel" || choice === "cerrar") return false;
      if (choice === "save") this.saveFile();
    }
    this.example = null;
    this.load(ws);
    this.saveSlot();
    this.renderBanner();
    return true;
  }

  async openExample(ex: Example) {
    if (!this.example) this.saveSlot();
    this.example = ex;
    this.load(ex.build());
    this.renderBanner();
    this.onExampleLoaded(ex);
  }

  backToMine() {
    this.example = null;
    this.loadSlot(this.slot);
    toast("Volviste a tu programa.");
  }

  private async copyExample() {
    if (!this.example) return;
    const ws = this.current();
    const title = this.example.title;
    if (await this.replaceMine(ws, `copiar el ejemplo «${title}» en tu programa`)) toast(`El ejemplo «${title}» ahora es tu programa.`, "ok");
  }

  renderBanner() {
    this.banner.replaceChildren();
    if (this.example) {
      this.banner.className = "doc-banner example";
      this.banner.append(
        icon("book"),
        h("div", { class: "grow" }, h("b", {}, `Ejemplo resuelto: ${this.example.title}`), h("div", { style: "font-weight:500;font-size:15px" }, this.example.summary)),
        btn("Copiar a mi programa", "copy", () => this.copyExample(), "small"),
        btn("Volver a mi programa", "left", () => this.backToMine(), "small"),
      );
    } else {
      this.banner.className = "doc-banner mine";
      const name = this.slot === "libre" ? "Mi programa (modo libre)" : `Mi programa · Práctica ${this.slot.replace("practica-", "")}`;
      this.banner.append(icon("edit"), h("div", { class: "grow" }, h("b", {}, name), h("div", { style: "font-weight:500;font-size:14.5px;color:var(--text-2)" }, "Se guarda solo en este navegador. Usa «Guardar» para llevarlo en un archivo.")), this.pendingNote);
    }
  }

  // ───────── Archivos ─────────

  saveFile() {
    const sim = this.sim();
    const file: ProjectFile = {
      tipo: "conduccion-inteligente-proyecto",
      version: 1,
      nombre: this.example ? `Ejemplo ${this.example.title}` : this.slot,
      fecha: new Date().toISOString(),
      practica: this.slot === "libre" ? null : this.slot,
      programa: this.current(),
      escenario: sim.scenario,
    };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    download(`proyecto-tiny-pro-${this.slot}-${stamp}.json`, JSON.stringify(file, null, 2));
    toast("Proyecto guardado en un archivo JSON.", "ok");
  }

  onScenarioFromFile: (s: Scenario) => void = () => {};

  async openFile() {
    const text = await pickFile(".json");
    if (!text) return;
    let data: ProjectFile;
    try {
      data = JSON.parse(text);
    } catch {
      toast("El archivo no es un JSON válido.", "warn");
      return;
    }
    if (data.tipo !== "conduccion-inteligente-proyecto" || !data.programa) {
      toast("Este archivo no es un proyecto del simulador.", "warn");
      return;
    }
    if (await this.replaceMine(data.programa, "abrir el proyecto del archivo")) {
      if (data.escenario) {
        const use = await modal({
          title: "El proyecto incluye un escenario",
          narrow: true,
          body: [h("p", {}, "¿Quieres cargar también la pista y los objetos guardados?")],
          actions: [
            { label: "Sí, cargar escenario", value: "si", cls: "primary" },
            { label: "No, solo el programa", value: "no" },
          ],
        });
        if (use === "si") this.onScenarioFromFile(data.escenario);
      }
      toast("Proyecto abierto.", "ok");
    }
  }

  // ───────── Ejecución ─────────

  toggleRun() {
    const sim = this.sim();
    if (sim.interp.running) {
      sim.stopProgram();
      return;
    }
    const prog = this.compile();
    if (prog.unknown.length) toast(`Bloques no reconocidos: ${prog.unknown.join(", ")}`, "warn");
    if (prog.onStart.length === 0 && prog.forevers.length === 0 && prog.buttons.A.length + prog.buttons.B.length === 0) {
      toast("Coloca tus bloques dentro de «al iniciar» o «repetir continuamente».", "warn");
      return;
    }
    sim.loadProgram(prog);
    sim.runProgram();
    this.changedSinceRun = false;
    this.onRun();
  }

  togglePause() {
    const sim = this.sim();
    sim.setPaused(!sim.paused);
  }

  step() {
    const sim = this.sim();
    if (!sim.interp.running) {
      this.toggleRun();
      sim.setPaused(true);
      sim.interp.prime();
      toast("Programa en pausa al inicio. Pulsa «Paso» para ejecutar cada bloque.");
      return;
    }
    const msg = sim.stepProgram();
    toast(msg);
  }

  update(sim: Sim) {
    const running = sim.interp.running;
    this.runBtn.querySelector("span")!.textContent = running ? "Detener" : "Ejecutar";
    this.runBtn.className = running ? "btn danger" : "btn run";
    this.runBtn.replaceChild(icon(running ? "stop" : "play"), this.runBtn.querySelector("svg")!);
    this.pauseBtn.querySelector("span")!.textContent = sim.paused ? "Continuar" : "Pausar";
    this.pauseBtn.toggleAttribute("disabled", !running && !sim.paused);
    this.buttonsBox.classList.toggle("hidden", !(running && sim.interp.hasButtons));
    this.pendingNote.classList.toggle("hidden", !running || !this.changedSinceRun);

    const s = sim.seen;
    const kv = (pairs: [string, string, string][]) => pairs.map(([k, v, c]) => `<span class="k">${k}</span><span class="v ${c}">${escapeHtml(v)}</span>`).join("");
    this.kvSensors.innerHTML = kv([
      ["Línea izquierda", `${s.lineLeft} (${s.lineLeft ? "negro" : "blanco"})`, "cy"],
      ["Línea derecha", `${s.lineRight} (${s.lineRight ? "negro" : "blanco"})`, "cy"],
      ["Distancia", s.distance > 0 ? `${s.distance} cm` : "0 (sin eco)", "cy"],
      ["Visión simulada", sim.visionText(s.vision.label), "cy"],
      ["Motores I · D", `${sim.robot.cmd.left} · ${sim.robot.cmd.right}`, "fu"],
      ["Tiempo del programa", running || sim.paused ? `${Math.max(0, Math.round(sim.programTimeMs))} ms` : "—", ""],
    ]);
    const st = sim.interp.state;
    this.kvState.innerHTML = kv([
      ["Estado", st ? STATE_NAME[st] : "—", "am"],
      ["Tiempo en el estado", st ? `${Math.round(sim.programTimeMs - sim.interp.stateSince)} ms` : "—", "am"],
    ]);
    const vars = [...sim.interp.vars.entries()];
    this.kvVars.innerHTML = vars.length ? kv(vars.map(([k, v]) => [k, String(v), ""])) : `<span class="k" style="grid-column:1/-1">Sin variables</span>`;

    if (sim.log.length !== this.lastLogLen) {
      this.lastLogLen = sim.log.length;
      this.logEl.innerHTML = sim.log
        .slice(-14)
        .reverse()
        .map((l) => `<div class="${l.kind}"><time>${l.t.toFixed(1)} s</time><span>${escapeHtml(l.text)}</span></div>`)
        .join("");
    }
    // Resaltar el bloque activo.
    if (this.workspace && !this.example?.id.startsWith("__")) {
      const ids = running ? sim.interp.activeBlocks() : [];
      const key = ids.join(",");
      if (key !== this.lastHighlight) {
        this.lastHighlight = key;
        this.workspace.highlightBlock(null);
        for (const id of ids) if (this.workspace.getBlockById(id)) this.workspace.highlightBlock(id, true);
      }
    }
  }
}
