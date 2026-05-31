import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBITS } from "./data.js";

/* ============================================================
   RENDERER + MULTIPLE SCENES
============================================================ */

const stage = document.getElementById("stage");

// Три отдельные сцены
const sceneQuantum = new THREE.Scene();
sceneQuantum.background = new THREE.Color(0xd0e8f2);
sceneQuantum.fog = new THREE.Fog(0xd0e8f2, 36, 90);

const sceneBiomed = new THREE.Scene();
sceneBiomed.background = new THREE.Color(0xd2f5d2);
sceneBiomed.fog = new THREE.Fog(0xd2f5d2, 36, 90);

const scenePhysics = new THREE.Scene();
scenePhysics.background = new THREE.Color(0xf5d2d2);
scenePhysics.fog = new THREE.Fog(0xf5d2d2, 36, 90);

let currentScene = sceneQuantum;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const CAM_POS = new THREE.Vector3(0, 4, 10);
const TARGET_POS = new THREE.Vector3(0, 1.5, 0);
camera.position.copy(CAM_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 40;
controls.minPolarAngle = Math.PI * 0.12;
controls.maxPolarAngle = Math.PI * 0.46;
controls.target.copy(TARGET_POS);

/* PBR environment for nicer reflections */
const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
sceneQuantum.environment = envTexture;
sceneBiomed.environment = envTexture;
scenePhysics.environment = envTexture;

/* ============================================================
   BUILD SCENE FUNCTION
============================================================ */

function buildScene(scene, zoneId, exhibits) {
  // Освещение
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe2dfd6, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(12, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const s = 22;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
  key.shadow.radius = 6;
  key.shadow.camera.near = 8;
  key.shadow.camera.far = 60;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffc080, 0.35);
  fill.position.set(-16, 6, -10);
  scene.add(fill);

  // Пол
  const floorGeo = new THREE.PlaneGeometry(20, 20);
  const floorColor = zoneId === 'quantum' ? 0xd0e8f2 : 
                     zoneId === 'biomed' ? 0xd2f5d2 : 0xf5d2d2;
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: floorColor,
    roughness: 0.8,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Стены
  const wallH = 8;
  const wallMat = new THREE.MeshStandardMaterial({ 
    color: 0xeeeeee, 
    side: THREE.DoubleSide,
    roughness: 0.9
  });

  const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(20, wallH), wallMat);
  wallBack.position.set(0, wallH/2, -10);
  wallBack.receiveShadow = true;
  scene.add(wallBack);

  const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(20, wallH), wallMat);
  wallLeft.position.set(-10, wallH/2, 0);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.receiveShadow = true;
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(20, wallH), wallMat);
  wallRight.position.set(10, wallH/2, 0);
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.receiveShadow = true;
  scene.add(wallRight);

  // Экспонаты
  exhibits.forEach((ex, i) => {
    const holder = makeExhibit(ex);
    const positions = [
      {x: -5, z: -3}, {x: 0, z: -4}, {x: 5, z: -3},
      {x: -4, z: 0}, {x: 4, z: 0}
    ];
    if (positions[i]) holder.position.set(positions[i].x, 0, positions[i].z);
    scene.add(holder);
  });
}

/* ============================================================
   EXHIBITS
============================================================ */

const tickers = [];
let currentExhibit = null;

