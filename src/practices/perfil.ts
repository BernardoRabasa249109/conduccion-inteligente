/**
 * Perfil del alumno: calificación de cada práctica, resumen del avance y
 * reporte en texto con código de verificación.
 *
 * El reporte es un .txt: cualquiera puede abrirlo y editarlo. Por eso lleva un
 * código calculado a partir de todo su contenido: si se cambia una sola letra,
 * el código deja de coincidir y el docente lo detecta al verificarlo en el
 * simulador. Protege contra cambios hechos a mano; no es una firma infalible.
 */
import { PRACTICES } from "./practices";

export interface Profile {
  correo: string;
  nombre: string;
  apellidos: string;
}

/** Lo que se registra de cada práctica mientras el alumno la hace. */
export interface PracticeRecord {
  /** Respuestas dadas en «Antes de probar» hasta acertar (1 = al primer intento). */
  intentos: number;
  /** Ya contestó bien la pregunta. */
  prediccion: boolean;
  /** Pistas que llegó a ver. */
  pistas: number;
  /** Vio la solución antes de completarla. */
  solucion: boolean;
  /** Fecha y hora en que la completó (ISO). */
  completada?: string;
  calificacion?: number;
}

export const emptyRecord = (): PracticeRecord => ({ intentos: 0, prediccion: false, pistas: 0, solucion: false });

/** Cómo se califica, con las mismas palabras en la pantalla y en el reporte. */
export const GRADING_RULE =
  "10 al completar la práctica; −1 por cada respuesta equivocada en «Antes de probar» (máximo −2); −0.5 por cada pista vista (máximo −1.5); −3 si vio la solución antes de completarla. Mínimo 5.";

export function gradeOf(r: PracticeRecord): number {
  const fails = Math.max(0, r.intentos - 1);
  const g = 10 - Math.min(2, fails) - Math.min(1.5, r.pistas * 0.5) - (r.solucion ? 3 : 0);
  return Math.max(5, Math.round(g * 10) / 10);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export interface Summary {
  total: number;
  completadas: number;
  /** Porcentaje de prácticas completadas. */
  avancePct: number;
  /** Promedio de las calificaciones de las prácticas completadas (null si ninguna). */
  promedio: number | null;
  /** Suma de calificaciones entre el total de prácticas (las pendientes cuentan 0). */
  general: number;
}

export function summarize(records: Record<number, PracticeRecord | undefined>): Summary {
  const total = PRACTICES.length;
  const done = PRACTICES.filter((p) => records[p.n]?.completada);
  const grades = done.map((p) => records[p.n]!.calificacion).filter((g): g is number => typeof g === "number");
  const sum = grades.reduce((a, b) => a + b, 0);
  return {
    total,
    completadas: done.length,
    avancePct: Math.round((done.length / total) * 100),
    promedio: grades.length ? round1(sum / grades.length) : null,
    general: round1(sum / total),
  };
}

/** Texto del detalle de una práctica completada (para la tabla y el reporte). */
export function detailOf(r: PracticeRecord): string {
  const parts = [r.intentos <= 1 ? "pregunta al primer intento" : `pregunta en ${r.intentos} intentos`, `${r.pistas} ${r.pistas === 1 ? "pista" : "pistas"}`];
  if (r.solucion) parts.push("vio la solución");
  return parts.join(" · ");
}

// ───────── Código de verificación ─────────

const SALT = "tinypro|conduccion-inteligente|reporte|v1";

/** Mismo texto con saltos de línea de Windows o de Mac y sin espacios sobrantes al final de las líneas. */
const normalize = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");

const fmix = (h: number) => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Código de 16 cifras hexadecimales que depende de cada carácter del texto. */
export function verificationCode(text: string): string {
  const s = `${SALT}\n${normalize(text)}`;
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    a = Math.imul(a ^ ch, 0x01000193);
    b = Math.imul(b ^ ch, 0x5bd1e995) ^ (b >>> 15);
    c = Math.imul((c << 5) | (c >>> 27), 31) + ch;
    d = Math.imul(d ^ (ch + i), 0x27d4eb2d);
  }
  const hex = [fmix(a ^ d), fmix(b ^ c)].map((x) => x.toString(16).toUpperCase().padStart(8, "0")).join("");
  return hex.match(/.{4}/g)!.join("-");
}

