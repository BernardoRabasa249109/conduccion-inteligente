/**
 * Dibuja el tapete en un canvas. La línea negra usa exactamente las mismas
 * formas que consultan los sensores (track.ts), así lo que se ve coincide con
 * lo que se lee. Las decoraciones son claras para que los infrarrojos las lean
 * como blanco.
 */
import { LINE } from "../core/config";
import { matHeight, matWidth, type Scenario, type TileType } from "../core/scenario";
import { isRoundabout, LineMap, markPrim, ROUNDABOUT, strokePrims, tilePrims } from "../core/track";

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

  // Glorietas: disco blanco bajo el anillo (como en el tapete de referencia).
  const rounds = s.tiles.filter((t) => isRoundabout(t.type)).map((t) => [(t.c + 0.5) * s.tile * k, (t.r + 0.5) * s.tile * k] as const);
  ctx.fillStyle = "#ffffff";
  for (const [cx, cy] of rounds) {
    ctx.beginPath();
    ctx.arc(cx, cy, (ROUNDABOUT.ring * s.tile + LINE.roadWidth / 2) * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // Carretera blanca y línea negra (mismas formas que leen los sensores).
  const prims = s.tiles.flatMap((t) => tilePrims(t, s.tile));
  strokePrims(ctx, prims, k, LINE.roadWidth, "#ffffff", "butt");
  // Tapas redondeadas en los extremos sueltos de la carretera.
  strokePrims(ctx, prims, k, LINE.roadWidth, "#ffffff", "round");
  // Dona morada al centro de cada glorieta. Es decoración: no es línea negra
  // y los sensores del simulador no la leen (en un tapete impreso depende de la tinta).
  ctx.strokeStyle = "#6e0078";
  ctx.lineWidth = (ROUNDABOUT.donutOuter - ROUNDABOUT.donutInner) * s.tile * k;
  for (const [cx, cy] of rounds) {
    ctx.beginPath();
    ctx.arc(cx, cy, ((ROUNDABOUT.donutOuter + ROUNDABOUT.donutInner) / 2) * s.tile * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Dibujos impresos de algunas piezas (señal, obras, «P»): decoración, no línea negra.
  for (const t of s.tiles) {
    const draw = PIECE_DECOR[t.type];
    if (!draw) continue;
    ctx.save();
    ctx.translate((t.c + 0.5) * s.tile * k, (t.r + 0.5) * s.tile * k);
    ctx.rotate((((t.rot % 4) + 4) % 4) * (Math.PI / 2));
    ctx.scale((s.tile * k) / 30, (s.tile * k) / 30);
    ctx.translate(-15, -15);
    draw(ctx);
    ctx.restore();
  }
  strokePrims(ctx, prims, k, LINE.width, "#111114", "butt");
  const marks = s.objects.filter((o) => o.kind === "mark").map((m) => markPrim(m as never));
  strokePrims(ctx, marks, k, LINE.width, "#111114", "butt");

  // Borde del tapete.
  ctx.strokeStyle = "#8f7fd6";
  ctx.lineWidth = 0.8 * k;
  ctx.strokeRect(0.4 * k, 0.4 * k, canvas.width - 0.8 * k, canvas.height - 0.8 * k);
  return canvas;
}

// ───────── Dibujos impresos de las piezas (en cm de una pieza de 30, sin girar) ─────────

/** Señal «calle sin salida»: cuadro azul con la barra roja y el poste blanco. */
function deadEndSign(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.fillStyle = "#ef1c1c";
  ctx.fillRect(x - s * 0.33, y - s * 0.32, s * 0.66, s * 0.16);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - s * 0.08, y - s * 0.16, s * 0.16, s * 0.48);
}

/** Valla de obras: barra con franjas naranjas y blancas entre dos postes. */
function barrier(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.clip();
  ctx.fillStyle = "#f97316";
  for (let i = -h; i < w + h; i += 1.6) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + i, y + h / 2);
    ctx.lineTo(x - w / 2 + i + 0.8, y + h / 2);
    ctx.lineTo(x - w / 2 + i + 0.8 + h, y - h / 2);
    ctx.lineTo(x - w / 2 + i + h, y - h / 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x - w / 2 - 0.5, y - h / 2 - 0.4, 0.8, h + 0.8);
  ctx.fillRect(x + w / 2 - 0.3, y - h / 2 - 0.4, 0.8, h + 0.8);
}

/** Cono de obras visto desde arriba: cuadro naranja con aro blanco. */
function cone(ctx: CanvasRenderingContext2D, x: number, y: number, s = 2.4) {
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, s * 0.11, 0, Math.PI * 2);
  ctx.fill();
}

/** Letrero de estacionamiento: cuadro azul con la «P» blanca. */
function parkingSign(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${s * 0.78}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("P", x, y + s * 0.04);
}

/** Decoración impresa de cada pieza (los sensores de línea no la leen: no es línea negra). */
const PIECE_DECOR: Partial<Record<TileType, (ctx: CanvasRenderingContext2D) => void>> = {
  deadend: (ctx) => deadEndSign(ctx, 24.5, 24.5, 4.6),
  detour: (ctx) => {
    barrier(ctx, 16, 15, 8.4, 2.2);
    cone(ctx, 13.4, 11.2);
    cone(ctx, 18.8, 11.2);
    cone(ctx, 16.1, 18.9);
  },
  bay: (ctx) => parkingSign(ctx, 26.3, 15, 3.2),
  parking: (ctx) => {
    // Lugares numerados (blancos, con esquinas redondeadas) y el letrero «P».
    const slots: [number, number, string][] = [[1, 10.5, "1"], [18.5, 10.5, "3"], [1, 21, "2"], [18.5, 21, "4"]];
    for (const [x, y, n] of slots) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(x, y - 3.6, 10.5, 7.2, 1.4);
      ctx.fill();
      ctx.fillStyle = "#6b21a8";
      ctx.font = "bold 3.8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n, x < 15 ? 3.6 : 26.4, y + 0.2);
    }
    parkingSign(ctx, 26.6, 3.4, 4.2);
  },
};

/** Comprueba que el dibujo y el modelo coinciden (lo usa la verificación interna). */
export function sampleMatches(s: Scenario, canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const ctx = canvas.getContext("2d")!;
  const d = ctx.getImageData(Math.floor(x * FLOOR_PX), Math.floor(y * FLOOR_PX), 1, 1).data;
  const dark = d[0] + d[1] + d[2] < 150;
  return dark === new LineMap(s).isBlack(x, y);
}
