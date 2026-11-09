/**
 * Vista 3D de «Explorar el robot»: el modelo del Tiny:bit Pro de
 * modelo3D/Tinybit_Pro_conceptual.glb sobre un plano técnico de estilo neón.
 *
 * Cada pieza del modelo se reconoce por su nombre (el número inicial que le
 * da crear_tinybit_pro_3d.py) y se asigna a un componente. El modelo está en
 * sus propias unidades, con Z hacia arriba, el frente hacia −Y y la izquierda
 * del robot hacia +X; todo lo que se añade aquí usa esas mismas coordenadas.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import modelUrl from "../../modelo3D/Tinybit_Pro_conceptual.glb?url";

export type ExploreComp = "microbit" | "motorL" | "motorR" | "irL" | "irR" | "sonar" | "camera" | "leds";
export type ExploreDemo = "sonar" | "camera" | null;

/** El chasis del modelo mide 1,15 de radio; en el robot real, 4,9 cm. */
export const UNIT_CM = 4.9 / 1.15;
/** Sensores de línea a ±0,7 cm del centro y línea de 2,4 cm, como en el simulador. */
const IR_X = 0.7 / UNIT_CM;
const IR_Y = -0.7;
const LINE_W = 2.4 / UNIT_CM;
/** Distancia del ultrasonido a la pared de prueba (unidades del modelo). */
const WALL_GAP = 1.65;
const SONAR_FRONT = -1.387;
const SONAR_X = 0.35;
const SONAR_Z = 0.71;
const LENS = new THREE.Vector3(0, -0.175, 2.75);
const SIGN = new THREE.Vector3(1.6, -2.35, 2.35);
/** Hacia dónde está quien mira en la vista inicial (delante a la derecha del robot). */
const VIEWER_DIR = new THREE.Vector3(-0.82, -0.57, 0);
const CYAN = 0x22d3ee;

/** Componente al que pertenece una pieza del modelo, según su nombre. */
function compOf(name: string): ExploreComp | null {
  const n = Number(name.slice(0, 2));
  const side = /_(-?1)(?:_\d+)?$/.exec(name)?.[1];
  if (n >= 10 && n <= 14) return side === "1" ? "motorL" : side === "-1" ? "motorR" : null;
  if (n >= 30 && n <= 33) return "sonar";
  if (n === 40 || n === 41 || n === 43) return "microbit";
  if (n === 42) return "leds";
  if (n >= 50 && n <= 67) return "camera";
  return null;
}

/** Material de cada pieza: el color del modelo con un acabado según lo que es. */
function materialFor(name: string, color: THREE.Color): THREE.MeshStandardMaterial {
  const n = Number(name.slice(0, 2));
  const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
  if (n === 10 || n === 13) return std({ roughness: 0.92 });
  if ([12, 14, 21, 31, 33, 51, 61, 67].includes(n)) return std({ metalness: 0.85, roughness: 0.3 });
  if (n === 70) return std({ metalness: 0.9, roughness: 0.32 });
  if (n === 20 || n === 11) return std({ roughness: 0.35 });
  if (n === 22) return new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: 0.08, transparent: true, opacity: 0.5, emissive: 0x7dd3fc, emissiveIntensity: 0.25 });
  if (n === 23 || n === 65) return std({ emissive: color, emissiveIntensity: 1.6 });
  // Caja de la cámara de acrílico transparente, como en la imagen de referencia.
  if (n === 60) return new THREE.MeshPhysicalMaterial({ color: 0xdbe9ff, roughness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
  if (n === 62) return new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 });
  if (n === 64) return std({ roughness: 0.05, metalness: 0.6 });
  if (n === 1 || n === 2) return std({ roughness: 0.45, metalness: 0.2 });
  return std();
}

