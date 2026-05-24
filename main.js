import * as THREE from "three";
// OrbitControls removed — using custom X-only drag
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBITS } from "./data.js";

/* ====================================================
   RENDERER + SCENE
==================================================== */
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f3ef);
scene.fog = new THREE.Fog(0xf4f3ef, 36, 90);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
camera.position.set(0, 2, 22);
camera.lookAt(0, 1.5, 0);
/* custom drag vars */

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const CAM_Y=0.8, CAM_Z=22, CAM_LOOK_Y=2.0, CAM_X_MIN=-14, CAM_X_MAX=14;
let camX=0, camXTarget=0, isDragging=false, dragStartX=0, dragCamStartX=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;isDragging=true;dragStartX=e.clientX;dragCamStartX=camX;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!isDragging)return;const dx=(e.clientX-dragStartX)/stage.clientWidth;camXTarget=Math.max(CAM_X_MIN,Math.min(CAM_X_MAX,dragCamStartX-dx*28));});
renderer.domElement.addEventListener('pointerup',()=>{isDragging=false;});
renderer.domElement.addEventListener('pointercancel',()=>{isDragging=false;});
const controls={update:()=>{},target:new THREE.Vector3(0,CAM_LOOK_Y,0)};
// CAM_HOME/TARGET_HOME stubs for flyTo compatibility
const CAM_HOME=new THREE.Vector3(0,CAM_Y,CAM_Z);const TARGET_HOME=new THREE.Vector3(0,CAM_LOOK_Y,0);
/* PBR environment for nicer reflections */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ====================================================
   LIGHTING
==================================================== */
const hemi = new THREE.HemisphereLight(0xffffff, 0xe2dfd6, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(12, 22, 10);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
const s = 22;
key.shadow.camera.left = -s; key.shadow.camera.right = s;
key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 6;
scene.add(key);

const rim = new THREE.DirectionalLight(0xb9d4ff, 0.35);
rim.position.set(-12, 8, -10);
scene.add(rim);

/* ====================================================
   FLOOR + GRID
==================================================== */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(36, 48),
  new THREE.MeshStandardMaterial({ color: 0xeae8e1, roughness: 0.92, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(72, 72, 0xcfccc3, 0xdedcd4);
grid.material.opacity = 0.32;
grid.material.transparent = true;
grid.position.y = 0.001;
scene.add(grid);

/* zone pads */
// shared pad geometries
const PAD_RING_GEO = new THREE.RingGeometry(3.5, 3.7, 48);
const PAD_DISC_GEO = new THREE.CircleGeometry(3.5, 48);
const PAD_DISC_MAT = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 1 });
function zonePad(x, z, color) {
  const ring = new THREE.Mesh(PAD_RING_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, z);
  scene.add(ring);
  const disc = new THREE.Mesh(PAD_DISC_GEO, PAD_DISC_MAT);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.011, z);
  disc.receiveShadow = true;
  scene.add(disc);
  return { x, z };
}

const ZONES = {
  quantum: { ...zonePad(-11, 0, 0x7dd3fc), label: "01 / Квантовые технологии" },
  biomed:  { ...zonePad(  0, 0, 0x86efac), label: "02 / Биомедицина" },
  physics: { ...zonePad( 11, 0, 0xfca5a5), label: "03 / Большая физика" }
};

/* ====================================================
   Registries
==================================================== */
const interactive = [];        // hit meshes
const exhibitWorldPos = {};    // key -> Vector3 for pins
const tickers = [];

function registerInteractive(hitMesh, key, label, anchor) {
  hitMesh.userData.exhibitKey = key;
  hitMesh.userData.label = label;
  interactive.push(hitMesh);
  // anchor: position above which the floating pin will hover (world)
  exhibitWorldPos[key] = anchor;
}

/* pedestals — shared geo & mat */
const PED_GEO = new THREE.CylinderGeometry(0.55, 0.55, 0.7, 32);
const PED_MAT = new THREE.MeshStandardMaterial({ color: 0xfafaf8, roughness: 0.35, metalness: 0.04 });
const PED_RING_GEO = new THREE.CylinderGeometry(0.58, 0.58, 0.04, 32);
const PED_RING_MAT = new THREE.MeshStandardMaterial({ color: 0xe4e1d8, roughness: 0.8 });
function pedestal(x, z) {
  const top = new THREE.Mesh(PED_GEO, PED_MAT);
  top.position.set(x, 0.35, z);
  top.castShadow = true; top.receiveShadow = true;
  scene.add(top);
  const ring = new THREE.Mesh(PED_RING_GEO, PED_RING_MAT);
  ring.position.set(x, 0.02, z);
  scene.add(ring);
  return top;
}

