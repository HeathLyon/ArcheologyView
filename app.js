import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* -----------------------------
   DATA STATE
------------------------------*/

let areas = [];
let currentAreaIndex = 0;
let currentScanIndex = 0;

let currentRoot = null;
let activeModels = [];

let currentModelSize = 1;
let isFreeCam = false;
let isMouseLooking = false;

const pressedKeys = new Set();
const clock = new THREE.Clock();

/* -----------------------------
   DOM ELEMENTS
------------------------------*/

const canvas = document.getElementById("c");
const viewer = document.getElementById("viewer");

const areaSelect = document.getElementById("areaSelect");
const scanSelect = document.getElementById("scanSelect");
const areaDescription = document.getElementById("areaDescription");

const prevScanButton = document.getElementById("prevScanButton");
const nextScanButton = document.getElementById("nextScanButton");
const timelineStatus = document.getElementById("timelineStatus");

const stackToggle = document.getElementById("stackToggle");
const stackOpacity = document.getElementById("stackOpacity");
const stackOpacityValue = document.getElementById("stackOpacityValue");

const freeCamButton = document.getElementById("freeCamButton");
const resetViewButton = document.getElementById("resetViewButton");
const freeCamHelp = document.getElementById("freeCamHelp");
const freeCamSpeed = document.getElementById("freeCamSpeed");
const freeCamSpeedValue = document.getElementById("freeCamSpeedValue");

const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");

const scanName = document.getElementById("scanName");
const scanClass = document.getElementById("scanClass");
const scanLocation = document.getElementById("scanLocation");
const scanStage = document.getElementById("scanStage");
const scanDate = document.getElementById("scanDate");
const scanNotes = document.getElementById("scanNotes");

/* -----------------------------
   THREE SETUP
------------------------------*/

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
    60,
    1,
    0.01,
    100000
);

camera.position.set(2, 2, 3);
camera.rotation.order = "YXZ";

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.screenSpacePanning = true;

const loader = new GLTFLoader();

/* LIGHTING */

scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.4));

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

/* HELPERS */

const grid = new THREE.GridHelper(10, 10, 0x666666, 0x333333);
scene.add(grid);

const axes = new THREE.AxesHelper(2);
scene.add(axes);

/* -----------------------------
   MANIFEST
------------------------------*/

async function loadManifest() {
    try {
        showLoading("Loading scan manifest...");

        const response = await fetch("GLBS/manifest.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Manifest request failed: ${response.status}`);
        }

        const manifest = await response.json();
        areas = normalizeManifest(manifest);

        if (!areas.length) {
            throw new Error("Manifest does not contain any excavation areas.");
        }

        populateAreaDropdown();
        selectArea(0);

        hideLoading();
    } catch (error) {
        console.error(error);
        showError("Could not load GLBS/manifest.json. Check the file path and JSON formatting.");
    }
}

function normalizeManifest(manifest) {
    if (Array.isArray(manifest?.areas)) {
        return manifest.areas.map(normalizeArea).filter(area => area.scans.length);
    }

    if (Array.isArray(manifest) && manifest.every(item => Array.isArray(item.scans))) {
        return manifest.map(normalizeArea).filter(area => area.scans.length);
    }

    if (Array.isArray(manifest)) {
        return [
            normalizeArea({
                id: "all-scans",
                name: "All Scans",
                description: "Scans imported from an older flat manifest.",
                scans: manifest
            })
        ];
    }

    throw new Error("Unsupported manifest format.");
}

function normalizeArea(area, index = 0) {
    return {
        id: area.id || `area-${index + 1}`,
        name: area.name || `Excavation Area ${index + 1}`,
        description: area.description || "No area description provided.",
        scans: Array.isArray(area.scans)
            ? area.scans.map(normalizeScan)
            : []
    };
}

