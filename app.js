import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// LIGHT
scene.add(new THREE.AmbientLight(0xffffff, 1));

camera.position.set(2, 2, 2);

// UI debug element
const debugBox = document.createElement("div");
debugBox.style.position = "absolute";
debugBox.style.bottom = "10px";
debugBox.style.left = "10px";
debugBox.style.color = "white";
debugBox.style.background = "rgba(0,0,0,0.6)";
debugBox.style.padding = "10px";
document.body.appendChild(debugBox);

function setDebug(msg) {
  console.log(msg);
  debugBox.innerText = msg;
}

const MODEL_PATH = "./example.glb";

setDebug("Checking file: " + MODEL_PATH);

// STEP 1 — pre-check if file exists (VERY IMPORTANT DEBUG STEP)
fetch(MODEL_PATH, { method: "HEAD" })
  .then((res) => {
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    setDebug("File FOUND on server → loading model...");
    loadModel();
  })
  .catch((err) => {
    setDebug("MODEL NOT FOUND (404 or path issue): " + err.message);
  });

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    MODEL_PATH,
    (gltf) => {
      setDebug("MODEL LOADED SUCCESSFULLY ✔");
      scene.add(gltf.scene);
    },
    (progress) => {
      console.log("Loading progress:", progress);
    },
    (err) => {
      console.error(err);
      setDebug("GLTF LOAD FAILED (see console)");
    }
  );
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();