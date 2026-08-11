import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Box, Eye, Hammer, MousePointer2, Rotate3D, ShoppingBag, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

type LifeMode = "live" | "build" | "buy";

const MODE_COPY: Record<LifeMode, { label: string; hint: string; icon: typeof Eye }> = {
  live: { label: "Viver", hint: "Observe e comande os colaboradores quando o escritório estiver pronto.", icon: Eye },
  build: { label: "Construir", hint: "Grade de 1 metro ativa. A construção de paredes chega na próxima fase.", icon: Hammer },
  buy: { label: "Mobiliar", hint: "Grade de posicionamento ativa. O catálogo procedural chega na próxima fase.", icon: ShoppingBag },
};

/** Isolated Three.js foundation; it reuses the platform renderer already shipped. */
export default function LifeSimPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<LifeMode>("live");
  const [mode, setMode] = useState<LifeMode>("live");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const selectMode = (next: LifeMode) => { modeRef.current = next; setMode(next); };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" }); }
    catch { setWebglAvailable(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--brand-gold").trim() || "#b57a20";
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#0d0d0d"); scene.fog = new THREE.Fog("#0d0d0d", 26, 48);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100); const focus = new THREE.Vector3(); const orbit = { azimuth: .62, polar: .88, radius: 24 };
    const updateCamera = () => { const sin = Math.sin(orbit.polar); camera.position.set(focus.x + orbit.radius * sin * Math.sin(orbit.azimuth), focus.y + orbit.radius * Math.cos(orbit.polar), focus.z + orbit.radius * sin * Math.cos(orbit.azimuth)); camera.lookAt(focus); }; updateCamera();
    scene.add(new THREE.HemisphereLight("#fff5df", "#111111", 1.6)); const key = new THREE.DirectionalLight("#ffffff", 2.5); key.position.set(-9, 14, 8); scene.add(key); const signal = new THREE.PointLight(accent, 9, 19, 2); signal.position.set(0, 5, 0); scene.add(signal);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: "#1a1712", roughness: .74, metalness: .2 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const grid = new THREE.GridHelper(20, 20, accent, "#393226"); grid.position.y = .012; grid.visible = false; scene.add(grid);
    const origin = new THREE.Mesh(new THREE.RingGeometry(.72, .86, 48), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .82, side: THREE.DoubleSide })); origin.rotation.x = -Math.PI / 2; origin.position.y = .025; scene.add(origin);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(20, .06, 20)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: .42 })); edges.position.y = -.03; scene.add(edges);
    let pointer: { x: number; y: number; button: number } | null = null;
    const down = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY, button: event.button }; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!pointer) return; const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y; if (pointer.button === 2) { focus.x -= dx * .018; focus.z += dy * .018; } else { orbit.azimuth -= dx * .008; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .007, .3, 1.48); } pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const up = (event: PointerEvent) => { pointer = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); orbit.radius = THREE.MathUtils.clamp(orbit.radius + event.deltaY * .014, 4, 40); updateCamera(); };
    const keyDown = (event: KeyboardEvent) => { if (event.key === "1") selectMode("live"); if (event.key === "2") selectMode("build"); if (event.key === "3") selectMode("buy"); if (event.key.toLowerCase() === "g") { orbit.polar = .35; focus.set(0, 0, 0); updateCamera(); } };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false }); renderer.domElement.addEventListener("keydown", keyDown);
    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let visible = true; const visibility = () => { visible = document.visibilityState === "visible"; }; document.addEventListener("visibilitychange", visibility); let frame = 0;
    const render = () => { frame = requestAnimationFrame(render); if (!visible) return; const activeMode = modeRef.current; grid.visible = activeMode !== "live"; origin.rotation.z += activeMode === "live" ? .007 : .002; (origin.material as THREE.MeshBasicMaterial).opacity = activeMode === "live" ? .82 : .42; renderer.render(scene, camera); }; render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); renderer.domElement.removeEventListener("keydown", keyDown); scene.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const material = mesh.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  const current = MODE_COPY[mode];
  return <main className="life-sim-page mx-auto w-full max-w-[1920px]"><header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Growdash Life · fundação</span><h1 className="mt-1 text-2xl font-black">Escritório de simulação</h1><p className="mt-1 text-xs text-muted-foreground">Ambiente 3D original para construir, mobiliar e acompanhar sua operação.</p></div><div className="life-sim-mode-switch" role="tablist" aria-label="Modo do Growdash Life">{(Object.keys(MODE_COPY) as LifeMode[]).map((item, index) => { const ItemIcon = MODE_COPY[item].icon; return <button type="button" key={item} role="tab" aria-selected={mode === item} onClick={() => selectMode(item)} className={cn(mode === item && "is-active")}><ItemIcon />{MODE_COPY[item].label}<kbd>{index + 1}</kbd></button>; })}</div></header><section className="life-sim-stage" aria-label="Mundo 3D Growdash Life"><div ref={hostRef} className="life-sim-canvas" tabIndex={0} onContextMenu={(event) => event.preventDefault()} aria-label="Cena 3D. Arraste para orbitar, botão direito para mover o foco e roda para aproximar." />{!webglAvailable && <div className="life-sim-fallback">O navegador não disponibilizou WebGL. Habilite a aceleração gráfica para abrir a simulação.</div>}<div className="life-sim-status"><current.icon /><div><b>{current.label.toUpperCase()}</b><span>{current.hint}</span></div></div><div className="life-sim-guide"><Rotate3D /><span>360° real</span><MousePointer2 /><span>Orbitar e pan</span><Box /><span>Grade 20×20m</span><UsersRound /><span>NPCs: próxima fase</span></div></section></main>;
}
