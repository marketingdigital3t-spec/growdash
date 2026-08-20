import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Box, Eye, Hammer, MousePointer2, Redo2, Rotate3D, ShoppingBag, Undo2, UsersRound, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LifeMode = "live" | "build" | "buy";
type NpcStatus = "working" | "walking" | "free";
type GridPoint = { x: number; z: number };
type WallBlueprint = { id: string; start: GridPoint; end: GridPoint };
type FurnitureKind = "desk" | "chair" | "monitor" | "meeting-table" | "sofa" | "plant";
type FurnitureBlueprint = { id: string; kind: FurnitureKind; x: number; z: number; rotation?: number };

const FURNITURE_COPY: Record<FurnitureKind, string> = { desk: "Mesa", chair: "Cadeira", monitor: "Monitor", "meeting-table": "Reunião", sofa: "Sofá", plant: "Planta" };
const NPC_COPY = { traffic: "Tráfego", finance: "Finanças", commercial: "Comercial", seo: "SEO", funnels: "Funis" } as const;
const NPC_DETAILS = {
  traffic: { name: "Ágata", specialty: "Escala e mídia", color: "#d79a32" },
  finance: { name: "Bianca", specialty: "Caixa e margem", color: "#8aaf72" },
  commercial: { name: "Camila", specialty: "Pipeline e vendas", color: "#b57961" },
  seo: { name: "Júlia", specialty: "Busca e conteúdo", color: "#c79e58" },
  funnels: { name: "Natália", specialty: "Jornadas e conversão", color: "#947a51" },
} as const;
const DEFAULT_FURNITURE: FurnitureBlueprint[] = [
  { id: "traffic-desk", kind: "desk", x: -6, z: -4, rotation: Math.PI }, { id: "traffic-chair", kind: "chair", x: -6, z: -2.75, rotation: Math.PI }, { id: "traffic-monitor", kind: "monitor", x: -6, z: -4.35, rotation: Math.PI },
  { id: "finance-desk", kind: "desk", x: 0, z: -4, rotation: Math.PI }, { id: "finance-chair", kind: "chair", x: 0, z: -2.75, rotation: Math.PI }, { id: "finance-monitor", kind: "monitor", x: 0, z: -4.35, rotation: Math.PI },
  { id: "commercial-desk", kind: "desk", x: 6, z: -4, rotation: Math.PI }, { id: "commercial-chair", kind: "chair", x: 6, z: -2.75, rotation: Math.PI }, { id: "commercial-monitor", kind: "monitor", x: 6, z: -4.35, rotation: Math.PI },
  { id: "meeting", kind: "meeting-table", x: -7, z: 5 }, { id: "strategy-sofa", kind: "sofa", x: 6.5, z: 5, rotation: Math.PI / 2 }, { id: "strategy-plant", kind: "plant", x: 9, z: 6.8 },
];

const DEFAULT_OFFICE_PLAN: WallBlueprint[] = [
  { id: "north", start: { x: -10, z: -8 }, end: { x: 10, z: -8 } },
  { id: "west", start: { x: -10, z: -8 }, end: { x: -10, z: 8 } },
  { id: "east", start: { x: 10, z: -8 }, end: { x: 10, z: 8 } },
  { id: "traffic-divider", start: { x: -3, z: -8 }, end: { x: -3, z: -1 } },
  { id: "finance-divider", start: { x: 3, z: -8 }, end: { x: 3, z: -1 } },
  { id: "meeting-divider", start: { x: -10, z: 2 }, end: { x: -4, z: 2 } },
  { id: "strategy-divider", start: { x: 4, z: 2 }, end: { x: 10, z: 2 } },
];

const MODE_COPY: Record<LifeMode, { label: string; hint: string; icon: typeof Eye }> = {
  live: { label: "Viver", hint: "Navegue pelo escritório e acompanhe cinco núcleos de operação em atividade.", icon: Eye },
  build: { label: "Construir", hint: "Arraste na grade para erguer paredes. Tudo encaixa em 1 metro.", icon: Hammer },
  buy: { label: "Mobiliar", hint: "O catálogo de móveis operacionais está sendo preparado para esta planta.", icon: ShoppingBag },
};

const gridPoint = (point: THREE.Vector3): GridPoint => ({ x: THREE.MathUtils.clamp(Math.round(point.x), -10, 10), z: THREE.MathUtils.clamp(Math.round(point.z), -10, 10) });
const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.z === b.z;
const wallKey = (wall: WallBlueprint) => `${wall.start.x}:${wall.start.z}:${wall.end.x}:${wall.end.z}`;
function readLocal<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function writeLocal(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled by the browser. */ } }

