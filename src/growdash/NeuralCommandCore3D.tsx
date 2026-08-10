import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type NeuralCommandCore3DProps = {
  expanded: boolean;
  entering?: boolean;
  onEnter: () => void;
};

/** A real WebGL object: the cortex has volume, depth and an orbitable camera. */
export function NeuralCommandCore3D({ expanded, entering = false, onEnter }: NeuralCommandCore3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEnterRef = useRef(onEnter);
  const [available, setAvailable] = useState(true);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch { setAvailable(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    const orbit = { azimuth: -.38, polar: 1.12, radius: 9.6 };
    const target = new THREE.Vector3(0, 0, 0);
    const updateCamera = () => {
      const sin = Math.sin(orbit.polar);
      camera.position.set(orbit.radius * sin * Math.sin(orbit.azimuth), orbit.radius * Math.cos(orbit.polar), orbit.radius * sin * Math.cos(orbit.azimuth));
      camera.lookAt(target);
    };
    updateCamera();
    scene.add(new THREE.AmbientLight("#59d9ff", 1.5));
    const key = new THREE.PointLight("#c7f5ff", 15, 18, 2); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight("#00b7ff", 20, 15, 2); rim.position.set(4, -1, -4); scene.add(rim);
    const core = new THREE.Group(); scene.add(core);
    const cortexMaterial = new THREE.MeshPhysicalMaterial({ color: "#075b7c", emissive: "#009bd3", emissiveIntensity: .8, roughness: .3, metalness: .56, transparent: true, opacity: .7, transmission: .08, side: THREE.DoubleSide });
    const wireMaterial = new THREE.MeshBasicMaterial({ color: "#85edff", transparent: true, opacity: .23, wireframe: true });
    const hemiGeometry = new THREE.IcosahedronGeometry(1.72, 3);
    for (const side of [-1, 1]) {
      const hemisphere = new THREE.Mesh(hemiGeometry, cortexMaterial); hemisphere.position.x = side * .82; hemisphere.scale.set(1, .82, .9); core.add(hemisphere);
      const wire = new THREE.Mesh(hemiGeometry, wireMaterial); wire.position.copy(hemisphere.position); wire.scale.copy(hemisphere.scale).multiplyScalar(1.012); core.add(wire);
    }
    const central = new THREE.Mesh(new THREE.TorusGeometry(.52, .05, 12, 48), new THREE.MeshBasicMaterial({ color: "#d9faff" })); central.rotation.x = Math.PI / 2; core.add(central);
    const reactor = new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 16), new THREE.MeshBasicMaterial({ color: "#dffcff" })); core.add(reactor);
    const nodes: THREE.Vector3[] = [];
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: "#b9f7ff" });
    for (let i = 0; i < 52; i++) {
      const side = i % 2 ? 1 : -1; const theta = (i * 2.399) % (Math.PI * 2); const radius = .42 + (i % 7) * .12;
      const p = new THREE.Vector3(side * (.5 + Math.abs(Math.cos(theta)) * .88), Math.sin(theta) * radius * 1.55, Math.cos(theta) * radius * .72);
      nodes.push(p); const dot = new THREE.Mesh(new THREE.SphereGeometry(i % 5 === 0 ? .055 : .032, 8, 8), nodeMaterial); dot.position.copy(p); core.add(dot);
    }
    const linePositions: number[] = [];
    nodes.forEach((node, index) => { for (const offset of [1, 7]) { const next = nodes[(index + offset) % nodes.length]; if (node.distanceTo(next) < 1.25) linePositions.push(node.x, node.y, node.z, next.x, next.y, next.z); } });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3)), new THREE.LineBasicMaterial({ color: "#45dcff", transparent: true, opacity: .42 })); core.add(lines);
    const rings = new THREE.Group(); scene.add(rings);
    [2.25, 2.75, 3.28].forEach((radius, index) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 8, 96), new THREE.MeshBasicMaterial({ color: index === 1 ? "#f4c94f" : "#47dcff", transparent: true, opacity: .55 })); ring.rotation.set(index === 0 ? .95 : 1.57, index === 1 ? .28 : .62, index * .65); rings.add(ring); });
    const resize = () => { const width = host.clientWidth; const height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let pointer: { x: number; y: number; moved: boolean } | null = null;
    const down = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY, moved: false }; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!pointer) return; const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y; pointer.moved ||= Math.abs(dx) + Math.abs(dy) > 4; orbit.azimuth -= dx * .009; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .008, .46, 2.45); pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const up = (event: PointerEvent) => { const clicked = pointer && !pointer.moved; pointer = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); if (clicked) onEnterRef.current(); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); orbit.radius = THREE.MathUtils.clamp(orbit.radius + event.deltaY * .009, 6.5, 14); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    let frame = 0; let raf = 0;
    const render = () => { raf = requestAnimationFrame(render); frame += .008; core.rotation.y += .0021; core.rotation.z = Math.sin(frame * .7) * .035; rings.rotation.y -= .003; rings.rotation.z += .001; reactor.scale.setScalar(1 + Math.sin(frame * 3) * .15); renderer.render(scene, camera); };
    render();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); scene.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const material = mesh.material; if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  if (!available) return <button type="button" className="neural-core-fallback" onClick={onEnter}>Abrir inteligência Growdash</button>;
  return <div className={`neural-command-core ${expanded ? "is-expanded" : ""} ${entering ? "is-entering" : ""}`}><div ref={hostRef} className="neural-command-core-canvas" role="button" tabIndex={0} aria-label={expanded ? "Cérebro Growdash expandido" : "Entrar no cérebro Growdash"} aria-expanded={expanded} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEnter(); } }} /><div className="neural-command-core-hud" aria-hidden="true"><b>GROWDASH</b><span>{entering ? "Sincronizando conexões…" : expanded ? "Núcleo operacional ativo" : "Arraste para orbitar · clique para entrar"}</span></div></div>;
}
