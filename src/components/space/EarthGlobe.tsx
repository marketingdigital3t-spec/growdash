import { useEffect, useRef } from "react";
import * as THREE from "three";
import earthTexture from "@/assets/growth/earth-2k-web.jpg";

interface EarthGlobeProps {
  /** Called after a WebGL renderer is ready so the CSS fallback can be dimmed. */
  onReady?: () => void;
}

const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform vec3 cameraPositionWorld;
  uniform vec3 atmosphereColor;

  void main() {
    vec3 viewDirection = normalize(cameraPositionWorld - vWorldPosition);
    float rim = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 3.2);
    gl_FragColor = vec4(atmosphereColor, rim * 0.92);
  }
`;

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && "isTexture" in value) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(disposeMaterial);
  });
}

/** A textured, slowly rotating Earth with a Fresnel atmosphere. */
export function EarthGlobe({ onReady }: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
      });
    } catch {
      return;
    }

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    onReady?.();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.08, 5.9);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x12345b, 0.55));
    const keyLight = new THREE.DirectionalLight(0xb9ecff, 3.4);
    keyLight.position.set(-4.5, 2.2, 5.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x087dff, 2.1);
    rimLight.position.set(4, -1, -4);
    scene.add(rimLight);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.z = -0.08;
    scene.add(globeGroup);

    const texture = new THREE.TextureLoader().load(
      earthTexture,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      },
      undefined,
      () => {
        // Keep the WebGL shell alive; the CSS planet remains the visual fallback.
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;

    const globeGeometry = new THREE.SphereGeometry(2.22, 96, 64);
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0x9bdcff,
      roughness: 0.82,
      metalness: 0.04,
    });
    globeGroup.add(new THREE.Mesh(globeGeometry, globeMaterial));

    const atmosphereGeometry = new THREE.SphereGeometry(2.34, 64, 48);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX_SHADER,
      fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
      uniforms: {
        cameraPositionWorld: { value: camera.position.clone() },
        atmosphereColor: { value: new THREE.Color(0x38bdf8) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

    let visible = true;
    let animationFrame = 0;
    let lastTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      atmosphereMaterial.uniforms.cameraPositionWorld.value.copy(camera.position);
      renderer.render(scene, camera);
    };

    const animate = (time: number) => {
      animationFrame = 0;
      if (!visible || document.hidden) return;
      if (lastTime === 0) lastTime = time;
      globeGroup.rotation.y += Math.min(time - lastTime, 100) * 0.00012;
      lastTime = time;
      render();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const scheduleAnimation = () => {
      if (!reducedMotion && visible && !document.hidden && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
      scheduleAnimation();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (visible) {
        scheduleAnimation();
      }
    }, { threshold: 0.01 });

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
      if (reducedMotion) render();
    });

    observer.observe(container);
    resizeObserver.observe(container);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    render();
    scheduleAnimation();

    return () => {
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady]);

  return (
    <div
      ref={containerRef}
      className="space-phase-earth-globe"
      aria-hidden="true"
      style={{
        position: "absolute",
        right: "clamp(-2rem, 2vw, 2rem)",
        top: "clamp(4rem, 9vh, 8rem)",
        width: "min(54vw, 760px)",
        height: "min(54vw, 760px)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
