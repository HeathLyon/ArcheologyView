import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const statusEl = document.getElementById("status");

function setStatus(msg) {
  console.log(msg);
  statusEl.textContent = msg;
}

const canvas = document.getElementById("c");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a08);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(2, 2, 3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// lighting (warmer “museum lamp” tone)
scene.add(new THREE.HemisphereLight(0xc9a46a, 0x1a1a1a, 1.2));

const dir = new THREE.DirectionalLight(0xffe0b2, 1.2);
dir.position.set(5, 10, 5);
scene.add(dir);

// dim grid (like excavation grid)
const grid = new THREE.GridHelper(10, 10, 0x5a4630, 0x2a2118);
grid.material.opacity = 0.25;
grid.material.transparent = true;
scene.add(grid);

const loader = new GLTFLoader();

let model;

setStatus("Scanning digital strata...");

loader.load(
  "example.glb",
  (gltf) => {
    model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    model.position.sub(center);

    camera.position.set(0, size * 0.2, size * 0.4);
    controls.update();

    setStatus("Artifact stabilized ✔");
  },
  (p) => {
    if (p.total) {
      setStatus(`Reconstructing... ${(p.loaded/p.total*100).toFixed(1)}%`);
    }
  },
  (err) => {
    console.error(err);
    setStatus("SCAN FAILURE — artifact corrupted");
  }
);

// subtle “alive display” motion
function animate() {
  requestAnimationFrame(animate);

  if (model) {
    model.rotation.y += 0.0015;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});