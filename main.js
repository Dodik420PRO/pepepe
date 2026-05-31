import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBITS } from "./data.js";

/* ====================================================
SCENE
==================================================== */
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f3ef);
scene.fog = new THREE.Fog(0xf4f3ef, 20, 48);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ====================================================
CAMERA
==================================================== */
const CAMERA_HOME = new THREE.Vector3(0, 7.5, 12.5);
const TARGET_HOME = new THREE.Vector3(0, 1.4, -0.8);

const cameraRig = {
  currentPos: CAMERA_HOME.clone(),
  currentTarget: TARGET_HOME.clone(),
  desiredPos: CAMERA_HOME.clone(),
  desiredTarget: TARGET_HOME.clone()
};

function setCameraImmediate(pos, target) {
  cameraRig.currentPos.copy(pos);
  cameraRig.currentTarget.copy(target);
  cameraRig.desiredPos.copy(pos);
  cameraRig.desiredTarget.copy(target);
  camera.position.copy(pos);
  camera.lookAt(target);
}

function flyTo(pos, target) {
  cameraRig.desiredPos.copy(pos);
  cameraRig.desiredTarget.copy(target);
}

/* ====================================================
LIGHT
==================================================== */
const hemi = new THREE.HemisphereLight(0xffffff, 0xe2dfd6, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(12, 22, 10);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
const s = 18;
key.shadow.camera.left = -s;
key.shadow.camera.right = s;
key.shadow.camera.top = s;
key.shadow.camera.bottom = -s;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 6;
scene.add(key);

const rim = new THREE.DirectionalLight(0xb9d4ff, 0.35);
rim.position.set(-12, 8, -10);
scene.add(rim);

/* ====================================================
GLOBAL FLOOR
==================================================== */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(28, 64),
  new THREE.MeshStandardMaterial({ color: 0xeae8e1, roughness: 0.92, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(56, 56, 0xcfccc3, 0xdedcd4);
grid.material.opacity = 0.22;
grid.material.transparent = true;
grid.position.y = 0.001;
scene.add(grid);

/* ====================================================
ROOMS
==================================================== */
const ROOMS = {
  quantum: {
    id: "quantum",
    title: "Квантовые технологии",
    color: 0x7dd3fc,
    exhibits: ["qubit_ion", "qubit_atom", "qubit_flux"]
  },
  biomed: {
    id: "biomed",
    title: "Биомедицина",
    color: 0x86efac,
    exhibits: ["bcd180", "elvis", "mrna"]
  },
  physics: {
    id: "physics",
    title: "Большая физика",
    color: 0xfca5a5,
    exhibits: ["skif", "tokamak"]
  }
};

const interactive = [];
const exhibitWorldPos = {};
const tickers = [];
const pins = [];

let roomRoot = new THREE.Group();
scene.add(roomRoot);

let currentRoom = "quantum";
let currentKey = null;

/* ====================================================
HELPERS
==================================================== */
function clearRoom() {
  pins.forEach((p) => p.el.remove());
  pins.length = 0;
  interactive.length = 0;
  tickers.length = 0;
  Object.keys(exhibitWorldPos).forEach((k) => delete exhibitWorldPos[k]);

  scene.remove(roomRoot);
  roomRoot = new THREE.Group();
  scene.add(roomRoot);
}

function registerInteractive(hitMesh, key, label, anchor) {
  hitMesh.userData.exhibitKey = key;
  hitMesh.userData.label = label;
  interactive.push(hitMesh);
  exhibitWorldPos[key] = anchor;
}

function makePedestal(x, z) {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.82, 0.72, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8f7f3, roughness: 0.45, metalness: 0.04 })
  );
  base.position.set(x, 0.36, z);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0xe4e1d8, roughness: 0.8 })
  );
  ring.position.set(x, 0.02, z);
  g.add(ring);

  roomRoot.add(g);
  return g;
}

