/**
 * Espacio "Prácticas": lista de las 25 prácticas (cada una con su botón para
 * reiniciarla) y, al abrir una, un panel plegable sobre el escenario con
 * objetivo, predicción, reto, pistas, comprobación en vivo y solución. Solo
 * se muestra una práctica a la vez. El panel acompaña al alumno cuando la
 * práctica lo lleva a otra sección; si cambia de sección a mano, se oculta
 * (la práctica sigue activa) y reaparece al volver a «Prácticas».
 */
import type { Sim } from "../core/sim";
import { done, type Checker } from "../practices/checks";
import { emptyRecord, gradeOf, detailOf, type PracticeRecord } from "../practices/perfil";
import { PRACTICES, practiceScenario, type Practice } from "../practices/practices";
import { ALL_CATEGORIES } from "../program/blocks";
import type { App } from "./app";
import { btn, h, icon, modal, store, toast } from "./dom";

const SPACE_NAME = { explorar: "Explorar", conducir: "Conducir", programar: "Programar" };

export class PracticesUI {
  readonly side: HTMLElement;
  readonly drawer: HTMLElement;
  active: Practice | null = null;
  /** El panel se ve fuera de «Prácticas» solo si fue la práctica la que llevó allí. */
  follows = false;
  checker: Checker | null = null;
  private list: HTMLElement;
  private drawerBody: HTMLElement;
  private drawerTitle: HTMLElement;
  private drawerNum: HTMLElement;
  private progress: HTMLElement;
  private checksEl: HTMLElement;
  private navPrev: HTMLButtonElement | null = null;
  /** Registro de la práctica activa: respuestas, pistas, solución y calificación. */
  private rec: PracticeRecord = emptyRecord();
  private navNext: HTMLButtonElement | null = null;
  private hintsShown = 0;
  private completedNow = false;
  private lastRender = "";
  private observer = (sim: Sim) => this.checker?.tick(sim);

  constructor(private app: App) {
    this.list = h("div", { class: "prac-list" });
    this.side = h(
      "div",
      { class: "side pane" },
      h(
        "div",
        { class: "card" },
        h("div", { class: "section-title" }, icon("flag"), "Prácticas guiadas"),
        h("p", { class: "help", style: "margin-bottom:12px" }, "Cada práctica se completa cuando el robot hace lo pedido, no al pulsar «Ejecutar»."),
        this.list,
      ),
    );
    this.drawerNum = h("div", { class: "n" });
    this.drawerTitle = h("h3", {});
    this.progress = h("span", { class: "progress" });
    const collapse = btn("", "chevron", () => this.drawer.classList.toggle("collapsed"), "small icon-only ghost");
    collapse.title = "Plegar o desplegar";
    collapse.setAttribute("aria-label", "Plegar o desplegar la práctica");
    const close = btn("", "x", () => this.close(), "small icon-only ghost");
    close.title = "Cerrar la práctica";
    close.setAttribute("aria-label", "Cerrar la práctica");
    this.drawerBody = h("div", { class: "drawer-body" });
    this.checksEl = h("div", { class: "checks" });
    this.drawer = h("aside", { class: "drawer hidden", "aria-label": "Práctica activa" }, h("div", { class: "drawer-head" }, this.drawerNum, this.drawerTitle, this.progress, collapse, close), this.drawerBody);
    this.render();
  }

  private status(p: Practice): "done" | "open" | "lock" {
    if (store.get(`done:${p.n}`, false)) return "done";
    if (this.app.teacher || p.n === 1 || store.get(`abierta:${p.n}`, false)) return "open";
    return store.get(`done:${p.after ?? p.n - 1}`, false) ? "open" : "lock";
  }