function makeExhibit(data) {
  const holder = new THREE.Group();
  
  // Постамент
  const pedGeo = new THREE.CylinderGeometry(0.6, 0.7, 1.2, 16);
  const pedMat = new THREE.MeshStandardMaterial({ 
    color: 0xdddddd,
    roughness: 0.5,
    metalness: 0.1
  });
  const pedestal = new THREE.Mesh(pedGeo, pedMat);
  pedestal.position.y = 0.6;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  holder.add(pedestal);

  // Модель (куб с цветом зоны)
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const color = data.zone === 'quantum' ? 0x4a9eff :
                data.zone === 'biomed' ? 0x66cc66 : 0xff6666;
  const boxMat = new THREE.MeshStandardMaterial({ 
    color,
    roughness: 0.3,
    metalness: 0.6
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.y = 1.8;
  box.castShadow = true;
  holder.add(box);

  // Анимация вращения
  tickers.push(() => {
    box.rotation.y += 0.01;
  });

  holder.userData = { exhibitData: data };
  holder.name = data.tag;
  return holder;
}

// Создаём сцены для каждой зоны
const quantumExhibits = EXHIBITS.filter(ex => ex.zone === 'quantum');
const biomedExhibits = EXHIBITS.filter(ex => ex.zone === 'biomed');
const physicsExhibits = EXHIBITS.filter(ex => ex.zone === 'physics');

buildScene(sceneQuantum, 'quantum', quantumExhibits);
buildScene(sceneBiomed, 'biomed', biomedExhibits);
buildScene(scenePhysics, 'physics', physicsExhibits);

/* ============================================================
   SCENE SWITCHING
============================================================ */

function switchScene(scene) {
  currentScene = scene;
  currentExhibit = null;
  hidePanel();
  camera.position.copy(CAM_POS);
  controls.target.copy(TARGET_POS);
  controls.update();
}

/* ============================================================
   INTERACTION - клик по экспонату
============================================================ */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onCanvasClick(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(currentScene.children, true);
  
  if (hits.length) {
    let obj = hits[0].object;
    while(obj.parent && !obj.userData.exhibitData) obj = obj.parent;
    if (obj.userData.exhibitData) {
      selectExhibit(obj);
    }
  }
}
renderer.domElement.addEventListener('click', onCanvasClick);

function selectExhibit(obj) {
  currentExhibit = obj;
  const data = obj.userData.exhibitData;
  showPanel(data);
}

/* ============================================================
   UI PANEL
============================================================ */

const panel = document.getElementById('panel');
const pTag = document.getElementById('p-tag');
const pTitle = document.getElementById('p-title');
const pLede = document.getElementById('p-lede');
const pOrg = document.getElementById('p-org');
const pStatus = document.getElementById('p-status');
const pYear = document.getElementById('p-year');
const pMetric = document.getElementById('p-metric');
const pBreakthrough = document.getElementById('p-breakthrough');
const pSpecs = document.getElementById('p-specs');
const pLinks = document.getElementById('p-links');
const pagerInfo = document.getElementById('pager-info');
const closeBtn = document.getElementById('panel').querySelector('button');
const prevBtn = document.getElementById('prev-exh');
const nextBtn = document.getElementById('next-exh');

function showPanel(data) {
  panel.style.display = 'block';
  pTag.textContent = data.tag;
  pTitle.textContent = data.title;
  pLede.textContent = data.lede;
  pOrg.textContent = data.org;
  pStatus.textContent = data.status;
  pYear.textContent = data.year;
  pMetric.textContent = data.metric;
  pBreakthrough.textContent = data.breakthrough;
  
  pSpecs.innerHTML = '';
  data.specs.forEach(sp => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${sp[0]}</strong> ${sp[1]}`;
    pSpecs.appendChild(li);
  });
  
  pLinks.innerHTML = '';
  data.links.forEach(lk => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${lk[1]}" target="_blank">${lk[0]}</a>`;
    pLinks.appendChild(li);
  });
  
  updatePagerInfo();
}

function hidePanel() {
  panel.style.display = 'none';
  currentExhibit = null;
}

closeBtn.addEventListener('click', hidePanel);

function updatePagerInfo() {
  if (!currentExhibit) return;
  const zone = currentExhibit.userData.exhibitData.zone;
  let arr = EXHIBITS.filter(e => e.zone === zone);
  let idx = arr.findIndex(e => e.tag === currentExhibit.userData.exhibitData.tag);
  pagerInfo.textContent = `${idx+1} / ${arr.length}`;
}

prevBtn.addEventListener('click', () => {
  if (!currentExhibit) return;
  const zone = currentExhibit.userData.exhibitData.zone;
  let arr = EXHIBITS.filter(e => e.zone === zone);
  let idx = arr.findIndex(e => e.tag === currentExhibit.userData.exhibitData.tag);
  idx = (idx - 1 + arr.length) % arr.length;
  const nextData = arr[idx];
  const nextObj = currentScene.getObjectByName(nextData.tag);
  if (nextObj) selectExhibit(nextObj);
});

nextBtn.addEventListener('click', () => {
  if (!currentExhibit) return;
  const zone = currentExhibit.userData.exhibitData.zone;
  let arr = EXHIBITS.filter(e => e.zone === zone);
  let idx = arr.findIndex(e => e.tag === currentExhibit.userData.exhibitData.tag);
  idx = (idx + 1) % arr.length;
  const nextData = arr[idx];
  const nextObj = currentScene.getObjectByName(nextData.tag);
  if (nextObj) selectExhibit(nextObj);
});

/* ============================================================
   SECTION BUTTONS
============================================================ */

const btn1 = document.querySelectorAll('button')[0];
const btn2 = document.querySelectorAll('button')[1];
const btn3 = document.querySelectorAll('button')[2];

btn1.addEventListener('click', () => switchScene(sceneQuantum));
btn2.addEventListener('click', () => switchScene(sceneBiomed));
btn3.addEventListener('click', () => switchScene(scenePhysics));

/* ============================================================
   MINIMAP
============================================================ */

const mmCam = document.getElementById("mm-cam");
const mmRing = document.getElementById("mm-cam-ring");

function updateMinimap() {
  const wx = camera.position.x, wz = camera.position.z;
  const tx = controls.target.x, tz = controls.target.z;
  const mapX = (v) => 110 + (v / 14) * 70;
  const mapY = (v) => 45 + (v / 6) * 25;
  mmCam.setAttribute("cx", mapX(tx));
  mmCam.setAttribute("cy", mapY(tz));
  mmRing.setAttribute("cx", mapX(wx));
  mmRing.setAttribute("cy", mapY(wz));
}

/* ============================================================
   RESIZE
============================================================ */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ============================================================
   BOOT
============================================================ */

const fpsEl = document.getElementById("fps");
let lastT = performance.now(), frames = 0;

function loop() {
  const now = performance.now();
  const t = now / 1000;

  frames++;
  if (now - lastT >= 500) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - lastT))} fps`;
    frames = 0;
    lastT = now;
  }

  controls.update();
  tickers.forEach((fn) => fn(t));
  updateMinimap();
  renderer.render(currentScene, camera);
  requestAnimationFrame(loop);
}

loop();
