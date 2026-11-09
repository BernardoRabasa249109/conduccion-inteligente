/**
 * Valor estable para mostrar en pantalla: un valor nuevo debe repetirse
 * `settleMs` antes de aparecer, y el valor visible se mantiene al menos
 * `minShowMs`. Evita que un dato que oscila muy rápido haga parpadear la
 * interfaz. Solo afecta a lo que se ve: el programa recibe los datos exactos.
 */
export class Steady<T> {
  private shownSince = -Infinity;
  private cand: T;
  private candSince = 0;
  constructor(public shown: T, private settleMs: number, private minShowMs: number) {
    this.cand = shown;
  }
  push(v: T, now: number): T {
    if (v === this.shown) {
      this.cand = v;
      return this.shown;
    }
    if (v !== this.cand) {
      this.cand = v;
      this.candSince = now;
    }
    if (now - this.candSince >= this.settleMs && now - this.shownSince >= this.minShowMs) {
      this.shown = v;
      this.shownSince = now;
    }
    return this.shown;
  }
}
