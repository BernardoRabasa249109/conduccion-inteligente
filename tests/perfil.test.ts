/** Perfil del alumno: calificación, resumen y reporte con código de verificación. */
import { describe, expect, it } from "vitest";
import { buildReport, emptyRecord, gradeOf, summarize, validEmail, verifyReport, type PracticeRecord } from "../src/practices/perfil";

const perfil = { correo: "ana.perez@escuela.edu.mx", nombre: "Ana", apellidos: "Pérez López" };
const done = (r: Partial<PracticeRecord>): PracticeRecord => {
  const rec = { ...emptyRecord(), intentos: 1, prediccion: true, completada: "2026-11-05T15:20:00.000Z", ...r };
  return { ...rec, calificacion: gradeOf(rec) };
};

describe("calificación por práctica", () => {
  it("10 si acierta la pregunta al primer intento, sin pistas ni solución", () => {
    expect(gradeOf(done({}))).toBe(10);
  });
  it("−1 por respuesta equivocada (máx. −2), −0.5 por pista (máx. −1.5), −3 por ver la solución", () => {
    expect(gradeOf(done({ intentos: 2 }))).toBe(9);
    expect(gradeOf(done({ intentos: 5 }))).toBe(8);
    expect(gradeOf(done({ pistas: 1 }))).toBe(9.5);
    expect(gradeOf(done({ pistas: 3 }))).toBe(8.5);
    expect(gradeOf(done({ solucion: true }))).toBe(7);
  });
  it("nunca baja de 5 si la completó", () => {
    expect(gradeOf(done({ intentos: 3, pistas: 3, solucion: true }))).toBe(5);
  });
});

describe("resumen del avance", () => {
  it("avance, promedio de las completadas y calificación sobre las 25", () => {
    const s = summarize({ 1: done({}), 2: done({ pistas: 2 }), 3: { ...emptyRecord(), intentos: 1, prediccion: true } });
    expect(s.total).toBe(25);
    expect(s.completadas).toBe(2);
    expect(s.avancePct).toBe(8);
    expect(s.promedio).toBe(9.5);
    expect(s.general).toBe(0.8);
  });
  it("sin prácticas completadas no hay promedio", () => {
    expect(summarize({}).promedio).toBeNull();
  });
});

describe("reporte .txt con código de verificación", () => {
  const records = { 1: done({}), 2: done({ intentos: 2, pistas: 1 }), 6: done({ solucion: true }) };
  const text = buildReport(perfil, records, new Date(2026, 10, 5, 9, 30));

  it("lleva nombre, apellidos, correo, avance, promedio y cada práctica", () => {
    for (const s of ["Nombre(s):  Ana", "Apellidos:  Pérez López", "Correo:     ana.perez@escuela.edu.mx", "Prácticas completadas: 3 de 25 (12 %)", "Promedio de las prácticas completadas: 8.5", "CÓDIGO DE VERIFICACIÓN: "]) {
      expect(text).toContain(s);
    }
    expect(text).toMatch(/^ 1 {2}Reconocer los componentes +Completada +10\.0/m);
    expect(text).toMatch(/^ 5 {2}Programar avance y parada +Pendiente/m);
  });
  it("un reporte sin cambios es válido, también con saltos de línea de Windows", () => {
    const v = verifyReport(text);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.data.perfil.correo).toBe(perfil.correo);
      expect(v.summary.completadas).toBe(3);
    }
    expect(verifyReport(text.replace(/\n/g, "\r\n")).ok).toBe(true);
  });
  it("si se cambia una calificación, el nombre o los datos, deja de ser válido", () => {
    expect(verifyReport(text.replace("Completada    7.0", "Completada   10.0")).ok).toBe(false);
    expect(verifyReport(text.replace("Pérez López", "Pérez Lopez")).ok).toBe(false);
    expect(verifyReport(text.replace(/DATOS: (.)/, "DATOS: X")).ok).toBe(false);
  });
  it("un texto cualquiera no es un reporte", () => {
    const v = verifyReport("Hola, este es mi avance: 25 de 25");
    expect(v.ok).toBe(false);
  });
});

it("correo de la escuela con forma válida", () => {
  expect(validEmail("ana.perez@escuela.edu.mx")).toBe(true);
  expect(validEmail("ana.perez@escuela")).toBe(false);
  expect(validEmail("ana perez@escuela.mx")).toBe(false);
});