/* ============================================================
   ZONE 1 — QUANTUM (3 объекта)
============================================================ */
{
  const cx = ZONES.quantum.x, cz = ZONES.quantum.z;

  // -- Q1: Ion chain (z = -1.6)
  pedestal(cx, cz - 1.7);
  const ionG = new THREE.Group();
  ionG.position.set(cx, 1.45, cz - 1.7);
  const ions = [];
  const ionGeo = new THREE.SphereGeometry(0.13, 16, 12);
  const ionMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 1,
    roughness: 0.2, metalness: 0.1
  });
  for (let i = 0; i < 7; i++) {
    const sph = new THREE.Mesh(ionGeo, ionMat.clone());
    sph.position.x = (i - 3) * 0.28;
    ionG.add(sph); ions.push(sph);
  }
  for (let k of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.035, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 })
    );
    rail.position.y = 0.2 * k;
    rail.castShadow = true;
    ionG.add(rail);
  }
  const ionHit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  ionG.add(ionHit);
  registerInteractive(ionHit, "qubit_ion", "Q-01 · Ионная цепочка",
    new THREE.Vector3(cx, 2.2, cz - 1.7));
  scene.add(ionG);
  tickers.push((t) => {
    ions.forEach((sp, i) => {
      sp.material.emissiveIntensity = 0.7 + Math.sin(t * 2.4 + i * 0.7) * 0.5;
      sp.position.y = Math.sin(t * 1.2 + i) * 0.012;
    });
  });

  // -- Q2: Neutral atom lattice (z = +1.4, x offset left)
  pedestal(cx - 1.5, cz + 1.0);
  const atomG = new THREE.Group();
  atomG.position.set(cx - 1.5, 1.5, cz + 1.0);
  const atoms = [];
  const atomGeo = new THREE.SphereGeometry(0.06, 12, 8);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const sph = new THREE.Mesh(
      atomGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7dd3fc, emissiveIntensity: 1.4 })
    );
    sph.position.set((i - 2) * 0.18, (j - 2) * 0.18, 0);
    atomG.add(sph); atoms.push(sph);
  }
  const atomHit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  atomG.add(atomHit);
  registerInteractive(atomHit, "qubit_atom", "Q-02 · Нейтральные атомы",
    new THREE.Vector3(cx - 1.5, 2.3, cz + 1.0));
  scene.add(atomG);
  tickers.push((t) => {
    atomG.rotation.y = Math.sin(t * 0.3) * 0.25;
    atoms.forEach((a, i) => { a.material.emissiveIntensity = 0.9 + Math.sin(t * 3 + i * 0.4) * 0.4; });
  });

  // -- Q3: Superconducting chip (z = +1.4, x offset right)
  pedestal(cx + 1.5, cz + 1.0);
  const chipG = new THREE.Group();
  chipG.position.set(cx + 1.5, 1.45, cz + 1.0);

  const wafer = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.06, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.25, metalness: 0.85 })
  );
  wafer.castShadow = true;
  chipG.add(wafer);
  // resonator meander on top
  const meanderMat = new THREE.MeshStandardMaterial({ color: 0xffd87a, emissive: 0xff9a3c, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3 });
  function track(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const g = new THREE.BoxGeometry(len, 0.02, 0.025);
    const m = new THREE.Mesh(g, meanderMat);
    m.position.set((x1 + x2) / 2, 0.045, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    chipG.add(m);
  }
  // simple meander pattern
  let zx = -0.4;
  for (let i = 0; i < 4; i++) {
    track(zx, -0.4, zx, 0.4);
    if (i < 3) track(zx, (i % 2 ? -0.4 : 0.4), zx + 0.25, (i % 2 ? -0.4 : 0.4));
    zx += 0.25;
  }
  // qubit pads (4 in corners)
  [[-.35,-.35],[.35,-.35],[-.35,.35],[.35,.35]].forEach(([x,z]) => {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.025, 24),
      new THREE.MeshStandardMaterial({ color: 0xffd87a, emissive: 0xff9a3c, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 })
    );
    pad.position.set(x, 0.05, z);
    chipG.add(pad);
  });
  const chipHit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
  chipG.add(chipHit);
  registerInteractive(chipHit, "qubit_flux", "Q-03 · Сверхпроводник",
    new THREE.Vector3(cx + 1.5, 2.2, cz + 1.0));
  scene.add(chipG);

  // hover floating particles
  tickers.push((t) => {
    chipG.children.forEach((c, i) => {
      if (c.material && c.material.emissive) {
        c.material.emissiveIntensity = 0.35 + Math.sin(t * 1.5 + i) * 0.2;
      }
    });
  });
}

