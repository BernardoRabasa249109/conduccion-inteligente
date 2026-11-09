/** Caras de las señales dibujadas en canvas (sin imágenes externas). */
import type { SignType } from "../core/scenario";

const cache = new Map<string, HTMLCanvasElement>();

function arrow(ctx: CanvasRenderingContext2D, dir: 1 | -1) {
  // Flecha en "L": sube y gira (como en las señales del kit).
  ctx.save();
  ctx.translate(128, 128);
  ctx.scale(dir, 1);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(18, 70);
  ctx.lineTo(18, -6);
  ctx.lineTo(-22, -6);
  ctx.lineTo(-22, 22);
  ctx.lineTo(-70, -22);
  ctx.lineTo(-22, -66);
  ctx.lineTo(-22, -38);
  ctx.lineTo(50, -38);
  ctx.lineTo(50, 70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function signFace(sign: SignType): HTMLCanvasElement {
  if (cache.has(sign)) return cache.get(sign)!;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const round = sign !== "p1" && sign !== "p2";
  ctx.clearRect(0, 0, 256, 256);
  if (round) {
    ctx.fillStyle = "#f4f4f4";
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#f4f4f4";
    roundRect(ctx, 4, 4, 248, 248, 26);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (sign) {
    case "izquierda":
    case "derecha":
      ctx.fillStyle = "#1f43b8";
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.fill();
      arrow(ctx, sign === "izquierda" ? 1 : -1);
      break;
    case "limite30":
    case "fin30":
      ctx.fillStyle = sign === "limite30" ? "#d7262e" : "#9a9a9a";
      ctx.beginPath();
      ctx.arc(128, 128, 116, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(128, 128, 88, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "bold 104px Arial, sans-serif";
      ctx.fillText("30", 128, 136);
      if (sign === "fin30") {
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(60, 196);
        ctx.lineTo(196, 60);
        ctx.stroke();
      }
      break;
    case "claxon":
      ctx.fillStyle = "#1f43b8";
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(62, 104);
      ctx.lineTo(96, 104);
      ctx.lineTo(150, 62);
      ctx.lineTo(150, 194);
      ctx.lineTo(96, 152);
      ctx.lineTo(62, 152);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 10;
      for (const r of [28, 50]) {
        ctx.beginPath();
        ctx.arc(150, 128, r, -0.7, 0.7);
        ctx.stroke();
      }
      break;
    case "p1":
    case "p2":
      ctx.fillStyle = "#1f43b8";
      roundRect(ctx, 16, 16, 224, 224, 18);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 150px Arial, sans-serif";
      ctx.fillText("P", 128, 108);
      ctx.font = "bold 70px Arial, sans-serif";
      ctx.fillText(sign === "p1" ? "1" : "2", 128, 205);
      break;
    case "alto":
      ctx.fillStyle = "#c81e1e";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        const x = 128 + Math.cos(a) * 120, y = 128 + Math.sin(a) * 120;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 74px Arial, sans-serif";
      ctx.fillText("ALTO", 128, 132);
      break;
  }
  cache.set(sign, c);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Pequeño icono SVG (para la paleta del editor y las listas). */
export function signThumb(sign: SignType): string {
  return signFace(sign).toDataURL();
}
