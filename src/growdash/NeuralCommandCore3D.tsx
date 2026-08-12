import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type NeuralCommandCore3DProps = {
  expanded: boolean;
  entering?: boolean;
  onEnter: () => void;
  /** Derived only from the account data already loaded by the command map. */
  health?: "healthy" | "attention" | "critical" | "no-data";
  healthScore?: number | null;
};

/** A real WebGL object: the cortex has volume, depth and an orbitable camera. */
export function NeuralCommandCore3D({ expanded, entering = false, onEnter, health = "no-data", healthScore = null }: NeuralCommandCore3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEnterRef = useRef(onEnter);
  const draggedRef = useRef(false);
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
    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      return {
        accent: styles.getPropertyValue("--brand-gold").trim() || "#b57a20",
        light: styles.getPropertyValue("--brand-gold-light").trim() || "#f1c76b",
      };
    };
    const healthColor = (nextHealth: NeuralCommandCore3DProps["health"], paletteColors = readPalette()) => {
      if (nextHealth === "critical") return "#e74c3c";
      if (nextHealth === "attention") return "#f39c12";
      if (nextHealth === "no-data") return "#95a5a6";
      return paletteColors.accent;
    };
    const palette = readPalette();
    // Keep the neural object inside Growdash's monochrome product palette.
    // Health can still surface a genuine critical condition in red.
    const neuralDark = "#1f2328";
    const neuralLight = "#f6f7f9";
    const neuralWhite = "#ffffff";
    const initialHealthColor = health === "critical" ? healthColor(health, palette) : neuralDark;
    const ambient = new THREE.AmbientLight(initialHealthColor, 1.35); scene.add(ambient);
    const key = new THREE.PointLight(neuralLight, 18, 18, 2); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(neuralWhite, 24, 15, 2); rim.position.set(4, -1, -4); scene.add(rim);
    const coreLight = new THREE.PointLight(neuralWhite, 22, 8, 2); coreLight.position.set(0, .1, 2.1); scene.add(coreLight);
    const core = new THREE.Group(); scene.add(core);
    const cortexMaterial = new THREE.MeshPhysicalMaterial({ color: initialHealthColor, emissive: initialHealthColor, emissiveIntensity: .62, roughness: .42, metalness: .38, transparent: true, opacity: .88, transmission: .03, side: THREE.DoubleSide });
    const wireMaterial = new THREE.MeshBasicMaterial({ color: neuralLight, transparent: true, opacity: .12, wireframe: true });
    // The silhouette is assembled from anatomical lobes instead of two generic
    // polyhedra: frontal crown, parietal ridge, temporal lobe, cerebellum and
    // brain stem. Each part has actual depth and stays recognisable in orbit.
    const cortex = new THREE.Group(); core.add(cortex);
    const lobeGeometry = new THREE.SphereGeometry(1, 28, 20);
    const lobeShapes = [
      { x: 0.62, y: .28, z: .08, sx: 1.25, sy: 1.08, sz: .96 },
      { x: 1.02, y: .68, z: .02, sx: .92, sy: .78, sz: .8 },
      { x: .93, y: -.42, z: .12, sx: 1.02, sy: .69, sz: .88 },
      { x: .38, y: .86, z: -.08, sx: .74, sy: .72, sz: .73 },
    ];
    for (const side of [-1, 1]) for (const shape of lobeShapes) {
      const lobe = new THREE.Mesh(lobeGeometry, cortexMaterial); lobe.position.set(side * shape.x, shape.y, shape.z); lobe.scale.set(shape.sx, shape.sy, shape.sz); cortex.add(lobe);
      const contour = new THREE.Mesh(lobeGeometry, wireMaterial); contour.position.copy(lobe.position); contour.scale.copy(lobe.scale).multiplyScalar(1.006); cortex.add(contour);
    }
    const cerebellum = new THREE.Mesh(new THREE.SphereGeometry(.76, 24, 16), cortexMaterial); cerebellum.position.set(0, -1.04, -.53); cerebellum.scale.set(1.22, .62, .62); cortex.add(cerebellum);
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .7, 8, 16), cortexMaterial); stem.position.set(0, -1.54, -.18); stem.rotation.x = -.35; cortex.add(stem);
    const centralMaterial = new THREE.MeshBasicMaterial({ color: neuralWhite });
    const central = new THREE.Mesh(new THREE.TorusGeometry(.52, .05, 12, 48), centralMaterial); central.rotation.x = Math.PI / 2; core.add(central);
    const reactorMaterial = new THREE.MeshBasicMaterial({ color: neuralWhite });
    const reactor = new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 16), reactorMaterial); core.add(reactor);
    const nodes: THREE.Vector3[] = [];
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: neuralLight });
    for (let i = 0; i < 42; i++) {
      const side = i % 2 ? 1 : -1; const theta = (i * 2.399) % (Math.PI * 2); const radius = .42 + (i % 7) * .12;
      const p = new THREE.Vector3(side * (.5 + Math.abs(Math.cos(theta)) * .88), Math.sin(theta) * radius * 1.55, Math.cos(theta) * radius * .72);
      nodes.push(p); const dot = new THREE.Mesh(new THREE.SphereGeometry(i % 5 === 0 ? .055 : .032, 8, 8), nodeMaterial); dot.position.copy(p); core.add(dot);
    }
    const linePositions: number[] = [];
    nodes.forEach((node, index) => { for (const offset of [1, 7]) { const next = nodes[(index + offset) % nodes.length]; if (node.distanceTo(next) < 1.25) linePositions.push(node.x, node.y, node.z, next.x, next.y, next.z); } });
    const linesMaterial = new THREE.LineBasicMaterial({ color: neuralLight, transparent: true, opacity: .22 });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3)), linesMaterial); core.add(lines);
    // Curved cortical grooves give the core an unmistakable organic depth;
    // they are procedural, not a texture/video projected onto a flat plane.
    const foldMaterial = new THREE.MeshBasicMaterial({ color: neuralLight, transparent: true, opacity: .48, blending: THREE.AdditiveBlending });
    const folds = new THREE.Group(); core.add(folds);
    for (let index = 0; index < 52; index++) {
      const side = index % 2 ? 1 : -1;
      const y = -1.08 + (index % 13) * .18;
      const z = -.78 + Math.floor(index / 13) * .34;
      const points = Array.from({ length: 7 }, (_, pointIndex) => {
        const t = pointIndex / 6;
        const breadth = .25 + Math.sin(t * Math.PI) * (1.22 - Math.abs(y) * .2);
        return new THREE.Vector3(side * breadth, y + Math.sin(t * Math.PI * 2 + index) * .095, z + Math.cos(t * Math.PI * 2 + index * .7) * .13);
      });
      const curve = new THREE.CatmullRomCurve3(points);
      const fold = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, .018 + (index % 4) * .004, 6, false), foldMaterial);
      folds.add(fold);
    }
    const rings = new THREE.Group(); scene.add(rings);
    const ringMaterials: THREE.MeshBasicMaterial[] = [];
    [2.25, 2.75, 3.28].forEach((radius, index) => { const material = new THREE.MeshBasicMaterial({ color: index === 1 ? palette.light : palette.accent, transparent: true, opacity: .55 }); ringMaterials.push(material); const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 8, 96), material); ring.rotation.set(index === 0 ? .95 : 1.57, index === 1 ? .28 : .62, index * .65); rings.add(ring); });
    // Dense points add a neural texture while the low-count synapses remain
    // readable and inexpensive on mobile GPUs.
    const particlePositions: number[] = [];
    const particleSizes: number[] = [];
    const random = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    for (let index = 0; index < 1600; index++) {
      const side = index % 2 ? 1 : -1;
      const theta = random(index + 1) * Math.PI * 2;
      const phi = Math.acos(2 * random(index + 31) - 1);
      const shell = .5 + random(index + 97) * 1.15;
      const x = side * (.22 + Math.abs(Math.sin(phi) * Math.cos(theta)) * 1.24) + (random(index + 61) - .5) * .1;
      const y = Math.cos(phi) * shell * .78 + .04;
      const z = Math.sin(phi) * Math.sin(theta) * shell * .68;
      // Reserve a visible central sulcus instead of filling the two hemispheres.
      if (Math.abs(x) < .22 && Math.abs(y) < 1.15) continue;
      particlePositions.push(x, y, z);
      particleSizes.push(random(index + 151) > .86 ? 1.55 : .8);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("size", new THREE.Float32BufferAttribute(particleSizes, 1));
    const particleMaterial = new THREE.PointsMaterial({ color: neuralLight, size: .026, sizeAttenuation: true, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false });
    const particles = new THREE.Points(particleGeometry, particleMaterial); core.add(particles);
    // A low-cost distant synapse field creates the surrounding neural space.
    const space = new THREE.Group(); scene.add(space);
    const starPositions: number[] = [];
    for (let index = 0; index < 280; index++) {
      const theta = random(index + 451) * Math.PI * 2;
      const radius = 4.2 + random(index + 611) * 5.8;
      starPositions.push(Math.cos(theta) * radius, (random(index + 731) - .5) * 8, Math.sin(theta) * radius - 2);
    }
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: neuralLight, size: .038, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false })); space.add(stars);
    const synapseMaterial = new THREE.LineBasicMaterial({ color: neuralLight, transparent: true, opacity: .23 });
    const synapsePoints: number[] = [];
    for (let index = 0; index < 70; index++) { const source = index * 3; const target = ((index * 17 + 31) % 280) * 3; synapsePoints.push(starPositions[source], starPositions[source + 1], starPositions[source + 2], starPositions[target], starPositions[target + 1], starPositions[target + 2]); }
    space.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(synapsePoints, 3)), synapseMaterial));
    const applyPalette = () => {
      const next = readPalette();
      const nextHealthColor = health === "critical" ? healthColor(health, next) : neuralDark;
      ambient.color.set(nextHealthColor); key.color.set(neuralLight); rim.color.set(nextHealthColor);
      cortexMaterial.color.set(nextHealthColor); cortexMaterial.emissive.set(nextHealthColor); wireMaterial.color.set(neuralLight);
      centralMaterial.color.set(neuralWhite); reactorMaterial.color.set(neuralWhite); nodeMaterial.color.set(neuralLight); linesMaterial.color.set(neuralLight);
      particleMaterial.color.set(neuralLight); foldMaterial.color.set(neuralLight); synapseMaterial.color.set(neuralLight);
      ringMaterials.forEach((material) => material.color.set(neuralLight));
    };
    const themeObserver = new MutationObserver(applyPalette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const resize = () => { const width = host.clientWidth; const height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let pointer: { x: number; y: number; moved: boolean } | null = null;
    const down = (event: PointerEvent) => { draggedRef.current = false; pointer = { x: event.clientX, y: event.clientY, moved: false }; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!pointer) return; const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y; pointer.moved ||= Math.abs(dx) + Math.abs(dy) > 4; draggedRef.current = pointer.moved; orbit.azimuth -= dx * .009; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .008, .46, 2.45); pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const up = (event: PointerEvent) => { pointer = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); orbit.radius = THREE.MathUtils.clamp(orbit.radius + event.deltaY * .009, 6.5, 14); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    let frame = 0; let raf = 0;
    const pulseSpeed = health === "critical" ? 6 : health === "attention" ? 4 : 3;
    const pulseStrength = healthScore === null ? .1 : .08 + (Math.max(0, Math.min(100, healthScore)) / 100) * .12;
    const render = () => { raf = requestAnimationFrame(render); frame += .008; core.rotation.y += .0021; core.rotation.z = Math.sin(frame * .7) * .035; folds.rotation.y -= .00045; rings.rotation.y -= .003; rings.rotation.z += .001; particles.rotation.y -= .0008; space.rotation.y += .00016; const pulse = 1 + Math.sin(frame * pulseSpeed) * pulseStrength; reactor.scale.setScalar(pulse); coreLight.intensity = 18 + Math.sin(frame * pulseSpeed) * 8; particles.scale.setScalar(1 + Math.sin(frame * pulseSpeed) * .018); renderer.render(scene, camera); };
    render();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); themeObserver.disconnect(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); scene.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const material = mesh.material; if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, [health, healthScore]);

  if (!available) return <button type="button" className="neural-core-fallback" onClick={onEnter}>Abrir inteligência Growdash</button>;
  const healthLabel = health === "healthy" ? "Em rota" : health === "attention" ? "Atenção operacional" : health === "critical" ? "Desvio de rota" : "Aguardando sinais reais";
  return <div className={`neural-command-core is-${health} ${expanded ? "is-expanded" : ""} ${entering ? "is-entering" : ""}`}><div ref={hostRef} className="neural-command-core-canvas" role="button" tabIndex={0} aria-label={expanded ? "Cérebro Growdash expandido" : "Entrar no cérebro Growdash"} aria-expanded={expanded} onClick={() => { if (!draggedRef.current) onEnter(); draggedRef.current = false; }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEnter(); } }} /><div className="neural-command-core-hud" aria-hidden="true"><b>GROWDASH</b><span>{entering ? "Sincronizando conexões…" : expanded ? "Núcleo operacional ativo" : `${healthLabel}${healthScore === null ? "" : ` · ${healthScore}%`}`}</span></div></div>;
}
