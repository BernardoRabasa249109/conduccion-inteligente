/**
 * «Perfil del alumno»: correo de la escuela, nombre y apellidos; las prácticas
 * completadas con su calificación, el avance y los promedios; el reporte .txt
 * con código de verificación para la plataforma de la escuela y, en modo
 * docente, la verificación del reporte de un alumno.
 *
 * El avance de cada alumno se guarda aparte en el navegador, ligado a su
 * correo (ver setStudentScope en dom.ts): varios alumnos pueden compartir equipo.
 */
import { buildReport, dateText, detailOf, GRADING_RULE, summarize, validEmail, verifyReport, type PracticeRecord, type Profile } from "../practices/perfil";
import { PRACTICES } from "../practices/practices";
import type { App } from "./app";
import { btn, download, h, icon, isStudentKey, modal, pickFile, store, toast } from "./dom";

export const currentProfile = (): Profile | null => store.get<Profile | null>("alumno:actual", null);

const fullName = (p: Profile) => `${p.nombre} ${p.apellidos}`.trim();

/** Claves del avance que no son de ningún alumno (de antes de registrar el perfil). */
function anonymousKeys(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith("tinypro:") && isStudentKey(k.slice(8)));
  } catch {
    return [];
  }
}

/** Pasa el avance sin dueño al perfil del alumno (al registrarse por primera vez). */
function moveAnonymousTo(correo: string) {
  const prefix = `tinypro:alumno:${correo.trim().toLowerCase()}:`;
  for (const k of anonymousKeys()) {
    const v = localStorage.getItem(k);
    if (v !== null && localStorage.getItem(prefix + k.slice(8)) === null) localStorage.setItem(prefix + k.slice(8), v);
    localStorage.removeItem(k);
  }
}

/** Alumnos que ya usaron este navegador (para cambiar rápido de uno a otro). */
function knownStudents(): Profile[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith("tinypro:perfil:"))
      .map((k) => JSON.parse(localStorage.getItem(k)!) as Profile)
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  } catch {
    return [];
  }
}

/** Activa a un alumno: su avance se carga al recargar la página. */
function activate(p: Profile) {
  store.set("alumno:actual", p);
  store.set(`perfil:${p.correo.toLowerCase()}`, p);
  location.reload();
}