  render() {
    this.list.replaceChildren();
    for (const p of PRACTICES) {
      const st = this.status(p);
      const item = h(
        "button",
        { class: "prac-item", type: "button", "data-status": st, disabled: st === "lock" },
        h("span", { class: "prac-num" }, st === "done" ? icon("check") : String(p.n)),
        h("span", {}, h("span", { class: "t" }, p.title), h("br"), h("span", { class: "s" }, p.goal)),
        h("span", { class: `badge ${st === "done" ? "done" : st === "lock" ? "lock" : "space"}` }, st === "done" ? "Completada" : st === "lock" ? "Bloqueada" : SPACE_NAME[p.space]),
      );
      if (st === "lock") item.title = `Completa la práctica ${p.after ?? p.n - 1} o activa el modo docente en Ajustes.`;
      item.addEventListener("click", () => this.open(p));
      const reset = btn("", "reset", () => this.resetPractice(p), "small icon-only ghost prac-reset");
      reset.title = `Reiniciar la práctica ${p.n}`;
      reset.setAttribute("aria-label", `Reiniciar la práctica ${p.n}: ${p.title}`);
      if (st === "lock") reset.setAttribute("disabled", "");
      this.list.append(h("div", { class: "prac-row" }, item, reset));
    }
  }

  /** Pone la ventana de la práctica en su sitio; con «first», al principio del contenedor. */
  placeDrawer(host: HTMLElement, first = false) {
    const old = this.drawer.parentElement;
    if (old !== host) {
      old?.classList.remove("has-practice");
      if (first) host.prepend(this.drawer);
      else host.append(this.drawer);
    }
    // Fuera de «Prácticas», el panel solo acompaña si la práctica llevó allí.
    const visible = Boolean(this.active) && (this.app.tab === "practicas" || this.follows);
    this.drawer.classList.toggle("hidden", !visible);
    // En «Programar» el escenario es pequeño: el panel empieza plegado.
    if (visible) this.drawer.classList.toggle("collapsed", this.app.tab === "programar");
    host.classList.toggle("has-practice", visible);
  }

  /** Reinicia una práctica: borra su avance y su programa (pide confirmación). */
  async resetPractice(p: Practice) {
    const ok = await modal({
      title: `¿Reiniciar la práctica ${p.n}?`,
      narrow: true,
      body: [h("p", {}, `«${p.title}» vuelve a empezar: se borra su avance (las comprobaciones y la marca de completada) y su programa vuelve al inicial. El escenario y el robot regresan a su inicio. Las demás prácticas no cambian.`)],
      actions: [
        { label: "Cancelar", value: "no" },
        { label: "Reiniciar", value: "si", cls: "danger", icon: "reset" },
      ],
    });
    if (ok !== "si") return;
    // Las prácticas que ya se habían abierto siguen abiertas.
    for (const q of PRACTICES) if ((q.after ?? q.n - 1) === p.n && store.get(`done:${p.n}`, false)) store.set(`abierta:${q.n}`, true);
    store.del(`done:${p.n}`);
    store.del(`registro:${p.n}`);
    this.app.program.dropSlot(`practica-${p.n}`);
    if (this.active?.n === p.n) await this.open(p, false);
    this.render();
    toast(`Práctica ${p.n} reiniciada.`, "ok");
  }

  /** «Explorar» terminó un percibir → decidir → actuar (práctica 16). */
  exploreFlow(key: string) {
    this.checker?.event?.("flujo", key);
  }

  async open(p: Practice, go = true) {
    const app = this.app;
    app.sim.stopProgram();
    if (app.program.workspace) app.program.saveSlot();
    this.active = p;
    this.hintsShown = 0;
    this.completedNow = store.get(`done:${p.n}`, false);
    this.rec = { ...emptyRecord(), ...store.get<Partial<PracticeRecord>>(`registro:${p.n}`, {}) };
    app.scenarioId = "practica";
    app.applyScenario(practiceScenario(p), "practica");
    app.drive.setAdvanced(app.advanced || Boolean(p.motorControls));
    app.setToolbox(p.toolbox ?? ALL_CATEGORIES);
    const slot = `practica-${p.n}`;
    const fresh = !app.program.hasSlot(slot);
    app.program.loadSlot(slot, p.starter ? p.starter() : undefined);
    if (fresh && p.starter) toast("Se cargó el programa inicial de la práctica. Tu programa anterior quedó guardado.");
    this.startChecker();
    app.explore.setQuiz(p.n === 1);
    this.renderDrawer();
    this.drawer.classList.remove("hidden", "collapsed");
    this.follows = true;
    app.setTab(go ? p.space : app.tab);
  }

