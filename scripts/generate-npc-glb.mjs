import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter uses FileReader for Blob conversion in browsers. This small
// Node implementation preserves that public browser contract for asset builds.
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }).catch((error) => { this.onerror?.(error); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    }).catch((error) => { this.onerror?.(error); });
  }
};

const material = (color, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04, flatShading: false });
const skin = material("#d99c7c", 0.78);
const pink = material("#d95489", 0.64);
const pinkDark = material("#9d285d", 0.7);
const hair = material("#211c23", 0.82);
const shoe = material("#17191d", 0.7);
const white = material("#f2ebec", 0.58);

const root = new THREE.Group();
root.name = "Growdash NPC · Aurora";
root.userData = { role: "Operações", source: "Growdash original procedural asset" };

const add = (geometry, meshMaterial, position, scale = [1, 1, 1], rotation = [0, 0, 0], name = "") => {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
};

// Head, hair cap and a low-poly ponytail give an identifiable silhouette from
// every camera angle while preserving a compact runtime asset.
add(new THREE.SphereGeometry(0.31, 20, 16), skin, [0, 2.36, 0], [0.92, 1.08, 0.9], [0, 0, 0], "Head");
add(new THREE.SphereGeometry(0.325, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, [0, 2.47, 0.015], [1.02, 0.92, 1.03], [0, 0, 0], "Hair cap");
add(new THREE.SphereGeometry(0.2, 16, 12), hair, [0.13, 2.24, 0.25], [0.85, 1.5, 0.75], [0.18, 0, -0.18], "Ponytail");
add(new THREE.CylinderGeometry(0.1, 0.12, 0.15, 12), skin, [0, 2.05, 0], [1, 1, 1], [0, 0, 0], "Neck");

// A fitted torso and flared dress make the model close in spirit to the
// supplied reference without copying any third-party mesh or texture.
add(new THREE.CylinderGeometry(0.28, 0.36, 0.55, 16), pink, [0, 1.72, 0], [1, 1, 0.83], [0, 0, 0], "Dress bodice");
add(new THREE.CylinderGeometry(0.38, 0.73, 0.72, 20), pink, [0, 1.1, 0], [1, 1, 0.78], [0, 0, 0], "Dress skirt");
add(new THREE.TorusGeometry(0.37, 0.035, 8, 20), pinkDark, [0, 1.43, 0], [1, 1, 0.8], [Math.PI / 2, 0, 0], "Dress waist band");

for (const side of [-1, 1]) {
  add(new THREE.CapsuleGeometry(0.09, 0.43, 5, 12), skin, [side * 0.37, 1.74, 0], [1, 1, 1], [0, 0, side * -0.3], side < 0 ? "Left arm" : "Right arm");
  add(new THREE.SphereGeometry(0.1, 12, 9), skin, [side * 0.51, 1.4, -0.03], [1, 1, 1], [0, 0, 0], side < 0 ? "Left hand" : "Right hand");
  add(new THREE.CapsuleGeometry(0.1, 0.53, 5, 12), skin, [side * 0.18, 0.43, 0], [1, 1, 1], [0.08, 0, 0], side < 0 ? "Left leg" : "Right leg");
  add(new THREE.SphereGeometry(0.13, 14, 10), shoe, [side * 0.18, 0.1, -0.07], [0.9, 0.5, 1.35], [0, 0, 0], side < 0 ? "Left shoe" : "Right shoe");
}

// Compact laptop prop makes the NPC immediately read as a working office agent.
const laptop = new THREE.Group(); laptop.name = "Laptop"; laptop.position.set(0, 1.52, -0.34); laptop.rotation.x = -0.22;
const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.34), white); base.position.y = -0.08; laptop.add(base);
const display = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.31, 0.025), shoe); display.position.set(0, 0.1, 0.15); display.rotation.x = -0.25; laptop.add(display);
root.add(laptop);

root.rotation.y = Math.PI;
const exporter = new GLTFExporter();
const output = await new Promise((resolve, reject) => exporter.parse(root, resolve, reject, { binary: true, onlyVisible: true, trs: false }));
await writeFile(new URL("../public/models/growdash-npc-aurora.glb", import.meta.url), Buffer.from(output));
console.log(`Wrote ${output.byteLength} bytes`);
