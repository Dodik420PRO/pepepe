import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBITS } from "./data.js";

/* ====================================================
SCENE
==================================================== */
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f3ef);
scene.fog = new THREE.Fog(0xf4f3ef, 18, 42);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
const CAMERA_HOME = new THREE.Vector3(0, 5.8, 9.2);
const TARGET_HOME = new THREE.Vector3(0, 1.5, -0.7);

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
const hemi = new THREE.HemisphereLight(0xffffff, 0xe3ddd0, 0.7);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(10, 18, 10);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -16;
key.shadow.camera.right = 16;
key.shadow.camera.top = 16;
key.shadow.camera.bottom = -16;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

const rim = new THREE.DirectionalLight(0xbdd8ff, 0.4);
rim.position.set(-10, 6, -8);
scene.add(rim);

/* ====================================================
BASE FLOOR
==================================================== */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(26, 64),
  new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.95, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(52, 52, 0xd8d2c8, 0xe4dfd8);
grid.material.opacity = 0.22;
grid.material.transparent = true;
grid.position.y = 0.002;
scene.add(grid);

/* ====================================================
ROOMS
==================================================== */
const ROOMS = {
  quantum: {
    id: "quantum",
    color: 0x7dd3fc,
    exhibits: ["qubit_ion", "qubit_atom", "qubit_flux"]
  },
  biomed: {
    id: "biomed",
    color: 0x86efac,
    exhibits: ["bcd180", "elvis", "mrna"]
  },
  physics: {
    id: "physics",
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

function registerInteractive(hitMesh, keyName, label, anchorLocal, parentGroup = null) {
  hitMesh.userData.exhibitKey = keyName;
  hitMesh.userData.label = label;
  interactive.push(hitMesh);

  const world = anchorLocal.clone();
  if (parentGroup) parentGroup.updateWorldMatrix(true, false);
  if (parentGroup) parentGroup.localToWorld(world);

  exhibitWorldPos[keyName] = world;
}

function makePedestal(x, z, radius = 0.78) {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, 0.72, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8f7f3, roughness: 0.45, metalness: 0.04 })
  );
  base.position.set(x, 0.36, z);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.08, radius + 0.08, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0xe2ddd3, roughness: 0.86 })
  );
  ring.position.set(x, 0.02, z);
  g.add(ring);

  roomRoot.add(g);
  return g;
}

function getSlots(count) {
  if (count === 2) {
    return [
      { x: -2.7, z: -0.2 },
      { x: 2.7, z: -0.2 }
    ];
  }

  return [
    { x: -3.4, z: -0.15 },
    { x: 0.0, z: -1.25 },
    { x: 3.4, z: -0.15 }
  ];
}

