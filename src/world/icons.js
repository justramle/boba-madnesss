// Renders small PNG icons of the real 3D models for the menu, the guide and the results panel.
import * as THREE from 'three';
import { addLights } from './stage.js';
import { TOPPING_KEYS, buildTopping } from '../entities/toppings.js';
import { OBSTACLES, OBSTACLE_KEYS } from '../entities/obstacles.js';
import { buildCloud } from '../entities/cloud.js';

export function renderIcons(models, mainScene) {
  const icons = { boba: [], topping: {}, obstacle: {}, cloud: '' };
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return icons;
  }
  r.outputColorSpace = THREE.LinearSRGBColorSpace;
  r.setPixelRatio(1);
  r.setSize(200, 200, false);
  r.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  addLights(scene);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  // frame any object to fill the icon
  function shoot(obj, pad = 1.2, tilt = 0.12) {
    scene.add(obj);
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    box.getCenter(center);
    box.getSize(size);
    const dist = (Math.max(size.x, size.y, size.z * 0.8) * pad) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    cam.position.set(center.x, center.y + size.y * tilt, center.z + dist);
    cam.lookAt(center);
    r.render(scene, cam);
    scene.remove(obj);
    return r.domElement.toDataURL('image/png');
  }

  models.forEach((m, i) => {
    const u = m.userData;
    m.visible = true;
    m.position.set(0, 0, 0);
    m.rotation.set(0, -0.5, 0);
    u.shadow.visible = false;
    u.wings.forEach((w, k) => w.rotation.set(0, (k ? 1 : -1) * 0.5, (k ? 1 : -1) * 0.1));
    icons.boba[i] = shoot(m, 1.1, 0.05);
    u.shadow.visible = true;
    m.visible = false;
    mainScene.add(m); // shoot() removed it from the main scene
  });
  for (const k of TOPPING_KEYS) {
    const g = new THREE.Group();
    buildTopping(k, g);
    g.rotation.y = 0.5;
    icons.topping[k] = shoot(g, 1.15, 0.1);
  }
  for (const k of OBSTACLE_KEYS) {
    const g = new THREE.Group();
    const u = {};
    OBSTACLES[k].build(g, u, 0);
    if (u.bob) u.bob.position.y = 0;
    g.rotation.y = -0.35;
    icons.obstacle[k] = shoot(g);
  }
  const cloud = new THREE.Group();
  buildCloud(cloud);
  icons.cloud = shoot(cloud, 1.1, 0.1);

  r.dispose();
  r.forceContextLoss();
  return icons;
}