  close() {
    const app = this.app;
    this.active = null;
    this.checker = null;
    app.sim.observers.delete(this.observer);
    this.follows = false;
    this.drawer.classList.add("hidden");
    this.drawer.parentElement?.classList.remove("has-practice");
    app.syncPractice();
    app.setToolbox(ALL_CATEGORIES);
    app.drive.setAdvanced(app.advanced);
    app.explore.setQuiz(false);
    app.program.loadSlot("libre");
    app.loadScenario(store.get("scenario:last", "basica"));
  }

  private startChecker() {
    const app = this.app;
    app.sim.observers.delete(this.observer);
    if (!this.active) return;
    this.checker = this.active.checker();
    app.sim.observers.add(this.observer);
    this.lastRender = "";
  }

  /** El alumno reinició: la comprobación vuelve a empezar desde cero. */
  onReset() {
    if (this.active) this.startChecker();
  }

  /** Se ejecutó un programa nuevo: comprobación de estructura y reinicio de hechos. */
  onProgramRun() {
    if (!this.active) return;
    this.startChecker();
    this.checker?.program?.(this.app.sim.program!);
  }

  quizAnswer(id: string) {
    this.checker?.event?.("quiz", id);
  }

  private renderDrawer() {
    const p = this.active!;
    // El número se cambia por una palomita cuando la práctica se completa y la ventana está minimizada.
    this.drawerNum.replaceChildren(h("span", { class: "num" }, String(p.n)), h("span", { class: "ok", "aria-hidden": "true" }, icon("check")));
    this.drawer.classList.remove("done");
    this.drawerTitle.textContent = p.title;
    const body = this.drawerBody;
    body.replaceChildren();
    body.append(h("div", { class: "blk goal-blk" }, h("div", { class: "lbl" }, icon("target"), "Objetivo"), h("p", {}, p.goal)));

    // Predicción
    const opts = h("div", { class: "opts" });
    const explain = h("p", { class: "help hidden", style: "margin-top:8px" }, p.prediction.explain);
    const status = h("p", { class: "pred-status" });
    const showAnswered = (picked: number | null) => {
      opts.querySelectorAll("button").forEach((x, j) => x.setAttribute("data-state", j === p.prediction.answer && (picked === null || picked === j) ? "right" : j === picked ? "wrong" : ""));
      explain.classList.toggle("hidden", picked !== null && picked !== p.prediction.answer);
    };
    const renderStatus = () => {
      status.dataset.ok = String(this.rec.prediccion);
      status.textContent = this.rec.prediccion
        ? "✓ Pregunta contestada."
        : this.rec.intentos > 0
          ? "Esa no es. Piénsalo otra vez y elige otra respuesta: la pregunta es parte de la práctica."
          : "Contéstala: es obligatoria para completar la práctica.";
    };
    p.prediction.options.forEach((o, i) => {
      const b = h("button", { class: "opt", type: "button" }, o);
      b.addEventListener("click", () => {
        if (this.rec.prediccion) return;
        this.rec.intentos += 1;
        if (i === p.prediction.answer) this.rec.prediccion = true;
        this.saveRec();
        opts.querySelectorAll("button").forEach((x, j) => x.setAttribute("data-state", j === i ? (i === p.prediction.answer ? "right" : "wrong") : ""));
        explain.classList.toggle("hidden", i !== p.prediction.answer);
        renderStatus();
        this.lastRender = "";
        this.renderChecks();
      });
      opts.append(b);
    });
    if (this.rec.prediccion) showAnswered(null);
    renderStatus();
    body.append(h("div", { class: "blk" }, h("div", { class: "lbl" }, icon("question"), "Antes de probar: predice"), h("p", {}, p.prediction.q), opts, explain, status));

    // Reto
    const reto = h("div", { class: "blk" }, h("div", { class: "lbl" }, icon("bolt"), "Reto"), h("p", {}, p.challenge));
    const row = h("div", { class: "row", style: "margin-top:10px" });
    if (p.space !== this.app.tab) {
      row.append(
        btn(`Ir a ${SPACE_NAME[p.space]}`, "right", () => {
          this.follows = true;
          this.app.setTab(p.space);
        }, "small primary"),
      );
    }
    row.append(btn("Reiniciar escenario", "reset", () => this.app.resetWorld(), "small"));
    if (p.starter) {
      row.append(
        btn("Programa inicial", "reset", async () => {
          if (await this.app.program.replaceMine(p.starter!(), "restaurar el programa inicial de la práctica")) toast("Programa inicial restaurado.");
        }, "small"),
      );
    }
    reto.append(row);
    body.append(reto);

    // Pistas progresivas
    const hints = h("div", { class: "opts" });
    const moreHint = btn("Ver una pista", "hint", () => {
      if (this.hintsShown < p.hints.length) {
        hints.append(h("div", { class: "hint" }, h("b", {}, `${this.hintsShown + 1}.`), h("span", {}, p.hints[this.hintsShown])));
        this.hintsShown += 1;
        // Las pistas cuentan para la calificación solo antes de completarla.
        if (!this.completedNow && this.hintsShown > this.rec.pistas) {
          this.rec.pistas = this.hintsShown;
          this.saveRec();
        }
      }
      moreHint.querySelector("span")!.textContent = this.hintsShown < p.hints.length ? `Ver otra pista (${this.hintsShown}/${p.hints.length})` : "No hay más pistas";
      if (this.hintsShown >= p.hints.length) moreHint.setAttribute("disabled", "");
    }, "small");
    body.append(h("div", { class: "blk" }, h("div", { class: "lbl" }, icon("hint"), "Pistas"), hints, h("div", { style: "margin-top:8px" }, moreHint)));

    // Comprobación
    body.append(h("div", { class: "blk check-blk" }, h("div", { class: "lbl" }, icon("check"), "Comprobación (lo que hace el robot)"), this.checksEl));

    // Solución
    body.append(h("div", { class: "row" }, btn("Ver solución", "book", () => this.showSolution(), "small ghost")));

    // Viajar entre prácticas: se activa al completar la práctica en turno.
    this.navPrev = btn("Anterior", "left", () => this.goTo(p.n - 1), "small");
    this.navNext = btn("Siguiente", "right", () => this.goTo(p.n + 1), "small primary");
    body.append(h("div", { class: "drawer-nav" }, this.navPrev, this.navNext));
    this.renderNav();
    this.renderChecks();
  }