export async function openProfile(app: App): Promise<void> {
  const p = currentProfile();
  if (!p && __DOCENTE__ && app.teacher) return teacherPanel(app);
  if (!p) return editProfile(app, null);
  const records = app.practices.records();
  const s = summarize(records);

  const card = (label: string, value: string, sub: string) => h("div", { class: "pf-card" }, h("span", { class: "k" }, label), h("b", {}, value), h("small", {}, sub));
  const bar = h("div", { class: "pf-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(s.avancePct) }, h("i", { style: `width:${s.avancePct}%` }));
  const rows = PRACTICES.map((q) => {
    const r: PracticeRecord | undefined = records[q.n];
    const graded = typeof r?.calificacion === "number";
    return h(
      "tr",
      { "data-done": String(!!r?.completada) },
      h("td", {}, String(q.n)),
      h("td", {}, q.title),
      h("td", {}, r?.completada ? "Completada" : "Pendiente"),
      h("td", { class: "num" }, graded ? r!.calificacion!.toFixed(1) : "—"),
      h("td", {}, graded && r!.completada ? dateText(new Date(r!.completada)) : r?.completada ? "antes del perfil" : ""),
      h("td", { class: "det" }, graded ? detailOf(r!) : ""),
    );
  });

  const downloadBtn = btn("Descargar mi avance (.txt)", "save", () => {
    const text = buildReport(p, records);
    const safe = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    download(`avance-${safe(p.apellidos)}-${safe(p.nombre)}-${new Date().toISOString().slice(0, 10)}.txt`, text, "text/plain;charset=utf-8");
    toast("Reporte descargado. Adjúntalo en la plataforma de la escuela.", "ok");
  }, "primary");
  let close: (v: string) => void = () => {};
  const importBtn = btn("Cargar mi avance de otro equipo", "open", () => close("importar"), "");
  const actions = h("div", { class: "row" }, downloadBtn, importBtn);

  const body: Node[] = [
    h("div", { class: "pf-head" }, h("div", {}, h("b", { class: "pf-name" }, fullName(p)), h("span", { class: "pf-mail" }, p.correo)), h("div", { class: "row" }, btn("Editar datos", "edit", () => close("editar"), "small"), btn("Cambiar de alumno", "person", () => close("cambiar"), "small"))),
    h("div", { class: "pf-cards" },
      card("Avance", `${s.completadas} de ${s.total}`, `${s.avancePct} % de las prácticas`),
      card("Promedio", s.promedio === null ? "—" : s.promedio.toFixed(1), "de las prácticas completadas"),
      card("Calificación general", s.general.toFixed(1), `sobre las ${s.total} prácticas (pendientes = 0)`),
    ),
    bar,
    actions,
    h("div", { class: "pf-table-wrap" }, h("table", { class: "pf-table" }, h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Práctica"), h("th", {}, "Estado"), h("th", {}, "Calif."), h("th", {}, "Fecha"), h("th", {}, "Detalle"))), h("tbody", {}, ...rows))),
    h("p", { class: "help" }, h("b", {}, "Cómo se califica: "), GRADING_RULE),
    h("p", { class: "help" }, "Tu avance se guarda en este navegador, ligado a tu correo. Para seguir en otro equipo, descarga tu avance y cárgalo allí con «Cargar mi avance de otro equipo»."),
  ];
  if (__DOCENTE__ && app.teacher) {
    body.push(
      h("div", { class: "pf-teacher" },
        h("div", { class: "section-title" }, icon("check"), "Para el docente"),
        h("p", { class: "help" }, "Comprueba que el reporte de un alumno no se modificó y mira su resumen."),
        btn("Verificar el reporte de un alumno", "check", () => close("verificar"), "small"),
      ),
    );
  }
  const res = await modal({ title: "Perfil del alumno", body, actions: [{ label: "Cerrar", value: "ok", cls: "primary" }], onOpen: (c) => {
    close = c;
    // Empieza arriba, con el nombre del alumno a la vista.
    document.querySelector(".modal-back:last-of-type .modal-body")?.scrollTo(0, 0);
  } });
  if (res === "editar") return editProfile(app, p);
  if (res === "cambiar") return editProfile(app, null, true);
  if (res === "importar") return importReport(app, p);
  if (res === "verificar") {
    await verifyFile();
    return openProfile(app);
  }
}

/** Registrar el perfil, editar los datos o cambiar de alumno. */
async function editProfile(app: App, current: Profile | null, switching = false): Promise<void> {
  const field = (label: string, name: string, value: string, type = "text", hint = "") =>
    h("label", { class: "pf-field" }, h("span", {}, label), h("input", { type, name, value, autocomplete: "off", spellcheck: "false", placeholder: hint }));
  const form = h(
    "div",
    { class: "pf-form" },
    field("Correo de la escuela", "correo", current?.correo ?? "", "email", "nombre.apellido@escuela.edu.mx"),
    field("Nombre(s)", "nombre", current?.nombre ?? ""),
    field("Apellidos", "apellidos", current?.apellidos ?? ""),
  );
  const error = h("p", { class: "pf-error hidden", role: "alert" });
  const known = knownStudents().filter((k) => k.correo.toLowerCase() !== current?.correo.toLowerCase());
  const body: Node[] = [
    h("p", { class: "help" }, current && !switching ? "Corrige tus datos. Tu avance no cambia." : "Escribe tu correo de la escuela, tu nombre y tus apellidos. Tu avance en las prácticas quedará ligado a tu correo."),
    form,
    error,
  ];
  if (switching && known.length) {
    const list = h("div", { class: "pf-known" });
    for (const k of known) list.append(btn(`${fullName(k)} · ${k.correo}`, "person", () => activate(k), "small"));
    body.push(h("p", { class: "help", style: "margin-top:12px" }, "O elige a un alumno que ya usó este equipo:"), list);
  }
  if (switching && currentProfile()) {
    body.push(h("p", { class: "help", style: "margin-top:12px" }, "Al cambiar de alumno se recarga la página con el avance del otro alumno."));
  }
  const read = () => {
    const v = (n: string) => ((form.querySelector(`input[name="${n}"]`) as HTMLInputElement).value || "").trim();
    return { correo: v("correo").toLowerCase(), nombre: v("nombre"), apellidos: v("apellidos") };
  };
  for (;;) {
    const res = await modal({ title: current && !switching ? "Editar datos del alumno" : "Perfil del alumno", narrow: true, body, actions: [{ label: "Cancelar", value: "no" }, { label: "Guardar", value: "si", cls: "primary", icon: "check" }] });
    if (res !== "si") return;
    const p = read();
    const msg = !validEmail(p.correo) ? "Escribe un correo válido (por ejemplo, nombre@escuela.edu.mx)." : !p.nombre ? "Escribe tu nombre." : !p.apellidos ? "Escribe tus apellidos." : "";
    if (msg) {
      error.textContent = msg;
      error.classList.remove("hidden");
      continue;
    }
    if (current && !switching && p.correo === current.correo.toLowerCase()) {
      // Solo cambian nombre o apellidos: no hace falta recargar.
      store.set("alumno:actual", p);
      store.set(`perfil:${p.correo}`, p);
      app.renderProfileButton();
      toast("Datos guardados.", "ok");
      return openProfile(app);
    }
    // Primera vez en este navegador: el avance que ya había puede pasar a su perfil.
    if (!currentProfile() && anonymousKeys().length) {
      const move = await modal({
        title: "¿Pasar el avance a tu perfil?",
        narrow: true,
        body: ["En este navegador ya hay prácticas o programas guardados sin perfil. ¿Son tuyos? Si eliges «Sí», pasan a tu perfil."],
        actions: [{ label: "No, empezar de cero", value: "no" }, { label: "Sí, son míos", value: "si", cls: "primary" }],
      });
      if (move === "si") moveAnonymousTo(p.correo);
    }
    activate(p);
    return;
  }
}

/** Recupera el avance desde un reporte descargado en otro equipo (solo si es válido y es suyo). */
async function importReport(app: App, p: Profile): Promise<void> {
  const text = await pickFile(".txt");
  if (!text) return;
  const v = verifyReport(text);
  if (!v.ok) {
    await modal({ title: "No se puede cargar el reporte", narrow: true, body: [v.reason] });
    return;
  }
  if (v.data.perfil.correo.toLowerCase() !== p.correo.toLowerCase()) {
    await modal({ title: "Ese reporte es de otro alumno", narrow: true, body: [`El reporte es de ${fullName(v.data.perfil)} (${v.data.perfil.correo}). Solo puedes cargar tu propio avance.`] });
    return;
  }
  let added = 0;
  for (const q of PRACTICES) {
    const r = v.data.registros[q.n];
    if (!r?.completada || store.get(`done:${q.n}`, false)) continue;
    store.set(`registro:${q.n}`, r);
    store.set(`done:${q.n}`, true);
    for (const x of PRACTICES) if ((x.after ?? x.n - 1) === q.n) store.set(`abierta:${x.n}`, true);
    added += 1;
  }
  app.practices.render();
  app.renderProfileButton();
  toast(added ? `Se cargaron ${added} práctica(s) completada(s).` : "Ese reporte no tiene prácticas nuevas para este equipo.", added ? "ok" : "warn");
  return openProfile(app);
}

/** Docente: comprueba un reporte y muestra su resumen. */
/**
 * Versión del docente sin alumno registrado: el docente no necesita un perfil
 * de alumno para verificar los reportes que le entregan.
 */
async function teacherPanel(app: App): Promise<void> {
  let close: (v: string) => void = () => {};
  const res = await modal({
    title: "Perfil · docente",
    narrow: true,
    body: [
      h("p", { class: "help" }, "Comprueba que el reporte (.txt) de un alumno no se modificó y mira su resumen."),
      h("div", { class: "row" }, btn("Verificar el reporte de un alumno", "check", () => close("verificar"), "primary")),
      h("p", { class: "help", style: "margin-top:14px" }, "Para probar el simulador como un alumno, registra un perfil de prueba (o apaga el modo docente en Ajustes)."),
      h("div", { class: "row" }, btn("Registrar un perfil de prueba", "person", () => close("registrar"), "small")),
    ],
    actions: [{ label: "Cerrar", value: "ok", cls: "primary" }],
    onOpen: (c) => (close = c),
  });
  if (res === "registrar") return editProfile(app, null);
  if (res === "verificar") {
    await verifyFile();
    return teacherPanel(app);
  }
}

async function verifyFile() {
  const text = await pickFile(".txt");
  if (!text) return;
  const v = verifyReport(text);
  if (!v.ok) {
    await modal({ title: "✗ Reporte no válido", narrow: true, body: [h("p", { class: "pf-bad" }, v.reason)] });
    return;
  }
  const { perfil, fecha } = v.data;
  const s = v.summary;
  await modal({
    title: "✓ Reporte válido",
    narrow: true,
    body: [
      h("p", { class: "pf-good" }, "El reporte no se modificó desde que el simulador lo generó."),
      h("p", {}, h("b", {}, fullName(perfil)), ` · ${perfil.correo}`),
      h("p", {}, `Generado: ${dateText(new Date(fecha))}`),
      h("p", {}, `Avance: ${s.completadas} de ${s.total} (${s.avancePct} %) · Promedio: ${s.promedio === null ? "—" : s.promedio.toFixed(1)} · General: ${s.general.toFixed(1)}`),
    ],
  });
}
