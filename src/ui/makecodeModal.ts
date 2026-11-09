/**
 * Puente honesto hacia MakeCode y el robot físico: estado de compatibilidad,
 * código solo para el subconjunto verificado, tabla de correspondencia y guía
 * "Del simulador al robot".
 */
import type { Program } from "../program/ast";
import { exportMakeCode, K210_EXT, MAPPING, TINYBIT_EXT, type MicrobitVersion } from "../program/makecode";
import { btn, download, h, icon, modal, store, toast } from "./dom";

export const MAKECODE_URL = "https://makecode.microbit.org/";

export function openMakeCodeSite() {
  window.open(MAKECODE_URL, "_blank", "noopener");
}

export function guideSteps(): HTMLElement {
  return h(
    "ol",
    { class: "steps" },
    h("li", {}, h("b", {}, "Crea el proyecto en MakeCode. "), "Abre makecode.microbit.org y pulsa «Nuevo proyecto»."),
    h("li", {}, h("b", {}, "Añade las extensiones oficiales. "), "En «Extensiones», pega ", h("code", {}, TINYBIT_EXT), " (el carro). Solo si usas la cámara, añade también ", h("code", {}, K210_EXT), "."),
    h("li", {}, h("b", {}, "Transfiere el programa compatible. "), "Cambia a la vista «JavaScript», borra lo que haya y pega el código. Vuelve a «Bloques» para verlo como bloques."),
    h("li", {}, h("b", {}, "Compila y descarga con MakeCode. "), "Conecta la micro:bit por USB y pulsa «Descargar». Copia el archivo .hex a la unidad MICROBIT si no usas conexión directa."),
    h("li", {}, h("b", {}, "Prepara por separado el módulo K210. "), "La cámara tiene su propio programa y su modelo. Sigue la documentación de Yahboom (curso 3.12: copiar 3.12_Autopilot.py como main.py y tinybit_AI.kmodel en la tarjeta TF). El código de la micro:bit no lo sustituye."),
    h("li", {}, h("b", {}, "Calibra en el equipo físico. "), "Prueba primero con las ruedas en el aire. Ajusta velocidades (PWM), tiempos de giro y de estacionamiento, y comprueba los sensores de línea sobre tu tapete y con tu iluminación."),
  );
}

export function mappingTable(): HTMLElement {
  const color = { verificado: "#34d399", comentario: "#fbbf24", "sin traducción": "#f43f5e" } as const;
  return h(
    "table",
    { class: "map" },
    h("thead", {}, h("tr", {}, h("th", {}, "Nuestro bloque"), h("th", {}, "MakeCode / extensión oficial"), h("th", {}, "Estado"))),
    h(
      "tbody",
      {},
      ...MAPPING.map((r) =>
        h(
          "tr",
          {},
          h("td", {}, r.block),
          h("td", {}, h("code", {}, r.official), r.note ? h("div", { class: "help", style: "font-size:13.5px;margin-top:3px" }, r.note) : ""),
          h("td", { style: "white-space:nowrap" }, h("span", { class: "status-dot", style: `background:${color[r.status]}` }), r.status),
        ),
      ),
    ),
  );
}

export async function openMakeCode(program: Program, exampleTitle: string | null) {
  let version = store.get<MicrobitVersion>("microbit", "V2");
  const body = h("div", { style: "display:flex;flex-direction:column;gap:14px" });
  const render = () => {
    const res = exportMakeCode(program, version);
    body.replaceChildren();
    body.append(
      h("div", { class: "note warn" }, "Abrir MakeCode no sincroniza este simulador con el editor externo. Copia el código compatible y pégalo en la vista «JavaScript» de MakeCode."),
    );
    const verSel = h("select", { class: "select", "aria-label": "Versión de micro:bit" }) as HTMLSelectElement;
    for (const v of ["V2", "V1"]) verSel.append(h("option", { value: v, selected: v === version }, `micro:bit ${v}`));
    verSel.addEventListener("change", () => {
      version = verSel.value as MicrobitVersion;
      store.set("microbit", version);
      render();
    });
    body.append(h("div", { class: "row" }, h("b", {}, exampleTitle ? `Programa: ejemplo «${exampleTitle}»` : "Programa: el que tienes en el editor"), verSel));
    if (res.compatible) {
      body.append(
        h("div", { class: "note good" }, "Todos los bloques tienen traducción verificada: se comprobó que este tipo de código compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques. ", h("b", {}, "No está comprobado en el robot físico:"), " calibra tiempos y velocidades."),
        h("pre", { class: "code", "aria-label": "Código para MakeCode" }, res.code),
        h(
          "div",
          { class: "row" },
          btn("Copiar código", "copy", async () => {
            try {
              await navigator.clipboard.writeText(res.code);
              toast("Código copiado.", "ok");
            } catch {
              toast("No se pudo copiar automáticamente: selecciona el texto y cópialo.", "warn");
            }
          }, "primary"),
          btn("Descargar .ts", "save", () => download("programa-tiny-pro.ts", res.code, "text/plain")),
        ),
      );
    } else {
      body.append(
        h(
          "div",
          { class: "note bad" },
          h("b", {}, "Este programa no se puede exportar como compatible. "),
          "Faltan traducciones verificadas para estos bloques:",
          h("ul", {}, ...res.missing.map((m) => h("li", {}, h("b", {}, `${m.block} (${m.count}): `), m.reason))),
          "Quita esos bloques o úsalos solo en el simulador. No se genera código incompleto.",
        ),
      );
    }
    for (const n of res.notes) body.append(h("div", { class: "note info" }, n));
    const details = h("details", {}, h("summary", { style: "cursor:pointer;font-weight:700" }, "Correspondencia entre nuestros bloques y los oficiales"), h("div", { style: "margin-top:10px" }, mappingTable()));
    const guide = h("details", { open: true }, h("summary", { style: "cursor:pointer;font-weight:700" }, "Del simulador al robot"), h("div", { style: "margin-top:10px" }, guideSteps()));
    body.append(guide, details);
  };
  render();
  const res = await modal({
    title: "MakeCode y el robot real",
    body: [body],
    actions: [
      { label: "Abrir MakeCode", value: "open", icon: "external", cls: "amber" },
      { label: "Cerrar", value: "cerrar" },
    ],
  });
  if (res === "open") openMakeCodeSite();
}

export { icon };