  private async showSolution() {
    const p = this.active!;
    const ok = this.app.teacher || (await modal({ title: "¿Ver la solución?", narrow: true, body: ["Intenta primero con las pistas. La solución se abre como ejemplo y no borra tu programa."], actions: [{ label: "Seguir intentando", value: "no" }, { label: "Ver solución", value: "si", cls: "primary" }] })) === "si";
    if (!ok) return;
    // Ver la solución antes de completarla baja la calificación (no en modo docente).
    if (!this.completedNow && !this.app.teacher && !this.rec.solucion) {
      this.rec.solucion = true;
      this.saveRec();
    }
    if (p.solution) {
      this.follows = true;
      this.app.setTab("programar");
      await this.app.program.openExample({ id: `__solucion-${p.n}`, title: `Solución de la práctica ${p.n}`, summary: "Ejecútala para comparar con tu programa. «Volver a mi programa» recupera tu trabajo.", scenario: "practica", build: p.solution });
    } else if (p.solutionText) {
      await modal({ title: `Solución · Práctica ${p.n}`, narrow: true, body: [h("p", {}, p.solutionText)] });
    }
  }

  private renderChecks() {
    const c = this.checker;
    if (!c) return;
    const key = `${c.items.map((i) => `${i.id}:${i.ok}`).join("|")}|p:${this.rec.prediccion}`;
    if (key === this.lastRender) return;
    this.lastRender = key;
    const pred = this.rec.prediccion;
    const robot = done(c);
    const complete = robot && pred;
    this.checksEl.replaceChildren(
      h("div", { class: "check", "data-ok": pred ? "true" : "" }, h("i", {}, pred ? "✓" : ""), h("span", {}, "Contestaste bien la pregunta «Antes de probar»")),
      ...c.items.map((i) => h("div", { class: "check", "data-ok": i.ok === null ? "" : String(i.ok) }, h("i", {}, i.ok === true ? "✓" : i.ok === false ? "✗" : ""), h("span", {}, i.text))),
    );
    const okCount = c.items.filter((i) => i.ok === true).length + (pred ? 1 : 0);
    this.progress.textContent = `${okCount}/${c.items.length + 1}`;
    this.progress.dataset.done = String(complete);
    const blk = this.checksEl.parentElement!;
    blk.dataset.ok = String(complete);
    if (robot && !pred) this.checksEl.append(h("p", { class: "help pred-missing" }, "El robot ya lo logró. Para completar la práctica, contesta bien la pregunta «Antes de probar» de arriba."));
    if (c.items.some((i) => i.ok === false)) this.checksEl.append(h("p", { class: "help" }, "Algo salió mal. Pulsa «Reiniciar escenario» y vuelve a intentarlo."));
    // Verde aunque la ventana esté minimizada: el alumno ve que la completó.
    this.drawer.classList.toggle("done", complete);
    const head = this.drawer.querySelector(".drawer-head");
    head?.setAttribute("title", complete ? "¡Práctica completada!" : "");
    if (complete) {
      if (!this.completedNow) {
        this.completedNow = true;
        this.rec.completada = new Date().toISOString();
        this.rec.calificacion = gradeOf(this.rec);
        this.saveRec();
        store.set(`done:${this.active!.n}`, true);
        for (const q of PRACTICES) if ((q.after ?? q.n - 1) === this.active!.n) store.set(`abierta:${q.n}`, true);
        toast(`Práctica ${this.active!.n} completada · calificación ${this.rec.calificacion.toFixed(1)}`, "ok", 5000);
        this.render();
        this.renderNav();
        this.app.renderProfileButton();
        if (!store.get("alumno:actual", null)) toast("Registra tu perfil (botón «Perfil», arriba) para que tu avance y tus calificaciones queden a tu nombre.", "warn", 6000);
      }
      const grade = typeof this.rec.calificacion === "number" ? ` Calificación: ${this.rec.calificacion.toFixed(1)} (${detailOf(this.rec)}).` : "";
      this.checksEl.append(h("div", { class: "done-banner" }, icon("trophy"), `¡Práctica completada! El robot lo demostró.${grade}`));
    }
  }