/* ============================================================
   ZONE 2 — BIOMED (3 объекта)
============================================================ */
{
  const cx = ZONES.biomed.x, cz = ZONES.biomed.z;

  // -- B1: Antibody Y-shape (left)
  pedestal(cx - 1.7, cz + 0.6);
  const drugG = new THREE.Group();
  drugG.position.set(cx - 1.7, 1.6, cz + 0.6);
  const armColor = 0x86efac, armEm = 0x16a34a;
  const drugMat = new THREE.MeshStandardMaterial({ color: armColor, roughness: 0.4, emissive: armEm, emissiveIntensity: 0.2, metalness: 0.05 });
  const drugGeo = new THREE.SphereGeometry(0.08, 14, 10);
  function arm(angle) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(drugGeo, drugMat);
      sp.position.y = i * 0.13;
      sp.scale.setScalar(1 - i * 0.06);
      g.add(sp);
    }
    g.rotation.z = angle;
    return g;
  }
  drugG.add(arm(0.5));
  drugG.add(arm(-0.5));
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(drugGeo, drugMat);
    sp.position.y = -i * 0.13;
    drugG.add(sp);
  }
  const drugHit = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
  drugG.add(drugHit);
  registerInteractive(drugHit, "bcd180", "B-01 · Сенипрутуг",
    new THREE.Vector3(cx - 1.7, 2.7, cz + 0.6));
  scene.add(drugG);
  tickers.push((t) => { drugG.rotation.y = t * 0.4; });

  // -- B2: Brain + implant (right)
  pedestal(cx + 1.7, cz + 0.6);
  const brainG = new THREE.Group();
  brainG.position.set(cx + 1.7, 1.6, cz + 0.6);
  const brain = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 1),
    new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.65, flatShading: true, metalness: 0.02 })
  );
  brain.castShadow = true;
  brainG.add(brain);
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.05, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.3, metalness: 0.85 })
  );
  chip.position.set(0, 0.38, 0.18);
  chip.castShadow = true;
  brainG.add(chip);
  const elGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);
  const elMat = new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x4ade80, emissiveIntensity: 0.8 });
  for (let i = 0; i < 9; i++) {
    const e = new THREE.Mesh(elGeo, elMat);
    const ix = (i % 3) - 1, iz = Math.floor(i / 3) - 1;
    e.position.set(ix * 0.09, 0.27, 0.18 + iz * 0.09);
    brainG.add(e);
  }
  const pulses = [];
  const pulseGeo = new THREE.RingGeometry(0.04, 0.05, 16);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(0, 0.42, 0.18);
    p.userData.offset = i / 4;
    brainG.add(p); pulses.push(p);
  }
  const brainHit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
  brainHit.position.y = 0.1;
  brainG.add(brainHit);
  registerInteractive(brainHit, "elvis", "B-02 · ELVIS V",
    new THREE.Vector3(cx + 1.7, 2.7, cz + 0.6));
  scene.add(brainG);
  tickers.push((t) => {
    brainG.rotation.y = -t * 0.25;
    pulses.forEach((p) => {
      const phase = (t * 0.6 + p.userData.offset) % 1;
      p.scale.setScalar(1 + phase * 6);
      p.material.opacity = 0.85 * (1 - phase);
    });
  });

  // -- B3: mRNA lipid nanoparticle (back center)
  pedestal(cx, cz - 1.7);
  const mrnaG = new THREE.Group();
  mrnaG.position.set(cx, 1.55, cz - 1.7);

  // outer LNP shell — translucent
  const lnp = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0xbbf7d0, roughness: 0.25, transmission: 0.6, thickness: 0.3,
      transparent: true, opacity: 0.55, metalness: 0, clearcoat: 0.4
    })
  );
  mrnaG.add(lnp);

  // mRNA helix inside
  const helix = new THREE.Group();
  const helixPts = [];
  for (let i = 0; i < 32; i++) {
    const a = i * 0.55;
    const r = 0.22;
    helixPts.push(new THREE.Vector3(Math.cos(a) * r, (i - 16) * 0.014, Math.sin(a) * r));
  }
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 48, 0.018, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x16a34a, emissiveIntensity: 0.4, roughness: 0.4 })
  );
  helix.add(tube);
  const nucGeo = new THREE.SphereGeometry(0.035, 10, 8);
  const nucMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x86efac, emissiveIntensity: 0.7 });
  for (let i = 0; i < helixPts.length; i += 2) {
    const sp = new THREE.Mesh(nucGeo, nucMat);
    sp.position.copy(helixPts[i]);
    helix.add(sp);
  }
  mrnaG.add(helix);
  const mrnaHit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
  mrnaG.add(mrnaHit);
  registerInteractive(mrnaHit, "mrna", "B-03 · мРНК-вакцина",
    new THREE.Vector3(cx, 2.6, cz - 1.7));
  scene.add(mrnaG);
  tickers.push((t) => {
    helix.rotation.y = t * 0.7;
    mrnaG.rotation.y = Math.sin(t * 0.25) * 0.4;
  });
}

