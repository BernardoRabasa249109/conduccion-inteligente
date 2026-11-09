/**
 * Modelo 3D simplificado del Tiny:bit Pro con módulo K210.
 * Ejes locales: +x hacia delante, +y hacia arriba, +z hacia la derecha del robot.
 * El origen está en el suelo, bajo el centro del eje de las ruedas.
 */
import * as THREE from "three";
import { ROBOT } from "../core/config";
import type { RobotState } from "../core/robot";

export type PartName = "microbit" | "motorL" | "motorR" | "irL" | "irR" | "sonar" | "camera" | "leds" | "chassis";

const ICON_PATTERNS: Record<string, string> = {
  Heart: "01010 11111 11111 01110 00100",
  Happy: "00000 01010 00000 10001 01110",
  Sad: "00000 01010 00000 01110 10001",
  Yes: "00000 00001 00010 10100 01000",
  No: "10001 01010 00100 01010 10001",
  Square: "11111 10001 10001 10001 11111",
  Diamond: "00100 01010 10001 01010 00100",
  Target: "00100 01110 11011 01110 00100",
  Asleep: "00000 11011 00000 01110 00000",
  Surprised: "01010 00000 00100 01010 00100",
  "flecha-North": "00100 01110 10101 00100 00100",
  "flecha-East": "00100 00010 11111 00010 00100",
  "flecha-South": "00100 00100 10101 01110 00100",
  "flecha-West": "00100 01000 11111 01000 00100",
};
/** Letras y números para «mostrar número / texto» (diseño propio de 5×5). */
const FONT: Record<string, string> = {
  "0": "01110 10011 10101 11001 01110",
  "1": "00100 01100 00100 00100 01110",
  "2": "11110 00001 01110 10000 11111",
  "3": "11110 00001 00110 00001 11110",
  "4": "00110 01010 10010 11111 00010",
  "5": "11111 10000 11110 00001 11110",
  "6": "00111 01000 11110 10001 01110",
  "7": "11111 00010 00100 01000 10000",
  "8": "01110 10001 01110 10001 01110",
  "9": "01110 10001 01111 00010 11100",
  "A": "01100 10010 11110 10010 10010",
  "B": "11100 10010 11100 10010 11100",
  "C": "01110 10000 10000 10000 01110",
  "D": "11100 10010 10010 10010 11100",
  "E": "11110 10000 11100 10000 11110",
  "F": "11110 10000 11100 10000 10000",
  "G": "01110 10000 10011 10001 01110",
  "H": "10010 10010 11110 10010 10010",
  "I": "11100 01000 01000 01000 11100",
  "J": "11111 00010 00010 10010 01100",
  "K": "10010 10100 11000 10100 10010",
  "L": "10000 10000 10000 10000 11110",
  "M": "10001 11011 10101 10001 10001",
  "N": "10001 11001 10101 10011 10001",
  "O": "01100 10010 10010 10010 01100",
  "P": "11100 10010 11100 10000 10000",
  "Q": "01100 10010 10010 01100 00110",
  "R": "11100 10010 11100 10010 10001",
  "S": "01110 10000 01100 00010 11100",
  "T": "11111 00100 00100 00100 00100",
  "U": "10010 10010 10010 10010 01100",
  "V": "10001 10001 10001 01010 00100",
  "W": "10001 10001 10101 11011 10001",
  "X": "10010 10010 01100 10010 10010",
  "Y": "10001 01010 00100 00100 00100",
  "Z": "11110 00100 01000 10000 11110",
  "-": "00000 00000 01110 00000 00000",
  ".": "00000 00000 00000 00000 01000",
  " ": "00000 00000 00000 00000 00000",
  "!": "01000 01000 01000 00000 01000",
  "?": "01110 10001 00110 00000 00100",
  ":": "00000 01000 00000 01000 00000",
};

export const iconPattern = (name: string) => {
  if (name.startsWith("letra:")) {
    const ch = name.slice(6).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return (FONT[ch] ?? FONT["?"]).replace(/ /g, "");
  }
  return (ICON_PATTERNS[name] ?? "00000 00000 00000 00000 00000").replace(/ /g, "");
};