  private saveRec() {
    if (this.active) store.set(`registro:${this.active.n}`, this.rec);
  }

  /** Registros de todas las prácticas del alumno (para su perfil y su reporte). */
  records(): Record<number, PracticeRecord | undefined> {
    const out: Record<number, PracticeRecord | undefined> = {};
    for (const p of PRACTICES) {
      const r = store.get<PracticeRecord | null>(`registro:${p.n}`, null);
      const done = store.get(`done:${p.n}`, false);
      // Completadas antes de que existiera el perfil: cuentan, pero sin calificación.
      out[p.n] = r?.completada ? r : done ? { ...emptyRecord(), ...(r ?? {}), completada: "antes" } : undefined;
    }
    return out;
  }

  /** «Anterior» y «Siguiente»: solo con la práctica en turno completada y si la otra está abierta. */
  private renderNav() {
    const p = this.active;
    if (!p || !this.navPrev || !this.navNext) return;
    const completed = store.get(`done:${p.n}`, false);
    for (const [b, n, word] of [[this.navPrev, p.n - 1, "anterior"], [this.navNext, p.n + 1, "siguiente"]] as const) {
      const q = PRACTICES.find((x) => x.n === n);
      const ok = completed && !!q && this.status(q) !== "lock";
      b.disabled = !ok;
      b.title = !q
        ? word === "anterior" ? "Es la primera práctica." : "Es la última práctica."
        : !completed
          ? `Completa esta práctica para ir a la ${word}.`
          : ok
            ? `Ir a la práctica ${q.n}: ${q.title}`
            : `La práctica ${q.n} todavía está bloqueada.`;
    }
  }

  private goTo(n: number) {
    const q = PRACTICES.find((x) => x.n === n);
    if (q && this.status(q) !== "lock") void this.open(q);
  }

  update(_sim: Sim) {
    if (this.active) this.renderChecks();
  }
}
