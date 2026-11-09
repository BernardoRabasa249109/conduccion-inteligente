/** Utilidades de interfaz: creación de nodos, íconos SVG, diálogos y avisos. */

type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, "").toLowerCase(), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

export function svgEl(markup: string): SVGElement {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

const P = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  explore: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/>'),
  drive: P('<rect x="5" y="7" width="14" height="9" rx="3"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M9 4h6"/>'),
  code: P('<path d="M4 6h7v5H4zM13 13h7v5h-7zM11 8.5h3a2 2 0 0 1 2 2V13"/>'),
  flag: P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  play: P('<path d="M7 5v14l11-7z" fill="currentColor"/>'),
  pause: P('<path d="M8 5v14M16 5v14"/>'),
  step: P('<path d="M6 5v14l8-7zM18 5v14"/>'),
  reset: P('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>'),
  stop: P('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
  up: P('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: P('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  left: P('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  right: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  spinL: P('<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>'),
  zoomIn: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>'),
  zoomOut: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>'),
  center: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2"/>'),
  follow: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  rotate: P('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
  eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  camera: P('<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'),
  sensor: P('<path d="M12 3v6"/><circle cx="12" cy="12" r="3"/><path d="M5 19c2-2 4.5-3 7-3s5 1 7 3"/>'),
  wave: P('<path d="M4 12h2M9 7c2 3 2 7 0 10M13 5c3 4 3 10 0 14M17 3c4 5 4 13 0 18"/>'),
  bulb: P('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>'),
  brain: P('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/>'),
  bolt: P('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  save: P('<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>'),
  open: P('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  book: P('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
  external: P('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  full: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  check: P('<path d="M5 12l5 5L20 7"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  target: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  hint: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  question: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  trophy: P('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  pin: P('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'),
  edit: P('<path d="M4 20h4L20 8l-4-4L4 16z"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  layers: P('<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 16l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'),
  chevron: P('<path d="m6 9 6 6 6-6"/>'),
  trail: P('<path d="M4 18c3-6 6 2 9-4s5-6 7-8"/><circle cx="20" cy="6" r="1.5" fill="currentColor"/>'),
  move: P('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  light: P('<rect x="8" y="2" width="8" height="16" rx="3"/><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="10" r="1.6"/><circle cx="12" cy="14" r="1.6"/><path d="M12 18v4"/>'),
  box: P('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
  person: P('<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M8 11h8M10 22l2-7 2 7"/>'),
  tile: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>'),
};

export function icon(name: keyof typeof ICON): SVGElement {
  return svgEl(ICON[name]);
}

export function btn(label: string, ic: keyof typeof ICON | null, onClick: (e: MouseEvent) => void, cls = ""): HTMLButtonElement {
  const b = h("button", { class: `btn ${cls}`.trim(), type: "button" });
  if (ic) b.append(icon(ic));
  if (label) b.append(h("span", {}, label));
  b.addEventListener("click", onClick);
  return b;
}

let toastZone: HTMLElement | null = null;
export function toast(text: string, kind: "" | "ok" | "warn" = "", ms = 3200) {
  if (!toastZone) {
    toastZone = h("div", { class: "toast-zone", role: "status", "aria-live": "polite" });
    document.body.append(toastZone);
  }
  const t = h("div", { class: `toast ${kind}` }, text);
  toastZone.append(t);
  setTimeout(() => t.remove(), ms);
}

export interface ModalOpts {
  title: string;
  body: (Node | string)[];
  actions?: { label: string; cls?: string; icon?: keyof typeof ICON; value: string }[];
  narrow?: boolean;
  /** Recibe la función que cierra el diálogo (para botones dentro del contenido). */
  onOpen?: (close: (value: string) => void) => void;
}

/** Diálogo modal. Devuelve el valor del botón pulsado (o "cerrar"). */
export function modal(opts: ModalOpts): Promise<string> {
  return new Promise((resolve) => {
    const close = (v: string) => {
      back.remove();
      document.removeEventListener("keydown", onKey);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close("cerrar");
      }
    };
    const head = h("div", { class: "modal-head" }, h("h2", {}, opts.title));
    const x = btn("", "x", () => close("cerrar"), "ghost icon-only");
    x.setAttribute("aria-label", "Cerrar");
    head.append(x);
    const body = h("div", { class: "modal-body" }, ...opts.body);
    const foot = h("div", { class: "modal-foot" });
    for (const a of opts.actions ?? [{ label: "Cerrar", value: "cerrar" }]) foot.append(btn(a.label, a.icon ?? null, () => close(a.value), a.cls ?? ""));
    const dlg = h("div", { class: `modal ${opts.narrow ? "narrow" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": opts.title }, head, body, foot);
    const back = h("div", { class: "modal-back" }, dlg);
    back.addEventListener("click", (e) => {
      if (e.target === back) close("cerrar");
    });
    document.addEventListener("keydown", onKey, true);
    document.body.append(back);
    (foot.querySelector("button") as HTMLButtonElement | null)?.focus();
    opts.onOpen?.(close);
  });
}

/** Descarga un texto como archivo (JSON o TypeScript). */
export function download(name: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/** Pide al usuario un archivo y devuelve su texto. */
export function pickFile(accept = ".json"): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept }) as HTMLInputElement;
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      resolve(f ? await f.text() : null);
    });
    input.click();
  });
}

/**
 * Avance ligado al alumno: las prácticas completadas, las abiertas, sus
 * registros (calificación) y los programas guardados se separan por correo, así
 * varios alumnos pueden usar el mismo equipo sin mezclar su avance.
 */
let studentScope = "";
export function setStudentScope(correo: string | null) {
  studentScope = correo ? `alumno:${correo.trim().toLowerCase()}:` : "";
}
/** Claves que pertenecen al alumno (las demás son del equipo: ajustes, escenario…). */
export const isStudentKey = (key: string) => /^(done|abierta|registro|prog):/.test(key);
const keyOf = (key: string) => `tinypro:${isStudentKey(key) ? studentScope : ""}${key}`;

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(keyOf(key));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(keyOf(key), JSON.stringify(value));
    } catch {
      /* almacenamiento no disponible */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(keyOf(key));
    } catch {
      /* sin efecto */
    }
  },
};
