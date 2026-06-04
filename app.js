import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* -----------------------------
   ARTIFACT DATABASE
------------------------------*/
const artifacts = {
    "example.glb": {
        name: "Example Artifact",
        classification: "Unknown Structure",
        location: "Excavation Site Alpha",
        notes: "Preliminary scans suggest artificial construction."
    },

    "artifact2.glb": {
        name: "Stone Tablet",
        classification: "Inscribed Relic",
        location: "Sector B",
        notes: "Contains weathered markings."
    },

    "artifact3.glb": {
        name: "Metal Device",
        classification: "Technological Object",
        location: "Deep Chamber",
        notes: "Material composition unknown."
    }
};

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

/* DEBUG AXES (IMPORTANT) */
scene.add(new THREE.AxesHelper(2));

/* GRID */
const grid = new THREE.GridHelper(10, 10);
scene.add(grid);

/* LOADER */
const loader = new GLTFLoader();

let currentModel = null;

/* -----------------------------
   LOAD FUNCTION
------------------------------*/
function loadArtifact(file) {

    console.log("Loading:", file);

    if (currentModel) {
        scene.remove(currentModel);
    }

    loader.load(
        file,

        (gltf) => {

            currentModel = gltf.scene;
            scene.add(currentModel);

            // CENTER MODEL
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            currentModel.position.sub(center);

            // CAMERA AUTO FRAME
            const maxDim = Math.max(size.x, size.y, size.z);

            camera.position.set(
                maxDim * 1.5,
                maxDim * 1.2,
                maxDim * 1.5
            );

            controls.target.set(0, 0, 0);
            controls.update();

            console.log("Loaded:", file);

            // UPDATE UI
            const data = artifacts[file];

            if (data) {
                artifactName.textContent = data.name;
                artifactClass.textContent = data.classification;
                artifactLocation.textContent = data.location;
                artifactNotes.textContent = data.notes;
            }

        },

        undefined,

        (err) => {
            console.error("GLB load error:", err);
        }
    );
}

/* -----------------------------
   DROPDOWN SWITCH
------------------------------*/
select.addEventListener("change", (e) => {
    loadArtifact(e.target.value);
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
loadArtifact("example.glb");