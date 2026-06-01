let scene, camera, renderer, controls;
let currentModel = null;

init();
loadModel("models/example.glb");
animate();

function init() {
  const container = document.getElementById("viewer");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(2, 2, 2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Light
  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  window.addEventListener("resize", onWindowResize);
}

function loadModel(path) {
  const loader = new THREE.GLTFLoader();

  loader.load(
    path,
    (gltf) => {
      if (currentModel) scene.remove(currentModel);

      currentModel = gltf.scene;
      scene.add(currentModel);

      document.getElementById("modelName").innerText = path;

      // Auto-frame model
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());

      controls.target.copy(center);
      camera.position.set(center.x + size, center.y + size, center.z + size);
      controls.update();
    },
    undefined,
    (err) => console.error(err)
  );
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}