/* ============================================================
   ZONE 3 — PHYSICS (2 объекта: СКИФ + Токамак)
============================================================ */
{
  const cx = ZONES.physics.x, cz = ZONES.physics.z;

  // shared platform for SKIF (large), tokamak goes beside on its own small pedestal
  // -- P1: SKIF ring (center, slightly back)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0xeeece5, roughness: 0.8 })
  );
  base.position.set(cx - 0.6, 0.06, cz - 0.6);
  base.receiveShadow = true;
  scene.add(base);

  const ringG = new THREE.Group();
  ringG.position.set(cx - 0.6, 0.5, cz - 0.6);
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.05, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.35, metalness: 0.4 })
  );
  torus.rotation.x = Math.PI / 2;
  ringG.add(torus);
  // instanced magnets
  const magnets = 16;
  const magnetMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.26, 0.2, 0.26),
    new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.45, metalness: 0.2 }),
    magnets
  );
  magnetMesh.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < magnets; i++) {
    const a = (i / magnets) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
    dummy.lookAt(0, 0, 0);
    dummy.updateMatrix();
    magnetMesh.setMatrixAt(i, dummy.matrix);
  }
  ringG.add(magnetMesh);
  // beam — instanced dots
  const beamCount = 24;
  const beamGeo = new THREE.SphereGeometry(0.04, 8, 6);
  const beamMesh = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff19a }), beamCount);
  ringG.add(beamMesh);
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.4 })
  );
  col.position.y = 0.55;
  col.castShadow = true;
  ringG.add(col);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.015, 1.3),
      new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.55, depthWrite: false })
    );
    beam.position.set(Math.cos(a) * 0.85, 1.1, Math.sin(a) * 0.85);
    beam.lookAt(ringG.position.x + Math.cos(a) * 3, 1.1, ringG.position.z + Math.sin(a) * 3);
    ringG.add(beam);
  }
  const skifHit = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.4, 24), new THREE.MeshBasicMaterial({ visible: false }));
  skifHit.position.y = 0.5;
  ringG.add(skifHit);
  registerInteractive(skifHit, "skif", "P-01 · СКИФ",
    new THREE.Vector3(cx - 0.6, 2.0, cz - 0.6));
  scene.add(ringG);
  tickers.push((t) => {
    for (let i = 0; i < beamCount; i++) {
      const a = (i / beamCount + t * 0.25) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      beamMesh.setMatrixAt(i, dummy.matrix);
    }
    beamMesh.instanceMatrix.needsUpdate = true;
    ringG.rotation.y = t * 0.04;
  });

  // -- P2: Tokamak T-15МД (donut + central solenoid, side spot)
  pedestal(cx + 1.7, cz + 1.5);
  const tokG = new THREE.Group();
  tokG.position.set(cx + 1.7, 1.55, cz + 1.5);

  // chamber torus
  const chamber = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.16, 14, 36),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.4, metalness: 0.7 })
  );
  chamber.rotation.x = Math.PI / 2;
  chamber.castShadow = true;
  tokG.add(chamber);
  // plasma inside
  const plasma = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.07, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xff8a4c, transparent: true, opacity: 0.85, depthWrite: false })
  );
  plasma.rotation.x = Math.PI / 2;
  tokG.add(plasma);
  // toroidal coils
  const coilGeo = new THREE.TorusGeometry(0.18, 0.022, 8, 24);
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const coil = new THREE.Mesh(coilGeo, coilMat);
    coil.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
    coil.lookAt(tokG.position);
    tokG.add(coil);
  }
  // central solenoid
  const solenoid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.4, metalness: 0.4 })
  );
  tokG.add(solenoid);

  const tokHit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
  tokG.add(tokHit);
  registerInteractive(tokHit, "tokamak", "P-02 · Т-15МД",
    new THREE.Vector3(cx + 1.7, 2.6, cz + 1.5));
  scene.add(tokG);

  tickers.push((t) => {
    tokG.rotation.y = t * 0.3;
    plasma.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
  });
}