function getSlots(count) {
  if (count === 2) {
    return [
      { x: -2.8, z: -0.4 },
      { x: 2.8, z: -0.4 }
    ];
  }

  return [
    { x: -3.8, z: -0.2 },
    { x: 0.0, z: -1.7 },
    { x: 3.8, z: -0.2 }
  ];
}

function buildRoomBase(room) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(9.5, 96),
    new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.98 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  disc.receiveShadow = true;
  roomRoot.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8.3, 8.6, 96),
    new THREE.MeshBasicMaterial({
      color: room.color,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  roomRoot.add(ring);

  const backArc = new THREE.Mesh(
    new THREE.TorusGeometry(6.5, 0.05, 12, 64, Math.PI),
    new THREE.MeshBasicMaterial({ color: room.color, transparent: true, opacity: 0.25 })
  );
  backArc.rotation.y = Math.PI;
  backArc.position.set(0, 2.4, -3.6);
  roomRoot.add(backArc);
}

/* ====================================================
EXHIBIT BUILDERS
==================================================== */
function buildQuantum(slot, key) {
  makePedestal(slot.x, slot.z);

  if (key === "qubit_ion") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.45, slot.z);

    const ions = [];
    const ionGeo = new THREE.SphereGeometry(0.13, 16, 12);

    for (let i = 0; i < 7; i++) {
      const sph = new THREE.Mesh(
        ionGeo,
        new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          emissive: 0x38bdf8,
          emissiveIntensity: 1,
          roughness: 0.2,
          metalness: 0.1
        })
      );
      sph.position.x = (i - 3) * 0.28;
      g.add(sph);
      ions.push(sph);
    }

    for (const k of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.035, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 })
      );
      rail.position.y = 0.2 * k;
      rail.castShadow = true;
      g.add(rail);
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.9, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.2, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      ions.forEach((sp, i) => {
        sp.material.emissiveIntensity = 0.7 + Math.sin(t * 2.4 + i * 0.7) * 0.5;
        sp.position.y = Math.sin(t * 1.2 + i) * 0.012;
      });
    });
  }

  if (key === "qubit_atom") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.55, slot.z);
    const atoms = [];
    const atomGeo = new THREE.SphereGeometry(0.06, 12, 8);

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const sph = new THREE.Mesh(
          atomGeo,
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x7dd3fc,
            emissiveIntensity: 1.4
          })
        );
        sph.position.set((i - 2) * 0.18, (j - 2) * 0.18, 0);
        g.add(sph);
        atoms.push(sph);
      }
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.3, 0.7),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.25, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      g.rotation.y = Math.sin(t * 0.3) * 0.25;
      atoms.forEach((a, i) => {
        a.material.emissiveIntensity = 0.9 + Math.sin(t * 3 + i * 0.4) * 0.4;
      });
    });
  }

  if (key === "qubit_flux") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.45, slot.z);

    const wafer = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.06, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.25, metalness: 0.85 })
    );
    wafer.castShadow = true;
    g.add(wafer);

    const meanderMat = new THREE.MeshStandardMaterial({
      color: 0xffd87a,
      emissive: 0xff9a3c,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.3
    });

    function track(x1, z1, x2, z2) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.025), meanderMat);
      m.position.set((x1 + x2) / 2, 0.045, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      g.add(m);
    }

    let zx = -0.4;
    for (let i = 0; i < 4; i++) {
      track(zx, -0.4, zx, 0.4);
      if (i < 3) track(zx, i % 2 ? -0.4 : 0.4, zx + 0.25, i % 2 ? -0.4 : 0.4);
      zx += 0.25;
    }

    [[-.35,-.35],[.35,-.35],[-.35,.35],[.35,.35]].forEach(([x, z]) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.025, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffd87a,
          emissive: 0xff9a3c,
          emissiveIntensity: 0.5,
          metalness: 0.7,
          roughness: 0.3
        })
      );
      pad.position.set(x, 0.05, z);
      g.add(pad);
    });

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.6, 1.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.2, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      g.children.forEach((c, i) => {
        if (c.material && c.material.emissive) {
          c.material.emissiveIntensity = 0.35 + Math.sin(t * 1.5 + i) * 0.2;
        }
      });
    });
  }
}

