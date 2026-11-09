/**
 * Dibuja el tapete en un canvas. La línea negra usa exactamente las mismas
 * formas que consultan los sensores (track.ts), así lo que se ve coincide con
 * lo que se lee. Las decoraciones son claras para que los infrarrojos las lean
 * como blanco.
 */
import { LINE } from "../core/config";
import { matHeight, matWidth, type Scenario } from "../core/scenario";
import { LineMap, markPrim, strokePrims, tilePrims } from "../core/track";

export const FLOOR_PX = 8;

export function drawFloor(canvas: HTMLCanvasElement, s: Scenario, opts: { grid?: boolean } = {}) {
  const W = matWidth(s), H = matHeight(s), k = FLOOR_PX;
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext("2d")!;
  // Superficie clara con un leve degradado "espacial" (tonos pastel: los IR los leen como blanco).
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#f1eefb");
  bg.addColorStop(1, "#e8eef8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Planetas decorativos muy claros.
  const deco: [number, number, number, string][] = [
    [W * 0.08, H * 0.9, 14, "#e4dcf7"], [W * 0.93, H * 0.12, 10, "#f6e2ea"], [W * 0.5, H * 0.5, 7, "#dfe6f7"], [W * 0.8, H * 0.86, 9, "#f7e9da"],
  ];
  for (const [x, y, r, c] of deco) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x * k, y * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#d9d3ee";
  for (let i = 0; i < 60; i++) {
    const x = ((i * 97.3) % W) * k, y = ((i * 53.9 + 11) % H) * k;
    ctx.fillRect(x, y, 0.35 * k, 0.35 * k);
  }

  if (opts.grid) {
    ctx.strokeStyle = "rgba(120,110,170,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    for (let c = 0; c <= s.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s.tile * k, 0);
      ctx.lineTo(c * s.tile * k, H * k);
      ctx.stroke();
    }
    for (let r = 0; r <= s.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s.tile * k);
      ctx.lineTo(W * k, r * s.tile * k);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Zonas: velocidad reducida, estacionamiento y metas (colores claros).
  for (const z of s.zones) {
    const x = z.x * k, y = z.y * k, w = z.w * k, d = z.d * k;
    // Zona girada: se dibuja igual, pero alrededor de su centro.
    ctx.save();
    if (z.rot) {
      ctx.translate(x + w / 2, y + d / 2);
      ctx.rotate(z.rot);
      ctx.translate(-(x + w / 2), -(y + d / 2));
    }
    if (z.kind === "slow") {
      ctx.fillStyle = "rgba(255, 196, 120, 0.28)";
      ctx.fillRect(x, y, w, d);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, d);
      ctx.clip();
      ctx.strokeStyle = "rgba(240, 160, 70, 0.35)";
      ctx.lineWidth = 0.6 * k;
      for (let i = -d; i < w + d; i += 4 * k) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + d, y + d);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(225, 140, 50, 0.55)";
      ctx.font = `bold ${3.2 * k}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("ZONA 30", x + 1 * k, y + 0.8 * k);
    } else if (z.kind === "parking") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, w, d);
      ctx.strokeStyle = "#7fa2e8";
      ctx.lineWidth = 0.5 * k;
      ctx.strokeRect(x, y, w, d);
      ctx.fillStyle = "#7fa2e8";
      ctx.font = `bold ${7 * k}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(z.label, x + w / 2, y + d / 2);
    } else {
      ctx.fillStyle = "rgba(120, 220, 170, 0.25)";
      ctx.fillRect(x, y, w, d);
      ctx.strokeStyle = "rgba(60, 170, 120, 0.7)";
      ctx.setLineDash([1.2 * k, 0.8 * k]);
      ctx.lineWidth = 0.4 * k;
      ctx.strokeRect(x, y, w, d);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(40, 140, 95, 0.85)";
      ctx.font = `bold ${3 * k}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(z.label, x + w / 2, y + d / 2);
    }
    ctx.restore();
  }

  // Carretera blanca y línea negra (mismas formas que leen los sensores).
  const prims = s.tiles.flatMap((t) => tilePrims(t, s.tile));
  strokePrims(ctx, prims, k, LINE.roadWidth, "#ffffff", "butt");
  // Tapas redondeadas en los extremos sueltos de la carretera.
  strokePrims(ctx, prims, k, LINE.roadWidth, "#ffffff", "round");
  strokePrims(ctx, prims, k, LINE.width, "#111114", "butt");
  const marks = s.objects.filter((o) => o.kind === "mark").map((m) => markPrim(m as never));
  strokePrims(ctx, marks, k, LINE.width, "#111114", "butt");

  // Borde del tapete.
  ctx.strokeStyle = "#8f7fd6";
  ctx.lineWidth = 0.8 * k;
  ctx.strokeRect(0.4 * k, 0.4 * k, canvas.width - 0.8 * k, canvas.height - 0.8 * k);
  return canvas;
}

/** Comprueba que el dibujo y el modelo coinciden (lo usa la verificación interna). */
export function sampleMatches(s: Scenario, canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const ctx = canvas.getContext("2d")!;
  const d = ctx.getImageData(Math.floor(x * FLOOR_PX), Math.floor(y * FLOOR_PX), 1, 1).data;
  const dark = d[0] + d[1] + d[2] < 150;
  return dark === new LineMap(s).isBlack(x, y);
}
