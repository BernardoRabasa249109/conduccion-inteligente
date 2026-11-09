/** Objetos 3D del tapete: señales, semáforos, obstáculos. */
import * as THREE from "three";
import type { LampColor, LightObject, LightState, ObstacleObject, SignObject } from "../core/scenario";
import { PROPS } from "../core/world";
import { signFace } from "./signFaces";

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const baseMat = std(0x2a2a2e);
const poleMat = std(0xa8adb5, { metalness: 0.6, roughness: 0.35 });
// Materiales y caras de señal compartidos: no se liberan al reconstruir.
baseMat.userData.shared = poleMat.userData.shared = true;
const faceTex = new Map<string, THREE.CanvasTexture>();

function softShadow(r: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
  g.addColorStop(0, "rgba(30,20,60,0.35)");
  g.addColorStop(1, "rgba(30,20,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

export function buildSign(o: SignObject): THREE.Group {
  const g = new THREE.Group();
  g.add(softShadow(PROPS.signBaseR));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(PROPS.signBaseR, PROPS.signBaseR * 1.05, PROPS.signBaseH, 28), baseMat);
  base.position.y = PROPS.signBaseH / 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(PROPS.signPoleR, PROPS.signPoleR, PROPS.signPlateCenter, 12), poleMat);
  pole.position.y = PROPS.signPlateCenter / 2;
  let tex = faceTex.get(o.sign);
  if (!tex) {
    tex = new THREE.CanvasTexture(signFace(o.sign));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.userData.shared = true;
    faceTex.set(o.sign, tex);
  }
  const square = o.sign === "p1" || o.sign === "p2";
  const r = PROPS.signPlateR;
  const plateGeo = square ? new THREE.BoxGeometry(0.3, r * 2, r * 2) : new THREE.CylinderGeometry(r, r, 0.3, 36);
  if (!square) plateGeo.rotateZ(Math.PI / 2);
  const plate = new THREE.Mesh(plateGeo, std(0xd5d8dd, { metalness: 0.3 }));
  // La placa va delante del poste (sujeta con una abrazadera) para que el poste no tape la cara.
  const ahead = PROPS.signPoleR + 0.35;
  plate.position.set(ahead, PROPS.signPlateCenter, 0);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(ahead, 1.3, 1.1), poleMat);
  clamp.position.set(ahead / 2, PROPS.signPlateCenter, 0);
  const face = new THREE.Mesh(square ? new THREE.PlaneGeometry(r * 2, r * 2) : new THREE.CircleGeometry(r * 0.98, 36), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
  // La cara mira hacia +x local; el grupo se gira hacia `facing`.
  face.rotation.y = Math.PI / 2;
  face.position.set(ahead + 0.16, PROPS.signPlateCenter, 0);
  if (!square) {
    const ftex = face.material as THREE.MeshStandardMaterial;
    ftex.map!.center.set(0.5, 0.5);
  }
  g.add(base, pole, clamp, plate, face);
  g.position.set(o.x, 0, o.y);
  g.rotation.y = -o.facing;
  g.userData.id = o.id;
  return g;
}

export class LightModel {
  readonly group = new THREE.Group();
  private lamps: Record<LampColor, THREE.MeshStandardMaterial>;
  private glow: Record<LampColor, THREE.Mesh>;
  constructor(o: LightObject) {
    const g = this.group;
    g.add(softShadow(PROPS.lightBaseR));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(PROPS.lightBaseR, PROPS.lightBaseR * 1.05, 1.2, 28), baseMat);
    base.position.y = 0.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(PROPS.lightPoleR, PROPS.lightPoleR, PROPS.lightCenter, 12), poleMat);
    pole.position.y = PROPS.lightCenter / 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, PROPS.lightBoxH, PROPS.lightBoxW), std(0x1c1c20, { roughness: 0.5 }));
    box.position.y = PROPS.lightCenter;
    g.add(base, pole, box);
    const colors: Record<LampColor, number> = { rojo: 0xff2a2a, amarillo: 0xffc21a, verde: 0x22e06a };
    this.lamps = {} as never;
    this.glow = {} as never;
    (["rojo", "amarillo", "verde"] as LampColor[]).forEach((st, i) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: colors[st], emissiveIntensity: 0.05, roughness: 0.3 });
      this.lamps[st] = m;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 12, 0, Math.PI), m);
      lamp.rotation.y = Math.PI / 2;
      lamp.position.set(1.2, PROPS.lightCenter + 2.8 - i * 2.8, 0);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.9, 16, 1, true, -Math.PI / 2, Math.PI), std(0x18181b, { side: THREE.DoubleSide }));
      visor.rotation.z = Math.PI / 2;
      visor.position.set(1.55, PROPS.lightCenter + 2.8 - i * 2.8, 0);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), new THREE.MeshBasicMaterial({ color: colors[st], transparent: true, opacity: 0, depthWrite: false }));
      glow.rotation.y = Math.PI / 2;
      glow.position.set(1.3, PROPS.lightCenter + 2.8 - i * 2.8, 0);
      this.glow[st] = glow;
      g.add(lamp, visor, glow);
    });
    g.position.set(o.x, 0, o.y);
    g.rotation.y = -o.facing;
    g.userData.id = o.id;
  }
  /** Enciende la luz del estado; «apagado» deja las tres apagadas. */
  set(state: LightState) {
    for (const st of ["rojo", "amarillo", "verde"] as LampColor[]) {
      const on = st === state;
      this.lamps[st].color.setHex(on ? 0xffffff : 0x222222);
      this.lamps[st].emissiveIntensity = on ? 1.6 : 0.05;
      (this.glow[st].material as THREE.MeshBasicMaterial).opacity = on ? 0.35 : 0;
    }
  }
}

export function buildObstacle(o: ObstacleObject): THREE.Group {
  const g = new THREE.Group();
  g.add(softShadow(Math.max(o.w, o.d) / 2));
  if (o.shape === "persona") {
    const body = std(0xf08a3c);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 6, 14), std(0x3b4f8c));
    legs.position.y = 3;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 5, 16), body);
    torso.position.y = 8.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), std(0xf2c9a0));
    head.position.y = 12.6;
    g.add(legs, torso, head);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), std(0xe0a040, { roughness: 0.8 }));
    box.position.y = o.h / 2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.05, 1.2, o.d + 0.05), std(0x222226));
    stripe.position.y = o.h * 0.7;
    g.add(box, stripe);
  }
  g.position.set(o.x, 0, o.y);
  g.rotation.y = -o.rot;
  g.userData.id = o.id;
  return g;
}
