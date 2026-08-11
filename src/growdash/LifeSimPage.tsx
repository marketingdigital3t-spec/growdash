import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Box, Eye, Hammer, MousePointer2, Redo2, Rotate3D, ShoppingBag, Undo2, UsersRound, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LifeMode = "live" | "build" | "buy";
type GridPoint = { x: number; z: number };
type WallBlueprint = { id: string; start: GridPoint; end: GridPoint };

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
  live: { label: "Viver", hint: "Navegue pelo escritório e acompanhe a operação em tempo real.", icon: Eye },
  build: { label: "Construir", hint: "Arraste na grade para erguer paredes. Tudo encaixa em 1 metro.", icon: Hammer },
  buy: { label: "Mobiliar", hint: "O catálogo de móveis operacionais está sendo preparado para esta planta.", icon: ShoppingBag },
};

const gridPoint = (point: THREE.Vector3): GridPoint => ({ x: THREE.MathUtils.clamp(Math.round(point.x), -10, 10), z: THREE.MathUtils.clamp(Math.round(point.z), -10, 10) });
const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.z === b.z;
const wallKey = (wall: WallBlueprint) => `${wall.start.x}:${wall.start.z}:${wall.end.x}:${wall.end.z}`;

/** A procedural, editable world. No bitmap or flat CSS scene is used here. */
export default function LifeSimPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<LifeMode>("live");
  const historyRef = useRef<WallBlueprint[][]>([DEFAULT_OFFICE_PLAN]);
  const historyIndexRef = useRef(0);
  const [mode, setMode] = useState<LifeMode>("live");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [walls, setWalls] = useState<WallBlueprint[]>(DEFAULT_OFFICE_PLAN);
  const [history, setHistory] = useState<WallBlueprint[][]>([DEFAULT_OFFICE_PLAN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const selectMode = (next: LifeMode) => { modeRef.current = next; setMode(next); };
  const commitWalls = (next: WallBlueprint[]) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1); const updated = [...trimmed, next];
    historyRef.current = updated; historyIndexRef.current = updated.length - 1;
    setWalls(next); setHistory(updated); setHistoryIndex(updated.length - 1);
  };
  const undo = () => { if (historyIndexRef.current <= 0) return; const nextIndex = historyIndexRef.current - 1; historyIndexRef.current = nextIndex; setHistoryIndex(nextIndex); setWalls(historyRef.current[nextIndex]); };
  const redo = () => { if (historyIndexRef.current >= historyRef.current.length - 1) return; const nextIndex = historyIndexRef.current + 1; historyIndexRef.current = nextIndex; setHistoryIndex(nextIndex); setWalls(historyRef.current[nextIndex]); };

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
    const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .5, transparent: true, opacity: .38 })); preview.visible = false; preview.castShadow = true; scene.add(preview);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: "#292114", roughness: .5, metalness: .4, emissive: "#151006", emissiveIntensity: .4, transparent: true, opacity: .84 });
    const renderWalls = (blueprints: WallBlueprint[]) => { while (wallLayer.children.length) { const child = wallLayer.children.pop()!; child.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } }); } blueprints.forEach((wall) => { const start = new THREE.Vector3(wall.start.x, 1.5, wall.start.z); const end = new THREE.Vector3(wall.end.x, 1.5, wall.end.z); const length = start.distanceTo(end); if (!length) return; const mesh = new THREE.Mesh(new THREE.BoxGeometry(.18, 3, length), wallMaterial.clone()); mesh.position.copy(start).lerp(end, .5); mesh.rotation.y = Math.atan2(end.x - start.x, end.z - start.z); mesh.castShadow = true; mesh.receiveShadow = true; wallLayer.add(mesh); const trim = new THREE.Mesh(new THREE.BoxGeometry(.24, .09, length + .04), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .55, metalness: .7, roughness: .25 })); trim.position.copy(mesh.position); trim.position.y = 3.04; trim.rotation.y = mesh.rotation.y; wallLayer.add(trim); }); };
    let wallsCurrent: WallBlueprint[] = [];
    const applyWalls = (next: WallBlueprint[]) => { wallsCurrent = next; renderWalls(next); };
    const blueprintHandler = (event: Event) => applyWalls((event as CustomEvent<WallBlueprint[]>).detail ?? []);
    host.addEventListener("growdash-life-walls", blueprintHandler);
    const raycaster = new THREE.Raycaster(); const pointerNdc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const floorPoint = new THREE.Vector3();
    const toFloor = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointerNdc, camera); return raycaster.ray.intersectPlane(plane, floorPoint) ? gridPoint(floorPoint) : null; };
    let pointer: { x: number; y: number; button: number; moved: boolean; buildStart?: GridPoint } | null = null;
    const down = (event: PointerEvent) => { const buildStart = modeRef.current === "build" && event.button === 0 ? toFloor(event) ?? undefined : undefined; pointer = { x: event.clientX, y: event.clientY, button: event.button, moved: false, buildStart }; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!pointer) return; const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y; if (Math.abs(dx) + Math.abs(dy) > 3) pointer.moved = true; if (modeRef.current === "build" && pointer.buildStart) { const end = toFloor(event); if (end && !samePoint(pointer.buildStart, end)) { const start3 = new THREE.Vector3(pointer.buildStart.x, 1.5, pointer.buildStart.z); const end3 = new THREE.Vector3(end.x, 1.5, end.z); const length = start3.distanceTo(end3); preview.visible = true; preview.scale.set(.2, 3, length); preview.position.copy(start3).lerp(end3, .5); preview.rotation.y = Math.atan2(end3.x - start3.x, end3.z - start3.z); } return; } if (pointer.button === 2) { focus.x -= dx * .018; focus.z += dy * .018; } else { orbit.azimuth -= dx * .008; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .007, .3, 1.48); } pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const up = (event: PointerEvent) => { if (!pointer) return; if (modeRef.current === "build" && pointer.buildStart) { const end = toFloor(event); if (end && !samePoint(pointer.buildStart, end)) { const wall = { id: crypto.randomUUID(), start: pointer.buildStart, end }; const exists = wallsCurrent.some((item) => wallKey(item) === wallKey(wall)); if (!exists) commitWalls([...wallsCurrent, wall]); } preview.visible = false; } pointer = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); const rect = renderer.domElement.getBoundingClientRect(); pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointerNdc, camera); const before = orbit.radius; const next = THREE.MathUtils.clamp(before + event.deltaY * .014, 5, 40); if (raycaster.ray.intersectPlane(plane, floorPoint)) focus.addScaledVector(floorPoint.clone().sub(focus), 1 - next / before); orbit.radius = next; updateCamera(); };
    const keyDown = (event: KeyboardEvent) => { if (event.key === "1") selectMode("live"); if (event.key === "2") selectMode("build"); if (event.key === "3") selectMode("buy"); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } if (event.key.toLowerCase() === "g") { orbit.polar = .35; focus.set(0, 0, 0); updateCamera(); } };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false }); renderer.domElement.addEventListener("keydown", keyDown);
    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let visible = true; const visibility = () => { visible = document.visibilityState === "visible"; }; document.addEventListener("visibilitychange", visibility); const clock = new THREE.Clock(); let frame = 0;
    const render = () => { frame = requestAnimationFrame(render); if (!visible) return; grid.visible = modeRef.current !== "live"; floorEdges.material.opacity = modeRef.current === "live" ? .3 : .7; signal.intensity = 10 + Math.sin(clock.getElapsedTime() * 1.2) * 2; target.lerp(focus, .12); updateCamera(); renderer.render(scene, camera); }; render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); host.removeEventListener("growdash-life-walls", blueprintHandler); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); renderer.domElement.removeEventListener("keydown", keyDown); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const material = object.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  useEffect(() => { const host = hostRef.current; if (!host) return; host.dispatchEvent(new CustomEvent("growdash-life-walls", { detail: walls })); }, [walls]);
  const current = MODE_COPY[mode];
  return <main className="life-sim-page mx-auto w-full max-w-[1920px]"><header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Growdash Life · alpha construível</span><h1 className="mt-1 text-2xl font-black">Central de operações em 3D</h1><p className="mt-1 text-xs text-muted-foreground">Um mundo procedural original, com espaço, altura, profundidade e planta editável.</p></div><div className="life-sim-mode-switch" role="tablist" aria-label="Modo do Growdash Life">{(Object.keys(MODE_COPY) as LifeMode[]).map((item, index) => { const ItemIcon = MODE_COPY[item].icon; return <button type="button" key={item} role="tab" aria-selected={mode === item} onClick={() => selectMode(item)} className={cn(mode === item && "is-active")}><ItemIcon />{MODE_COPY[item].label}<kbd>{index + 1}</kbd></button>; })}</div></header><section className="life-sim-stage" aria-label="Mundo 3D Growdash Life"><div ref={hostRef} className="life-sim-canvas" tabIndex={0} onContextMenu={(event) => event.preventDefault()} aria-label="Cena 3D. Arraste para orbitar, botão direito para mover o foco e roda para aproximar." />{!webglAvailable && <div className="life-sim-fallback">O navegador não disponibilizou WebGL. Habilite a aceleração gráfica para abrir a simulação.</div>}<div className="life-sim-status"><current.icon /><div><b>{current.label.toUpperCase()}</b><span>{current.hint}</span></div></div><div className="life-sim-build-tools" aria-label="Ferramentas de construção"><div><WandSparkles /><span><b>PLANTA LOCAL</b><small>{walls.length} {walls.length === 1 ? "parede" : "paredes"} na sessão</small></span></div><button type="button" onClick={undo} disabled={historyIndex === 0} aria-label="Desfazer parede"><Undo2 /></button><button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} aria-label="Refazer parede"><Redo2 /></button><button type="button" onClick={() => commitWalls([])} disabled={!walls.length}>Limpar</button></div><div className="life-sim-guide"><Rotate3D /><span>360° real</span><MousePointer2 /><span>{mode === "build" ? "Arraste para construir" : "Orbitar e pan"}</span><Box /><span>Grade 20×20m</span><UsersRound /><span>NPCs: próxima etapa</span></div></section></main>;
}