function buildRoomBase(room) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(8.8, 96),
    new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.98 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  disc.receiveShadow = true;
  roomRoot.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.8, 8.05, 96),
    new THREE.MeshBasicMaterial({
      color: room.color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  roomRoot.add(ring);

  const backArc = new THREE.Mesh(
    new THREE.TorusGeometry(6.2, 0.06, 12, 72, Math.PI),
    new THREE.MeshBasicMaterial({
      color: room.color,
      transparent: true,
      opacity: 0.22
    })
  );
  backArc.rotation.y = Math.PI;
  backArc.position.set(0, 2.5, -3.4);
  roomRoot.add(backArc);
}

/* ====================================================
EXHIBIT BUILDERS
==================================================== */
function buildQuantum(slot, keyName) {
  makePedestal(slot.x, slot.z);

  if (keyName === "qubit_ion") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.48, slot.z);

    const ions = [];
    const ionGeo = new THREE.SphereGeometry(0.15, 16, 12);

    for (let i = 0; i < 7; i++) {
      const sph = new THREE.Mesh(
        ionGeo,
        new THREE.MeshStandardMaterial({
          color: 0x8fdcff,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.9,
          roughness: 0.2,
          metalness: 0.1
        })
      );
      sph.position.x = (i - 3) * 0.31;
      sph.castShadow = true;
      g.add(sph);
      ions.push(sph);
    }

    for (const dir of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.035, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 })
      );
      rail.position.y = 0.22 * dir;
      rail.castShadow = true;
      g.add(rail);
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 1.1, 0.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 0.82, 0), g);

    tickers.push((t) => {
      ions.forEach((sp, i) => {
        sp.material.emissiveIntensity = 0.7 + Math.sin(t * 2.4 + i * 0.7) * 0.45;
        sp.position.y = Math.sin(t * 1.4 + i) * 0.018;
      });
    });
  }

  if (keyName === "qubit_atom") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.55, slot.z);

    const atoms = [];
    const atomGeo = new THREE.SphereGeometry(0.08, 12, 8);

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const sph = new THREE.Mesh(
          atomGeo,
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x7dd3fc,
            emissiveIntensity: 1.2,
            roughness: 0.25
          })
        );
        sph.position.set((i - 2) * 0.23, (j - 2) * 0.23, 0);
        sph.castShadow = true;
        g.add(sph);
        atoms.push(sph);
      }
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 0.9, 0), g);

    tickers.push((t) => {
      g.rotation.y = Math.sin(t * 0.45) * 0.28;
      atoms.forEach((a, i) => {
        a.material.emissiveIntensity = 0.8 + Math.sin(t * 3.2 + i * 0.35) * 0.35;
      });
    });
  }

  if (keyName === "qubit_flux") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.42, slot.z);

    const wafer = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.07, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.25, metalness: 0.85 })
    );
    wafer.castShadow = true;
    g.add(wafer);

    const meanderMat = new THREE.MeshStandardMaterial({
      color: 0xffd87a,
      emissive: 0xff9a3c,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.72
    });

    function track(x1, z1, x2, z2) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.03), meanderMat);
      m.position.set((x1 + x2) / 2, 0.055, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      g.add(m);
    }

    let zx = -0.46;
    for (let i = 0; i < 4; i++) {
      track(zx, -0.46, zx, 0.46);
      if (i < 3) {
        const side = i % 2 ? -0.46 : 0.46;
        track(zx, side, zx + 0.3, side);
      }
      zx += 0.3;
    }

    [[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]].forEach(([x, z]) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffd87a,
          emissive: 0xff9a3c,
          emissiveIntensity: 0.45,
          roughness: 0.35,
          metalness: 0.72
        })
      );
      pad.position.set(x, 0.055, z);
      g.add(pad);
    });

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.75, 1.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 0.78, 0), g);

    tickers.push((t) => {
      g.children.forEach((c, i) => {
        if (c.material && c.material.emissive) {
          c.material.emissiveIntensity = 0.28 + Math.sin(t * 1.7 + i) * 0.18;
        }
      });
    });
  }
}