const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const fromBase64 = (s: string) => decodeURIComponent(escape(atob(s)));
const pad2 = (n: number) => String(n).padStart(2, "0");
export const dateText = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export interface ReportData {
  v: 1;
  perfil: Profile;
  fecha: string;
  registros: Record<number, PracticeRecord>;
}

/** Reporte de avance en texto, listo para adjuntar en la plataforma de la escuela. */
export function buildReport(perfil: Profile, records: Record<number, PracticeRecord | undefined>, now = new Date()): string {
  const s = summarize(records);
  const lines = [
    "CONDUCCIÓN INTELIGENTE — LABORATORIO TINY PRO",
    "REPORTE DE AVANCE DEL ALUMNO",
    "",
    `Nombre(s):  ${perfil.nombre}`,
    `Apellidos:  ${perfil.apellidos}`,
    `Correo:     ${perfil.correo}`,
    `Fecha del reporte: ${dateText(now)}`,
    "",
    "RESUMEN",
    `Prácticas completadas: ${s.completadas} de ${s.total} (${s.avancePct} %)`,
    `Promedio de las prácticas completadas: ${s.promedio === null ? "—" : s.promedio.toFixed(1)}`,
    `Calificación sobre las ${s.total} prácticas (las pendientes cuentan 0): ${s.general.toFixed(1)}`,
    "",
    "DETALLE POR PRÁCTICA",
    `${"#".padStart(2)}  ${"Práctica".padEnd(46)}  ${"Estado".padEnd(10)}  Calif.  ${"Fecha".padEnd(16)}  Detalle`,
  ];
  for (const p of PRACTICES) {
    const r = records[p.n];
    const title = p.title.length > 46 ? `${p.title.slice(0, 45)}…` : p.title;
    if (r?.completada) {
      const grade = typeof r.calificacion === "number" ? r.calificacion.toFixed(1) : "—";
      const when = r.completada.length >= 16 ? dateText(new Date(r.completada)) : "—";
      lines.push(`${String(p.n).padStart(2)}  ${title.padEnd(46)}  ${"Completada".padEnd(10)}  ${grade.padStart(5)}   ${when.padEnd(16)}  ${typeof r.calificacion === "number" ? detailOf(r) : "completada antes de registrar calificaciones"}`);
    } else {
      lines.push(`${String(p.n).padStart(2)}  ${title.padEnd(46)}  ${"Pendiente".padEnd(10)}  ${"—".padStart(5)}`);
    }
  }
  lines.push(
    "",
    `Cómo se califica: ${GRADING_RULE}`,
    "Este archivo lleva un código de verificación: si se modifica cualquier parte, el código deja de coincidir.",
    "El docente lo comprueba en el simulador: Perfil del alumno → Verificar el reporte de un alumno (modo docente).",
  );
  const data: ReportData = { v: 1, perfil, fecha: now.toISOString(), registros: Object.fromEntries(Object.entries(records).filter(([, r]) => r)) as Record<number, PracticeRecord> };
  const signed = `${lines.join("\n")}\n\nDATOS: ${toBase64(JSON.stringify(data))}`;
  return `${signed}\nCÓDIGO DE VERIFICACIÓN: ${verificationCode(signed)}\n`;
}

export type Verification = { ok: true; data: ReportData; summary: Summary } | { ok: false; reason: string };

/** Comprueba que un reporte no se modificó y recupera sus datos. */
export function verifyReport(text: string): Verification {
  const norm = normalize(text);
  const m = /\nCÓDIGO DE VERIFICACIÓN: ([0-9A-F]{4}(?:-[0-9A-F]{4}){3})$/.exec(norm);
  if (!m) return { ok: false, reason: "No es un reporte del simulador: no tiene código de verificación." };
  const signed = norm.slice(0, m.index);
  if (verificationCode(signed) !== m[1]) return { ok: false, reason: "El reporte fue modificado: su código de verificación ya no coincide con el contenido." };
  const raw = /\nDATOS: ([A-Za-z0-9+/=]+)$/.exec(signed);
  if (!raw) return { ok: false, reason: "Al reporte le faltan sus datos." };
  try {
    const data = JSON.parse(fromBase64(raw[1])) as ReportData;
    return { ok: true, data, summary: summarize(data.registros) };
  } catch {
    return { ok: false, reason: "Los datos del reporte no se pueden leer." };
  }
}

/** Correo de la escuela con forma válida (alguien@dominio.algo). */
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