function normalizeScan(scan, index = 0) {
    return {
        file: scan.file,
        name: scan.name || `Scan ${index + 1}`,
        classification: scan.classification || scan.type || "Progress Scan",
        location: scan.location || "Not specified",
        stage: scan.stage || scan.phase || `Stage ${index + 1}`,
        date: scan.date || "Not specified",
        notes: scan.notes || "No notes provided."
    };
}

/* -----------------------------
   DROPDOWNS / TIMELINE
------------------------------*/

function populateAreaDropdown() {
    areaSelect.innerHTML = "";

    areas.forEach((area, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = area.name;
        areaSelect.appendChild(option);
    });
}

function populateScanDropdown(areaIndex) {
    const area = areas[areaIndex];
    scanSelect.innerHTML = "";

    area.scans.forEach((scan, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `${index + 1}. ${scan.name}`;
        scanSelect.appendChild(option);
    });
}

function selectArea(areaIndex) {
    currentAreaIndex = areaIndex;
    currentScanIndex = 0;

    const area = areas[currentAreaIndex];

    areaSelect.value = String(currentAreaIndex);
    areaDescription.textContent = area.description;

    populateScanDropdown(currentAreaIndex);
    selectScan(0, true);
}

function selectScan(scanIndex, reloadModels = true) {
    const area = areas[currentAreaIndex];

    if (!area || !area.scans.length) return;

    currentScanIndex = THREE.MathUtils.clamp(
        scanIndex,
        0,
        area.scans.length - 1
    );

    scanSelect.value = String(currentScanIndex);

    updateTimelineStatus();
    updateMetadata();

    if (reloadModels) {
        if (stackToggle.checked) {
            loadStackedArea();
        } else {
            loadSingleScan();
        }
    } else {
        updateStackOpacity();
    }
}

function updateTimelineStatus() {
    const area = areas[currentAreaIndex];

    if (!area) {
        timelineStatus.textContent = "No area selected.";
        return;
    }

    const total = area.scans.length;
    const scan = area.scans[currentScanIndex];

    timelineStatus.textContent = `Scan ${currentScanIndex + 1} of ${total}: ${scan.stage}`;

    prevScanButton.disabled = currentScanIndex === 0;
    nextScanButton.disabled = currentScanIndex === total - 1;
}

function updateMetadata() {
    const area = areas[currentAreaIndex];
    const scan = area?.scans?.[currentScanIndex];

    if (!scan) return;

    scanName.textContent = scan.name;
    scanClass.textContent = scan.classification;
    scanLocation.textContent = scan.location || area.name;
    scanStage.textContent = scan.stage;
    scanDate.textContent = scan.date;
    scanNotes.textContent = scan.notes;
}

/* -----------------------------
   MODEL LOADING
------------------------------*/

async function loadSingleScan() {
    const area = areas[currentAreaIndex];
    const scan = area.scans[currentScanIndex];

    if (!scan?.file) {
        showError("This scan is missing a GLB file path in manifest.json.");
        return;
    }

    try {
        showLoading(`Loading ${scan.name}...`);
        clearCurrentModels();

        const root = new THREE.Group();
        const gltf = await loader.loadAsync(`GLBS/${scan.file}`);

        root.add(gltf.scene);
        centerRoot(root);

        currentRoot = root;
        activeModels = [
            {
                scanIndex: currentScanIndex,
                object: gltf.scene
            }
        ];

        scene.add(currentRoot);

        updateSceneScale();
        resetView();
        hideLoading();
    } catch (error) {
        console.error(error);
        showError(`Could not load ${scan.file}. Check the filename and GLBS folder.`);
    }
}