function buildBiomed(slot, keyName) {
  makePedestal(slot.x, slot.z);

  if (keyName === "bcd180") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.62, slot.z);

    const drugMat = new THREE.MeshStandardMaterial({
      color: 0x8df3b2,
      roughness: 0.4,
      emissive: 0x16a34a,
      emissiveIntensity: 0.16,
      metalness: 0.04
    });
    const drugGeo = new THREE.SphereGeometry(0.1, 14, 10);

    function arm(angle) {
      const a = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(drugGeo, drugMat);
        sp.position.y = i * 0.16;
        sp.scale.setScalar(1 - i * 0.06);
        sp.castShadow = true;
        a.add(sp);
      }
      a.rotation.z = angle;
      return a;
    }

    g.add(arm(0.52));
    g.add(arm(-0.52));
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(drugGeo, drugMat);
      sp.position.y = -i * 0.16;
      sp.castShadow = true;
      g.add(sp);
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 1.08, 0), g);

    tickers.push((t) => {
      g.rotation.y = t * 0.45;
    });
  }

  if (keyName === "elvis") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.58, slot.z);

    const brain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.58, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf5bfd9,
        roughness: 0.68,
        flatShading: true,
        metalness: 0.02
      })
    );
    brain.castShadow = true;
    g.add(brain);

    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.06, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.3, metalness: 0.86 })
    );
    chip.position.set(0, 0.48, 0.22);
    chip.castShadow = true;
    g.add(chip);

    const elGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6);
    const elMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      emissive: 0x4ade80,
      emissiveIntensity: 0.85
    });

    for (let i = 0; i < 9; i++) {
      const e = new THREE.Mesh(elGeo, elMat);
      const ix = (i % 3) - 1;
      const iz = Math.floor(i / 3) - 1;
      e.position.set(ix * 0.105, 0.35, 0.22 + iz * 0.105);
      g.add(e);
    }

    const pulses = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.065, 18),
        new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(0, 0.52, 0.22);
      p.userData.offset = i / 4;
      g.add(p);
      pulses.push(p);
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.12;
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 1.0, 0), g);

    tickers.push((t) => {
      g.rotation.y = -t * 0.22;
      pulses.forEach((p) => {
        const phase = (t * 0.65 + p.userData.offset) % 1;
        p.scale.setScalar(1 + phase * 6);
        p.material.opacity = 0.82 * (1 - phase);
      });
    });
  }

  if (keyName === "mrna") {
    const g = new THREE.Group();
    g.position.set(slot.x, 1.6, slot.z);

    const lnp = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xc8fad8,
        roughness: 0.24,
        transmission: 0.55,
        thickness: 0.3,
        transparent: true,
        opacity: 0.58,
        metalness: 0,
        clearcoat: 0.35
      })
    );
    g.add(lnp);

    const helix = new THREE.Group();
    const helixPts = [];
    for (let i = 0; i < 34; i++) {
      const a = i * 0.52;
      const r = 0.28;
      helixPts.push(new THREE.Vector3(Math.cos(a) * r, (i - 17) * 0.018, Math.sin(a) * r));
    }

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 52, 0.022, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        emissive: 0x16a34a,
        emissiveIntensity: 0.35,
        roughness: 0.4
      })
    );
    helix.add(tube);

    for (let i = 0; i < helixPts.length; i += 2) {
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x86efac,
          emissiveIntensity: 0.65
        })
      );
      sp.position.copy(helixPts[i]);
      helix.add(sp);
    }

    g.add(helix);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 0.98, 0), g);

    tickers.push((t) => {
      helix.rotation.y = t * 0.8;
      g.rotation.y = Math.sin(t * 0.3) * 0.35;
    });
  }
}

function buildPhysics(slot, keyName) {
  if (keyName === "skif") {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0xeeece5, roughness: 0.82 })
    );
    base.position.set(slot.x, 0.07, slot.z);
    base.receiveShadow = true;
    roomRoot.add(base);

    const g = new THREE.Group();
    g.position.set(slot.x, 0.55, slot.z);

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.06, 14, 72),
      new THREE.MeshStandardMaterial({ color: 0xf9f9f8, roughness: 0.35, metalness: 0.4 })
    );
    torus.rotation.x = Math.PI / 2;
    torus.castShadow = true;
    g.add(torus);

    const magnets = 16;
    const magnetMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.45, metalness: 0.22 }),
      magnets
    );
    magnetMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < magnets; i++) {
      const a = (i / magnets) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75);
      dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      magnetMesh.setMatrixAt(i, dummy.matrix);
    }
    g.add(magnetMesh);

    const beamCount = 24;
    const beamMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
      beamCount
    );
    g.add(beamMesh);

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.2, 18),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.45 })
    );
    col.position.y = 0.6;
    col.castShadow = true;
    g.add(col);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.016, 1.35),
        new THREE.MeshBasicMaterial({
          color: 0xfca5a5,
          transparent: true,
          opacity: 0.52,
          depthWrite: false
        })
      );
      beam.position.set(Math.cos(a) * 0.9, 1.15, Math.sin(a) * 0.9);
      beam.lookAt(Math.cos(a) * 3, 1.15, Math.sin(a) * 3);
      g.add(beam);
    }

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 1.6, 24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.62;
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 1.55, 0), g);

    tickers.push((t) => {
      for (let i = 0; i < beamCount; i++) {
        const a = (i / beamCount + t * 0.24) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        beamMesh.setMatrixAt(i, dummy.matrix);
      }
      beamMesh.instanceMatrix.needsUpdate = true;
      g.rotation.y = t * 0.045;
    });
  }

  if (keyName === "tokamak") {
    makePedestal(slot.x, slot.z, 0.86);

    const g = new THREE.Group();
    g.position.set(slot.x, 1.6, slot.z);

    const chamber = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.22, 16, 42),
      new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.38, metalness: 0.74 })
    );
    chamber.rotation.x = Math.PI / 2;
    chamber.castShadow = true;
    g.add(chamber);

    const plasma = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.09, 12, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff8a4c,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      })
    );
    plasma.rotation.x = Math.PI / 2;
    g.add(plasma);

    const coilGeo = new THREE.TorusGeometry(0.22, 0.025, 8, 24);
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.4, metalness: 0.62 });

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const coil = new THREE.Mesh(coilGeo, coilMat);
      coil.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
      coil.lookAt(0, 0, 0);
      g.add(coil);
    }

    const solenoid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.82, 24),
      new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.42, metalness: 0.4 })
    );
    g.add(solenoid);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    g.add(hit);

    roomRoot.add(g);
    registerInteractive(hit, keyName, EXHIBITS[keyName].tag, new THREE.Vector3(0, 1.0, 0), g);

    tickers.push((t) => {
      g.rotation.y = t * 0.34;
      plasma.material.opacity = 0.7 + Math.sin(t * 3.2) * 0.14;
    });
  }
}