/** Color de los faros: nombre de Tinybit.enColor o «rgb:r,g,b» (RGB_Car_Big2). */
export function lightHex(lights: string): number {
  if (lights.startsWith("rgb:")) {
    const [r, g, b] = lights.slice(4).split(",").map((v) => Math.max(0, Math.min(255, Number(v) || 0)));
    return (r << 16) | (g << 8) | b;
  }
  return LIGHT_HEX[lights] ?? 0;
}

export const LIGHT_HEX: Record<string, number> = {
  OFF: 0x000000, apagadas: 0x000000, Red: 0xff2a2a, Green: 0x2aff6a, Blue: 0x3a6bff, White: 0xffffff, Cyan: 0x2af0ff, Pinkish: 0xff4af0, Yellow: 0xffe23a,
};

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...opts });
}

function treadTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1b1b1d";
  ctx.fillRect(0, 0, 128, 16);
  ctx.fillStyle = "#2d2d31";
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, 0);
    ctx.lineTo(i * 8 + 4, 8);
    ctx.lineTo(i * 8, 16);
    ctx.lineTo(i * 8 + 2, 16);
    ctx.lineTo(i * 8 + 6, 8);
    ctx.lineTo(i * 8 + 2, 0);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class RobotModel {
  readonly group = new THREE.Group();
  readonly parts = new Map<PartName, THREE.Object3D[]>();
  private wheelL = new THREE.Group();
  private wheelR = new THREE.Group();
  private ledMeshes: THREE.Mesh[] = [];
  private ledOn = mat(0xff3b30, { emissive: 0xff2010, emissiveIntensity: 1.6 });
  private ledOff = mat(0x3a1512, { roughness: 0.4 });
  private headlights: THREE.MeshStandardMaterial[] = [];
  private highlightMat = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private lastIcon = "";

  constructor() {
    const g = this.group;
    const pcb = mat(0x15161a, { roughness: 0.5 });
    const gold = mat(0xc9a24a, { metalness: 0.6, roughness: 0.35 });
    const blue = mat(0x1a5fd6, { roughness: 0.45 });
    const black = mat(0x0d0d10, { roughness: 0.55 });
    const silver = mat(0xc7ccd3, { metalness: 0.8, roughness: 0.3 });
    const white = mat(0xf2f2f0, { roughness: 0.4 });
    const add = (part: PartName | null, mesh: THREE.Object3D, parent: THREE.Object3D = g) => {
      parent.add(mesh);
      if (part) this.parts.set(part, [...(this.parts.get(part) ?? []), mesh]);
      return mesh;
    };

    // Chasis: disco con escotaduras para las ruedas.
    const shape = new THREE.Shape();
    const cxOff = ROBOT.chassisOffset;
    const R = 4.9;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      let x = cxOff + Math.cos(a) * R, z = Math.sin(a) * R;
      if (Math.abs(x) < 2.7 && Math.abs(z) > 3.15) z = Math.sign(z) * 3.15;
      pts.push(new THREE.Vector2(x, z));
    }
    shape.setFromPoints(pts);
    const chassisGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    chassisGeo.rotateX(Math.PI / 2);
    const chassis = new THREE.Mesh(chassisGeo, pcb);
    chassis.position.y = 2.75;
    add("chassis", chassis);
    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, gold);
    rim.scale.set(1.01, 1, 1.01);
    rim.position.y = 2.6;
    add("chassis", rim);
    // Gráficos azules del PCB.
    for (const side of [-1, 1]) {
      const tri = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.04, 3), blue);
      tri.position.set(3.4, 2.78, side * 2.2);
      tri.rotation.y = side * 0.5;
      add("chassis", tri);
    }
    // Batería y placa inferior.
    const battery = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 4.6), black);
    battery.position.set(0.9, 1.9, 0);
    add("chassis", battery);
    // Interruptor de encendido.
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.2), black);
    sw.position.set(-1.6, 3.05, 3.2);
    add("chassis", sw);

    // Ruedas y motores N20.
    const tread = treadTexture();
    tread.repeat.set(6, 1);
    const tireMat = new THREE.MeshStandardMaterial({ map: tread, roughness: 0.9 });
    const hubMat = white;
    for (const [side, wheel] of [[-1, this.wheelL], [1, this.wheelR]] as const) {
      const part: PartName = side < 0 ? "motorL" : "motorR";
      wheel.position.set(0, ROBOT.wheelRadius, (side * ROBOT.trackWidth) / 2);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(ROBOT.wheelRadius, ROBOT.wheelRadius, 1.7, 36, 1, true), tireMat);
      tire.rotation.x = Math.PI / 2;
      const sideMat = mat(0x1d1d20, { roughness: 0.85 });
      const outer = new THREE.Mesh(new THREE.RingGeometry(1.25, ROBOT.wheelRadius, 36), sideMat);
      outer.position.z = side * 0.85;
      if (side < 0) outer.rotation.y = Math.PI;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.5, 28), hubMat);
      hub.rotation.x = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.56, 12), black);
      cap.rotation.x = Math.PI / 2;
      // Marca para ver girar la rueda.
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.05), mat(0x9aa0aa));
      marker.position.set(0, 0.6, side * 0.78);
      wheel.add(tire, outer, hub, cap, marker);
      add(part, wheel);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 18), silver);
      motor.rotation.x = Math.PI / 2;
      motor.position.set(0, ROBOT.wheelRadius, side * 1.9);
      add(part, motor);
      const gearbox = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.9), mat(0xd9c25a, { metalness: 0.5, roughness: 0.4 }));
      gearbox.position.set(0, ROBOT.wheelRadius, side * 2.9);
      add(part, gearbox);
    }

    // Rueda loca delantera (bola blanca).
    const casterHousing = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.6, 16), black);
    casterHousing.position.set(4.6, 1.9, 0);
    add("chassis", casterHousing);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), white);
    ball.position.set(4.6, 0.85, 0);
    add("chassis", ball);

    // Sensores infrarrojos de línea (bajo el frente).
    for (const [side, part] of [[-1, "irL"], [1, "irR"]] as const) {
      const z = (side * ROBOT.lineSensorSpacing) / 2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.55), mat(0x1a1a24));
      body.position.set(ROBOT.lineSensorForward, 2.2, z);
      add(part, body);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 10), mat(0x2a5bff, { emissive: 0x0a2280, emissiveIntensity: 0.5 }));
      eye.position.set(ROBOT.lineSensorForward, 1.85, z);
      add(part, eye);
    }

    // Soporte negro de la micro:bit y placa micro:bit (LEDs hacia arriba).
    const holder = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 5.0), black);
    holder.position.set(1.9, 3.6, 0);
    add("microbit", holder);
    const mb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 5.2), mat(0x18181c, { roughness: 0.5 }));
    mb.position.set(1.6, 4.5, 0);
    add("microbit", mb);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 5.0), gold);
    edge.position.set(-0.3, 4.5, 0);
    add("microbit", edge);
    for (const side of [-1, 1]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12), black);
      btn.position.set(2.1, 4.65, side * 2.0);
      add("microbit", btn);
    }
    // Matriz LED 5×5.
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.32), this.ledOff);
        led.position.set(2.75 - row * 0.55, 4.6, -1.1 + col * 0.55);
        add("leds", led);
        this.ledMeshes.push(led);
      }
    }

    // Ultrasonido: placa azul vertical con dos cápsulas plateadas.
    const usBoard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 4.4), blue);
    usBoard.position.set(5.3, ROBOT.sonarHeight, 0);
    add("sonar", usBoard);
    for (const side of [-1, 1]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 24, 1, true), silver);
      can.rotation.z = Math.PI / 2;
      can.position.set(5.95, ROBOT.sonarHeight, side * 1.25);
      add("sonar", can);
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), mat(0x2b2b2e, { roughness: 1 }));
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(6.4, ROBOT.sonarHeight, side * 1.25);
      add("sonar", mesh);
    }
    const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.9), silver);
    crystal.position.set(5.45, ROBOT.sonarHeight + 0.75, 0);
    add("sonar", crystal);

    // Faros RGB (luces delanteras transparentes).
    for (const side of [-1, 1]) {
      const m = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, transparent: true, opacity: 0.8, roughness: 0.15, emissive: 0x000000 });
      this.headlights.push(m);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16), m);
      body.rotation.z = Math.PI / 2;
      body.position.set(5.0, 3.15, side * 3.0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
      dome.rotation.z = -Math.PI / 2;
      dome.position.set(5.45, 3.15, side * 3.0);
      add(null, body);
      add(null, dome);
    }

    // Soporte en "U" invertida y módulo de visión K210.
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.6, 0.28), black);
      leg.position.set(-0.6, 2.85 + 4.3, side * 2.4);
      add("camera", leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 5.1), black);
    top.position.set(-0.6, 11.3, 0);
    add("camera", top);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 10), silver);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(-0.2, 11.5, 0);
    add("camera", hinge);
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.6, 6.6), white);
    caseMesh.position.set(0.3, 13.3, 0);
    add("camera", caseMesh);
    const acrylic = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 6.0), new THREE.MeshStandardMaterial({ color: 0xd8dee6, transparent: true, opacity: 0.55, roughness: 0.2 }));
    acrylic.position.set(1.15, 13.3, 0);
    add("camera", acrylic);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.6), mat(0xd9822b));
    ribbon.position.set(1.06, 12.0, 0);
    add("camera", ribbon);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.5, 18), mat(0x0b0b0e, { roughness: 0.2, metalness: 0.3 }));
    lens.rotation.z = Math.PI / 2;
    lens.position.set(1.35, ROBOT.cameraHeight + 0.3, 0);
    add("camera", lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), mat(0x2a3f66, { roughness: 0.05, metalness: 0.5 }));
    glass.rotation.y = Math.PI / 2;
    glass.position.set(1.61, ROBOT.cameraHeight + 0.3, 0);
    add("camera", glass);
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.6), mat(0x1a2433, { emissive: 0x0d1a2a, emissiveIntensity: 0.6, roughness: 0.2 }));
    lcd.rotation.y = -Math.PI / 2;
    lcd.position.set(-0.46, 13.3, 0);
    add("camera", lcd);
    for (const [y, z] of [[15.2, 2.8], [15.2, -2.8], [11.4, 2.8], [11.4, -2.8]]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 10), silver);
      screw.rotation.z = Math.PI / 2;
      screw.position.set(1.3, y, z);
      add("camera", screw);
    }

    // Sombra suave falsa bajo el robot.
    const sh = document.createElement("canvas");
    sh.width = sh.height = 64;
    const sctx = sh.getContext("2d")!;
    const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, "rgba(20,10,40,0.45)");
    grad.addColorStop(1, "rgba(20,10,40,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(14, 13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1.4, 0.05, 0);
    shadow.renderOrder = -1;
    g.add(shadow);

    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = false;
    });
  }

  update(r: RobotState) {
    this.group.position.set(r.x, 0, r.y);
    this.group.rotation.y = -r.heading;
    this.wheelL.rotation.z = -r.spinLeft;
    this.wheelR.rotation.z = -r.spinRight;
    if (r.icon !== this.lastIcon) {
      this.lastIcon = r.icon;
      const p = iconPattern(r.icon);
      this.ledMeshes.forEach((m, i) => (m.material = p[i] === "1" ? this.ledOn : this.ledOff));
    }
    const hex = lightHex(r.lights);
    for (const m of this.headlights) {
      m.emissive.setHex(hex);
      m.emissiveIntensity = hex ? 1.4 : 0;
    }
  }

  /** Resalta un componente (modo Explorar). */
  highlight(part: PartName | null, color = 0x22d3ee) {
    for (const [mesh, original] of this.highlightMat) mesh.material = original;
    this.highlightMat.clear();
    if (!part) return;
    for (const obj of this.parts.get(part) ?? []) {
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        this.highlightMat.set(mesh, mesh.material);
        mesh.material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
      });
    }
  }
}