/* ============================================================
   HTML OVERLAYS — zone labels + per-exhibit pins
============================================================ */
const markers = [];
for (const [, z] of Object.entries(ZONES)) {
  const el = document.createElement("div");
  el.className = "zone-marker";
  const parts = z.label.split(" / ");
  el.innerHTML = `<div class="num">${parts[0]}</div><div class="name">${parts[1]}</div>`;
  stage.appendChild(el);
  // anchor near the floor, close to models — y small
  markers.push({ el, pos: new THREE.Vector3(z.x, 0.4, z.z + 1.5) });
}

const pins = []; // { el, key, pos:Vector3 }
for (const key in EXHIBITS) {
  const el = document.createElement("div");
  el.className = "exh-pin";
  el.textContent = EXHIBITS[key].tag.split(" · ")[1] || EXHIBITS[key].tag;
  el.addEventListener("click", () => openPanel(key, true));
  stage.appendChild(el);
  pins.push({ el, key, pos: exhibitWorldPos[key] });
}

const hoverLabel = document.createElement("div");
hoverLabel.className = "hover-label";
stage.appendChild(hoverLabel);

/* ============================================================
   Interaction — raycast
============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactive, true);
  if (hits.length) {
    const m = hits[0].object;
    hovered = m;
    hoverLabel.textContent = m.userData.label;
    const sr = stage.getBoundingClientRect();
    hoverLabel.style.left = e.clientX - sr.left + "px";
    hoverLabel.style.top = e.clientY - sr.top + "px";
    hoverLabel.classList.add("on");
    stage.style.cursor = "pointer";
  } else {
    hovered = null;
    hoverLabel.classList.remove("on");
    stage.style.cursor = "";
  }
});
renderer.domElement.addEventListener("click", () => {
  if (!hovered) return;
  openPanel(hovered.userData.exhibitKey, true);
});

/* ============================================================
   Panel + Pager
============================================================ */
const panel = document.getElementById("panel");
const exhibitOrder = Object.keys(EXHIBITS);
let currentKey = null;

panel.querySelector(".close").addEventListener("click", () => {
  panel.classList.add("hidden");
  currentKey = null;
  pins.forEach((p) => p.el.classList.remove("dim"));
});
document.getElementById("prev-exh").addEventListener("click", () => stepExhibit(-1));
document.getElementById("next-exh").addEventListener("click", () => stepExhibit(+1));

function stepExhibit(dir) {
  if (!currentKey) return openPanel(exhibitOrder[0], true);
  const i = exhibitOrder.indexOf(currentKey);
  const n = (i + dir + exhibitOrder.length) % exhibitOrder.length;
  openPanel(exhibitOrder[n], true);
}

function openPanel(key, focus = false) {
  const e = EXHIBITS[key];
  if (!e) return;
  currentKey = key;
  document.getElementById("p-tag").textContent = e.tag;
  document.getElementById("p-title").textContent = e.title;
  document.getElementById("p-lede").textContent = e.lede;
  document.getElementById("p-org").textContent = e.org;
  document.getElementById("p-status").textContent = e.status;
  document.getElementById("p-year").textContent = e.year;
  document.getElementById("p-metric").textContent = e.metric;
  document.getElementById("p-breakthrough").textContent = e.breakthrough;
  document.getElementById("p-specs").innerHTML =
    e.specs.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
  document.getElementById("p-links").innerHTML =
    e.links.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join("");
  const idx = exhibitOrder.indexOf(key) + 1;
  document.getElementById("pager-info").textContent = `${idx} / ${exhibitOrder.length}`;
  panel.classList.remove("hidden");
  panel.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".zones button").forEach((b) =>
    b.classList.toggle("active", b.dataset.jump === e.zone)
  );
  // dim other pins
  pins.forEach((p) => p.el.classList.toggle("dim", p.key !== key));
  if (focus) focusOnExhibit(key);
}

