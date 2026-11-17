import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface CosmicLaunchScene3DProps {
  launching?: boolean;
}

/**
 * Cena 3D Cinematográfica em WebGL (Three.js)
 * - Foguete metálico 3D detalhado com fuselagem aerodinâmica, aletas e cabine
 * - Jato de fogo e plasma emissivo na propulsão
 * - Sistema de faíscas incandescentes em tempo real (partículas 3D)
 * - Nuvens de fumaça volumétrica ondulando na base
 * - Iluminação cinematográfica de alta voltagem (key light ciano, rim light azul profundo, flare volumétrico)
 * - Campo estelar profundo com nebulosa cósmica pulsante
 * - Efeito de paralaxe suave com o movimento do mouse
 */
export function CosmicLaunchScene3D({ launching = false }: CosmicLaunchScene3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

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
      setWebglSupported(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.018);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(-1.8, 0.4, 9.2);
    camera.lookAt(new THREE.Vector3(-0.6, 0.8, 0));

    // -------------------------------------------------------------------------
    // 1. ILUMINAÇÃO CINEMATOGRÁFICA DE ALTA VOLTAGEM
    // -------------------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x0a1931, 1.8);
    scene.add(ambientLight);

    // Key light (luz principal de cinema azul ciano vindo do jato)
    const thrusterKeyLight = new THREE.PointLight(0x00d4ff, 28, 14, 1.8);
    thrusterKeyLight.position.set(-0.8, -0.6, 1.2);
    scene.add(thrusterKeyLight);

    // Rim light (luz de recorte de cinema azul celeste vindo da galáxia)
    const galaxyRimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
    galaxyRimLight.position.set(5, 6, -3);
    scene.add(galaxyRimLight);

    // Fill light suave vindo de baixo
    const smokeGlowLight = new THREE.PointLight(0x0284c7, 16, 10, 2);
    smokeGlowLight.position.set(-1.2, -2.4, 2);
    scene.add(smokeGlowLight);

    // -------------------------------------------------------------------------
    // 2. FOGUETE 3D COM FUSELAGEM METÁLICA E CABINE
    // -------------------------------------------------------------------------
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(-1.5, 1.1, 0);
    scene.add(rocketGroup);

    // Materiais metálicos de cinema com reflexos PBR
    const rocketBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f274a,
      metalness: 0.82,
      roughness: 0.22,
      emissive: 0x021329,
      emissiveIntensity: 0.35,
    });

    const rocketNoseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e4976,
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
    });

    const rocketFinMaterial = new THREE.MeshStandardMaterial({
      color: 0x071b36,
      metalness: 0.88,
      roughness: 0.3,
    });

    const cockpitGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.6,
      thickness: 0.4,
    });

    const cockpitRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    // Corpo cilíndrico aerodinâmico
    const bodyGeometry = new THREE.CylinderGeometry(0.55, 0.65, 2.2, 48);
    const bodyMesh = new THREE.Mesh(bodyGeometry, rocketBodyMaterial);
    rocketGroup.add(bodyMesh);

    // Nariz parabólico / ogiva aerodinâmica
    const noseGeometry = new THREE.ConeGeometry(0.55, 1.35, 48);
    const noseMesh = new THREE.Mesh(noseGeometry, rocketNoseMaterial);
    noseMesh.position.y = 1.775;
    rocketGroup.add(noseMesh);

    // Ponta metálica brilhante
    const tipGeometry = new THREE.SphereGeometry(0.12, 24, 24);
    const tipMesh = new THREE.Mesh(tipGeometry, cockpitRimMaterial);
    tipMesh.position.y = 2.45;
    rocketGroup.add(tipMesh);

    // Cabine / vigia principal circular luminosa
    const cockpitRingGeo = new THREE.TorusGeometry(0.24, 0.045, 16, 36);
    const cockpitRing = new THREE.Mesh(cockpitRingGeo, cockpitRimMaterial);
    cockpitRing.position.set(0, 0.62, 0.54);
    rocketGroup.add(cockpitRing);

    const cockpitGlassGeo = new THREE.CircleGeometry(0.22, 32);
    const cockpitGlass = new THREE.Mesh(cockpitGlassGeo, cockpitGlassMaterial);
    cockpitGlass.position.set(0, 0.62, 0.55);
    rocketGroup.add(cockpitGlass);

    // Vigia secundária menor
    const smallWindowGeo = new THREE.CircleGeometry(0.12, 24);
    const smallWindow = new THREE.Mesh(smallWindowGeo, cockpitGlassMaterial);
    smallWindow.position.set(0, 0.08, 0.58);
    rocketGroup.add(smallWindow);

    // Aletas estilizadas em 4 direções
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.65, -0.65);
    finShape.lineTo(0.55, -1.05);
    finShape.lineTo(0, -0.75);
    finShape.closePath();

    const finExtrudeSettings = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 };
    const finGeometry = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);

    for (let i = 0; i < 4; i++) {
      const finMesh = new THREE.Mesh(finGeometry, rocketFinMaterial);
      const angle = (i * Math.PI) / 2;
      finMesh.rotation.y = angle;
      finMesh.position.set(Math.sin(angle) * 0.48, -0.4, Math.cos(angle) * 0.48);
      rocketGroup.add(finMesh);
    }

    // Bocal da turbina (exhaust nozzle)
    const nozzleGeometry = new THREE.CylinderGeometry(0.42, 0.56, 0.45, 32, 1, true);
    const nozzleMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1122,
      metalness: 0.95,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
    const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
    nozzle.position.y = -1.25;
    rocketGroup.add(nozzle);

    // -------------------------------------------------------------------------
    // 3. JATO DE FOGO E PLASMA INCANDESCENTE (THRUSTER FLAME)
    // -------------------------------------------------------------------------
    const flameCoreGeo = new THREE.ConeGeometry(0.32, 1.8, 32);
    flameCoreGeo.rotateX(Math.PI);
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    flameCore.position.y = -2.25;
    rocketGroup.add(flameCore);

    const flameOuterGeo = new THREE.ConeGeometry(0.55, 3.2, 32);
    flameOuterGeo.rotateX(Math.PI);
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
    flameOuter.position.y = -2.95;
    rocketGroup.add(flameOuter);

    const flameHaloGeo = new THREE.ConeGeometry(0.85, 4.2, 24);
    flameHaloGeo.rotateX(Math.PI);
    const flameHaloMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    const flameHalo = new THREE.Mesh(flameHaloGeo, flameHaloMat);
    flameHalo.position.y = -3.4;
    rocketGroup.add(flameHalo);

    // -------------------------------------------------------------------------
    // 4. SISTEMA DE FAÍSCAS E PARTÍCULAS EM TEMPO REAL
    // -------------------------------------------------------------------------
    const sparkCount = 380;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities: { x: number; y: number; z: number; life: number; maxLife: number }[] = [];

    for (let i = 0; i < sparkCount; i++) {
      const i3 = i * 3;
      sparkPositions[i3] = (Math.random() - 0.5) * 0.6;
      sparkPositions[i3 + 1] = -1.5 - Math.random() * 3.5;
      sparkPositions[i3 + 2] = (Math.random() - 0.5) * 0.6;
      sparkVelocities.push({
        x: (Math.random() - 0.5) * 0.04,
        y: -(0.06 + Math.random() * 0.08),
        z: (Math.random() - 0.5) * 0.04,
        life: Math.random(),
        maxLife: 1,
      });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.09,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
    rocketGroup.add(sparkParticles);

    // -------------------------------------------------------------------------
    // 5. NUVENS DE FUMAÇA VOLUMÉTRICA EM CAMADAS ONDULANDO NA BASE
    // -------------------------------------------------------------------------
    const smokeGroup = new THREE.Group();
    smokeGroup.position.set(-1.5, -2.6, 0.4);
    scene.add(smokeGroup);

    const smokeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      emissive: 0x021b3a,
      emissiveIntensity: 0.45,
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
      blending: THREE.NormalBlending,
    });

    const smokePuffs: { mesh: THREE.Mesh; seed: number; speed: number; baseScale: number }[] = [];
    const puffCount = 22;
    for (let i = 0; i < puffCount; i++) {
      const puffGeo = new THREE.DodecahedronGeometry(0.85 + Math.random() * 0.6, 2);
      const puff = new THREE.Mesh(puffGeo, smokeMaterial.clone());
      const angle = (i / puffCount) * Math.PI * 2;
      const radius = 0.6 + Math.random() * 1.8;
      puff.position.set(
        Math.cos(angle) * radius * 1.6,
        (Math.random() - 0.5) * 1.1,
        Math.sin(angle) * radius * 0.9
      );
      const scale = 0.8 + Math.random() * 0.8;
      puff.scale.set(scale, scale, scale);
      smokeGroup.add(puff);
      smokePuffs.push({
        mesh: puff,
        seed: Math.random() * 100,
        speed: 0.4 + Math.random() * 0.6,
        baseScale: scale,
      });
    }

    // -------------------------------------------------------------------------
    // 6. CAMPO ESTELAR E GALÁXIA ESPIRAL PROFUNDA
    // -------------------------------------------------------------------------
    const starCount = 1400;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const colorPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0x7dd3fc),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xa855f7),
      new THREE.Color(0x0284c7),
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const r = 25 + Math.random() * 65;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      starPositions[i3] = r * Math.cos(phi) * Math.cos(theta);
      starPositions[i3 + 1] = r * Math.sin(phi);
      starPositions[i3 + 2] = r * Math.cos(phi) * Math.sin(theta);

      const picked = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      starColors[i3] = picked.r;
      starColors[i3 + 1] = picked.g;
      starColors[i3 + 2] = picked.b;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Galáxia espiral no quadrante superior direito
    const galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(6.5, 4.2, -18);
    galaxyGroup.rotation.x = 0.85;
    galaxyGroup.rotation.z = -0.45;
    scene.add(galaxyGroup);

    const galaxyParticleCount = 800;
    const galaxyGeo = new THREE.BufferGeometry();
    const galaxyPos = new Float32Array(galaxyParticleCount * 3);
    const galaxyColors = new Float32Array(galaxyParticleCount * 3);

    for (let i = 0; i < galaxyParticleCount; i++) {
      const i3 = i * 3;
      const armAngle = (i % 2) * Math.PI;
      const dist = 0.5 + (i / galaxyParticleCount) * 5.2;
      const spiralAngle = dist * 1.35 + armAngle;
      galaxyPos[i3] = Math.cos(spiralAngle) * dist + (Math.random() - 0.5) * 0.45;
      galaxyPos[i3 + 1] = (Math.random() - 0.5) * 0.25;
      galaxyPos[i3 + 2] = Math.sin(spiralAngle) * dist + (Math.random() - 0.5) * 0.45;

      const t = dist / 5.2;
      galaxyColors[i3] = 0.4 + 0.6 * (1 - t);
      galaxyColors[i3 + 1] = 0.7 - 0.3 * t;
      galaxyColors[i3 + 2] = 0.95;
    }
    galaxyGeo.setAttribute("position", new THREE.BufferAttribute(galaxyPos, 3));
    galaxyGeo.setAttribute("color", new THREE.BufferAttribute(galaxyColors, 3));
    const galaxyMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const galaxyPoints = new THREE.Points(galaxyGeo, galaxyMat);
    galaxyGroup.add(galaxyPoints);

    // -------------------------------------------------------------------------
    // 7. INTERATIVIDADE COM MOUSE / PARALAXE
    // -------------------------------------------------------------------------
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      mouse.targetX = relX * 0.8;
      mouse.targetY = -relY * 0.5;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // -------------------------------------------------------------------------
    // 8. LOOP DE ANIMAÇÃO CINEMATOGRÁFICA EM 60 FPS
    // -------------------------------------------------------------------------
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const engineVibration = (Math.sin(elapsedTime * 65) + Math.cos(elapsedTime * 85)) * 0.005;
      const hoverFloat = Math.sin(elapsedTime * 1.8) * 0.06;

      rocketGroup.position.y = 1.1 + hoverFloat + engineVibration;
      rocketGroup.position.x = -1.5 + mouse.x * 0.3;
      rocketGroup.rotation.z = Math.sin(elapsedTime * 1.4) * 0.015 - mouse.x * 0.04;
      rocketGroup.rotation.x = mouse.y * 0.04;

      const flameScalePulse = 1 + Math.sin(elapsedTime * 28) * 0.08 + Math.cos(elapsedTime * 42) * 0.05;
      flameCore.scale.set(1 + Math.sin(elapsedTime * 35) * 0.1, flameScalePulse, 1);
      flameOuter.scale.set(1 + Math.sin(elapsedTime * 22) * 0.12, flameScalePulse * 1.05, 1);
      flameHalo.scale.set(1 + Math.cos(elapsedTime * 18) * 0.15, flameScalePulse, 1);

      thrusterKeyLight.intensity = 26 + Math.sin(elapsedTime * 32) * 8;
      smokeGlowLight.intensity = 14 + Math.cos(elapsedTime * 24) * 5;

      const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sparkCount; i++) {
        const i3 = i * 3;
        const vel = sparkVelocities[i];
        posAttr.array[i3] += vel.x + (Math.random() - 0.5) * 0.01;
        posAttr.array[i3 + 1] += vel.y;
        posAttr.array[i3 + 2] += vel.z + (Math.random() - 0.5) * 0.01;

        if (posAttr.array[i3 + 1] < -5.5) {
          posAttr.array[i3] = (Math.random() - 0.5) * 0.4;
          posAttr.array[i3 + 1] = -1.35;
          posAttr.array[i3 + 2] = (Math.random() - 0.5) * 0.4;
        }
      }
      posAttr.needsUpdate = true;

      for (const puff of smokePuffs) {
        const s = puff.baseScale * (1 + Math.sin(elapsedTime * puff.speed + puff.seed) * 0.14);
        puff.mesh.scale.set(s, s, s);
        puff.mesh.rotation.y = elapsedTime * 0.15 * puff.speed + puff.seed;
        puff.mesh.rotation.z = Math.sin(elapsedTime * 0.2 + puff.seed) * 0.1;
      }

      starField.rotation.y = elapsedTime * 0.012;
      galaxyGroup.rotation.y = elapsedTime * 0.04;

      if (launching) {
        rocketGroup.position.y += 0.22;
        flameOuter.scale.y += 0.08;
        camera.position.z += 0.08;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [launching]);

  if (!webglSupported) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    />
  );
}