async function loadStackedArea() {
    const area = areas[currentAreaIndex];

    try {
        showLoading(`Loading stacked scans for ${area.name}...`);
        clearCurrentModels();

        const root = new THREE.Group();
        const loadedModels = [];

        for (let i = 0; i < area.scans.length; i++) {
            const scan = area.scans[i];

            if (!scan.file) continue;

            const gltf = await loader.loadAsync(`GLBS/${scan.file}`);

            root.add(gltf.scene);

            loadedModels.push({
                scanIndex: i,
                object: gltf.scene
            });
        }

        if (!loadedModels.length) {
            throw new Error("No scan models could be loaded for this area.");
        }

        centerRoot(root);

        currentRoot = root;
        activeModels = loadedModels;

        scene.add(currentRoot);

        updateSceneScale();
        updateStackOpacity();
        resetView();
        hideLoading();
    } catch (error) {
        console.error(error);
        showError(`Could not stack scans for ${area.name}. Check your file paths.`);
    }
}

function clearCurrentModels() {
    if (!currentRoot) return;

    scene.remove(currentRoot);
    disposeObject(currentRoot);

    currentRoot = null;
    activeModels = [];
}

function centerRoot(root) {
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());

    root.position.sub(center);
}

function updateSceneScale() {
    if (!currentRoot) return;

    const box = new THREE.Box3().setFromObject(currentRoot);
    const size = box.getSize(new THREE.Vector3());

    currentModelSize = Math.max(size.x, size.y, size.z, 1);

    const helperScale = Math.max(currentModelSize / 10, 1);
    grid.scale.setScalar(helperScale);
    axes.scale.setScalar(Math.max(currentModelSize / 5, 1));
}

function disposeObject(object) {
    object.traverse(child => {
        if (!child.isMesh) return;

        child.geometry?.dispose();

        const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        materials.forEach(material => {
            if (!material) return;

            Object.values(material).forEach(value => {
                if (value?.isTexture) {
                    value.dispose();
                }
            });

            material.dispose();
        });
    });
}

/* -----------------------------
   STACK OPACITY
------------------------------*/

function updateStackOpacity() {
    const olderOpacity = Number(stackOpacity.value);
    stackOpacityValue.textContent = `${Math.round(olderOpacity * 100)}%`;

    activeModels.forEach(entry => {
        const selected = entry.scanIndex === currentScanIndex;
        const opacity = stackToggle.checked
            ? selected ? 1 : olderOpacity
            : 1;

        setObjectOpacity(entry.object, opacity);
    });
}

function setObjectOpacity(object, opacity) {
    object.traverse(child => {
        if (!child.isMesh) return;

        const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        materials.forEach(material => {
            if (!material) return;

            material.transparent = opacity < 1;
            material.opacity = opacity;
            material.depthWrite = opacity >= 1;
            material.needsUpdate = true;
        });
    });
}

/* -----------------------------
   CAMERA
------------------------------*/

function resetView() {
    if (!currentRoot) {
        camera.position.set(2, 2, 3);
        orbitControls.target.set(0, 0, 0);
        orbitControls.update();
        return;
    }

    const distance = Math.max(currentModelSize * 1.35, 1);

    camera.position.set(
        distance * 0.75,
        distance * 0.55,
        distance
    );

    camera.near = Math.max(currentModelSize / 10000, 0.001);
    camera.far = Math.max(currentModelSize * 100, 1000);
    camera.updateProjectionMatrix();

    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
}

function enterFreeCam() {
    isFreeCam = true;
    orbitControls.enabled = false;

    freeCamButton.textContent = "Exit Free Cam";
    freeCamButton.classList.add("active");
    freeCamHelp.hidden = false;

    document.body.classList.add("free-cam");
}

function exitFreeCam() {
    isFreeCam = false;
    isMouseLooking = false;

    orbitControls.enabled = true;

    freeCamButton.textContent = "Enter Free Cam";
    freeCamButton.classList.remove("active");
    freeCamHelp.hidden = true;

    document.body.classList.remove("free-cam");
    document.body.classList.remove("mouse-looking");
}