function buildBiomed(slot, key) {
  makePedestal(slot.x, slot.z);

  if (key === "bcd180") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.6, slot.z);

    const drugMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      roughness: 0.4,
      emissive: 0x16a34a,
      emissiveIntensity: 0.2,
      metalness: 0.05
    });
    const drugGeo = new THREE.SphereGeometry(0.08, 14, 10);

    function arm(angle) {
      const a = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(drugGeo, drugMat);
        sp.position.y = i * 0.13;
        sp.scale.setScalar(1 - i * 0.06);
        a.add(sp);
      }
      a.rotation.z = angle;
      return a;
    }

    g.add(arm(0.5));
    g.add(arm(-0.5));
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(drugGeo, drugMat);
      sp.position.y = -i * 0.13;
      g.add(sp);
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.7, slot.z));
    roomRoot.add(g);

    tickers.push((t) => { g.rotation.y = t * 0.4; });
  }

  if (key === "elvis") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.6, slot.z);

    const brain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45, 1),
      new THREE.MeshStandardMaterial({
        color: 0xfbcfe8,
        roughness: 0.65,
        flatShading: true,
        metalness: 0.02
      })
    );
    brain.castShadow = true;
    g.add(brain);

    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.05, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.3, metalness: 0.85 })
    );
    chip.position.set(0, 0.38, 0.18);
    chip.castShadow = true;
    g.add(chip);

    const elGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);
    const elMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      emissive: 0x4ade80,
      emissiveIntensity: 0.8
    });

    for (let i = 0; i < 9; i++) {
      const e = new THREE.Mesh(elGeo, elMat);
      const ix = (i % 3) - 1;
      const iz = Math.floor(i / 3) - 1;
      e.position.set(ix * 0.09, 0.27, 0.18 + iz * 0.09);
      g.add(e);
    }

    const pulses = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.05, 16),
        new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(0, 0.42, 0.18);
      p.userData.offset = i / 4;
      g.add(p);
      pulses.push(p);
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.1;
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.7, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      g.rotation.y = -t * 0.25;
      pulses.forEach((p) => {
        const phase = (t * 0.6 + p.userData.offset) % 1;
        p.scale.setScalar(1 + phase * 6);
        p.material.opacity = 0.85 * (1 - phase);
      });
    });
  }

  if (key === "mrna") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.55, slot.z);

    const lnp = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xbbf7d0,
        roughness: 0.25,
        transmission: 0.6,
        thickness: 0.3,
        transparent: true,
        opacity: 0.55,
        metalness: 0,
        clearcoat: 0.4
      })
    );
    g.add(lnp);

    const helix = new THREE.Group();
    const helixPts = [];
    for (let i = 0; i < 32; i++) {
      const a = i * 0.55;
      const r = 0.22;
      helixPts.push(new THREE.Vector3(Math.cos(a) * r, (i - 16) * 0.014, Math.sin(a) * r));
    }

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 48, 0.018, 6, false),
      new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        emissive: 0x16a34a,
        emissiveIntensity: 0.4,
        roughness: 0.4
      })
    );
    helix.add(tube);

    for (let i = 0; i < helixPts.length; i += 2) {
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x86efac,
          emissiveIntensity: 0.7
        })
      );
      sp.position.copy(helixPts[i]);
      helix.add(sp);
    }

    g.add(helix);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.6, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      helix.rotation.y = t * 0.7;
      g.rotation.y = Math.sin(t * 0.25) * 0.4;
    });
  }
}

