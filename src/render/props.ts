/** Objetos 3D del tapete: señales, semáforos, obstáculos. */
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import lightUrl from "../../modelo3D/Semaforo_simulador.glb?url";
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

const LAMPS: LampColor[] = ["rojo", "amarillo", "verde"];
/** Material de cada lente en el modelo (Semaforo_3D) y su color encendido (el mismo del visor del modelo). */
const LENS_MAT: Record<LampColor, string> = { rojo: "Lente_roja_apagada", amarillo: "Lente_ambar_apagada", verde: "Lente_verde_apagada" };
const LIT: Record<LampColor, number> = { rojo: 0xff1420, amarillo: 0xffaa05, verde: 0x00ef55 };

interface LightTemplate {
  model: THREE.Object3D;
  /** Centro y radio de cada lente, ya en las medidas del simulador. */
  lenses: Record<LampColor, { x: number; y: number; z: number; r: number }>;
}
let template: Promise<LightTemplate> | null = null;

/**
 * Modelo 3D del semáforo (Semaforo_3D, copia optimizada con `npm run semaforo`).
 * Se carga una vez; todos los semáforos comparten sus formas y sus materiales
 * (salvo las lentes, que cada uno enciende por su cuenta).
 */
function lightTemplate(): Promise<LightTemplate> {
  template ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(lightUrl)
    .then((gltf) => {
      const model = gltf.scene;
      // El modelo tiene Y vertical y el frente hacia +Z (en metros); en el simulador
      // las luces miran hacia +X local. Mide lo mismo que el semáforo de siempre,
      // con la carcasa a la altura que usa la visión simulada (PROPS.lightCenter).
      model.rotation.y = Math.PI / 2;
      const box = new THREE.Box3().setFromObject(model);
      model.scale.setScalar((PROPS.lightCenter + PROPS.lightBoxH / 2) / (box.max.y - box.min.y));
      model.updateMatrixWorld(true);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.userData.shared = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!Object.values(LENS_MAT).includes(mat.name)) mat.userData.shared = true;
        // La escena del tapete no tiene reflejos de entorno: con el acabado metálico
        // del modelo, el poste de aluminio y la carcasa se verían negros.
        mat.metalness = Math.min(mat.metalness, 0.15);
      });
      // La base, centrada en el punto del semáforo y apoyada en el tapete.
      const all = new THREE.Box3().setFromObject(model);
      const center = new THREE.Box3().setFromObject(findByMaterial(model, "Base_grafito") ?? model).getCenter(new THREE.Vector3());
      model.position.set(-center.x, -all.min.y, -center.z);
      model.updateMatrixWorld(true);
      const lenses = {} as LightTemplate["lenses"];
      for (const c of LAMPS) {
        const b = new THREE.Box3().setFromObject(findByMaterial(model, LENS_MAT[c])!);
        const mid = b.getCenter(new THREE.Vector3());
        lenses[c] = { x: b.max.x, y: mid.y, z: mid.z, r: (b.max.y - b.min.y) / 2 };
      }
      const holder = new THREE.Group();
      holder.add(model);
      return { model: holder, lenses };
    });
  return template;
}

function findByMaterial(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).name === name) found = o;
  });
  return found;
}

export class LightModel {
  readonly group = new THREE.Group();
  private lamps = {} as Record<LampColor, THREE.MeshStandardMaterial>;
  private glow = {} as Record<LampColor, THREE.Mesh>;
  private state: LightState = "apagado";
  constructor(o: LightObject) {
    const g = this.group;
    g.add(softShadow(PROPS.lightBaseR));
    g.position.set(o.x, 0, o.y);
    g.rotation.y = -o.facing;
    g.userData.id = o.id;
    void lightTemplate().then((t) => this.attach(t));
  }

  private attach(t: LightTemplate) {
    const model = t.model.clone();
    // Cada semáforo enciende sus propias lentes: esos materiales no se comparten.
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const c = LAMPS.find((k) => (m.material as THREE.Material).name === LENS_MAT[k]);
      if (!c) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.emissive.setHex(LIT[c]);
      m.material = this.lamps[c] = mat;
    });
    // Halo delante de la lente encendida: se distingue el color también desde lejos
    // y en la vista pequeña de la cámara K210.
    for (const c of LAMPS) {
      const l = t.lenses[c];
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(l.r * 1.35, 24),
        new THREE.MeshBasicMaterial({ color: LIT[c], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      glow.rotation.y = Math.PI / 2;
      glow.position.set(l.x + 0.08, l.y, l.z);
      this.glow[c] = glow;
      model.add(glow);
    }
    this.group.add(model);
    this.set(this.state);
  }

  /** Enciende la luz del estado; «apagado» deja las tres apagadas. */
  set(state: LightState) {
    this.state = state;
    for (const c of LAMPS) {
      const on = c === state;
      if (this.lamps[c]) this.lamps[c].emissiveIntensity = on ? 2.2 : 0;
      if (this.glow[c]) (this.glow[c].material as THREE.MeshBasicMaterial).opacity = on ? 0.45 : 0;
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
