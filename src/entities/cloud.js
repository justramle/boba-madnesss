// Reward cloud: floats above jumpable obstacles; jump into it for bonus points.
import { toon, basic, GEO, mesh, ball, BRASS } from '../engine/materials.js';
import * as THREE from 'three';

const CLOUD = toon('#fbf9f4');
const haloGeo = new THREE.TorusGeometry(0.78, 0.012, 8, 64);

export function buildCloud(group) {
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.42],
    [-0.38, -0.08, 0.05, 0.3],
    [0.38, -0.06, 0, 0.32],
    [-0.15, 0.2, -0.05, 0.28],
    [0.18, 0.18, 0.08, 0.26],
  ])
    group.add(ball(CLOUD, r, x, y, z, 1, 0.78, 0.9));
  const halo = mesh(haloGeo, BRASS);
  group.add(halo);
  const glints = [0, 1, 2].map(() => {
    const s = mesh(GEO.octahedron, basic('#e6c88a'));
    s.scale.set(0.04, 0.08, 0.04);
    group.add(s);
    return s;
  });
  group.userData.halo = halo;
  group.userData.glints = glints;
}

export function animateCloud(group, time) {
  const { halo, glints } = group.userData;
  halo.rotation.set(Math.PI / 2 + Math.sin(time) * 0.15, 0, time * 0.6);
  glints.forEach((s, k) => {
    const a = time * 1.4 + k * 2.1;
    s.position.set(Math.cos(a) * 0.8, Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.8);
  });
}