/* ============================================================
   Camera fly-to
============================================================ */
function flyToZone(zoneKey) {
  const z = ZONES[zoneKey];
  // Подлёт по диагонали из центра наружу, выше — обзор всей зоны
  const dirX = Math.sign(z.x) || 0.4;
  flyTo(
    new THREE.Vector3(z.x + dirX * 6, 7, z.z + 15),
    new THREE.Vector3(z.x, 1.4, z.z)
  );
}
function focusOnExhibit(key) {
  const w = exhibitWorldPos[key];
  if (!w) return;
  // Направление: от центра выставки наружу — чтобы камера не оказалась за объектом
  const outward = new THREE.Vector3(w.x, 0, w.z).normalize();
  if (outward.lengthSq() < 0.01) outward.set(0, 0, 1);
  const camPos = new THREE.Vector3(
    w.x + outward.x * 6.5,
    w.y + 3.0,
    w.z + outward.z * 6.5 + 4.5
  );
  // Цель — на уровне центра объекта
  const tgt = new THREE.Vector3(w.x, Math.max(1.2, w.y), w.z);
  flyTo(camPos, tgt);
}
function flyTo(toPos, toTarget) {
  const fromPos = camera.position.clone();
  const fromT = controls.target.clone();
  const t0 = performance.now(), dur = 750;
  function step() {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(fromPos, toPos, e);
    controls.target.lerpVectors(fromT, toTarget, e);
    if (k < 1) requestAnimationFrame(step);
  }
  step();
}

document.querySelectorAll(".zones button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".zones button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    flyToZone(btn.dataset.jump);
  });
});
document.getElementById("reset-cam").addEventListener("click", () => {
  flyTo(CAM_HOME.clone(), TARGET_HOME.clone());
  panel.classList.add("hidden");
  pins.forEach((p) => p.el.classList.remove("dim"));
});

/* keyboard shortcuts */
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "Tab") { e.preventDefault(); stepExhibit(e.shiftKey ? -1 : +1); }
  else if (e.key === "Escape") { panel.classList.add("hidden"); pins.forEach((p)=>p.el.classList.remove("dim")); }
  else if (e.key === "r" || e.key === "R") { document.getElementById("reset-cam").click(); }
  else if (e.key === "1") { document.querySelector('[data-jump="quantum"]').click(); }
  else if (e.key === "2") { document.querySelector('[data-jump="biomed"]').click(); }
  else if (e.key === "3") { document.querySelector('[data-jump="physics"]').click(); }
});

/* ============================================================
   Resize + loop + mini-map
============================================================ */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

const tmpV = new THREE.Vector3();
function project(pos) {
  tmpV.copy(pos).project(camera);
  const rect = stage.getBoundingClientRect();
  return {
    x: (tmpV.x * 0.5 + 0.5) * rect.width,
    y: (-tmpV.y * 0.5 + 0.5) * rect.height,
    visible: tmpV.z < 1
  };
}

function updateOverlays() {
  markers.forEach(({ el, pos }) => {
    const p = project(pos);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.opacity = p.visible ? 1 : 0;
  });
  pins.forEach(({ el, pos }) => {
    const p = project(pos);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.display = p.visible ? "block" : "none";
  });
}

/* mini-map camera projection: floor X/Z → svg X/Y */
const mmCam = document.getElementById("mm-cam");
const mmRing = document.getElementById("mm-cam-ring");
function updateMinimap() {
  // map world X [-18..18] -> svg x [4..216], world Z [-6..6] -> svg y [10..80]
  const wx = camera.position.x, wz = camera.position.z;
  const tx = controls.target.x, tz = controls.target.z;
  const mapX = (v) => 110 + (v / 14) * 70;
  const mapY = (v) => 45 + (v / 6) * 25;
  mmCam.setAttribute("cx", mapX(tx));
  mmCam.setAttribute("cy", mapY(tz));
  mmRing.setAttribute("cx", mapX(wx));
  mmRing.setAttribute("cy", mapY(wz));
}

const fpsEl = document.getElementById("fps");
let lastT = performance.now(), frames = 0;
function loop() {
  const now = performance.now();
  const t = now / 1000;
  frames++;
  if (now - lastT >= 500) {
    fpsEl.textContent = Math.round((frames * 1000) / (now - lastT)) + " fps";
    frames = 0; lastT = now;
  }
  controls.update();
   camX += (camXTarget - camX) * 0.08; camera.position.set(camX, CAM_Y, CAM_Z); camera.lookAt(camX * 0.3, CAM_LOOK_Y, 0);
  tickers.forEach((fn) => fn(t));
  updateOverlays();
  updateMinimap();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
