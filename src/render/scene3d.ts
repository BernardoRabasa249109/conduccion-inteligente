/**
 * Escena 3D compartida: tapete, objetos, robot y ayudas visuales.
 * Tres cámaras miran el mismo estado: isométrica, superior y la de a bordo.
 * Mundo (x, y) en cm → Three (x, 0, y), con la altura en el eje y de Three.
 */
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { ROBOT, VISION } from "../core/config";
import { matHeight, matWidth, type LightObject, type Scenario, type VisionLabel } from "../core/scenario";
import { Steady } from "../core/steady";
import { cameraPose, type SensorSnapshot } from "../core/sensors";
import type { Sim } from "../core/sim";
import { drawFloor } from "./floor";
import { buildObstacle, buildSign, LightModel } from "./props";
import { RobotModel, type PartName } from "./robotModel";

export type ViewMode = "iso" | "top";

export interface Overlays {
  sensors: boolean;
  sonar: boolean;
  camera: boolean;
  trail: boolean;
}

const SENSOR_CYAN = 0x22d3ee;
/** Cono del ultrasonido: azul oscuro para que se distinga bien sobre el tapete claro. */
const SONAR_FILL = 0x0284c7;
const SONAR_EDGE = 0x075985;
/** Grosor del rastro en píxeles del lienzo (4 px: se ve bien al proyectar). */
export const TRAIL_WIDTH_PX = 4;

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly robot = new RobotModel();
  view: ViewMode = "iso";
  follow = false;
  overlays: Overlays = { sensors: true, sonar: true, camera: false, trail: true };
  azimuth = (62 * Math.PI) / 180;
  elevation = (38 * Math.PI) / 180;
  private iso = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 3000);
  private top = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 3000);
  private target = new THREE.Vector3(90, 0, 60);
  private viewSize = 160;
  private floorMesh!: THREE.Mesh;
  private floorCanvas = document.createElement("canvas");
  private floorTex!: THREE.CanvasTexture;
  private floorTexSize: [number, number] = [0, 0];
  private propGroup = new THREE.Group();
  private lights = new Map<string, LightModel>();
  private obstacleMeshes = new Map<string, THREE.Object3D>();
  private overlayGroup = new THREE.Group();
  private sensorDots: THREE.Mesh[] = [];
  private sensorBeams: THREE.Mesh[] = [];
  private dotBlack = new THREE.MeshBasicMaterial({ color: 0x050507 });
  private dotWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private sonarCone: THREE.Mesh;
  private sonarHit: THREE.Mesh;
  private sonarEdgeMat: LineMaterial;
  private camLines: THREE.LineSegments;
  private trail: Line2;
  private trailMat: LineMaterial;
  private trailKey = "";
  private selection: THREE.Mesh;
  private hoverTile: THREE.Mesh;
  /** Asa para colocar y girar el robot. */
  private gizmo = new THREE.Group();
  private gizmoHandle!: THREE.Mesh;
  /** Marco de la pieza de pista seleccionada en el editor. */
  private tileFrame!: THREE.Mesh;
  /** Asa del editor para mover y girar señales, obstáculos, franjas, zonas y la salida. */
  private objGizmo = new THREE.Group();
  private objRing!: THREE.Mesh;
  private objStem!: THREE.Mesh;
  private objHandle!: THREE.Mesh;
  private objRingR = 0;
  private ray = new THREE.Raycaster();
  private scenarioRef: Scenario | null = null;
  private resizeObs: ResizeObserver;
  // Cámara de a bordo
  readonly camRenderer: THREE.WebGLRenderer;
  private onboard = new THREE.PerspectiveCamera((ROBOT.cameraVFov * 180) / Math.PI, 4 / 3, 0.5, 600);
  private camOverlay: HTMLCanvasElement;
  private frame = 0;
  showGrid = false;
  /** Etiqueta de visión que muestra la interfaz (estabilizada). */
  shownLabel: VisionLabel | null = null;
  private overlayHold = new Map<string, { status: Steady<string>; conf: Steady<number> }>();

  constructor(private container: HTMLElement, camContainer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "stage-canvas";

    this.camRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.camRenderer.setPixelRatio(1);
    this.camRenderer.setSize(320, 240, false);
    this.camRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camRenderer.domElement.className = "cam-canvas";
    camContainer.appendChild(this.camRenderer.domElement);
    this.camOverlay = document.createElement("canvas");
    this.camOverlay.width = 320;
    this.camOverlay.height = 240;
    this.camOverlay.className = "cam-overlay";
    camContainer.appendChild(this.camOverlay);

    this.scene.background = new THREE.Color(0x0d1220);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2440, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-80, 160, -40);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    // Mesa del laboratorio con una cuadrícula tenue.
    const gc = document.createElement("canvas");
    gc.width = gc.height = 128;
    const gx = gc.getContext("2d")!;
    gx.fillStyle = "#121a2b";
    gx.fillRect(0, 0, 128, 128);
    gx.strokeStyle = "#1c2840";
    gx.lineWidth = 2;
    gx.strokeRect(0, 0, 128, 128);
    const gtex = new THREE.CanvasTexture(gc);
    gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
    gtex.repeat.set(60, 60);
    gtex.colorSpace = THREE.SRGBColorSpace;
    const table = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.4;
    this.scene.add(table);

    this.scene.add(this.propGroup, this.robot.group, this.overlayGroup);

    // Ayudas visuales: puntos de los sensores de línea.
    for (let i = 0; i < 2; i++) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), this.dotWhite);
      dot.rotation.x = -Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 24), new THREE.MeshBasicMaterial({ color: SENSOR_CYAN }));
      ring.position.z = 0.001;
      dot.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), new THREE.MeshBasicMaterial({ color: SENSOR_CYAN, transparent: true, opacity: 0.8 }));
      this.sensorDots.push(dot);
      this.sensorBeams.push(beam);
      this.overlayGroup.add(dot, beam);
    }
    // Cono del ultrasonido.
    this.sonarCone = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24, -ROBOT.sonarHalfAngle, ROBOT.sonarHalfAngle * 2),
      new THREE.MeshBasicMaterial({ color: SONAR_FILL, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.sonarCone.rotation.x = -Math.PI / 2;
    // Borde del cono: dos lados y el arco, con grosor fijo en pantalla.
    const edge: number[] = [0, 0, 0];
    for (let i = 0; i <= 24; i++) {
      const a = -ROBOT.sonarHalfAngle + (i / 24) * ROBOT.sonarHalfAngle * 2;
      edge.push(Math.cos(a), Math.sin(a), 0);
    }
    edge.push(0, 0, 0);
    const edgeGeo = new LineGeometry();
    edgeGeo.setPositions(edge);
    this.sonarEdgeMat = new LineMaterial({ color: SONAR_EDGE, linewidth: 2, worldUnits: false, transparent: true, opacity: 0.85, depthWrite: false });
    this.sonarCone.add(new Line2(edgeGeo, this.sonarEdgeMat));
    this.sonarHit = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 20), new THREE.MeshBasicMaterial({ color: SENSOR_CYAN, side: THREE.DoubleSide }));
    this.sonarHit.rotation.x = -Math.PI / 2;
    this.overlayGroup.add(this.sonarCone, this.sonarHit);
    // Campo de visión de la cámara.
    this.camLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.9 }));
    this.camLines.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    this.overlayGroup.add(this.camLines);
    // Rastro: línea con grosor real en píxeles (una línea WebGL básica siempre mide 1 px).
    this.trailMat = new LineMaterial({ color: 0xd946ef, linewidth: TRAIL_WIDTH_PX, worldUnits: false, transparent: true, opacity: 0.8 });
    this.trail = new Line2(new LineGeometry(), this.trailMat);
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.overlayGroup.add(this.trail);
    // Editor: selección y pieza bajo el puntero.
    this.selection = new THREE.Mesh(new THREE.RingGeometry(5, 5.8, 40), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }));
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.visible = false;
    this.hoverTile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.22, depthWrite: false }));
    this.hoverTile.rotation.x = -Math.PI / 2;
    this.hoverTile.visible = false;
    this.scene.add(this.selection, this.hoverTile);
    // Asa de colocación: anillo alrededor del robot y un tirador para girarlo.
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.4, 10.4, 56), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
    const stem = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.7), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, depthWrite: false }));
    stem.rotation.x = -Math.PI / 2;
    stem.position.set(12.1, 0.2, 0);
    this.gizmoHandle = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.2, 28), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    this.gizmoHandle.position.set(15.5, 0.6, 0);
    this.gizmoHandle.name = "asa-giro";
    this.gizmo.add(ring, stem, this.gizmoHandle);
    this.gizmo.visible = false;
    // Marco cuadrado (un anillo de 4 lados girado 45°).
    this.tileFrame = new THREE.Mesh(new THREE.RingGeometry(1, 1.08, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, depthWrite: false }));
    this.tileFrame.rotation.x = -Math.PI / 2;
    this.tileFrame.visible = false;
    // La misma asa (anillo y tirador ámbar) para los objetos del editor; su tamaño se ajusta a cada objeto.
    this.objRing = new THREE.Mesh(new THREE.RingGeometry(5, 6, 64), ring.material);
    this.objRing.rotation.x = -Math.PI / 2;
    this.objRing.position.y = 0.2;
    this.objStem = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), stem.material);
    this.objStem.rotation.x = -Math.PI / 2;
    this.objHandle = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.2, 28), this.gizmoHandle.material);
    this.objHandle.name = "asa-giro-objeto";
    this.objGizmo.add(this.objRing, this.objStem, this.objHandle);
    // Se dibuja después del suelo: el anillo y la barra no escriben profundidad.
    for (const m of [this.objRing, this.objStem, this.objHandle]) m.renderOrder = 2;
    this.objGizmo.visible = false;
    this.overlayGroup.add(this.gizmo, this.tileFrame, this.objGizmo);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  setScenario(s: Scenario) {
    this.scenarioRef = s;
    drawFloor(this.floorCanvas, s, { grid: this.showGrid });
    if (!this.floorMesh) {
      this.floorTex = new THREE.CanvasTexture(this.floorCanvas);
      this.floorTex.colorSpace = THREE.SRGBColorSpace;
      this.floorTex.anisotropy = 8;
      this.floorTexSize = [this.floorCanvas.width, this.floorCanvas.height];
      this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.95 }));
      this.floorMesh.rotation.x = -Math.PI / 2;
      this.scene.add(this.floorMesh);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x5b4ca6 }));
      edge.name = "mat-edge";
      this.scene.add(edge);
    } else {
      this.uploadFloor();
    }
    const W = matWidth(s), H = matHeight(s);
    this.floorMesh.scale.set(W, H, 1);
    this.floorMesh.position.set(W / 2, 0, H / 2);
    const edge = this.scene.getObjectByName("mat-edge")!;
    edge.scale.set(W + 1, 0.4, H + 1);
    edge.position.set(W / 2, -0.21, H / 2);
    this.rebuildProps(s);
  }

  rebuildProps(s: Scenario) {
    // Libera de la tarjeta gráfica las formas, materiales y texturas de antes
    // (cada cambio en el editor reconstruye los objetos: sin esto, la memoria crece).
    this.propGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.geometry) return;
      // Las formas del modelo del semáforo las comparten todos los semáforos.
      if (!m.geometry.userData.shared) m.geometry.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
        const map = (mat as THREE.MeshStandardMaterial).map;
        if (map && !map.userData.shared) map.dispose();
        if (!mat.userData.shared) mat.dispose();
      }
    });
    this.propGroup.clear();
    this.lights.clear();
    this.obstacleMeshes.clear();
    for (const o of s.objects) {
      if (o.kind === "sign") this.propGroup.add(buildSign(o));
      if (o.kind === "light") {
        const lm = new LightModel(o);
        this.lights.set(o.id, lm);
        this.propGroup.add(lm.group);
      }
      if (o.kind === "obstacle") {
        const m = buildObstacle(o);
        this.obstacleMeshes.set(o.id, m);
        this.propGroup.add(m);
      }
    }
  }

  /** Redibuja solo la textura del suelo (tras editar la pista o las zonas). */
  refreshFloor() {
    if (!this.scenarioRef) return;
    drawFloor(this.floorCanvas, this.scenarioRef, { grid: this.showGrid });
    this.uploadFloor();
  }

  /**
   * Envía el dibujo del suelo a la tarjeta gráfica. Si el tapete cambió de
   * tamaño, hay que crear una textura nueva: WebGL no puede reutilizar la
   * memoria reservada para el tamaño anterior (el suelo se quedaba sin actualizar).
   */
  private uploadFloor() {
    const { width, height } = this.floorCanvas;
    const img = this.floorTex.image as { width: number; height: number } | undefined;
    if (!img || this.floorTexSize[0] !== width || this.floorTexSize[1] !== height) {
      this.floorTex.dispose();
      this.floorTex = new THREE.CanvasTexture(this.floorCanvas);
      this.floorTex.colorSpace = THREE.SRGBColorSpace;
      this.floorTex.anisotropy = 8;
      const mat = this.floorMesh.material as THREE.MeshStandardMaterial;
      mat.map = this.floorTex;
      mat.needsUpdate = true;
    } else {
      this.floorTex.needsUpdate = true;
    }
    this.floorTexSize = [width, height];
  }

  // ───────── Cámara ─────────

  center() {
    if (!this.scenarioRef) return;
    const W = matWidth(this.scenarioRef), H = matHeight(this.scenarioRef);
    this.target.set(W / 2, 0, H / 2);
    const aspect = this.aspect();
    if (this.view === "top") {
      this.viewSize = Math.max(H, W / aspect) * 1.08;
      return;
    }
    // Proyecta las esquinas del tapete (y la altura de las señales) sobre los ejes de la cámara.
    const d = new THREE.Vector3(Math.cos(this.elevation) * Math.cos(this.azimuth), Math.sin(this.elevation), Math.cos(this.elevation) * Math.sin(this.azimuth));
    const fwd = d.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
    for (const [x, z] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      for (const y of [0, 16]) {
        const p = new THREE.Vector3(x - W / 2, y, z - H / 2);
        minR = Math.min(minR, p.dot(right));
        maxR = Math.max(maxR, p.dot(right));
        minU = Math.min(minU, p.dot(up));
        maxU = Math.max(maxU, p.dot(up));
      }
    }
    this.viewSize = Math.max(maxU - minU, (maxR - minR) / aspect) * 1.06;
  }

  focusRobot(sim: Sim, size = 70) {
    this.target.set(sim.robot.x, 0, sim.robot.y);
    this.viewSize = size;
  }

  zoom(factor: number) {
    this.viewSize = Math.max(18, Math.min(900, this.viewSize * factor));
  }

  zoomAt(factor: number, clientX: number, clientY: number) {
    const before = this.groundAt(clientX, clientY);
    this.zoom(factor);
    this.updateCameras();
    const after = this.groundAt(clientX, clientY);
    if (before && after && !this.follow) this.target.add(new THREE.Vector3(before[0] - after[0], 0, before[1] - after[1]));
  }

  pan(dx: number, dy: number) {
    this.target.x += dx;
    this.target.z += dy;
  }

  rotateView() {
    this.azimuth += Math.PI / 2;
  }

  private aspect() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    return w / h;
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    // El grosor del rastro se mide en píxeles reales del lienzo.
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.trailMat.resolution.set(size.x, size.y);
    this.sonarEdgeMat.resolution.set(size.x, size.y);
    this.updateCameras();
  }

  get activeCamera(): THREE.OrthographicCamera {
    return this.view === "iso" ? this.iso : this.top;
  }

  private updateCameras() {
    const aspect = this.aspect();
    for (const cam of [this.iso, this.top]) {
      cam.top = this.viewSize / 2;
      cam.bottom = -this.viewSize / 2;
      cam.left = (-this.viewSize / 2) * aspect;
      cam.right = (this.viewSize / 2) * aspect;
      cam.updateProjectionMatrix();
    }
    const d = 800;
    const t = this.target;
    this.iso.position.set(t.x + Math.cos(this.elevation) * Math.cos(this.azimuth) * d, Math.sin(this.elevation) * d, t.z + Math.cos(this.elevation) * Math.sin(this.azimuth) * d);
    this.iso.up.set(0, 1, 0);
    this.iso.lookAt(t);
    this.top.position.set(t.x, d, t.z);
    this.top.up.set(0, 0, -1);
    this.top.lookAt(t.x, 0, t.z);
  }

  /** Punto del suelo (cm) bajo un punto de la pantalla. */
  groundAt(clientX: number, clientY: number): [number, number] | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.activeCamera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return [hit.x, hit.z];
  }

  /** Posición en pantalla (px dentro del lienzo) de un punto del mundo. */
  screenOf(x: number, y: number, z = 0): [number, number] {
    const v = new THREE.Vector3(x, z, y).project(this.activeCamera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return [((v.x + 1) / 2) * rect.width, ((1 - v.y) / 2) * rect.height];
  }

  // ───────── Editor ─────────

  setSelection(x: number | null, y = 0, r = 5) {
    this.selection.visible = x !== null;
    if (x !== null) {
      this.selection.position.set(x, 0.15, y);
      this.selection.scale.setScalar(r / 5);
    }
  }

  setHoverTile(c: number | null, r = 0) {
    const s = this.scenarioRef;
    this.hoverTile.visible = c !== null && !!s;
    if (c !== null && s) {
      this.hoverTile.scale.set(s.tile, s.tile, 1);
      this.hoverTile.position.set((c + 0.5) * s.tile, 0.12, (r + 0.5) * s.tile);
    }
  }

  /** Muestra u oculta el asa para colocar y girar el robot. */
  setPlaceGizmo(on: boolean) {
    this.gizmo.visible = on;
  }

  /** Marca una pieza de pista como seleccionada (o ninguna). */
  setSelectedTile(c: number | null, r = 0) {
    const s = this.scenarioRef;
    this.tileFrame.visible = c !== null && !!s;
    if (c !== null && s) {
      const k = s.tile / Math.SQRT2;
      this.tileFrame.scale.set(k, k, 1);
      this.tileFrame.position.set((c + 0.5) * s.tile, 0.16, (r + 0.5) * s.tile);
    }
  }

  /** Asa de un objeto del editor: centro, ángulo y radio del anillo (null la oculta). */
  setObjectGizmo(x: number | null, y = 0, angle = 0, r = 6) {
    this.objGizmo.visible = x !== null;
    if (x === null) return;
    if (Math.abs(r - this.objRingR) > 0.01) {
      this.objRingR = r;
      this.objRing.geometry.dispose();
      this.objRing.geometry = new THREE.RingGeometry(r - 0.5, r + 0.5, 64);
      this.objStem.scale.set(3.7, 1, 1);
      this.objStem.position.set(r + 2.35, 0.22, 0);
      this.objHandle.position.set(r + 5.6, 0.6, 0);
    }
    this.objGizmo.position.set(x, 0, y);
    this.objGizmo.rotation.y = -angle;
  }

  /** Mueve y gira un objeto ya dibujado (sin reconstruir la escena). */
  poseProp(id: string, x: number, y: number, angle: number) {
    const g = this.propGroup.children.find((o) => o.userData.id === id);
    if (g) {
      g.position.set(x, 0, y);
      g.rotation.y = -angle;
    }
  }

  /** Mueve un objeto ya dibujado (para arrastrar sin reconstruir toda la escena). */
  moveProp(id: string, x: number, y: number) {
    const g = this.propGroup.children.find((o) => o.userData.id === id);
    if (g) g.position.set(x, 0, y);
  }

  /**
   * Qué hay bajo el puntero: se lanza un rayo contra lo que se ve (robot,
   * señales, semáforos, obstáculos y el asa de giro), no solo contra el suelo.
   */
  pick(clientX: number, clientY: number): { floor: [number, number] | null; objectId: string | null; robot: boolean; handle: boolean; objHandle: boolean } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.updateCameras();
    this.ray.setFromCamera(ndc, this.activeCamera);
    const out = { floor: this.groundAt(clientX, clientY), objectId: null as string | null, robot: false, handle: false, objHandle: false };
    if (this.gizmo.visible && this.ray.intersectObject(this.gizmoHandle, false).length) {
      out.handle = true;
      return out;
    }
    if (this.objGizmo.visible && this.ray.intersectObject(this.objHandle, false).length) {
      out.objHandle = true;
      return out;
    }
    const robotHit = this.ray.intersectObject(this.robot.group, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
    const propHit = this.ray.intersectObjects(this.propGroup.children, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible && (h.object as THREE.Mesh).geometry.type !== "PlaneGeometry");
    if (robotHit && (!propHit || robotHit.distance <= propHit.distance)) out.robot = true;
    else if (propHit) {
      let o: THREE.Object3D | null = propHit.object;
      while (o && !o.userData.id) o = o.parent;
      out.objectId = o ? String(o.userData.id) : null;
    }
    return out;
  }

  highlight(part: PartName | null) {
    this.robot.highlight(part);
  }

  // ───────── Actualización y dibujo ─────────

  sync(sim: Sim) {
    if (this.gizmo.visible) {
      this.gizmo.position.set(sim.robot.x, 0, sim.robot.y);
      this.gizmo.rotation.y = -sim.robot.heading;
    }
    const r = sim.robot;
    this.robot.update(r);
    for (const [id, lm] of this.lights) {
      const obj = sim.scenario.objects.find((o) => o.id === id) as LightObject | undefined;
      if (obj) lm.set(sim.world.lightState(obj, sim.time));
    }
    for (const [id, m] of this.obstacleMeshes) m.visible = !sim.world.removed.has(id);
    this.syncOverlays(sim.now, sim);
    if (this.follow) {
      this.target.lerp(new THREE.Vector3(r.x, 0, r.y), 0.12);
    }
  }

  private syncOverlays(s: SensorSnapshot, sim: Sim) {
    const show = this.overlays;
    const pts = [s.leftPoint, s.rightPoint];
    const vals = [s.lineLeft, s.lineRight];
    pts.forEach((p, i) => {
      const dot = this.sensorDots[i];
      dot.visible = show.sensors;
      dot.position.set(p[0], 0.09, p[1]);
      dot.material = vals[i] ? this.dotBlack : this.dotWhite;
      const beam = this.sensorBeams[i];
      beam.visible = show.sensors;
      beam.position.set(p[0], 1.0, p[1]);
    });
    this.sonarCone.visible = show.sonar;
    this.sonarHit.visible = show.sonar && s.distance > 0 && !!s.sonarHit;
    if (show.sonar) {
      const len = s.distance > 0 ? s.distance : 60;
      this.sonarCone.position.set(s.sonarOrigin[0], 0.3, s.sonarOrigin[1]);
      this.sonarCone.scale.set(len, len, 1);
      this.sonarCone.rotation.z = -sim.robot.heading;
      // Con eco, el cono se ve más intenso que cuando no hay nada delante.
      (this.sonarCone.material as THREE.MeshBasicMaterial).opacity = s.distance > 0 ? 0.5 : 0.32;
      this.sonarEdgeMat.opacity = s.distance > 0 ? 0.95 : 0.7;
      if (s.sonarHit) this.sonarHit.position.set(s.sonarHit[0], 0.35, s.sonarHit[1]);
    }
    this.camLines.visible = show.camera;
    if (show.camera) {
      const cam = cameraPose(sim.robot);
      const origin = new THREE.Vector3(cam.x, cam.z, cam.y);
      const fwd = new THREE.Vector3(Math.cos(cam.yaw) * Math.cos(cam.pitch), -Math.sin(cam.pitch), Math.sin(cam.yaw) * Math.cos(cam.pitch));
      const up = new THREE.Vector3(Math.cos(cam.yaw) * Math.sin(cam.pitch), Math.cos(cam.pitch), Math.sin(cam.yaw) * Math.sin(cam.pitch));
      const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
      const L = VISION.maxDistance;
      const hw = Math.tan(ROBOT.cameraHFov / 2) * L, hh = Math.tan(ROBOT.cameraVFov / 2) * L;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => origin.clone().add(fwd.clone().multiplyScalar(L)).add(right.clone().multiplyScalar(a * hw)).add(up.clone().multiplyScalar(b * hh)));
      const arr = this.camLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      const seg: THREE.Vector3[] = [];
      for (let i = 0; i < 4; i++) seg.push(origin, corners[i], corners[i], corners[(i + 1) % 4]);
      seg.forEach((v, i) => arr.setXYZ(i, v.x, Math.max(0.1, v.y), v.z));
      arr.needsUpdate = true;
    }
    const n = Math.min(sim.trail.length, 3000);
    this.trail.visible = show.trail && n >= 2;
    if (this.trail.visible) {
      // Solo se reconstruye cuando el robot añadió un punto nuevo al rastro.
      const last = sim.trail[sim.trail.length - 1];
      const key = `${n}:${last[0]}:${last[1]}`;
      if (key !== this.trailKey) {
        this.trailKey = key;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const [x, y] = sim.trail[sim.trail.length - n + i];
          pos[i * 3] = x;
          pos[i * 3 + 1] = 0.08;
          pos[i * 3 + 2] = y;
        }
        const geo = new LineGeometry();
        geo.setPositions(pos);
        this.trail.geometry.dispose();
        this.trail.geometry = geo;
      }
    }
  }

  /** Color del rastro (lo elige el usuario en el menú «Rastro»). */
  setTrailColor(hex: number) {
    this.trailMat.color.setHex(hex);
  }

  render(sim: Sim, drawCamera = true) {
    this.updateCameras();
    this.renderer.render(this.scene, this.activeCamera);
    this.frame += 1;
    if (drawCamera && this.frame % 2 === 0) this.renderOnboard(sim);
  }

  /** Vista desde la cámara del robot (sin las ayudas visuales ni el propio robot). */
  renderOnboard(sim: Sim) {
    const cam = cameraPose(sim.robot);
    this.onboard.position.set(cam.x, cam.z, cam.y);
    this.onboard.lookAt(cam.x + Math.cos(cam.yaw) * Math.cos(cam.pitch) * 10, cam.z - Math.sin(cam.pitch) * 10, cam.y + Math.sin(cam.yaw) * Math.cos(cam.pitch) * 10);
    const ov = this.overlayGroup.visible, rv = this.robot.group.visible, sel = this.selection.visible, hov = this.hoverTile.visible;
    this.overlayGroup.visible = false;
    this.robot.group.visible = false;
    this.selection.visible = false;
    this.hoverTile.visible = false;
    this.camRenderer.render(this.scene, this.onboard);
    this.overlayGroup.visible = ov;
    this.robot.group.visible = rv;
    this.selection.visible = sel;
    this.hoverTile.visible = hov;
    this.drawCamOverlay(sim);
  }

  private drawCamOverlay(sim: Sim) {
    const ctx = this.camOverlay.getContext("2d")!;
    ctx.clearRect(0, 0, 320, 240);
    const v = sim.now.vision;
    const now = performance.now();
    for (const c of v.candidates) {
      // Cada recuadro conserva su estado y su texto un momento: sin parpadeos.
      let held = this.overlayHold.get(c.id);
      if (!held) {
        held = { status: new Steady<string>(c.status, 120, 500), conf: new Steady<number>(0, 0, 700) };
        this.overlayHold.set(c.id, held);
      }
      const status = held.status.push(c.status, now);
      const confPct = held.conf.push(Math.round((c.confidence * 100) / 5) * 5, now);
      if (!c.px || status === "fuera del campo de visión") continue;
      const s = Math.max(10, c.px.size);
      const x = c.px.x - s / 2, y = c.px.y - s / 2;
      const ok = status === "reconocida";
      const best = ok && (this.shownLabel ?? v.label) === c.label;
      ctx.lineWidth = best ? 3 : 2;
      ctx.strokeStyle = ok ? (best ? "#22d3ee" : "#67e8f9") : "rgba(255,255,255,0.55)";
      ctx.setLineDash(ok ? [] : [5, 4]);
      ctx.strokeRect(x, y, s, s);
      ctx.setLineDash([]);
      ctx.font = "bold 12px system-ui, sans-serif";
      const text = ok ? `${sim.visionText(c.label)} · ${confPct}%*` : status;
      const tw = ctx.measureText(text).width + 8;
      const ty = y > 18 ? y - 17 : y + s + 2;
      ctx.fillStyle = ok ? "rgba(8,60,72,0.85)" : "rgba(30,30,40,0.75)";
      ctx.fillRect(Math.min(Math.max(0, x), 320 - tw), ty, tw, 16);
      ctx.fillStyle = ok ? "#a5f3fc" : "#e5e7eb";
      ctx.fillText(text, Math.min(Math.max(0, x), 320 - tw) + 4, ty + 12);
    }
  }

  dispose() {
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.camRenderer.dispose();
  }
}