function buildPhysics(slot, key) {
  if (key === "skif") {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.12, 48),
      new THREE.MeshStandardMaterial({ color: 0xeeece5, roughness: 0.8 })
    );
    base.position.set(slot.x, 0.06, slot.z);
    base.receiveShadow = true;
    roomRoot.add(base);

    const g = new THREE.Group();
    g.position.set(slot.x, 0.5, slot.z);

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.05, 12, 64),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.35, metalness: 0.4 })
    );
    torus.rotation.x = Math.PI / 2;
    g.add(torus);

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
    g.add(magnetMesh);

    const beamCount = 24;
    const beamMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff19a }),
      beamCount
    );
    g.add(beamMesh);

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.4 })
    );
    col.position.y = 0.55;
    col.castShadow = true;
    g.add(col);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.015, 1.3),
        new THREE.MeshBasicMaterial({
          color: 0xfca5a5,
          transparent: true,
          opacity: 0.55,
          depthWrite: false
        })
      );
      beam.position.set(Math.cos(a) * 0.85, 1.1, Math.sin(a) * 0.85);
      beam.lookAt(Math.cos(a) * 3, 1.1, Math.sin(a) * 3);
      g.add(beam);
    }

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 1.4, 24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.5;
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.0, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      for (let i = 0; i < beamCount; i++) {
        const a = (i / beamCount + t * 0.25) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        beamMesh.setMatrixAt(i, dummy.matrix);
      }
      beamMesh.instanceMatrix.needsUpdate = true;
      g.rotation.y = t * 0.04;
    });
  }

  if (key === "tokamak") {
    makePedestal(slot.x, slot.z);

    const g = new THREE.Group();
    g.position.set(slot.x, 1.55, slot.z);

    const chamber = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.16, 14, 36),
      new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.4, metalness: 0.7 })
    );
    chamber.rotation.x = Math.PI / 2;
    chamber.castShadow = true;
    g.add(chamber);

    const plasma = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.07, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xff8a4c, transparent: true, opacity: 0.85, depthWrite: false })
    );
    plasma.rotation.x = Math.PI / 2;
    g.add(plasma);

    const coilGeo = new THREE.TorusGeometry(0.18, 0.022, 8, 24);
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const coil = new THREE.Mesh(coilGeo, coilMat);
      coil.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
      coil.lookAt(0, 0, 0);
      g.add(coil);
    }

    const solenoid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.4, metalness: 0.4 })
    );
    g.add(solenoid);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);
    registerInteractive(hit, key, EXHIBITS[key].tag, new THREE.Vector3(slot.x, 2.6, slot.z));
    roomRoot.add(g);

    tickers.push((t) => {
      g.rotation.y = t * 0.3;
      plasma.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
    });
  }
}

function buildExhibit(key, slot, roomId) {
  if (roomId === "quantum") buildQuantum(slot, key);
  if (roomId === "biomed") buildBiomed(slot, key);
  if (roomId === "physics") buildPhysics(slot, key);
}

function buildPins(room) {
  room.exhibits.forEach((key) => {
    const el = document.createElement("button");
    el.className = "room-chip";
    el.textContent = EXHIBITS[key].tag.split(" · ")[1] || EXHIBITS[key].title;
    el.addEventListener("click", () => openPanel(key, true));
    stage.appendChild(el);
    pins.push({ el, key, pos: exhibitWorldPos[key] });
  });
}

function buildRoom(roomId) {
  clearRoom();

  const room = ROOMS[roomId];
  currentRoom = roomId;

  buildRoomBase(room);

  const slots = getSlots(room.exhibits.length);
  room.exhibits.forEach((key, i) => buildExhibit(key, slots[i], roomId));

  buildPins(room);

  document.querySelectorAll(".zones button").forEach((b) => {
    b.classList.toggle("active", b.dataset.jump === roomId);
  });
}

/* ====================================================
OVERLAYS
==================================================== */
const hoverLabel = document.createElement("div");
hoverLabel.className = "hover-label";
stage.appendChild(hoverLabel);

/* ====================================================
RAYCAST
==================================================== */
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

/* ====================================================
PANEL
==================================================== */
const panel = document.getElementById("panel");

panel.querySelector(".close").addEventListener("click", () => {
  panel.classList.add("hidden");
  currentKey = null;
  pins.forEach((p) => p.el.classList.remove("dim"));
});

document.getElementById("prev-exh").addEventListener("click", () => stepExhibit(-1));
document.getElementById("next-exh").addEventListener("click", () => stepExhibit(+1));

