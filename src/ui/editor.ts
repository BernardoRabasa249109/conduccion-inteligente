/**
 * Editor sencillo de escenarios: piezas de pista conectables, señales,
 * semáforo, obstáculos, zonas y salida del robot. Guarda y carga en JSON.
 */
import { LINE } from "../core/config";
import { clampToMat } from "../core/robot";
import { EXTRA_SIGNS, inRect, matHeight, matWidth, newId, OFFICIAL_SIGNS, SIGN_INFO, TILE_NAME, TILE_TYPES, validateScenario, type Scenario, type SignType, type TileType, type WorldObject, type Zone } from "../core/scenario";
import { PROPS } from "../core/world";
import { distPrim, E, markPrim, N, S, tileMask, W } from "../core/track";
import { SCENARIOS, SCENARIO_LIST } from "../scenarios/defaults";
import { signThumb } from "../render/signFaces";
import type { App } from "./app";
import { btn, download, h, icon, modal, pickFile, store, toast, ICON } from "./dom";
import { StageUI, type PointerDelegate } from "./stage";

type Sel = { kind: "tile"; c: number; r: number } | { kind: "object" | "zone"; id: string } | { kind: "start" };
const sameSel = (a: Sel | null, b: Sel | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
/** Centro y ángulo de lo seleccionado (radianes, mismo sentido que el robot). */
type Place = { x: number; y: number; a: number };
const STEP15 = Math.PI / 12;
/** Medio ancho y medio fondo, en ejes del tapete, de un rectángulo girado. */
const rotExt = (hw: number, hd: number, a: number): [number, number] => [Math.abs(hw * Math.cos(a)) + Math.abs(hd * Math.sin(a)), Math.abs(hw * Math.sin(a)) + Math.abs(hd * Math.cos(a))];

type Tool =
  | { kind: "select" }
  | { kind: "tile"; type: TileType | "erase" }
  | { kind: "sign"; sign: SignType }
  | { kind: "light" }
  | { kind: "obstacle"; shape: "caja" | "alta" | "persona" }
  | { kind: "mark" }
  | { kind: "zone"; zone: "slow" | "target" | "parking" }
  | { kind: "start" };

const TILE_SVG: Record<TileType | "erase", string> = {
  straight: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M2 12h20" stroke="currentColor" stroke-width="3"/></svg>',
  curve: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M12 22a10 10 0 0 1 10-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  tee: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M2 12h20M12 12v10" stroke="currentColor" stroke-width="3"/></svg>',
  cross: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M2 12h20M12 2v20" stroke="currentColor" stroke-width="3"/></svg>',
  roundabout: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M2 12h4.6M17.4 12H22" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.1" fill="none" stroke="#c084fc" stroke-width="1.8"/></svg>',
  turnaround: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M12 2v4.6" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.1" fill="none" stroke="#c084fc" stroke-width="1.8"/></svg>',
  erase: ICON.trash,
};

export class ScenarioEditor implements PointerDelegate {
  isOpen = false;
  readonly side: HTMLElement;
  private tool: Tool = { kind: "select" };
  private rot = 0;
  private selected: Sel | null = null;
  private press: { target: Sel; mode: "move" | "rotate"; startX: number; startY: number; dx: number; dy: number; angOff: number; moved: boolean; was: boolean } | null = null;
  /** Adónde va lo que se arrastra o se gira; el objeto lo sigue con suavidad (ver tick). */
  private goal: { sel: Sel; to: Place } | null = null;
  private toolBtns: { el: HTMLButtonElement; match: (t: Tool) => boolean }[] = [];
  private selBox: HTMLElement;
  private status: HTMLElement;
  private sizeOut: HTMLElement;

  constructor(private app: App) {
    const toolBtn = (label: string, iconHtml: string, tool: Tool, match: (t: Tool) => boolean) => {
      const b = h("button", { class: "btn", type: "button", "aria-pressed": "false", title: label }) as HTMLButtonElement;
      b.innerHTML = iconHtml;
      b.append(h("span", {}, label));
      b.addEventListener("click", () => this.setTool(tool));
      this.toolBtns.push({ el: b, match });
      return b;
    };
    const img = (sign: SignType) => `<img alt="" src="${signThumb(sign)}">`;
    const tiles = h("div", { class: "palette" },
      toolBtn("Seleccionar y mover", ICON.move, { kind: "select" }, (t) => t.kind === "select"),
      ...TILE_TYPES.map((t) => toolBtn(TILE_NAME[t], TILE_SVG[t], { kind: "tile", type: t }, (x) => x.kind === "tile" && x.type === t)),
      toolBtn("Borrar pieza", TILE_SVG.erase, { kind: "tile", type: "erase" }, (x) => x.kind === "tile" && x.type === "erase"),
    );
    const signs = h("div", { class: "palette" },
      ...[...OFFICIAL_SIGNS, ...EXTRA_SIGNS].map((s) => toolBtn(SIGN_INFO[s].name, img(s), { kind: "sign", sign: s }, (t) => t.kind === "sign" && t.sign === s)),
      toolBtn("Semáforo", ICON.light, { kind: "light" }, (t) => t.kind === "light"),
    );
    const things = h("div", { class: "palette" },
      toolBtn("Caja", ICON.box, { kind: "obstacle", shape: "caja" }, (t) => t.kind === "obstacle" && t.shape === "caja"),
      toolBtn("Caja alta", ICON.box, { kind: "obstacle", shape: "alta" }, (t) => t.kind === "obstacle" && t.shape === "alta"),
      toolBtn("Persona", ICON.person, { kind: "obstacle", shape: "persona" }, (t) => t.kind === "obstacle" && t.shape === "persona"),
      toolBtn("Franja negra", TILE_SVG.straight, { kind: "mark" }, (t) => t.kind === "mark"),
      toolBtn("Zona 30", ICON.layers, { kind: "zone", zone: "slow" }, (t) => t.kind === "zone" && t.zone === "slow"),
      toolBtn("Meta", ICON.target, { kind: "zone", zone: "target" }, (t) => t.kind === "zone" && t.zone === "target"),
      toolBtn("Plaza", ICON.pin, { kind: "zone", zone: "parking" }, (t) => t.kind === "zone" && t.zone === "parking"),
      toolBtn("Salida del robot", ICON.flag, { kind: "start" }, (t) => t.kind === "start"),
    );
    this.selBox = h("div", { class: "blk" });
    this.status = h("p", { class: "help" });
    this.sizeOut = h("b", {});
    const size = h("div", { class: "row" },
      h("span", {}, "Tamaño:"), this.sizeOut,
      btn("+ col", null, () => this.resize(1, 0), "small"), btn("− col", null, () => this.resize(-1, 0), "small"),
      btn("+ fila", null, () => this.resize(0, 1), "small"), btn("− fila", null, () => this.resize(0, -1), "small"),
    );
    const preset = h("select", { class: "select", "aria-label": "Partir de un escenario" }) as HTMLSelectElement;
    preset.append(h("option", { value: "" }, "Partir de…"), h("option", { value: "vacio" }, "Tapete vacío"));
    for (const s of SCENARIO_LIST) preset.append(h("option", { value: s.id }, s.name));
    preset.addEventListener("change", async () => {
      const v = preset.value;
      preset.value = "";
      if (!v) return;
      if ((await modal({ title: "¿Reemplazar el escenario?", narrow: true, body: ["Se perderán los cambios que no hayas guardado en un archivo."], actions: [{ label: "Cancelar", value: "no" }, { label: "Reemplazar", value: "si", cls: "danger" }] })) !== "si") return;
      const s = v === "vacio" ? emptyScenario() : SCENARIOS[v]();
      this.app.sim.setScenario(s);
      this.changed(true);
    });
    this.side = h(
      "div",
      { class: "side pane" },
      h("div", { class: "card" },
        h("div", { class: "section-title" }, icon("edit"), "Editor de escenario"),
        h("p", { class: "help", style: "margin-bottom:10px" }, "Elige una herramienta y haz clic en el tapete. Vuelve a hacer clic sobre una pieza para girarla. Las señales, obstáculos y zonas tienen un tirador ámbar para girarlas al ángulo que quieras."),
        h("div", { class: "row", style: "margin-bottom:10px" }, btn("Terminar", "check", () => this.close(), "primary"), btn("Guardar", "save", () => this.save()), btn("Cargar", "open", () => this.load()), btn("Restablecer", "layers", () => this.app.resetScenario(), "scenario-reset"), preset),
        this.status,
      ),
      h("div", { class: "card" }, h("div", { class: "section-title" }, icon("tile"), "Piezas de pista"), tiles, h("div", { style: "margin-top:10px" }, size)),
      h("div", { class: "card" }, h("div", { class: "section-title" }, icon("flag"), "Señales"), h("p", { class: "help", style: "margin-bottom:8px" }, "Las del ejemplo oficial de Yahboom, y «Alto» como ampliación educativa."), signs),
      h("div", { class: "card" }, h("div", { class: "section-title" }, icon("box"), "Obstáculos y zonas"), things),
      h("div", { class: "card" }, h("div", { class: "section-title" }, icon("move"), "Objeto seleccionado"), this.selBox),
    );
    this.renderSel();
    // Teclado del editor: Supr/Retroceso elimina, R gira lo seleccionado.
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen || document.querySelector(".modal-back")) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.remove();
      } else if (e.key === "r" || e.key === "R") {
        this.rotateSelected();
      } else if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E") {
        e.preventDefault();
        this.turnBy(e.key.toLowerCase() === "q" ? -15 : 15);
      }
    });
  }

  open() {
    this.isOpen = true;
    this.goal = null;
    this.app.sim.stopProgram();
    this.app.sim.setMode("manual");
    this.app.stage.editDelegate = this;
    this.app.stage.setTool("edit");
    this.app.scene.showGrid = true;
    this.app.scene.refreshFloor();
    this.app.setTab("conducir");
    this.refreshStatus();
    this.setTool({ kind: "select" });
  }

  /** Cierra el editor sin guardar el escenario (se va a restablecer). */
  discard() {
    this.goal = null;
    this.isOpen = false;
    this.press = null;
    this.select(null);
    this.app.scene.setHoverTile(null);
    this.app.stage.setTool("view");
    this.app.scene.showGrid = store.get("grid", true);
  }

  close() {
    // Lo que aún se deslizaba llega a su sitio antes de guardar.
    if (this.goal) this.applyPlace(this.goal.sel, this.goal.to);
    this.goal = null;
    this.isOpen = false;
    this.press = null;
    this.select(null);
    this.app.scene.setHoverTile(null);
    this.app.stage.setTool("view");
    this.app.scene.showGrid = store.get("grid", true);
    this.app.applyScenario(this.app.sim.scenario, "editor");
    this.app.setTab("conducir");
    toast("Escenario guardado en este navegador como «personalizado».", "ok");
  }

  private setTool(t: Tool) {
    this.tool = t;
    for (const b of this.toolBtns) b.el.setAttribute("aria-pressed", String(b.match(t)));
    if (t.kind !== "tile") this.app.scene.setHoverTile(null);
    this.app.stage.canvasCursor("");
  }

  private get s(): Scenario {
    return this.app.sim.scenario;
  }

  /** Aplica los cambios al mundo y a la escena. */
  private changed(full = false) {
    const sim = this.app.sim;
    if (full) {
      this.app.scene.setScenario(sim.scenario);
      this.app.scene.center();
    } else {
      sim.rebuildWorld();
      this.app.scene.rebuildProps(sim.scenario);
      this.app.scene.refreshFloor();
    }
    sim.rebuildWorld();
    this.app.stage.buildLightControl(sim);
    this.refreshStatus();
    this.renderSel();
  }

  private refreshStatus() {
    this.sizeOut.textContent = `${this.s.cols} × ${this.s.rows} piezas (${this.s.cols * this.s.tile} × ${this.s.rows * this.s.tile} cm)`;
    const open = openEnds(this.s);
    this.status.textContent = open === 0 ? "Todas las piezas están conectadas." : `Hay ${open} extremo(s) de línea sin conectar: el robot perderá la línea allí.`;
  }

  // ───────── Puntero ─────────

  private cellAt(x: number, y: number): { c: number; r: number } | null {
    const s = this.s;
    const c = Math.floor(x / s.tile), r = Math.floor(y / s.tile);
    return c >= 0 && r >= 0 && c < s.cols && r < s.rows ? { c, r } : null;
  }

  down(x: number, y: number, e: PointerEvent): boolean {
    const t = this.tool;
    const s = this.s;
    if (t.kind === "tile") {
      const cell = this.cellAt(x, y);
      if (!cell) return true;
      const { c, r } = cell;
      const idx = s.tiles.findIndex((q) => q.c === c && q.r === r);
      if (t.type === "erase") {
        if (idx >= 0) s.tiles.splice(idx, 1);
        if (this.selected?.kind === "tile" && this.selected.c === c && this.selected.r === r) this.selected = null;
      } else if (idx >= 0 && s.tiles[idx].type === t.type) {
        s.tiles[idx].rot = (s.tiles[idx].rot + 1) % 4;
      } else {
        const tile = { c, r, type: t.type, rot: this.bestRotation(c, r, t.type) };
        if (idx >= 0) s.tiles[idx] = tile;
        else s.tiles.push(tile);
      }
      this.changed();
      return true;
    }
    if (t.kind === "start") {
      s.start = { x, y, heading: s.start.heading };
      this.app.sim.placeRobot(x, y, s.start.heading);
      this.setTool({ kind: "select" });
      this.select({ kind: "start" });
      toast("Salida colocada. Haz clic otra vez sobre ella para girarla 45°.");
      return true;
    }
    if (t.kind === "select") {
      // Tirador ámbar: girar lo seleccionado siguiendo al puntero.
      const sel = this.selected;
      if (sel && sel.kind !== "tile" && this.app.scene.pick(e.clientX, e.clientY).objHandle) {
        const p = this.placeOf(sel);
        if (p) {
          this.press = { target: sel, mode: "rotate", startX: x, startY: y, dx: 0, dy: 0, angOff: p.a - Math.atan2(y - p.y, x - p.x), moved: false, was: false };
          this.app.stage.canvasCursor("grabbing");
          return true;
        }
      }
      const target = this.hitTest(x, y, e);
      if (!target) {
        // Nada debajo: se deselecciona y el arrastre desplaza la vista.
        this.select(null);
        return false;
      }
      const was = sameSel(target, this.selected);
      this.select(target);
      const pos = target.kind === "tile" ? { x: (target.c + 0.5) * s.tile, y: (target.r + 0.5) * s.tile } : this.placeOf(target) ?? { x, y };
      this.press = { target, mode: "move", startX: x, startY: y, dx: pos.x - x, dy: pos.y - y, angOff: 0, moved: false, was };
      this.app.stage.canvasCursor("grabbing");
      return true;
    }
    const id = newId("obj");
    let obj: WorldObject | null = null;
    if (t.kind === "sign") obj = { id, kind: "sign", sign: t.sign, x, y, facing: Math.PI };
    if (t.kind === "light") obj = { id, kind: "light", x, y, facing: Math.PI, state: "rojo", cycle: { auto: true, rojo: 6, verde: 7, amarillo: 2 } };
    if (t.kind === "obstacle") obj = t.shape === "persona" ? { id, kind: "obstacle", shape: "persona", x, y, w: 6, d: 6, h: 14, rot: 0, leavesAfterStop: 2 } : { id, kind: "obstacle", shape: "caja", x, y, w: 8, d: 8, h: t.shape === "alta" ? 18 : 8, rot: 0 };
    if (t.kind === "mark") obj = { id, kind: "mark", x, y, rot: Math.PI / 2, length: 8 };
    if (t.kind === "zone") {
      const size = t.zone === "slow" ? [40, 18] : t.zone === "target" ? [22, 22] : [15, 22];
      const label = t.zone === "slow" ? "30" : t.zone === "target" ? "META" : String(s.zones.filter((z) => z.kind === "parking").length + 1);
      s.zones.push({ id, kind: t.zone, label, x: x - size[0] / 2, y: y - size[1] / 2, w: size[0], d: size[1] });
      this.selected = { kind: "zone", id };
      this.changed();
      return true;
    }
    if (obj) {
      s.objects.push(obj);
      this.selected = { kind: "object", id };
      this.changed();
    }
    return true;
  }

  move(x: number, y: number, e?: PointerEvent) {
    const p = this.press;
    if (!p) return;
    if (!p.moved && p.mode === "move" && Math.hypot(x - p.startX, y - p.startY) < 1.5) return;
    p.moved = true;
    const sel = p.target;
    if (sel.kind === "tile") {
      const cell = this.cellAt(x, y);
      this.app.scene.setHoverTile(cell ? cell.c : null, cell ? cell.r : 0);
      return;
    }
    const cur = this.goalOrPlace(sel);
    if (!cur) return;
    if (p.mode === "rotate") {
      let a = Math.atan2(y - cur.y, x - cur.x) + p.angOff;
      if (e?.shiftKey) a = Math.round(a / STEP15) * STEP15;
      this.aim(sel, { x: cur.x, y: cur.y, a });
      if (e) this.app.stage.showAngle(e.clientX, e.clientY, a);
    } else {
      this.aim(sel, { x: x + p.dx, y: y + p.dy, a: cur.a });
    }
  }

  // ───────── Mover y girar con suavidad ─────────

  /** Centro y ángulo actuales de lo seleccionado. */
  private placeOf(sel: Sel): Place | null {
    if (sel.kind === "tile") return null;
    if (sel.kind === "start") return { x: this.s.start.x, y: this.s.start.y, a: this.s.start.heading };
    if (sel.kind === "zone") {
      const z = this.s.zones.find((q) => q.id === sel.id);
      return z ? { x: z.x + z.w / 2, y: z.y + z.d / 2, a: z.rot ?? 0 } : null;
    }
    const o = this.s.objects.find((q) => q.id === sel.id);
    if (!o) return null;
    return { x: o.x, y: o.y, a: o.kind === "sign" || o.kind === "light" ? o.facing : o.rot };
  }

  private goalOrPlace(sel: Sel): Place | null {
    return this.goal && sameSel(this.goal.sel, sel) ? this.goal.to : this.placeOf(sel);
  }

  /** Escribe la pose en el escenario y actualiza lo que se ve, sin reconstruir todo. */
  private applyPlace(sel: Sel, p: Place) {
    if (sel.kind === "tile") return;
    if (sel.kind === "start") {
      this.s.start = { x: p.x, y: p.y, heading: p.a };
      this.app.sim.placeRobot(p.x, p.y, p.a);
    } else if (sel.kind === "zone") {
      const z = this.s.zones.find((q) => q.id === sel.id);
      if (!z) return;
      z.x = p.x - z.w / 2;
      z.y = p.y - z.d / 2;
      z.rot = p.a;
      this.floorSoon();
    } else {
      const o = this.s.objects.find((q) => q.id === sel.id);
      if (!o) return;
      o.x = p.x;
      o.y = p.y;
      if (o.kind === "sign" || o.kind === "light") o.facing = p.a;
      else o.rot = p.a;
      if (o.kind === "mark") this.floorSoon();
      else this.app.scene.poseProp(o.id, p.x, p.y, p.a);
    }
    if (sameSel(sel, this.selected)) this.markSelection();
  }

  /** Lo que sobresale del centro en x e y (para no salir del tapete). */
  private extentOf(sel: Sel, a: number): [number, number] {
    if (sel.kind === "zone") {
      const z = this.s.zones.find((q) => q.id === sel.id);
      return z ? rotExt(z.w / 2, z.d / 2, a) : [0, 0];
    }
    if (sel.kind !== "object") return [0, 0];
    const o = this.s.objects.find((q) => q.id === sel.id);
    if (!o) return [0, 0];
    if (o.kind === "sign") return [PROPS.signBaseR, PROPS.signBaseR];
    if (o.kind === "light") return [PROPS.lightBaseR, PROPS.lightBaseR];
    if (o.kind === "mark") return rotExt(o.length / 2, LINE.width / 2, a);
    return rotExt(o.w / 2, o.d / 2, a);
  }

  /** Fija el destino (dentro del tapete); tick() lleva el objeto hasta allí. */
  private aim(sel: Sel, p: Place) {
    const W = matWidth(this.s), H = matHeight(this.s);
    let to: Place;
    if (sel.kind === "start") {
      const c = clampToMat({ x: p.x, y: p.y, heading: p.a }, W, H);
      to = { x: c.x, y: c.y, a: p.a };
    } else {
      const [hx, hy] = this.extentOf(sel, p.a);
      const fit = (v: number, half: number, size: number) => (half * 2 >= size ? size / 2 : Math.min(size - half, Math.max(half, v)));
      to = { x: fit(p.x, hx, W), y: fit(p.y, hy, H), a: p.a };
    }
    to.x = Math.round(to.x * 10) / 10;
    to.y = Math.round(to.y * 10) / 10;
    this.goal = { sel, to };
  }

  /** Cada fotograma: lo que se arrastra se desliza hacia su destino. */
  tick(dt: number) {
    const g = this.goal;
    if (!g || !this.isOpen) return;
    const cur = this.placeOf(g.sel);
    if (!cur) {
      this.goal = null;
      return;
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) / 0.075);
    const da = Math.atan2(Math.sin(g.to.a - cur.a), Math.cos(g.to.a - cur.a));
    const next = { x: cur.x + (g.to.x - cur.x) * k, y: cur.y + (g.to.y - cur.y) * k, a: cur.a + da * k };
    const done = Math.hypot(g.to.x - next.x, g.to.y - next.y) < 0.03 && Math.abs(da) * (1 - k) < 0.001;
    this.applyPlace(g.sel, done ? g.to : next);
    if (done) {
      this.goal = null;
      // Al terminar, el mundo se reconstruye (choques, línea pintada, panel).
      if (!this.press) this.changed();
    }
  }

  /** Gira lo seleccionado unos grados (teclas Q/E y botones ±15°). */
  turnBy(deg: number) {
    const sel = this.selected;
    if (!sel || sel.kind === "tile") return;
    const p = this.goalOrPlace(sel);
    if (!p) return;
    this.aim(sel, { x: p.x, y: p.y, a: Math.round(p.a / STEP15) * STEP15 + (deg * Math.PI) / 180 });
  }

  up(x: number, y: number) {
    const p = this.press;
    if (!p) return;
    this.press = null;
    this.app.stage.canvasCursor("");
    const sel = p.target;
    if (p.moved) {
      if (sel.kind === "tile") {
        this.app.scene.setHoverTile(null);
        const cell = this.cellAt(x, y);
        if (cell && (cell.c !== sel.c || cell.r !== sel.r)) {
          const src = this.s.tiles.find((t) => t.c === sel.c && t.r === sel.r);
          const dst = this.s.tiles.find((t) => t.c === cell.c && t.r === cell.r);
          if (src) {
            // Si la casilla de destino está ocupada, las piezas se intercambian.
            if (dst) {
              dst.c = sel.c;
              dst.r = sel.r;
            }
            src.c = cell.c;
            src.r = cell.r;
            this.selected = { kind: "tile", c: cell.c, r: cell.r };
          }
        }
      }
      if (sel.kind === "tile") this.changed();
      // Los objetos terminan de deslizarse y entonces se reconstruye el mundo (tick).
      else if (!this.goal) this.changed();
      return;
    }
    // Clic sin arrastrar sobre lo que ya estaba seleccionado: se gira.
    if (p.was && p.mode === "move") this.rotateSelected();
  }

  hover(x: number, y: number, e?: PointerEvent) {
    if (this.tool.kind === "tile") {
      const cell = this.cellAt(x, y);
      this.app.scene.setHoverTile(cell ? cell.c : null, cell ? cell.r : 0);
      return;
    }
    if (this.tool.kind === "select" && !this.press && e) {
      const onHandle = !!this.selected && this.selected.kind !== "tile" && this.app.scene.pick(e.clientX, e.clientY).objHandle;
      this.app.stage.canvasCursor(onHandle || this.hitTest(x, y, e) ? "grab" : "");
    }
  }

  private floorTimer = 0;
  /** Redibuja el suelo como mucho cada 33 ms mientras se arrastra una zona o una franja. */
  private floorSoon() {
    if (this.floorTimer) return;
    this.floorTimer = window.setTimeout(() => {
      this.floorTimer = 0;
      this.app.scene.refreshFloor();
    }, 33);
  }

  // ───────── Selección ─────────

  /** Qué hay bajo el puntero: primero lo que se ve en 3D, luego lo pintado en el suelo. */
  private hitTest(x: number, y: number, e: PointerEvent): Sel | null {
    const hit = this.app.scene.pick(e.clientX, e.clientY);
    if (hit.objectId) return { kind: "object", id: hit.objectId };
    const st = this.s.start;
    if (hit.robot && Math.hypot(this.app.sim.robot.x - st.x, this.app.sim.robot.y - st.y) < 2) return { kind: "start" };
    for (const o of this.s.objects) if (o.kind === "mark" && distPrim([x, y], markPrim(o)) < 3) return { kind: "object", id: o.id };
    const z = [...this.s.zones].reverse().find((q) => inRect(q, x, y));
    if (z) return { kind: "zone", id: z.id };
    const cell = this.cellAt(x, y);
    if (cell && this.s.tiles.some((t) => t.c === cell.c && t.r === cell.r)) return { kind: "tile", c: cell.c, r: cell.r };
    return null;
  }

  private find(id: string): { x: number; y: number; [k: string]: unknown } | null {
    return (this.s.objects.find((o) => o.id === id) as never) ?? (this.s.zones.find((z) => z.id === id) as never) ?? null;
  }

  private select(sel: Sel | null) {
    this.selected = sel;
    this.renderSel();
  }

  /** Gira lo seleccionado: pieza de pista 90°; objeto, zona o salida 45° (con suavidad). */
  rotateSelected() {
    const sel = this.selected;
    if (!sel) return;
    if (sel.kind === "tile") {
      const t = this.s.tiles.find((q) => q.c === sel.c && q.r === sel.r);
      if (t) t.rot = (t.rot + 1) % 4;
      this.changed();
      return;
    }
    const p = this.goalOrPlace(sel);
    if (p) this.aim(sel, { x: p.x, y: p.y, a: p.a + Math.PI / 4 });
  }

  private markSelection() {
    if (!this.app.scene) return;
    const sel = this.selected;
    this.app.scene.setSelectedTile(sel?.kind === "tile" ? sel.c : null, sel?.kind === "tile" ? sel.r : 0);
    this.app.scene.setSelection(null);
    const p = sel ? this.placeOf(sel) : null;
    if (!sel || !p) return this.app.scene.setObjectGizmo(null);
    this.app.scene.setObjectGizmo(p.x, p.y, p.a, this.ringOf(sel));
  }

  /** Radio del anillo del asa según el tamaño de lo seleccionado. */
  private ringOf(sel: Sel): number {
    if (sel.kind === "start") return 9.9;
    if (sel.kind === "zone") {
      const z = this.s.zones.find((q) => q.id === sel.id) as Zone | undefined;
      return z ? Math.hypot(z.w, z.d) / 2 + 1.5 : 6;
    }
    const o = this.s.objects.find((q) => (sel.kind === "object" ? q.id === sel.id : false));
    if (!o) return 6;
    if (o.kind === "sign") return PROPS.signBaseR + 2;
    if (o.kind === "light") return PROPS.lightBaseR + 2;
    if (o.kind === "mark") return o.length / 2 + 2;
    return Math.hypot(o.w, o.d) / 2 + 2;
  }

  private renderSel(): void {
    this.markSelection();
    const box = this.selBox;
    box.replaceChildren();
    const sel = this.selected;
    const actions = (rotLabel: string, canDelete = true, fine = false) => {
      const row = h("div", { class: "row", style: "margin-top:8px" }, btn(rotLabel, "rotate", () => this.rotateSelected(), "small"));
      if (fine) row.append(btn("−15°", null, () => this.turnBy(-15), "small"), btn("+15°", null, () => this.turnBy(15), "small"));
      if (canDelete) row.append(btn("Eliminar", "trash", () => this.remove(), "small danger"));
      return row;
    };
    const angle = (a: number) => ` · ${StageUI.degrees(a)}°`;
    const tip = (text: string) => h("p", { class: "help", style: "margin-top:6px" }, text);
    if (!sel) {
      box.append(h("p", { class: "help" }, "Nada seleccionado. Con «Seleccionar y mover», haz clic en una pieza de pista, una señal, un obstáculo o una zona."));
      return;
    }
    if (sel.kind === "start") {
      box.append(h("p", {}, h("b", {}, "Salida del robot"), angle(this.s.start.heading)), actions("Girar 45°", false, true), tip("Arrástrala para moverla. Tirador ámbar: girarla al ángulo que quieras (con Shift, de 15 en 15°). Clic otra vez sobre ella: gira 45°. Teclas Q y E: 15°."));
      return;
    }
    if (sel.kind === "tile") {
      const t = this.s.tiles.find((q) => q.c === sel.c && q.r === sel.r);
      if (!t) {
        this.selected = null;
        return this.renderSel();
      }
      const name = TILE_NAME[t.type];
      box.append(h("p", {}, h("b", {}, `Pieza: ${name}`), ` en la casilla (${sel.c + 1}, ${sel.r + 1})`), actions("Girar 90°"), tip("Arrástrala a otra casilla para moverla (si está ocupada, se intercambian). Clic otra vez sobre ella: gira 90°. Tecla Supr: eliminar."));
      return;
    }
    const o = this.find(sel.id);
    if (!o) {
      this.selected = null;
      return this.renderSel();
    }
    const obj = o as unknown as WorldObject & { kind: string };
    const name = obj.kind === "sign" ? SIGN_INFO[(obj as { sign: SignType }).sign].name : { light: "Semáforo", obstacle: "Obstáculo", mark: "Franja negra", slow: "Zona 30", target: "Meta", parking: "Plaza" }[obj.kind] ?? obj.kind;
    const pl = this.placeOf(sel);
    box.append(
      h("p", {}, h("b", {}, name), ` en (${(pl?.x ?? o.x).toFixed(0)}, ${(pl?.y ?? o.y).toFixed(0)}) cm`, pl ? angle(pl.a) : ""),
      actions("Girar 45°", true, true),
      tip("Arrástralo para moverlo (no sale del tapete). Tirador ámbar: girarlo al ángulo que quieras (con Shift, de 15 en 15°). Clic otra vez sobre él: gira 45°. Teclas Q y E: 15°. Supr: eliminar."),
    );
    if (obj.kind === "sign") box.append(tip(SIGN_INFO[(obj as { sign: SignType }).sign].meaning + " La cara debe mirar hacia el robot que se acerca."));
    if (obj.kind === "light") box.append(tip("Cambia su estado con el control «Semáforo» del escenario."));
  }

  remove() {
    const sel = this.selected;
    if (!sel || sel.kind === "start") return;
    if (sel.kind === "tile") this.s.tiles = this.s.tiles.filter((t) => !(t.c === sel.c && t.r === sel.r));
    else {
      this.s.objects = this.s.objects.filter((o) => o.id !== sel.id);
      this.s.zones = this.s.zones.filter((z) => z.id !== sel.id);
    }
    this.selected = null;
    this.changed();
  }

  /** Gira una pieza nueva para conectarla con las vecinas, si es posible. */
  private bestRotation(c: number, r: number, type: TileType): number {
    let best = this.rot, score = -1;
    for (let rot = 0; rot < 4; rot++) {
      const mask = tileMask(type, rot);
      let sc = 0;
      for (const [side, dc, dr, opp] of [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]]) {
        if (!(mask & side)) continue;
        const nb = this.s.tiles.find((t) => t.c === c + dc && t.r === r + dr);
        if (nb && tileMask(nb.type, nb.rot) & opp) sc += 1;
      }
      if (sc > score) {
        score = sc;
        best = rot;
      }
    }
    return best;
  }

  private resize(dc: number, dr: number) {
    const s = this.s;
    s.cols = Math.max(3, Math.min(10, s.cols + dc));
    s.rows = Math.max(3, Math.min(8, s.rows + dr));
    s.tiles = s.tiles.filter((t) => t.c < s.cols && t.r < s.rows);
    this.changed(true);
  }

  // ───────── Archivos ─────────

  private save() {
    const s = { ...this.s, id: "personalizado", name: this.s.name.startsWith("Mi ") ? this.s.name : `Mi escenario` };
    download(`escenario-tiny-pro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 2));
    toast("Escenario guardado en un archivo JSON.", "ok");
  }

  private async load() {
    const text = await pickFile(".json");
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const errs = validateScenario(data);
      if (errs.length) {
        toast(`No es un escenario válido: ${errs[0]}`, "warn");
        return;
      }
      this.app.sim.setScenario(data);
      this.changed(true);
      toast("Escenario cargado.", "ok");
    } catch {
      toast("El archivo no es un JSON válido.", "warn");
    }
  }
}

/** Número de lados de pieza con línea que no conectan con la pieza vecina. */
export function openEnds(s: Scenario): number {
  let n = 0;
  for (const t of s.tiles) {
    const mask = tileMask(t.type, t.rot);
    for (const [side, dc, dr, opp] of [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]]) {
      if (!(mask & side)) continue;
      const nb = s.tiles.find((q) => q.c === t.c + dc && q.r === t.r + dr);
      if (!nb || !(tileMask(nb.type, nb.rot) & opp)) n += 1;
    }
  }
  return n;
}

function emptyScenario(): Scenario {
  return { version: 1, id: "personalizado", name: "Mi escenario", cols: 6, rows: 4, tile: 30, tiles: [], objects: [], zones: [], start: { x: 40, y: 60, heading: 0 } };
}