/** Suelo de plano técnico: anillos, marcas y una retícula que se desvanece. */
function blueprintTexture(): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.translate(S / 2, S / 2);
  // Retícula que se apaga hacia los bordes.
  for (let i = -16; i <= 16; i++) {
    const p = i * 32;
    const a = 0.1 * Math.max(0, 1 - Math.abs(p) / 500);
    g.strokeStyle = `rgba(56, 189, 248, ${a})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p, -500);
    g.lineTo(p, 500);
    g.moveTo(-500, p);
    g.lineTo(500, p);
    g.stroke();
  }
  const ring = (r: number, a: number, w = 1.5) => {
    g.strokeStyle = `rgba(56, 189, 248, ${a})`;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(505, 0.16);
  ring(470, 0.4, 2.2);
  ring(400, 0.16);
  ring(300, 0.24);
  ring(210, 0.12);
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2, major = i % 10 === 0;
    g.strokeStyle = `rgba(56, 189, 248, ${major ? 0.6 : 0.28})`;
    g.lineWidth = major ? 2.2 : 1.1;
    g.beginPath();
    g.moveTo(Math.cos(a) * 470, Math.sin(a) * 470);
    g.lineTo(Math.cos(a) * (major ? 444 : 458), Math.sin(a) * (major ? 444 : 458));
    g.stroke();
  }
  g.shadowColor = "#22d3ee";
  g.shadowBlur = 18;
  g.strokeStyle = "rgba(103, 232, 249, 0.9)";
  g.lineWidth = 4;
  for (const [a0, a1] of [[0.2, 0.85], [2.25, 2.95], [3.7, 4.25]]) {
    g.beginPath();
    g.arc(0, 0, 400, a0, a1);
    g.stroke();
  }
  g.fillStyle = "#a5f3fc";
  for (const a of [0.2, 0.85, 2.25, 4.25, 5.3]) {
    g.beginPath();
    g.arc(Math.cos(a) * 400, Math.sin(a) * 400, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  g.strokeStyle = "rgba(56, 189, 248, 0.2)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-512, 0);
  g.lineTo(512, 0);
  g.moveTo(0, -512);
  g.lineTo(0, 512);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Fondo azul marino con un resplandor suave detrás del robot. */
function backdropTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(256, 210, 20, 256, 256, 380);
  grad.addColorStop(0, "#16305a");
  grad.addColorStop(0.5, "#0c1a33");
  grad.addColorStop(1, "#060c1a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Señal azul de «girar a la izquierda» para la prueba de la cámara. */
function signTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1d4ed8";
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(52, 128);
  g.lineTo(118, 70);
  g.lineTo(118, 105);
  g.lineTo(196, 105);
  g.lineTo(196, 151);
  g.lineTo(118, 151);
  g.lineTo(118, 186);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Opacidad que sigue a su objetivo con suavidad (para mostrar y ocultar ayudas). */
const ease = (v: number, target: number, dt: number, tau = 0.18) => v + (target - v) * (1 - Math.exp(-dt / tau));

export class ExploreScene {
  readonly el: HTMLElement;
  /** Se llama al tocar un componente (o el vacío, con null). */
  onPick: (c: ExploreComp | null) => void = () => {};
  readonly ready: Promise<void>;
  readonly sonarCm = Math.round(WALL_GAP * UNIT_CM);

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private controls: OrbitControls;
  /** Raíz del modelo: pasa de Z hacia arriba (modelo) a Y hacia arriba (three.js). */
  private root = new THREE.Group();
  private floorZ = -0.1;
  private target = new THREE.Vector3(0, 1.3, 0.35);
  private userMoved = false;

  private compMeshes = new Map<ExploreComp, THREE.Mesh[]>();
  private baseEmissive = new Map<THREE.MeshStandardMaterial, [THREE.Color, number]>();
  private pickables: THREE.Object3D[] = [];
  private wheels: Partial<Record<"motorL" | "motorR", THREE.Group>> = {};
  private leds: THREE.Mesh[] = [];
  private ledOn = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2a1a, emissiveIntensity: 2.2, roughness: 0.4 });
  private ledOff = new THREE.MeshStandardMaterial({ color: 0x3a1512, roughness: 0.5 });
  private ledPattern = "";

  private selected: ExploreComp | null = null;
  private selColor = new THREE.Color(CYAN);
  private hovered: ExploreComp | null = null;

  private line!: THREE.Mesh;
  private ir: Record<"L" | "R", { spot: THREE.Mesh; ring: THREE.Mesh; beam: THREE.Line }> = {} as never;
  private wall!: THREE.Group;
  private sign!: THREE.Group;
  private sight!: THREE.Line;
  private waves: THREE.Mesh[] = [];
  private demo: ExploreDemo = null;
  private demoT = 0;
  private fade = { sonar: 0, camera: 0 };
  private down: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "explore-3d";
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.el.append(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = backdropTexture();
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(-4, 7, 6);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rim.position.set(5, 3, -5);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x9cc8ff, 0x0a1428, 0.35));

    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.copy(this.target);
    this.controls.addEventListener("start", () => (this.userMoved = true));
    this.resetView();
    this.bindPointer();

    this.ready = new GLTFLoader().loadAsync(modelUrl).then((gltf) => this.build(gltf.scene));
  }

  // ───────── Construcción ─────────

  private build(model: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    const box = new THREE.Box3();
    for (const mesh of meshes) {
      const name = mesh.name || mesh.parent?.name || "";
      const src = mesh.geometry;
      const col = src.getAttribute("color");
      const color = col ? new THREE.Color().setRGB(col.getX(0), col.getY(0), col.getZ(0), THREE.SRGBColorSpace) : new THREE.Color(0x888888);
      // Normales suaves en lo redondo y aristas vivas en lo recto.
      const geo = toCreasedNormals(src, Math.PI / 5);
      geo.deleteAttribute("color");
      const mat = /^42_/.test(name) ? this.ledOff : materialFor(name, color);
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      box.expandByObject(m);
      const comp = compOf(name);
      m.userData.comp = comp;
      this.root.add(m);
      if (comp) {
        this.compMeshes.set(comp, [...(this.compMeshes.get(comp) ?? []), m]);
        this.pickables.push(m);
      }
      if (Number(name.slice(0, 2)) === 60) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 })));
      const led = /^42_LED_microbit_(\d)_(\d)$/.exec(name);
      // Fila 0 hacia el frente; columna 0 a la izquierda del robot (+X).
      if (led) this.leds[Number(led[1]) * 5 + (4 - Number(led[2]))] = m;
    }
    for (const mat of new Set([...this.compMeshes.values()].flat().map((m) => m.material as THREE.MeshStandardMaterial))) {
      this.baseEmissive.set(mat, [mat.emissive.clone(), mat.emissiveIntensity]);
    }
    this.floorZ = box.min.z;

    // Ruedas: cada lado gira alrededor de su eje.
    for (const comp of ["motorL", "motorR"] as const) {
      const side = comp === "motorL" ? 1 : -1;
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.2, 0.2, 0.46);
      this.root.add(pivot);
      for (const m of this.compMeshes.get(comp) ?? []) if (!m.name.startsWith("14_")) pivot.attach(m);
      this.wheels[comp] = pivot;
    }

    this.addLineSensors();
    this.addGround();
    this.addSonarDemo();
    this.addCameraDemo();
    this.applyGlow();
    this.setLeds(this.ledPattern || "0".repeat(25), true);
  }

  /** El modelo no trae los sensores de línea: dos módulos bajo el frente del chasis. */
  private addLineSensors() {
    const body = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.5 });
    for (const [side, comp] of [[1, "irL"], [-1, "irR"]] as const) {
      const g = new THREE.Group();
      const mod = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.09), body.clone());
      mod.position.set(side * IR_X, IR_Y, 0.215);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x2a5bff, emissive: 0x0a2280, emissiveIntensity: 0.6 }));
      eye.rotation.x = Math.PI / 2;
      eye.position.set(side * IR_X, IR_Y, 0.16);
      g.add(mod, eye);
      for (const m of [mod, eye]) {
        m.userData.comp = comp;
        this.compMeshes.set(comp, [...(this.compMeshes.get(comp) ?? []), m]);
        this.pickables.push(m);
        const mat = m.material as THREE.MeshStandardMaterial;
        this.baseEmissive.set(mat, [mat.emissive.clone(), mat.emissiveIntensity]);
      }
      this.root.add(g);
      // Marcas «de rayos X» en el suelo: se ven a través del chasis.
      const z = this.floorZ + 0.006;
      const xray = (geo: THREE.BufferGeometry, opacity: number) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity, depthTest: false, depthWrite: false }));
        m.position.set(side * IR_X, IR_Y, z);
        m.renderOrder = 20;
        m.userData.comp = comp;
        m.userData.xray = true;
        this.root.add(m);
        return m;
      };
      const ring = xray(new THREE.RingGeometry(0.075, 0.1, 40), 0.95);
      const spot = xray(new THREE.CircleGeometry(0.075, 40), 0.1);
      const beam = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side * IR_X, IR_Y, 0.15), new THREE.Vector3(side * IR_X, IR_Y, z)]),
        new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthTest: false }),
      );
      beam.renderOrder = 21;
      this.root.add(beam);
      this.pickables.push(ring, spot);
      this.ir[side > 0 ? "L" : "R"] = { spot, ring, beam };
    }
  }

  /** Suelo de plano técnico, tapete claro con la línea negra y sombra de contacto. */
  private addGround() {
    const z = this.floorZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: blueprintTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    floor.position.set(0, -0.6, z - 0.004);
    floor.renderOrder = -2;
    // Tira de pista: lo justo para que la línea se mueva bajo los sensores.
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2, 5), new THREE.MeshStandardMaterial({ color: 0xc9d4e6, roughness: 0.9, transparent: true, opacity: 0.72 }));
    mat.position.set(0, -1.1, z - 0.002);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mat.geometry), new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.7 }));
    edge.position.copy(mat.position);
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(LINE_W, 5), new THREE.MeshStandardMaterial({ color: 0x08080b, roughness: 0.8 }));
    this.line.position.set(0, -1.1, z);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.position.set(0, -0.2, z + 0.002);
    this.root.add(floor, mat, edge, this.line, shadow);
  }

  /** Pared de prueba delante del ultrasonido y ondas que viajan hasta ella. */
  private addSonarDemo() {
    this.wall = new THREE.Group();
    const y = SONAR_FRONT - WALL_GAP;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), new THREE.MeshStandardMaterial({ color: 0x1e3a66, roughness: 0.6, transparent: true, opacity: 0.85 }));
    panel.position.set(0, y - 0.04, this.floorZ + 0.65);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: CYAN, transparent: true }));
    edges.position.copy(panel.position);
    this.wall.add(panel, edges);
    this.wall.visible = false;
    this.root.add(this.wall);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.245, 48), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      w.rotation.x = Math.PI / 2;
      w.userData.side = i % 2 ? -1 : 1;
      w.userData.phase = Math.floor(i / 2) / 3;
      w.visible = false;
      this.waves.push(w);
      this.root.add(w);
    }
  }

  /** Señal de «girar a la izquierda» y la línea de visión desde la lente. */
  private addCameraDemo() {
    this.sign = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, SIGN.z - this.floorZ, 12), new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.35, transparent: true }));
    pole.rotation.x = Math.PI / 2;
    pole.position.set(SIGN.x, SIGN.y, (SIGN.z + this.floorZ) / 2);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, side: THREE.DoubleSide }));
    face.position.copy(SIGN);
    // La cara queda a medio camino entre la lente y quien mira: la ven los dos.
    const toLens = LENS.clone().sub(SIGN).setZ(0).normalize();
    face.up.set(0, 0, 1);
    face.lookAt(SIGN.clone().add(toLens.add(VIEWER_DIR).normalize()));
    this.sign.add(pole, face);
    this.sign.visible = false;
    this.sight = new THREE.Line(new THREE.BufferGeometry().setFromPoints([LENS, SIGN]), new THREE.LineDashedMaterial({ color: 0x60a5fa, dashSize: 0.12, gapSize: 0.08, transparent: true }));
    this.sight.computeLineDistances();
    this.sight.visible = false;
    this.root.add(this.sign, this.sight);
  }

  // ───────── Estado que pide «Explorar» ─────────

  /** Resalta un componente con el color de su función (o ninguno). */
  setSelected(c: ExploreComp | null, color?: string) {
    this.selected = c;
    if (color) this.selColor.set(color);
    this.applyGlow();
  }

  private applyGlow() {
    for (const [comp, meshes] of this.compMeshes) {
      for (const m of meshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat === this.ledOn || mat === this.ledOff) continue;
        const base = this.baseEmissive.get(mat);
        if (comp === this.selected) {
          mat.emissive.copy(this.selColor);
          mat.emissiveIntensity = 0.4;
        } else if (comp === this.hovered) {
          mat.emissive.set(0xffffff);
          mat.emissiveIntensity = 0.12;
        } else if (base) {
          mat.emissive.copy(base[0]);
          mat.emissiveIntensity = base[1];
        }
      }
    }
    // La matriz apagada toma el color de la selección cuando se elige.
    this.ledOff.emissive.copy(this.selected === "leds" ? this.selColor : new THREE.Color(0));
    this.ledOff.emissiveIntensity = this.selected === "leds" ? 0.5 : 0;
    // Sensor de línea elegido: se dibuja «en rayos X», encima de todo, porque
    // queda escondido bajo la micro:bit y detrás del ultrasonido.
    for (const id of ["L", "R"] as const) {
      const comp = id === "L" ? "irL" : "irR";
      const on = this.selected === comp;
      this.ir[id]?.ring.scale.setScalar(on ? 1.6 : 1);
      for (const m of this.compMeshes.get(comp) ?? []) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.depthTest = !on;
        mat.transparent = on;
        mat.opacity = on ? 0.95 : 1;
        m.renderOrder = on ? 22 : 0;
      }
    }
  }

  /** Enciende la matriz LED con un patrón de 25 caracteres «0»/«1». */
  setLeds(pattern: string, force = false) {
    if (pattern === this.ledPattern && !force) return;
    this.ledPattern = pattern;
    this.leds.forEach((m, i) => m && (m.material = pattern[i] === "1" ? this.ledOn : this.ledOff));
  }

  /** Desplaza la línea negra bajo los sensores (mm hacia la izquierda del robot). */
  setLine(mm: number) {
    if (this.line) this.line.position.x = mm / 10 / UNIT_CM;
  }

  /** Lecturas de los sensores (1 = negro) y si se ve su haz infrarrojo. */
  setIr(l: 0 | 1, r: 0 | 1, beamL: boolean, beamR: boolean) {
    for (const [id, v, beam] of [["L", l, beamL], ["R", r, beamR]] as const) {
      const s = this.ir[id];
      if (!s) continue;
      (s.spot.material as THREE.MeshBasicMaterial).opacity = v ? 0.65 : 0.1;
      (s.beam.material as THREE.LineBasicMaterial).opacity = beam ? 1 : 0;
    }
  }

  private wheelAngle = { motorL: 0, motorR: 0 };
  /** Gira las ruedas a la velocidad indicada (−255 a 255). */
  spinWheels(speed: { motorL: number; motorR: number }, dt: number) {
    for (const w of ["motorL", "motorR"] as const) {
      this.wheelAngle[w] += (speed[w] / 255) * 6 * dt;
      const pivot = this.wheels[w];
      if (pivot) pivot.rotation.x = this.wheelAngle[w];
    }
  }

  /** Prueba en curso: ondas del ultrasonido o la señal para la cámara. */
  setDemo(d: ExploreDemo) {
    if (d !== this.demo) this.demoT = 0;
    this.demo = d;
  }

  resetView() {
    this.userMoved = false;
    this.controls.target.copy(this.target);
    this.fit();
  }

  private fit() {
    const w = this.el.clientWidth || 800, h = this.el.clientHeight || 600;
    this.camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = 2.75 / Math.sin(Math.min(vfov, hfov) / 2);
    // Desde delante a la derecha y un poco arriba, como en la imagen de referencia.
    const az = THREE.MathUtils.degToRad(-36), el = THREE.MathUtils.degToRad(27);
    this.camera.position.set(this.target.x + dist * Math.cos(el) * Math.sin(az), this.target.y + dist * Math.sin(el), this.target.z + dist * Math.cos(el) * Math.cos(az));
    this.camera.updateProjectionMatrix();
    // Sin amortiguación por un instante: borra el giro que quedara de un arrastre.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.fit();
  }

  render(dt: number) {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    const c = this.renderer.domElement;
    if (c.width !== Math.round(w * this.renderer.getPixelRatio()) || c.height !== Math.round(h * this.renderer.getPixelRatio())) this.resize();
    this.animateDemos(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private animateDemos(dt: number) {
    if (!this.wall) return;
    this.demoT += dt;
    this.fade.sonar = ease(this.fade.sonar, this.demo === "sonar" ? 1 : 0, dt);
    this.fade.camera = ease(this.fade.camera, this.demo === "camera" ? 1 : 0, dt);
    const fs = this.fade.sonar, fc = this.fade.camera;
    this.wall.visible = fs > 0.01;
    this.wall.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material & { opacity: number } | undefined;
      if (m) m.opacity = (o instanceof THREE.LineSegments ? 1 : 0.85) * fs;
    });
    const span = WALL_GAP - 0.05;
    for (const wv of this.waves) {
      const p = (this.demoT * 0.9 + wv.userData.phase) % 1;
      wv.visible = fs > 0.01;
      wv.position.set(wv.userData.side * SONAR_X, SONAR_FRONT - p * span, SONAR_Z);
      wv.scale.setScalar(1 + p * 1.4);
      (wv.material as THREE.MeshBasicMaterial).opacity = fs * 0.9 * (1 - p);
    }
    this.sign.visible = this.sight.visible = fc > 0.01;
    this.sign.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material & { opacity: number } | undefined;
      if (m) m.opacity = fc;
    });
    (this.sight.material as THREE.LineDashedMaterial).opacity = fc;
  }

  // ───────── Puntero: girar la vista y tocar componentes ─────────

  private bindPointer() {
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", (e) => {
      if (e.button === 0) this.down = { x: e.clientX, y: e.clientY };
    });
    c.addEventListener("pointerup", (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      this.onPick(this.pick(e.clientX, e.clientY));
    });
    c.addEventListener("pointermove", (e) => {
      if (e.buttons) return;
      const comp = this.pick(e.clientX, e.clientY);
      c.style.cursor = comp ? "pointer" : "grab";
      if (comp !== this.hovered) {
        this.hovered = comp;
        this.applyGlow();
      }
    });
    c.addEventListener("pointerleave", () => {
      if (this.hovered) {
        this.hovered = null;
        this.applyGlow();
      }
    });
  }

  /** Componente bajo el puntero. Las marcas de los sensores de línea se ven siempre, así que ganan. */
  pick(clientX: number, clientY: number): ExploreComp | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    const xray = hits.find((hh) => hh.object.userData.xray);
    if (xray) return xray.object.userData.comp;
    const blockers = this.raycaster.intersectObjects(this.root.children, false).filter((hh) => !hh.object.userData.xray && (hh.object as THREE.Mesh).isMesh && hh.object.visible);
    const first = [...hits, ...blockers].sort((a, b) => a.distance - b.distance)[0];
    return (first?.object.userData.comp as ExploreComp | undefined) ?? null;
  }
}