function stepExhibit(dir) {
  const roomKeys = ROOMS[currentRoom].exhibits;
  if (!currentKey || !roomKeys.includes(currentKey)) return openPanel(roomKeys[0], true);
  const i = roomKeys.indexOf(currentKey);
  const n = (i + dir + roomKeys.length) % roomKeys.length;
  openPanel(roomKeys[n], true);
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
    e.links.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a></li>`).join("");

  const roomKeys = ROOMS[currentRoom].exhibits;
  const idx = roomKeys.indexOf(key) + 1;
  document.getElementById("pager-info").textContent = `${idx} / ${roomKeys.length}`;

  panel.classList.remove("hidden");
  panel.scrollTo({ top: 0, behavior: "smooth" });

  pins.forEach((p) => p.el.classList.toggle("dim", p.key !== key));

  if (focus) focusOnExhibit(key);
}

function focusOnExhibit(key) {
  const w = exhibitWorldPos[key];
  if (!w) return;

  const camPos = new THREE.Vector3(w.x * 0.38, w.y + 2.7, 7.2);
  const tgt = new THREE.Vector3(w.x * 0.18, Math.max(1.2, w.y - 0.3), w.z - 0.2);
  flyTo(camPos, tgt);
}

/* ====================================================
ROOM SWITCH
==================================================== */
function switchRoom(roomId) {
  if (!ROOMS[roomId]) return;

  stage.classList.add("room-switching");
  hoverLabel.classList.remove("on");
  panel.classList.add("hidden");
  currentKey = null;

  setTimeout(() => {
    buildRoom(roomId);
    setCameraImmediate(CAMERA_HOME, TARGET_HOME);
    flyTo(CAMERA_HOME.clone(), TARGET_HOME.clone());
    stage.classList.remove("room-switching");
  }, 180);
}

document.querySelectorAll(".zones button").forEach((btn) => {
  btn.addEventListener("click", () => switchRoom(btn.dataset.jump));
});

document.getElementById("reset-cam").addEventListener("click", () => {
  flyTo(CAMERA_HOME.clone(), TARGET_HOME.clone());
  panel.classList.add("hidden");
  currentKey = null;
  pins.forEach((p) => p.el.classList.remove("dim"));
});

/* ====================================================
KEYBOARD
==================================================== */
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.key === "Tab") {
    e.preventDefault();
    stepExhibit(e.shiftKey ? -1 : +1);
  } else if (e.key === "Escape") {
    panel.classList.add("hidden");
    pins.forEach((p) => p.el.classList.remove("dim"));
  } else if (e.key === "r" || e.key === "R") {
    document.getElementById("reset-cam").click();
  } else if (e.key === "1") {
    switchRoom("quantum");
  } else if (e.key === "2") {
    switchRoom("biomed");
  } else if (e.key === "3") {
    switchRoom("physics");
  }
});

/* ====================================================
RESIZE + OVERLAYS
==================================================== */
function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
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
  pins.forEach(({ el, pos }) => {
    const p = project(pos);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.display = p.visible ? "block" : "none";
  });
}

/* ====================================================
BOOT
==================================================== */
buildRoom("quantum");
setCameraImmediate(CAMERA_HOME, TARGET_HOME);

/* ====================================================
LOOP
==================================================== */
const fpsEl = document.getElementById("fps");
let lastT = performance.now();
let frames = 0;

function loop() {
  const now = performance.now();
  const t = now / 1000;

  frames++;
  if (now - lastT >= 500) {
    fpsEl.textContent = Math.round((frames * 1000) / (now - lastT)) + " fps";
    frames = 0;
    lastT = now;
  }

  cameraRig.currentPos.lerp(cameraRig.desiredPos, 0.08);
  cameraRig.currentTarget.lerp(cameraRig.desiredTarget, 0.08);

  camera.position.copy(cameraRig.currentPos);
  camera.lookAt(cameraRig.currentTarget);

  tickers.forEach((fn) => fn(t));
  updateOverlays();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