function buildExhibit(keyName, slot, roomId) {
  if (roomId === "quantum") buildQuantum(slot, keyName);
  if (roomId === "biomed") buildBiomed(slot, keyName);
  if (roomId === "physics") buildPhysics(slot, keyName);
}

function buildPins(room) {
  room.exhibits.forEach((keyName) => {
    const el = document.createElement("button");
    el.className = "room-chip";
    el.textContent = EXHIBITS[keyName].tag.split(" · ")[1] || EXHIBITS[keyName].title;
    el.addEventListener("click", () => openPanel(keyName, true));
    stage.appendChild(el);
    pins.push({ el, key: keyName, pos: exhibitWorldPos[keyName] });
  });
}

function buildRoom(roomId) {
  clearRoom();

  const room = ROOMS[roomId];
  currentRoom = roomId;

  buildRoomBase(room);

  const slots = getSlots(room.exhibits.length);
  room.exhibits.forEach((keyName, i) => buildExhibit(keyName, slots[i], roomId));

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
    hoverLabel.style.left = `${e.clientX - sr.left}px`;
    hoverLabel.style.top = `${e.clientY - sr.top}px`;
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
document.getElementById("next-exh").addEventListener("click", () => stepExhibit(1));

function stepExhibit(dir) {
  const roomKeys = ROOMS[currentRoom].exhibits;
  if (!currentKey || !roomKeys.includes(currentKey)) {
    openPanel(roomKeys[0], true);
    return;
  }
  const i = roomKeys.indexOf(currentKey);
  const n = (i + dir + roomKeys.length) % roomKeys.length;
  openPanel(roomKeys[n], true);
}

function openPanel(keyName, focus = false) {
  const e = EXHIBITS[keyName];
  if (!e) return;

  currentKey = keyName;

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
  const idx = roomKeys.indexOf(keyName) + 1;
  document.getElementById("pager-info").textContent = `${idx} / ${roomKeys.length}`;

  panel.classList.remove("hidden");
  panel.scrollTo({ top: 0, behavior: "smooth" });

  pins.forEach((p) => p.el.classList.toggle("dim", p.key !== keyName));

  if (focus) focusOnExhibit(keyName);
}

function focusOnExhibit(keyName) {
  const w = exhibitWorldPos[keyName];
  if (!w) return;

  const camPos = new THREE.Vector3(w.x * 0.18, w.y + 1.7, 4.9);
  const tgt = new THREE.Vector3(w.x * 0.06, w.y + 0.06, w.z);

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

  const startPos = cameraRig.currentPos.clone();
  const startTarget = cameraRig.currentTarget.clone();

  setTimeout(() => {
    buildRoom(roomId);

    cameraRig.currentPos.copy(startPos);
    cameraRig.currentTarget.copy(startTarget);

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
    stepExhibit(e.shiftKey ? -1 : 1);
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
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
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
let lastFpsTime = performance.now();
let frames = 0;

function loop() {
  const now = performance.now();
  const t = now / 1000;

  frames++;
  if (now - lastFpsTime >= 500) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - lastFpsTime))} fps`;
    frames = 0;
    lastFpsTime = now;
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
