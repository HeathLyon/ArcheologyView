import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* -----------------------------
   ARTIFACT DATABASE (FALLBACK ONLY)
------------------------------*/
let artifacts = [];

/* -----------------------------
   DOM ELEMENTS
------------------------------*/
const canvas = document.getElementById("c");
const select = document.getElementById("artifactSelect");

const artifactName = document.getElementById("artifactName");
const artifactClass = document.getElementById("artifactClass");
const artifactLocation = document.getElementById("artifactLocation");
const artifactNotes = document.getElementById("artifactNotes");

/* -----------------------------
   THREE SETUP
------------------------------*/
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(2, 2, 3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* LIGHTING */
scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));

const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(5, 10, 5);
scene.add(dir);

/* DEBUG */
scene.add(new THREE.AxesHelper(2));
scene.add(new THREE.GridHelper(10, 10));

/* LOADER */
const loader = new GLTFLoader();

let currentModel = null;

/* -----------------------------
   LOAD ARTIFACT MODEL
------------------------------*/
function loadArtifact(index) {

    const data = artifacts[index];

    if (!data) return;

    const filePath = "GLBS/" + data.file;

    console.log("Loading:", filePath);

    if (currentModel) {
        scene.remove(currentModel);
    }

    loader.load(
        filePath,

        (gltf) => {

            currentModel = gltf.scene;
            scene.add(currentModel);

            // CENTER MODEL
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            currentModel.position.sub(center);

            // CAMERA FIT
            const maxDim = Math.max(size.x, size.y, size.z);

            camera.position.set(
                maxDim * 1.5,
                maxDim * 1.2,
                maxDim * 1.5
            );

            controls.target.set(0, 0, 0);
            controls.update();

            console.log("Loaded:", filePath);

            // UI UPDATE
            artifactName.textContent = data.name;
            artifactClass.textContent = data.classification;
            artifactLocation.textContent = data.location;
            artifactNotes.textContent = data.notes;
        },

        undefined,

        (err) => {
            console.error("GLB load error:", err);
        }
    );
}

/* -----------------------------
   LOAD MANIFEST
------------------------------*/
async function loadManifest() {

    try {
        const res = await fetch("GLBS/manifest.json");
        artifacts = await res.json();

        console.log("Manifest loaded:", artifacts);

        // populate dropdown
        select.innerHTML = "";

        artifacts.forEach((a, i) => {

            const option = document.createElement("option");
            option.value = i;
            option.textContent = a.name;

            select.appendChild(option);
        });

        // load first artifact automatically
        loadArtifact(0);

    } catch (err) {
        console.error("Failed to load manifest:", err);
    }
}

/* -----------------------------
   DROPDOWN SWITCH
------------------------------*/
select.addEventListener("change", (e) => {
    loadArtifact(parseInt(e.target.value));
});

/* -----------------------------
   RESIZE
------------------------------*/
window.addEventListener("resize", () => {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

});

/* -----------------------------
   LOOP
------------------------------*/
function animate() {

    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);

}

animate();

/* -----------------------------
   INIT
------------------------------*/
loadManifest();