/** A procedural, editable world. No bitmap or flat CSS scene is used here. */
export default function LifeSimPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<LifeMode>("live");
  const furnitureKindRef = useRef<FurnitureKind>("desk");
  const initialWalls = readLocal<WallBlueprint[]>("growdash:life:walls", DEFAULT_OFFICE_PLAN);
  const initialFurniture = readLocal<FurnitureBlueprint[]>("growdash:life:furniture", DEFAULT_FURNITURE);
  const initialNpcStatuses = readLocal<Record<string, NpcStatus>>("growdash:life:npc-statuses", { traffic: "working", finance: "working", commercial: "working", seo: "working", funnels: "working" });
  const historyRef = useRef<WallBlueprint[][]>([initialWalls]);
  const historyIndexRef = useRef(0);
  const [mode, setMode] = useState<LifeMode>("live");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [walls, setWalls] = useState<WallBlueprint[]>(initialWalls);
  const [history, setHistory] = useState<WallBlueprint[][]>([initialWalls]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [furniture, setFurniture] = useState<FurnitureBlueprint[]>(initialFurniture);
  const [furnitureKind, setFurnitureKind] = useState<FurnitureKind>("desk");
  const [npcStatuses, setNpcStatuses] = useState<Record<string, NpcStatus>>(initialNpcStatuses);
  const [selectedNpc, setSelectedNpc] = useState<keyof typeof NPC_COPY | null>(null);
  const selectMode = (next: LifeMode) => { modeRef.current = next; setMode(next); };
  const commitWalls = (next: WallBlueprint[]) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1); const updated = [...trimmed, next];
    historyRef.current = updated; historyIndexRef.current = updated.length - 1;
    setWalls(next); setHistory(updated); setHistoryIndex(updated.length - 1);
  };
  const undo = () => { if (historyIndexRef.current <= 0) return; const nextIndex = historyIndexRef.current - 1; historyIndexRef.current = nextIndex; setHistoryIndex(nextIndex); setWalls(historyRef.current[nextIndex]); };
  const redo = () => { if (historyIndexRef.current >= historyRef.current.length - 1) return; const nextIndex = historyIndexRef.current + 1; historyIndexRef.current = nextIndex; setHistoryIndex(nextIndex); setWalls(historyRef.current[nextIndex]); };
  const selectFurniture = (kind: FurnitureKind) => { furnitureKindRef.current = kind; setFurnitureKind(kind); selectMode("buy"); };
  const restoreOffice = () => { historyRef.current = [DEFAULT_OFFICE_PLAN]; historyIndexRef.current = 0; setHistory([DEFAULT_OFFICE_PLAN]); setHistoryIndex(0); setWalls(DEFAULT_OFFICE_PLAN); setFurniture(DEFAULT_FURNITURE); setNpcStatuses({ traffic: "working", finance: "working", commercial: "working", seo: "working", funnels: "working" }); };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" }); }
    catch { setWebglAvailable(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--brand-gold").trim() || "#b57a20";
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#0d0d0d"); scene.fog = new THREE.Fog("#0d0d0d", 30, 58);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100); const focus = new THREE.Vector3(0, 0, 0); const target = focus.clone(); const orbit = { azimuth: .62, polar: .88, radius: 25 };
    const updateCamera = () => { const sin = Math.sin(orbit.polar); camera.position.set(target.x + orbit.radius * sin * Math.sin(orbit.azimuth), target.y + orbit.radius * Math.cos(orbit.polar), target.z + orbit.radius * sin * Math.cos(orbit.azimuth)); camera.lookAt(target); }; updateCamera();
    scene.add(new THREE.HemisphereLight("#fff6e4", "#0b0906", 1.6)); const key = new THREE.DirectionalLight("#fff5da", 2.8); key.position.set(-9, 16, 9); key.castShadow = true; scene.add(key); const signal = new THREE.PointLight(accent, 14, 24, 2); signal.position.set(0, 7, 0); scene.add(signal);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(22, .32, 22), new THREE.MeshStandardMaterial({ color: "#19150e", roughness: .76, metalness: .28 })); floor.position.y = -.18; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(20, 20, accent, "#3a3122"); grid.position.y = .01; grid.visible = false; scene.add(grid);
    const floorEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(22, .32, 22)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: .45 })); floorEdges.position.y = -.18; scene.add(floorEdges);
    const wallLayer = new THREE.Group(); scene.add(wallLayer);
    const occludingWalls: THREE.Mesh[] = [];
    const furnitureLayer = new THREE.Group(); scene.add(furnitureLayer);
    const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .5, transparent: true, opacity: .38 })); preview.visible = false; preview.castShadow = true; scene.add(preview);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: "#292114", roughness: .5, metalness: .4, emissive: "#151006", emissiveIntensity: .4, transparent: true, opacity: .84 });
    const renderWalls = (blueprints: WallBlueprint[]) => { while (wallLayer.children.length) { const child = wallLayer.children.pop()!; child.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } }); } occludingWalls.length = 0; blueprints.forEach((wall) => { const start = new THREE.Vector3(wall.start.x, 1.5, wall.start.z); const end = new THREE.Vector3(wall.end.x, 1.5, wall.end.z); const length = start.distanceTo(end); if (!length) return; const mesh = new THREE.Mesh(new THREE.BoxGeometry(.18, 3, length), wallMaterial.clone()); mesh.position.copy(start).lerp(end, .5); mesh.rotation.y = Math.atan2(end.x - start.x, end.z - start.z); mesh.castShadow = true; mesh.receiveShadow = true; wallLayer.add(mesh); occludingWalls.push(mesh); const trim = new THREE.Mesh(new THREE.BoxGeometry(.24, .09, length + .04), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .55, metalness: .7, roughness: .25 })); trim.position.copy(mesh.position); trim.position.y = 3.04; trim.rotation.y = mesh.rotation.y; wallLayer.add(trim); }); };
    const furnitureMaterial = new THREE.MeshStandardMaterial({ color: "#292114", roughness: .42, metalness: .62 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: "#090806", roughness: .67, metalness: .52 });
    const makeFurniture = (item: FurnitureBlueprint) => {
      const group = new THREE.Group(); group.position.set(item.x, 0, item.z); group.rotation.y = item.rotation ?? 0;
      const mesh = (geometry: THREE.BufferGeometry, material = furnitureMaterial, y = 0) => { const object = new THREE.Mesh(geometry, material.clone()); object.position.y = y; object.castShadow = true; object.receiveShadow = true; group.add(object); return object; };
      if (item.kind === "desk") { mesh(new THREE.BoxGeometry(2.4, .16, 1.2), furnitureMaterial, 1.25); for (const x of [-.95, .95]) for (const z of [-.42, .42]) { const leg = mesh(new THREE.BoxGeometry(.12, 1.25, .12), darkMaterial, .62); leg.position.x = x; leg.position.z = z; } }
      if (item.kind === "chair") { mesh(new THREE.BoxGeometry(1.05, .18, 1.0), furnitureMaterial, .78); const back = mesh(new THREE.BoxGeometry(1.05, 1.1, .16), furnitureMaterial, 1.35); back.position.z = .43; mesh(new THREE.CylinderGeometry(.09, .12, .75, 10), darkMaterial, .38); for (let index = 0; index < 5; index++) { const arm = mesh(new THREE.BoxGeometry(.68, .06, .1), darkMaterial, .08); const angle = index * Math.PI * .4; arm.position.set(Math.cos(angle) * .27, .08, Math.sin(angle) * .27); arm.rotation.y = -angle; } }
      if (item.kind === "monitor") { mesh(new THREE.BoxGeometry(1.35, .78, .08), new THREE.MeshStandardMaterial({ color: "#11100c", emissive: accent, emissiveIntensity: 1.15, roughness: .2, metalness: .75 }), 1.95); mesh(new THREE.BoxGeometry(.1, .62, .1), darkMaterial, 1.48); mesh(new THREE.BoxGeometry(.66, .06, .38), darkMaterial, 1.2); }
      if (item.kind === "meeting-table") { const top = mesh(new THREE.CylinderGeometry(2.05, 2.05, .16, 32), furnitureMaterial, 1.2); top.scale.z = .6; mesh(new THREE.CylinderGeometry(.4, .62, 1.15, 18), darkMaterial, .58); for (let index = 0; index < 5; index++) { const seat = mesh(new THREE.BoxGeometry(.68, .82, .68), furnitureMaterial, .55); const angle = index * Math.PI * .4; seat.position.set(Math.cos(angle) * 2.2, .55, Math.sin(angle) * 1.32); seat.rotation.y = -angle; } }
      if (item.kind === "sofa") { mesh(new THREE.BoxGeometry(3.3, .7, 1.25), furnitureMaterial, .68); const back = mesh(new THREE.BoxGeometry(3.3, 1.1, .2), furnitureMaterial, 1.25); back.position.z = .5; }
      if (item.kind === "plant") { mesh(new THREE.CylinderGeometry(.38, .52, .58, 14), new THREE.MeshStandardMaterial({ color: "#795a27", roughness: .85 }), .29); for (let index = 0; index < 7; index++) { const leaf = mesh(new THREE.SphereGeometry(.3, 12, 8), new THREE.MeshStandardMaterial({ color: "#2f6d40", roughness: .72 }), 1.02 + (index % 2) * .18); leaf.position.set(Math.sin(index * .9) * .36, leaf.position.y, Math.cos(index * .9) * .36); leaf.scale.set(.55, 1.55, .55); } }
      furnitureLayer.add(group);
    };
    const renderFurniture = (items: FurnitureBlueprint[]) => { while (furnitureLayer.children.length) { const child = furnitureLayer.children.pop()!; child.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } }); } items.forEach(makeFurniture); };
    let wallsCurrent: WallBlueprint[] = [];
    const applyWalls = (next: WallBlueprint[]) => { wallsCurrent = next; renderWalls(next); };
    const blueprintHandler = (event: Event) => applyWalls((event as CustomEvent<WallBlueprint[]>).detail ?? []);
    host.addEventListener("growdash-life-walls", blueprintHandler);
    const furnitureHandler = (event: Event) => renderFurniture((event as CustomEvent<FurnitureBlueprint[]>).detail ?? []);
    host.addEventListener("growdash-life-furniture", furnitureHandler);
    type NpcRig = {
      id: string; root: THREE.Group; base: THREE.Vector3; halo: THREE.Mesh; body: THREE.Group; head: THREE.Group;
      leftShoulder: THREE.Group; rightShoulder: THREE.Group; leftElbow: THREE.Group; rightElbow: THREE.Group;
      leftHip: THREE.Group; rightHip: THREE.Group; leftKnee: THREE.Group; rightKnee: THREE.Group; phase: number;
    };
    const npcObjects: NpcRig[] = [];
    const npcSeeds = [
      { id: "traffic", name: "TRÁFEGO", x: -6, z: -2.75, color: "#d79a32" }, { id: "finance", name: "FINANÇAS", x: 0, z: -2.75, color: "#8aaf72" }, { id: "commercial", name: "COMERCIAL", x: 6, z: -2.75, color: "#b57961" },
      { id: "seo", name: "SEO", x: -7, z: 6.8, color: "#c79e58" }, { id: "funnels", name: "FUNIS", x: 7, z: 6.6, color: "#947a51" },
    ];
    const createNpc = (seed: typeof npcSeeds[number], index: number) => {
      const root = new THREE.Group(); root.position.set(seed.x, 0, seed.z); root.rotation.y = Math.PI;
      const body = new THREE.Group(); body.position.y = .98; root.add(body);
      const skinTone = ["#d89b78", "#b97050", "#efb78e", "#9c5c43", "#c98b68"][index];
      const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: .82 });
      const outfit = new THREE.MeshStandardMaterial({ color: seed.color, roughness: .48, metalness: .12 });
      const trousers = new THREE.MeshStandardMaterial({ color: index % 2 ? "#20242b" : "#18202a", roughness: .76 });
      const hairMaterial = new THREE.MeshStandardMaterial({ color: ["#302018", "#171315", "#6a3522", "#261913", "#4b2c22"][index], roughness: .9 });
      const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position?: THREE.Vector3) => { const mesh = new THREE.Mesh(geometry, material); if (position) mesh.position.copy(position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
      // Layered torso and pelvis give the character a readable human silhouette from every camera angle.
      add(body, new THREE.CapsuleGeometry(.37, .54, 6, 14), outfit, new THREE.Vector3(0, .03, 0));
      add(body, new THREE.SphereGeometry(.38, 16, 12), outfit, new THREE.Vector3(0, -.38, .01)).scale.set(1, .55, .8);
      add(body, new THREE.CylinderGeometry(.105, .12, .18, 10), skin, new THREE.Vector3(0, .43, 0));
      const head = new THREE.Group(); head.position.set(0, .74, -.02); body.add(head);
      add(head, new THREE.SphereGeometry(.31, 20, 16), skin).scale.set(.92, 1.1, .9);
      const hair = add(head, new THREE.SphereGeometry(.33, 18, 14, 0, Math.PI * 2, 0, Math.PI * .62), hairMaterial, new THREE.Vector3(0, .09, .01)); hair.scale.set(1.04, .82, 1);
      // Minimal facial geometry makes the agents read as people rather than mannequins at close zoom.
      const faceMaterial = new THREE.MeshStandardMaterial({ color: "#18120e", roughness: .65 });
      for (const x of [-.105, .105]) add(head, new THREE.SphereGeometry(.026, 8, 8), faceMaterial, new THREE.Vector3(x, .015, -.282));
      add(head, new THREE.SphereGeometry(.028, 8, 8), skin, new THREE.Vector3(0, -.055, -.305)).scale.set(.75, 1.15, .65);
      const mouth = add(head, new THREE.TorusGeometry(.06, .009, 6, 10, Math.PI), faceMaterial, new THREE.Vector3(0, -.14, -.286)); mouth.rotation.x = Math.PI;
      const arm = (side: number) => {
        const shoulder = new THREE.Group(); shoulder.position.set(side * .39, .25, 0); body.add(shoulder);
        add(shoulder, new THREE.CapsuleGeometry(.105, .34, 4, 10), outfit, new THREE.Vector3(0, -.25, 0));
        const elbow = new THREE.Group(); elbow.position.set(0, -.5, 0); shoulder.add(elbow);
        add(elbow, new THREE.CapsuleGeometry(.085, .28, 4, 10), skin, new THREE.Vector3(0, -.22, 0));
        add(elbow, new THREE.SphereGeometry(.105, 10, 8), skin, new THREE.Vector3(0, -.43, -.01));
        return { shoulder, elbow };
      };
      const left = arm(-1); const right = arm(1);
      const leg = (side: number) => {
        const hip = new THREE.Group(); hip.position.set(side * .18, -.48, .02); body.add(hip);
        add(hip, new THREE.CapsuleGeometry(.13, .38, 4, 10), trousers, new THREE.Vector3(0, -.27, 0));
        const knee = new THREE.Group(); knee.position.set(0, -.57, 0); hip.add(knee);
        add(knee, new THREE.CapsuleGeometry(.115, .34, 4, 10), trousers, new THREE.Vector3(0, -.24, .02));
        add(knee, new THREE.BoxGeometry(.2, .12, .36), new THREE.MeshStandardMaterial({ color: "#111316", roughness: .7 }), new THREE.Vector3(0, -.5, -.1));
        return { hip, knee };
      };
      const leftLeg = leg(-1); const rightLeg = leg(1);
      const halo = new THREE.Mesh(new THREE.RingGeometry(.42, .58, 32), new THREE.MeshBasicMaterial({ color: seed.color, transparent: true, opacity: .55, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = .02; root.add(halo);
      root.userData.label = seed.name; root.traverse((part) => { part.userData.npcId = seed.id; }); scene.add(root);
      npcObjects.push({ id: seed.id, root, body, head, base: root.position.clone(), halo, leftShoulder: left.shoulder, rightShoulder: right.shoulder, leftElbow: left.elbow, rightElbow: right.elbow, leftHip: leftLeg.hip, rightHip: rightLeg.hip, leftKnee: leftLeg.knee, rightKnee: rightLeg.knee, phase: index * .72 });
    };
    npcSeeds.forEach(createNpc);
    let currentNpcStatuses: Record<string, NpcStatus> = {};
    const npcStatusHandler = (event: Event) => { currentNpcStatuses = (event as CustomEvent<Record<string, NpcStatus>>).detail ?? {}; };
    host.addEventListener("growdash-life-npcs", npcStatusHandler);
    let selectedNpcId: string | null = null;
    const selectedNpcHandler = (event: Event) => { selectedNpcId = (event as CustomEvent<string | null>).detail; };
    host.addEventListener("growdash-life-selected-npc", selectedNpcHandler);
    const raycaster = new THREE.Raycaster(); const pointerNdc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const floorPoint = new THREE.Vector3();
    const toFloor = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointerNdc, camera); return raycaster.ray.intersectPlane(plane, floorPoint) ? gridPoint(floorPoint) : null; };
    let pointer: { x: number; y: number; button: number; moved: boolean; buildStart?: GridPoint } | null = null;
    const down = (event: PointerEvent) => { const buildStart = modeRef.current === "build" && event.button === 0 ? toFloor(event) ?? undefined : undefined; pointer = { x: event.clientX, y: event.clientY, button: event.button, moved: false, buildStart }; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!pointer) return; const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y; if (Math.abs(dx) + Math.abs(dy) > 3) pointer.moved = true; if (modeRef.current === "build" && pointer.buildStart) { const end = toFloor(event); if (end && !samePoint(pointer.buildStart, end)) { const start3 = new THREE.Vector3(pointer.buildStart.x, 1.5, pointer.buildStart.z); const end3 = new THREE.Vector3(end.x, 1.5, end.z); const length = start3.distanceTo(end3); preview.visible = true; preview.scale.set(.2, 3, length); preview.position.copy(start3).lerp(end3, .5); preview.rotation.y = Math.atan2(end3.x - start3.x, end3.z - start3.z); } return; } if (pointer.button === 2) { focus.x -= dx * .018; focus.z += dy * .018; } else { orbit.azimuth -= dx * .008; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .007, .3, 1.48); } pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const up = (event: PointerEvent) => { if (!pointer) return; if (modeRef.current === "build" && pointer.buildStart) { const end = toFloor(event); if (end && !samePoint(pointer.buildStart, end)) { const wall = { id: crypto.randomUUID(), start: pointer.buildStart, end }; const exists = wallsCurrent.some((item) => wallKey(item) === wallKey(wall)); if (!exists) commitWalls([...wallsCurrent, wall]); } preview.visible = false; } if (modeRef.current === "buy" && !pointer.moved && pointer.button === 0) { const point = toFloor(event); if (point) setFurniture((current) => [...current, { id: crypto.randomUUID(), kind: furnitureKindRef.current, x: point.x, z: point.z }]); } if (modeRef.current === "live" && !pointer.moved && pointer.button === 0) { const rect = renderer.domElement.getBoundingClientRect(); pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointerNdc, camera); const picked = raycaster.intersectObjects(npcObjects.map((npc) => npc.root), true).find((hit) => hit.object.userData.npcId); if (picked) setSelectedNpc(picked.object.userData.npcId as keyof typeof NPC_COPY); } pointer = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); const rect = renderer.domElement.getBoundingClientRect(); pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointerNdc, camera); const before = orbit.radius; const next = THREE.MathUtils.clamp(before + event.deltaY * .014, 5, 40); if (raycaster.ray.intersectPlane(plane, floorPoint)) focus.addScaledVector(floorPoint.clone().sub(focus), 1 - next / before); orbit.radius = next; updateCamera(); };
    const keyDown = (event: KeyboardEvent) => { if (event.key === "1") selectMode("live"); if (event.key === "2") selectMode("build"); if (event.key === "3") selectMode("buy"); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } if (event.key.toLowerCase() === "g") { orbit.polar = .35; focus.set(0, 0, 0); updateCamera(); } };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false }); renderer.domElement.addEventListener("keydown", keyDown);
    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let visible = true; const visibility = () => { visible = document.visibilityState === "visible"; }; document.addEventListener("visibilitychange", visibility); const clock = new THREE.Clock(); let frame = 0;
    const render = () => { frame = requestAnimationFrame(render); if (!visible) return; const elapsed = clock.getElapsedTime(); grid.visible = modeRef.current !== "live"; floorEdges.material.opacity = modeRef.current === "live" ? .3 : .7; signal.intensity = 10 + Math.sin(elapsed * 1.2) * 2; npcObjects.forEach((npc, index) => { const status = currentNpcStatuses[npc.id] || "working"; const selected = selectedNpcId === npc.id; const stride = elapsed * 3.15 + npc.phase; npc.halo.material.opacity = THREE.MathUtils.lerp((npc.halo.material as THREE.MeshBasicMaterial).opacity, selected ? .98 : .45, .18); npc.halo.scale.setScalar(selected ? 1.45 + Math.sin(elapsed * 4) * .08 : 1); if (status === "walking") { npc.root.position.lerp(new THREE.Vector3(npc.base.x + Math.sin(elapsed + npc.phase) * 1.5, .02, npc.base.z + Math.cos(elapsed * .8 + npc.phase) * 1.1), .12); npc.root.rotation.y = Math.atan2(Math.cos(elapsed + npc.phase), -Math.sin(elapsed * .8 + npc.phase)); npc.body.position.y = .98 + Math.abs(Math.sin(stride)) * .055; npc.body.rotation.x = .06; npc.head.rotation.y = Math.sin(elapsed * .75 + npc.phase) * .12; npc.leftShoulder.rotation.x = Math.sin(stride) * .65; npc.rightShoulder.rotation.x = -Math.sin(stride) * .65; npc.leftElbow.rotation.x = -.28 - Math.max(0, Math.sin(stride)) * .35; npc.rightElbow.rotation.x = -.28 + Math.min(0, Math.sin(stride)) * .35; npc.leftHip.rotation.x = -Math.sin(stride) * .62; npc.rightHip.rotation.x = Math.sin(stride) * .62; npc.leftKnee.rotation.x = Math.max(0, Math.sin(stride)) * .72; npc.rightKnee.rotation.x = Math.max(0, -Math.sin(stride)) * .72; } else if (status === "free") { const lounge = new THREE.Vector3(-7 + index * .25, 0, 6.5 + index * .12); npc.root.position.lerp(lounge, .04); npc.root.rotation.y = .35; npc.body.position.y = .92 + Math.sin(elapsed * 1.25 + npc.phase) * .022; npc.body.rotation.x = -.15; npc.head.rotation.y = Math.sin(elapsed * .7 + npc.phase) * .22; npc.leftShoulder.rotation.x = .34; npc.rightShoulder.rotation.x = -.15 + Math.sin(elapsed * 1.8 + npc.phase) * .18; npc.leftElbow.rotation.x = -.55; npc.rightElbow.rotation.x = -.38; npc.leftHip.rotation.x = .92; npc.rightHip.rotation.x = .92; npc.leftKnee.rotation.x = -.88; npc.rightKnee.rotation.x = -.88; } else { /* seated typing: hips bend to the chair, forearms stay above the keyboard and hands alternate in a subtle rhythm. */ npc.root.position.lerp(npc.base, .11); npc.root.position.y = Math.sin(elapsed * 1.6 + npc.phase) * .012; npc.root.rotation.y = Math.PI; npc.body.position.y = .64 + Math.sin(elapsed * 1.6 + npc.phase) * .012; npc.body.rotation.x = -.08; npc.head.rotation.y = Math.sin(elapsed * .55 + npc.phase) * .08; npc.leftShoulder.rotation.x = -.92 + Math.sin(elapsed * 7 + npc.phase) * .11; npc.rightShoulder.rotation.x = -.92 - Math.sin(elapsed * 7 + npc.phase) * .11; npc.leftElbow.rotation.x = .72 + Math.sin(elapsed * 7 + npc.phase) * .08; npc.rightElbow.rotation.x = .72 - Math.sin(elapsed * 7 + npc.phase) * .08; npc.leftHip.rotation.x = Math.PI / 2; npc.rightHip.rotation.x = Math.PI / 2; npc.leftKnee.rotation.x = -Math.PI / 2 + .12; npc.rightKnee.rotation.x = -Math.PI / 2 + .12; } }); target.lerp(focus, .12); updateCamera(); const hiddenWalls = new Set<THREE.Object3D>(); npcObjects.forEach((npc) => { const sightLine = npc.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(camera.position); const distance = sightLine.length(); raycaster.set(camera.position, sightLine.normalize()); raycaster.intersectObjects(occludingWalls, false).filter((hit) => hit.distance < distance - .35).forEach((hit) => hiddenWalls.add(hit.object)); }); occludingWalls.forEach((wall) => { const material = wall.material as THREE.MeshStandardMaterial; material.opacity = THREE.MathUtils.lerp(material.opacity, hiddenWalls.has(wall) ? .12 : .84, .16); material.depthWrite = material.opacity > .72; }); renderer.render(scene, camera); }; render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); host.removeEventListener("growdash-life-walls", blueprintHandler); host.removeEventListener("growdash-life-furniture", furnitureHandler); host.removeEventListener("growdash-life-npcs", npcStatusHandler); host.removeEventListener("growdash-life-selected-npc", selectedNpcHandler); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); renderer.domElement.removeEventListener("keydown", keyDown); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const material = object.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  useEffect(() => { const host = hostRef.current; if (!host) return; host.dispatchEvent(new CustomEvent("growdash-life-walls", { detail: walls })); }, [walls]);
  useEffect(() => { const host = hostRef.current; if (!host) return; host.dispatchEvent(new CustomEvent("growdash-life-furniture", { detail: furniture })); }, [furniture]);
  useEffect(() => { const host = hostRef.current; if (!host) return; host.dispatchEvent(new CustomEvent("growdash-life-npcs", { detail: npcStatuses })); }, [npcStatuses]);
  useEffect(() => { const host = hostRef.current; if (!host) return; host.dispatchEvent(new CustomEvent("growdash-life-selected-npc", { detail: selectedNpc })); }, [selectedNpc]);
  useEffect(() => { writeLocal("growdash:life:walls", walls); }, [walls]);
  useEffect(() => { writeLocal("growdash:life:furniture", furniture); }, [furniture]);
  useEffect(() => { writeLocal("growdash:life:npc-statuses", npcStatuses); }, [npcStatuses]);
  const current = MODE_COPY[mode];
  const selectedNpcDetail = selectedNpc ? NPC_DETAILS[selectedNpc] : null;
  return <main className="life-sim-page mx-auto w-full max-w-[1920px]"><header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Growdash Life · alpha construível</span><h1 className="mt-1 text-2xl font-black">Central de operações em 3D</h1><p className="mt-1 text-xs text-muted-foreground">Um mundo procedural original, com espaço, altura, profundidade e planta editável.</p></div><div className="life-sim-mode-switch" role="tablist" aria-label="Modo do Growdash Life">{(Object.keys(MODE_COPY) as LifeMode[]).map((item, index) => { const ItemIcon = MODE_COPY[item].icon; return <button type="button" key={item} role="tab" aria-selected={mode === item} onClick={() => selectMode(item)} className={cn(mode === item && "is-active")}><ItemIcon />{MODE_COPY[item].label}<kbd>{index + 1}</kbd></button>; })}</div></header><section className="life-sim-stage" aria-label="Mundo 3D Growdash Life"><div ref={hostRef} className="life-sim-canvas" tabIndex={0} onContextMenu={(event) => event.preventDefault()} aria-label="Cena 3D. Arraste para orbitar, botão direito para mover o foco e roda para aproximar." />{!webglAvailable && <div className="life-sim-fallback">O navegador não disponibilizou WebGL. Habilite a aceleração gráfica para abrir a simulação.</div>}<div className="life-sim-status"><current.icon /><div><b>{current.label.toUpperCase()}</b><span>{current.hint}</span></div></div>{mode === "live" && <aside className="life-sim-roster" aria-label="Comandos dos NPCs"><b>OPERAÇÃO AO VIVO</b>{(Object.entries(NPC_COPY) as Array<[keyof typeof NPC_COPY, string]>).map(([id, label]) => <div key={id} className={cn(selectedNpc === id && "is-selected")}><span><i className={`is-${npcStatuses[id]}`} />{label}</span><button type="button" className={cn(npcStatuses[id] === "working" && "is-active")} onClick={() => { setSelectedNpc(id); setNpcStatuses((current) => ({ ...current, [id]: "working" })); }}>Trabalhar</button><button type="button" className={cn(npcStatuses[id] === "walking" && "is-active")} onClick={() => { setSelectedNpc(id); setNpcStatuses((current) => ({ ...current, [id]: "walking" })); }}>Andar</button><button type="button" className={cn(npcStatuses[id] === "free" && "is-active")} onClick={() => { setSelectedNpc(id); setNpcStatuses((current) => ({ ...current, [id]: "free" })); }}>Pausa</button></div>)}</aside>}{selectedNpcDetail && mode === "live" && <aside className="life-sim-npc-card"><button type="button" aria-label="Fechar agente" onClick={() => setSelectedNpc(null)}>×</button><i style={{ background: selectedNpcDetail.color }} /><b>{selectedNpcDetail.name}</b><span>{NPC_COPY[selectedNpc!]} · {selectedNpcDetail.specialty}</span><small>{npcStatuses[selectedNpc!] === "working" ? "Em atividade na estação" : npcStatuses[selectedNpc!] === "walking" ? "Em deslocamento pelo escritório" : "Em pausa no lounge"}</small></aside>}{mode === "buy" && <aside className="life-sim-catalog" aria-label="Catálogo de móveis"><b>CATÁLOGO OPERACIONAL</b><span>Selecione e clique na planta</span><div>{(Object.keys(FURNITURE_COPY) as FurnitureKind[]).map((kind) => <button type="button" key={kind} className={cn(furnitureKind === kind && "is-active")} onClick={() => selectFurniture(kind)}>{FURNITURE_COPY[kind]}</button>)}</div></aside>}<div className="life-sim-build-tools" aria-label="Ferramentas de construção"><div><WandSparkles /><span><b>{mode === "buy" ? "MOBILIÁRIO" : "PLANTA LOCAL"}</b><small>{mode === "buy" ? `${furniture.length} itens na sessão` : `${walls.length} ${walls.length === 1 ? "parede" : "paredes"} na sessão`}</small></span></div><button type="button" onClick={undo} disabled={historyIndex === 0 || mode === "buy"} aria-label="Desfazer parede"><Undo2 /></button><button type="button" onClick={redo} disabled={historyIndex >= history.length - 1 || mode === "buy"} aria-label="Refazer parede"><Redo2 /></button><button type="button" onClick={() => mode === "buy" ? setFurniture([]) : commitWalls([])} disabled={mode === "buy" ? !furniture.length : !walls.length}>Limpar</button><button type="button" onClick={restoreOffice} aria-label="Restaurar escritório inicial">Restaurar</button></div><div className="life-sim-guide"><Rotate3D /><span>360° real</span><MousePointer2 /><span>{mode === "build" ? "Arraste para construir" : mode === "buy" ? "Clique para posicionar" : "Orbitar e pan"}</span><Box /><span>Grade 20×20m</span><UsersRound /><span>5 NPCs ativos</span></div></section></main>;
}
