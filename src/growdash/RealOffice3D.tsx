import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Box, ChevronLeft, ChevronRight, MousePointer2, Presentation, Rotate3D, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type OfficeNpcStatus = "working" | "walking" | "free";

export type OfficeNpc = {
  id: string;
  name: string;
  role: string;
  specialty: string;
  color: string;
  status: OfficeNpcStatus;
};

type Props = {
  agents: OfficeNpc[];
  onSelectAgent: (id: string) => void;
  onStatusChange: (id: string, status: OfficeNpcStatus) => void;
};

type NpcObject = {
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  legs: THREE.Mesh[];
  base: THREE.Vector3;
};

const OFFICE_AGENT_LIMIT = 5;

export function RealOffice3D({ agents, onSelectAgent, onStatusChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const agentsRef = useRef(agents.slice(0, OFFICE_AGENT_LIMIT));
  const selectRef = useRef(onSelectAgent);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [helpOpen, setHelpOpen] = useState(true);

  useEffect(() => { agentsRef.current = agents.slice(0, OFFICE_AGENT_LIMIT); }, [agents]);
  useEffect(() => { selectRef.current = onSelectAgent; }, [onSelectAgent]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setWebglAvailable(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#102431");
    scene.fog = new THREE.Fog("#102431", 22, 48);
    const camera = new THREE.PerspectiveCamera(44, 1, .1, 100);
    const target = new THREE.Vector3(0, 1.4, 0);
    const intendedTarget = target.clone();
    const orbit = { azimuth: .66, polar: 1.03, radius: 25 };
    const updateCamera = () => {
      const sin = Math.sin(orbit.polar);
      camera.position.set(
        target.x + orbit.radius * sin * Math.sin(orbit.azimuth),
        target.y + orbit.radius * Math.cos(orbit.polar),
        target.z + orbit.radius * sin * Math.cos(orbit.azimuth),
      );
      camera.lookAt(target);
    };
    const focus = (position: THREE.Vector3, radius = 12) => {
      intendedTarget.copy(position);
      orbit.radius = THREE.MathUtils.clamp(radius, 11, 28);
    };
    updateCamera();

    const hemi = new THREE.HemisphereLight("#e8f8ff", "#203f4d", 2.25);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#ffffff", 3.8);
    key.position.set(-7, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
    scene.add(key);
    const rim = new THREE.PointLight("#63d9ff", 28, 22, 2);
    rim.position.set(0, 4.8, -5.6);
    scene.add(rim);
    const gold = new THREE.PointLight("#ffd873", 18, 16, 2);
    gold.position.set(-7, 2.5, 4);
    scene.add(gold);

    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3, castShadow = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const wallMaterial = new THREE.MeshStandardMaterial({ color: "#102837", roughness: .68, metalness: .32 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: "#1d607a", emissive: "#0a2735", emissiveIntensity: 1.2, roughness: .32, metalness: .72 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: "#1c3944", roughness: .38, metalness: .45 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: "#091017", roughness: .65, metalness: .45 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: "#13516a", emissive: "#0f5a78", emissiveIntensity: 1.5, roughness: .12, metalness: .55, transparent: true, opacity: .7 });
    const lightMaterial = new THREE.MeshStandardMaterial({ color: "#dfffff", emissive: "#83e9ff", emissiveIntensity: 4 });

    const occludingWalls: THREE.Mesh[] = [];
    const addOccludingWall = (geometry: THREE.BufferGeometry, position: THREE.Vector3) => {
      const material = wallMaterial.clone(); material.transparent = true; material.opacity = 1; material.depthWrite = true;
      const wall = addMesh(geometry, material, position, false); occludingWalls.push(wall); return wall;
    };
    addMesh(new THREE.BoxGeometry(25, .35, 18), floorMaterial, new THREE.Vector3(0, -.2, 0), false);
    // No ceiling: the whole office is visible from an isometric/top-down view.
    addOccludingWall(new THREE.BoxGeometry(25, 6.2, .28), new THREE.Vector3(0, 2.8, -8.9));
    addOccludingWall(new THREE.BoxGeometry(.28, 6.2, 18), new THREE.Vector3(-12.35, 2.8, 0));
    addOccludingWall(new THREE.BoxGeometry(.28, 6.2, 18), new THREE.Vector3(12.35, 2.8, 0));

    // The partitions make this an office with rooms, rather than a single decorative box.
    // Door gaps are intentionally left open so the camera keeps visual continuity between zones.
    addOccludingWall(new THREE.BoxGeometry(6.4, 3.25, .18), new THREE.Vector3(-8.9, 1.63, 1.55));
    addOccludingWall(new THREE.BoxGeometry(.18, 3.25, 4.2), new THREE.Vector3(-5.8, 1.63, 5.35));
    addOccludingWall(new THREE.BoxGeometry(5.8, 3.25, .18), new THREE.Vector3(8.7, 1.63, 1.55));
    addOccludingWall(new THREE.BoxGeometry(.18, 3.25, 4.2), new THREE.Vector3(5.9, 1.63, 5.35));

    for (let x = -10; x <= 10; x += 4) {
      addMesh(new THREE.BoxGeometry(.08, .03, 17), trimMaterial, new THREE.Vector3(x, .02, 0), false);
    }
    for (let z = -7; z <= 7; z += 4) {
      addMesh(new THREE.BoxGeometry(24, .03, .08), trimMaterial, new THREE.Vector3(0, .02, z), false);
    }
    for (const x of [-7, 0, 7]) {
      const fixture = addMesh(new THREE.BoxGeometry(2.7, .12, .56), lightMaterial, new THREE.Vector3(x, 5.55, -1.5), false);
      fixture.rotation.z = .08;
    }

    const skyline = new THREE.Group();
    for (let x = -7.5; x <= 7.5; x += 1.25) {
      const height = 1 + ((Math.round((x + 9) * 7) % 4) * .62);
      const building = new THREE.Mesh(new THREE.BoxGeometry(.72, height, .35), new THREE.MeshStandardMaterial({ color: "#0b2537", emissive: "#0b4160", emissiveIntensity: .8, roughness: .5 }));
      building.position.set(x, height / 2 + .6, -8.66);
      skyline.add(building);
    }
    scene.add(skyline);
    const windowFrame = new THREE.Group();
    const frameMaterial = new THREE.MeshStandardMaterial({ color: "#244b5e", metalness: .8, roughness: .3 });
    const windowPane = new THREE.Mesh(new THREE.BoxGeometry(10.8, 3.2, .1), glassMaterial);
    windowPane.position.set(0, 3.25, -8.64); windowFrame.add(windowPane);
    for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.45, .16), frameMaterial); bar.position.set(x, 3.25, -8.5); windowFrame.add(bar); }
    scene.add(windowFrame);

    const deskPositions = [new THREE.Vector3(-7.8, 0, -3.9), new THREE.Vector3(-2.6, 0, -3.9), new THREE.Vector3(2.6, 0, -3.9), new THREE.Vector3(-4.5, 0, 4.1), new THREE.Vector3(4.5, 0, 4.1)];
    const workAreas = ["TRÁFEGO", "FINANÇAS", "COMERCIAL", "SEO", "FUNIL"];
    const monitorBars: THREE.Mesh[] = [];
    const createDesk = (position: THREE.Vector3, accent: string, index: number) => {
      const group = new THREE.Group(); group.position.copy(position); group.rotation.y = index < 3 ? Math.PI : 0;
      const deskMaterial = new THREE.MeshStandardMaterial({ color: "#183847", roughness: .38, metalness: .68 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, .2, 1.45), deskMaterial); top.position.y = 1.48; top.castShadow = true; top.receiveShadow = true; group.add(top);
      for (const [x, z] of [[-1.35, -.52], [1.35, -.52], [-1.35, .52], [1.35, .52]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.13, 1.48, .13), darkMaterial); leg.position.set(x, .74, z); leg.castShadow = true; group.add(leg); }
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.35, .86, .1), new THREE.MeshStandardMaterial({ color: "#153a4c", emissive: accent, emissiveIntensity: 1.45, metalness: .55, roughness: .15 })); screen.position.set(0, 2.08, -.38); group.add(screen);
      for (let line = 0; line < 3; line++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.7 + line * .12, .055, .025), new THREE.MeshBasicMaterial({ color: "#e7fbff" })); bar.position.set(-.17 + line * .08, 2.25 - line * .2, -.445); group.add(bar); monitorBars.push(bar); }
      const stem = new THREE.Mesh(new THREE.BoxGeometry(.12, .6, .12), darkMaterial); stem.position.set(0, 1.72, -.38); group.add(stem);
      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, .42), darkMaterial); keyboard.position.set(0, 1.62, .28); group.add(keyboard);
      // Full office chair: seat, high back, arm rests and five-star base remain
      // legible from the isometric camera instead of looking like a thin slab.
      const chairMaterial = new THREE.MeshStandardMaterial({ color: "#315a6b", roughness: .45, metalness: .48 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.18, .18, 1.05), chairMaterial); seat.position.set(0, .82, 1.12); seat.castShadow = true; group.add(seat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.25, .2), chairMaterial); chairBack.position.set(0, 1.48, 1.56); chairBack.rotation.x = -.15; chairBack.castShadow = true; group.add(chairBack);
      for (const armX of [-.64, .64]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, .5, .62), chairMaterial); arm.position.set(armX, 1.12, 1.1); group.add(arm); }
      const chairStem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .72, 10), darkMaterial); chairStem.position.set(0, .38, 1.12); group.add(chairStem);
      for (let spoke = 0; spoke < 5; spoke++) { const angle = (spoke / 5) * Math.PI * 2; const base = new THREE.Mesh(new THREE.BoxGeometry(.72, .07, .1), darkMaterial); base.position.set(Math.cos(angle) * .3, .07, 1.12 + Math.sin(angle) * .3); base.rotation.y = -angle; group.add(base); }
      const labelCanvas = document.createElement("canvas"); labelCanvas.width = 512; labelCanvas.height = 128; const context = labelCanvas.getContext("2d");
      if (context) { context.clearRect(0, 0, 512, 128); context.fillStyle = "rgba(4, 18, 27, .9)"; context.fillRect(0, 0, 512, 128); context.fillStyle = accent; context.fillRect(0, 0, 10, 128); context.fillStyle = "#e9fbff"; context.font = "bold 48px Arial"; context.fillText(workAreas[index], 32, 75); }
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthTest: false })); label.scale.set(2.2, .55, 1); label.position.set(0, 2.9, .15); group.add(label);
      const deskLight = new THREE.PointLight(accent, 2.4, 4.5, 2); deskLight.position.set(0, 2.2, .15); group.add(deskLight);
      scene.add(group);
    };
    agentsRef.current.forEach((agent, index) => createDesk(deskPositions[index], agent.color, index));

    const lounge = new THREE.Group(); lounge.position.set(-8.2, 0, 5.6);
    const couchMaterial = new THREE.MeshStandardMaterial({ color: "#1c5060", roughness: .64, metalness: .25 });
    const couch = new THREE.Mesh(new THREE.BoxGeometry(3.7, .72, 1.35), couchMaterial); couch.position.y = .72; couch.castShadow = true; lounge.add(couch);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.25, .25), couchMaterial); back.position.set(0, 1.3, .54); lounge.add(back);
    scene.add(lounge);
    const meeting = new THREE.Group(); meeting.position.set(-8.85, 0, 5.45);
    const meetingTop = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .16, 32), new THREE.MeshStandardMaterial({ color: "#214958", roughness: .35, metalness: .72 })); meetingTop.scale.z = .58; meetingTop.position.y = 1.25; meetingTop.castShadow = true; meeting.add(meetingTop);
    const meetingBase = new THREE.Mesh(new THREE.CylinderGeometry(.42, .62, 1.2, 16), darkMaterial); meetingBase.position.y = .6; meeting.add(meetingBase);
    for (let seat = 0; seat < 5; seat++) { const angle = (seat / 5) * Math.PI * 2; const chair = new THREE.Mesh(new THREE.BoxGeometry(.72, .92, .68), couchMaterial); chair.position.set(Math.cos(angle) * 2.25, .65, Math.sin(angle) * 1.28); chair.rotation.y = -angle; chair.castShadow = true; meeting.add(chair); }
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.9, .09), new THREE.MeshStandardMaterial({ color: "#103f50", emissive: "#11657d", emissiveIntensity: .85, roughness: .22, metalness: .5 })); board.position.set(0, 2.75, -2.2); meeting.add(board); scene.add(meeting);
    const ceoOffice = new THREE.Group(); ceoOffice.position.set(8.75, 0, 5.25);
    const executiveDesk = new THREE.Mesh(new THREE.BoxGeometry(3.6, .24, 1.7), new THREE.MeshStandardMaterial({ color: "#62491d", roughness: .36, metalness: .58 })); executiveDesk.position.y = 1.35; executiveDesk.castShadow = true; ceoOffice.add(executiveDesk);
    const executiveMonitor = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, .1), new THREE.MeshStandardMaterial({ color: "#071b25", emissive: "#d8a83f", emissiveIntensity: .75 })); executiveMonitor.position.set(0, 2.05, -.35); ceoOffice.add(executiveMonitor);
    const bookshelf = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.6, .42), darkMaterial); bookshelf.position.set(0, 1.3, 2.35); ceoOffice.add(bookshelf); scene.add(ceoOffice);
    const plant = new THREE.Group(); plant.position.set(9.5, 0, 5.8); const pot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .54, .62, 14), new THREE.MeshStandardMaterial({ color: "#a67541", roughness: .8 })); pot.position.y = .31; plant.add(pot); for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 8), new THREE.MeshStandardMaterial({ color: "#1c754f", roughness: .75 })); leaf.position.set(Math.sin(i * .9) * .43, 1.05 + (i % 2) * .23, Math.cos(i * .9) * .43); leaf.scale.set(.55, 1.6, .55); plant.add(leaf); } scene.add(plant);

    const npcObjects = new Map<string, NpcObject>();
    const pickables: THREE.Object3D[] = [];
    const createNpc = (agent: OfficeNpc, index: number) => {
      const root = new THREE.Group(); root.name = agent.id;
      // The working pose starts on the actual chair axis, not inside the desk.
      root.position.copy(deskPositions[index]).add(new THREE.Vector3(0, 0, index < 3 ? -1.02 : 1.02));
      const body = new THREE.Group(); body.position.y = 1.15; root.add(body);
      const shirt = new THREE.Mesh(new THREE.CylinderGeometry(.35, .43, .9, 14), new THREE.MeshStandardMaterial({ color: agent.color, roughness: .55, metalness: .15 })); shirt.castShadow = true; body.add(shirt);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.12, .13, .18, 10), new THREE.MeshStandardMaterial({ color: "#d99872", roughness: .8 })); neck.position.y = .54; body.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.33, 18, 14), new THREE.MeshStandardMaterial({ color: "#dd9d76", roughness: .72 })); head.position.y = .82; head.scale.set(.9, 1.08, .88); head.castShadow = true; body.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * .58), new THREE.MeshStandardMaterial({ color: "#1b1720", roughness: .82 })); hair.position.set(0, .94, .02); hair.scale.set(1.02, .75, 1); body.add(hair);
      const leftArm = new THREE.Group(); leftArm.position.set(-.42, .32, 0); const leftMesh = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .52, 4, 10), new THREE.MeshStandardMaterial({ color: agent.color, roughness: .6 })); leftMesh.rotation.z = -.45; leftMesh.position.y = -.28; leftArm.add(leftMesh); body.add(leftArm);
      const rightArm = new THREE.Group(); rightArm.position.set(.42, .32, 0); const rightMesh = leftMesh.clone(); rightMesh.rotation.z = .45; rightMesh.position.y = -.28; rightArm.add(rightMesh); body.add(rightArm);
      const legMaterial = new THREE.MeshStandardMaterial({ color: "#111d29", roughness: .72 }); const legs: THREE.Mesh[] = [];
      for (const x of [-.16, .16]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .65, .19), legMaterial); leg.position.set(x, -.7, 0); body.add(leg); legs.push(leg); }
      const halo = new THREE.Mesh(new THREE.RingGeometry(.42, .58, 32), new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: .78, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = .02; root.add(halo);
      root.traverse((object) => { if (object instanceof THREE.Mesh) { object.userData.npcId = agent.id; pickables.push(object); } });
      scene.add(root); npcObjects.set(agent.id, { root, body, leftArm, rightArm, legs, base: root.position.clone() });
    };
    agentsRef.current.forEach(createNpc);

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const mouseFloorPoint = new THREE.Vector3();
    let pointerDown: { x: number; y: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => { pointerDown = { x: event.clientX, y: event.clientY, moved: false }; renderer.domElement.setPointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x; const dy = event.clientY - pointerDown.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) pointerDown.moved = true;
      if (event.buttons === 2) { intendedTarget.x -= dx * .018; intendedTarget.z += dy * .018; }
      else { orbit.azimuth -= dx * .008; orbit.polar = THREE.MathUtils.clamp(orbit.polar + dy * .007, .45, 1.45); }
      pointerDown.x = event.clientX; pointerDown.y = event.clientY; updateCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      if (!pointerDown.moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const selected = raycaster.intersectObjects(pickables, false).find((hit) => hit.object.userData.npcId);
        const id = selected?.object.userData.npcId as string | undefined;
        if (id) { setSelectedId(id); selectRef.current(id); const npc = npcObjects.get(id); if (npc) focus(npc.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 8.8); }
      }
      pointerDown = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const previousRadius = orbit.radius;
      const nextRadius = THREE.MathUtils.clamp(previousRadius + event.deltaY * .014, 9, 34);
      // Cursor-anchored dolly: the floor point under the pointer stays under
      // the pointer while zooming, rather than zooming only around screen center.
      if (raycaster.ray.intersectPlane(floorPlane, mouseFloorPoint)) {
        const anchorShift = 1 - nextRadius / previousRadius;
        intendedTarget.addScaledVector(mouseFloorPoint.clone().sub(intendedTarget), anchorShift);
      }
      orbit.radius = nextRadius; updateCamera();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") orbit.azimuth += .16;
      if (event.key === "ArrowRight") orbit.azimuth -= .16;
      if (event.key === "ArrowUp") orbit.polar = THREE.MathUtils.clamp(orbit.polar - .1, .45, 1.45);
      if (event.key === "ArrowDown") orbit.polar = THREE.MathUtils.clamp(orbit.polar + .1, .45, 1.45);
      if (event.key === "+") orbit.radius = Math.max(11, orbit.radius - 1);
      if (event.key === "-") orbit.radius = Math.min(28, orbit.radius + 1);
      const agentIndex = Number(event.key) - 1;
      if (agentIndex >= 0 && agentIndex < agentsRef.current.length) { const npc = npcObjects.get(agentsRef.current[agentIndex].id); if (npc) focus(npc.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 8.8); }
      if (event.key.toLowerCase() === "r") focus(new THREE.Vector3(-8.85, 1.1, 5.45), 9.5);
      if (event.key.toLowerCase() === "c") focus(new THREE.Vector3(8.75, 1.1, 5.25), 9.5);
      if (event.key.toLowerCase() === "g") { orbit.polar = .48; focus(new THREE.Vector3(0, 0, 0), 23); }
      if (event.key === "Escape") { setSelectedId(null); focus(new THREE.Vector3(0, 1.4, 0), 19); }
      updateCamera();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown); renderer.domElement.addEventListener("pointermove", onPointerMove); renderer.domElement.addEventListener("pointerup", onPointerUp); renderer.domElement.addEventListener("wheel", onWheel, { passive: false }); renderer.domElement.addEventListener("keydown", onKeyDown);

    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
    const clock = new THREE.Clock(); let frame = 0; let visible = true;
    const visibility = () => { visible = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", visibility);
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!visible) return;
      const elapsed = clock.getElapsedTime();
      target.lerp(intendedTarget, .09); updateCamera();
      // Sims-style cutaway: only the wall currently between the camera and the
      // operational floor fades, preserving the room while never hiding an NPC.
      const sightLine = target.clone().sub(camera.position);
      const sightDistance = sightLine.length();
      raycaster.set(camera.position, sightLine.normalize());
      const hiddenWalls = new Set(raycaster.intersectObjects(occludingWalls, false)
        .filter((hit) => hit.distance < sightDistance - .4).map((hit) => hit.object));
      for (const wall of occludingWalls) {
        const material = wall.material as THREE.MeshStandardMaterial;
        const opacity = hiddenWalls.has(wall) ? .12 : 1;
        material.opacity = THREE.MathUtils.lerp(material.opacity, opacity, .16);
        material.depthWrite = material.opacity > .97;
      }
      monitorBars.forEach((bar, index) => { bar.scale.x = .75 + Math.sin(elapsed * 3 + index) * .25; });
      for (const [index, agent] of agentsRef.current.entries()) {
        const npc = npcObjects.get(agent.id); if (!npc) continue;
        const phase = elapsed * .9 + index * .7;
        if (agent.status === "walking") { npc.root.position.set(npc.base.x + Math.sin(phase) * 1.15, npc.base.y, npc.base.z + Math.cos(phase * .8) * .86); npc.root.rotation.y = Math.atan2(Math.cos(phase), -Math.sin(phase * .8)); npc.body.position.y = 1.15 + Math.abs(Math.sin(phase * 2)) * .07; npc.leftArm.rotation.x = Math.sin(phase * 2) * .55; npc.rightArm.rotation.x = -Math.sin(phase * 2) * .55; npc.legs.forEach((leg, legIndex) => { leg.rotation.x = Math.sin(phase * 2 + legIndex * Math.PI) * .45; leg.position.z = 0; }); }
        else if (agent.status === "free") { npc.root.position.lerp(new THREE.Vector3(-7.6 + index * .12, 0, 5.0 + index * .08), .025); npc.root.rotation.y = .4; npc.body.position.y = 1.13 + Math.sin(phase) * .025; npc.leftArm.rotation.x = .18; npc.rightArm.rotation.x = -.18; npc.legs.forEach((leg) => { leg.rotation.x = 0; leg.position.z = 0; }); }
        else {
          // Working means seated: lower the torso onto the chair and keep both
          // forearms over the keyboard. Walking/free use the standing pose.
          npc.root.position.lerp(npc.base, .08); npc.root.rotation.y = index < 3 ? Math.PI : 0;
          npc.body.position.y = .72 + Math.sin(phase) * .012;
          npc.leftArm.rotation.x = -.72 + Math.sin(phase * 5) * .18;
          npc.rightArm.rotation.x = -.72 - Math.sin(phase * 5) * .18;
          npc.legs.forEach((leg) => { leg.rotation.x = Math.PI / 2; leg.position.z = .22; });
        }
      }
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibility); resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown); renderer.domElement.removeEventListener("pointermove", onPointerMove); renderer.domElement.removeEventListener("pointerup", onPointerUp); renderer.domElement.removeEventListener("wheel", onWheel); renderer.domElement.removeEventListener("keydown", onKeyDown);
      scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const displayedAgents = agents.slice(0, OFFICE_AGENT_LIMIT);
  const selected = displayedAgents.find((agent) => agent.id === selectedId);
  return <section className="real-office-shell" aria-label="Escritório 3D Growdash Life">
    <div ref={hostRef} className="real-office-canvas" tabIndex={0} aria-label="Cena 3D navegável. Arraste para orbitar, arraste com o botão direito para mover, use a roda para aproximar e as setas do teclado para mover a câmera." onContextMenu={(event) => event.preventDefault()} />
    {!webglAvailable && <div className="real-office-fallback">Seu navegador não liberou WebGL. Atualize o navegador ou habilite a aceleração gráfica para abrir a cena 3D.</div>}
    <header className="real-office-hud"><span><Box /> GROWdash LIFE · ESCRITÓRIO 3D</span><small><Rotate3D /> 360° real · reunião, CEO e operações</small></header>
    <div className="real-office-camera" role="group" aria-label="Câmera da cena"><ChevronLeft /><span>Arraste para orbitar</span><ChevronRight /></div>
    <button type="button" className="real-office-help" onClick={() => setHelpOpen((value) => !value)} aria-expanded={helpOpen}><MousePointer2 /> Como navegar</button>
    {helpOpen && <aside className="real-office-help-card"><b>Uma cena, não uma imagem</b><span>O chão, paredes, teto, mesas, sala de reunião e escritório executivo possuem profundidade. Clique em um NPC para focar sua operação; 1–5 focam pessoas, R reunião, C direção e G abre a visão geral.</span></aside>}
    <aside className="real-office-roster" aria-label="NPCs do escritório">{displayedAgents.map((agent) => <button key={agent.id} type="button" className={cn(selectedId === agent.id && "is-selected")} onClick={() => { setSelectedId(agent.id); onSelectAgent(agent.id); }}><i style={{ background: agent.color }} /><span><b>{agent.name}</b><small>{agent.status === "working" ? "Trabalhando" : agent.status === "walking" ? "Caminhando" : "Em pausa"}</small></span></button>)}</aside>
    <footer className="real-office-controls"><div><UsersRound /><span><b>5 NPCs ativos</b><small>Selecione um agente e defina sua atividade.</small></span></div><div className="real-office-zone-guide"><Presentation /><span>Sala de reunião</span><UserRound /><span>Diretoria</span></div>{displayedAgents.map((agent) => <div className="real-office-agent-control" key={agent.id}><span style={{ "--npc-color": agent.color } as React.CSSProperties}>{agent.name}</span><button type="button" className={cn(agent.status === "working" && "is-active")} onClick={() => onStatusChange(agent.id, "working")}>Trabalhar</button><button type="button" className={cn(agent.status === "walking" && "is-active")} onClick={() => onStatusChange(agent.id, "walking")}>Andar</button><button type="button" className={cn(agent.status === "free" && "is-active")} onClick={() => onStatusChange(agent.id, "free")}>Pausa</button></div>)}</footer>
    {selected && <div className="real-office-selection"><i style={{ background: selected.color }} /><span><b>{selected.name}</b><small>{selected.role} · {selected.specialty}</small></span></div>}
  </section>;
}