function updateFreeCamera(delta) {
    if (!isFreeCam) return;

    const speedMultiplier = Number(freeCamSpeed.value);
    const baseSpeed = Math.max(currentModelSize * 0.25, 0.5);
    const boost = pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight") ? 2.5 : 1;
    const moveDistance = baseSpeed * speedMultiplier * boost * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    if (pressedKeys.has("KeyW")) {
        camera.position.addScaledVector(forward, moveDistance);
    }

    if (pressedKeys.has("KeyS")) {
        camera.position.addScaledVector(forward, -moveDistance);
    }

    if (pressedKeys.has("KeyD")) {
        camera.position.addScaledVector(right, moveDistance);
    }

    if (pressedKeys.has("KeyA")) {
        camera.position.addScaledVector(right, -moveDistance);
    }

    if (pressedKeys.has("Space")) {
        camera.position.y += moveDistance;
    }

    if (pressedKeys.has("KeyC") || pressedKeys.has("ControlLeft") || pressedKeys.has("ControlRight")) {
        camera.position.y -= moveDistance;
    }
}

/* -----------------------------
   MOUSE LOOK
------------------------------*/

canvas.addEventListener("mousedown", event => {
    if (!isFreeCam) return;

    event.preventDefault();

    isMouseLooking = true;
    document.body.classList.add("mouse-looking");
});

window.addEventListener("mouseup", () => {
    isMouseLooking = false;
    document.body.classList.remove("mouse-looking");
});

window.addEventListener("mousemove", event => {
    if (!isFreeCam || !isMouseLooking) return;

    const sensitivity = 0.003;

    camera.rotation.y -= event.movementX * sensitivity;
    camera.rotation.x -= event.movementY * sensitivity;

    const pitchLimit = Math.PI / 2 - 0.05;

    camera.rotation.x = THREE.MathUtils.clamp(
        camera.rotation.x,
        -pitchLimit,
        pitchLimit
    );
});

/* -----------------------------
   UI EVENTS
------------------------------*/

areaSelect.addEventListener("change", event => {
    selectArea(Number(event.target.value));
});

scanSelect.addEventListener("change", event => {
    if (stackToggle.checked) {
        selectScan(Number(event.target.value), false);
    } else {
        selectScan(Number(event.target.value), true);
    }
});

prevScanButton.addEventListener("click", () => {
    const reload = !stackToggle.checked;
    selectScan(currentScanIndex - 1, reload);
});

nextScanButton.addEventListener("click", () => {
    const reload = !stackToggle.checked;
    selectScan(currentScanIndex + 1, reload);
});

stackToggle.addEventListener("change", () => {
    if (stackToggle.checked) {
        loadStackedArea();
    } else {
        loadSingleScan();
    }
});

stackOpacity.addEventListener("input", updateStackOpacity);

freeCamButton.addEventListener("click", () => {
    if (isFreeCam) {
        exitFreeCam();
    } else {
        enterFreeCam();
    }
});

resetViewButton.addEventListener("click", resetView);

freeCamSpeed.addEventListener("input", () => {
    freeCamSpeedValue.textContent = `${Number(freeCamSpeed.value).toFixed(1)}x`;
});

window.addEventListener("keydown", event => {
    pressedKeys.add(event.code);

    if (event.code === "Escape" && isFreeCam) {
        exitFreeCam();
    }
});

window.addEventListener("keyup", event => {
    pressedKeys.delete(event.code);
});

/* -----------------------------
   RENDERER RESIZE
------------------------------*/

function resizeRenderer() {
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;

    if (!width || !height) return;

    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

new ResizeObserver(resizeRenderer).observe(viewer);
resizeRenderer();

/* -----------------------------
   MESSAGES
------------------------------*/

function showLoading(message) {
    loadingMessage.textContent = message;
    loadingMessage.hidden = false;
    errorMessage.hidden = true;
}

function hideLoading() {
    loadingMessage.hidden = true;
}

function showError(message) {
    loadingMessage.hidden = true;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

/* -----------------------------
   LOOP
------------------------------*/

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    updateFreeCamera(delta);

    if (!isFreeCam) {
        orbitControls.update();
    }

    renderer.render(scene, camera);
}

animate();
loadManifest();