0, 1.5, 5.0    0, 2.0, 7.0    0, 0.9, 3.5  0, 1.5, 5.0  0, 1.2, 4.5  0, 0.9, 3.5  import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBITS } from "./data.js";

/* ====================================================
SCENE
==================================================== */
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = null; // Используем CSS background вместо Three.js
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
const CAMERA_HOME = new THREE.Vector3(0, 2.0, 7.0);const CAM_ROOMS = {    quantum:  { pos: new THREE.Vector3(0, 1.5, 5.0), target: new THREE.Vector3(0, 1.0, 0) },
    biomed:   { pos: new THREE.Vector3(0, 1.5, 5.0), target: new THREE.Vector3(0, 1.0, 0) },
    physics:  { pos: new THREE.Vector3(0, 1.5, 5.0), target: new THREE.Vector3(0, 1.0, 0) },
