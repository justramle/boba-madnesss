// Object pools: obstacles, toppings and clouds are reused instead of re-created every row.
// Obstacles and toppings look different per level, so the pool key includes the level.
import * as THREE from 'three';
import { blobShadow } from '../engine/materials.js';
import { TOPPING_KEYS, buildTopping } from '../entities/toppings.js';
import { OBSTACLES, OBSTACLE_KEYS } from '../entities/obstacles.js';
import { buildCloud } from '../entities/cloud.js';
import { LEVELS } from '../data/levels.js';

export function createPools(scene) {
  const pools = new Map();

  function build(kind, type, level) {
    const g = new THREE.Group();
    const inner = new THREE.Group(); // animated part (bob, spin) separate from world placement
    g.add(inner);
    g.userData = { kind, type, level, inner, key: `${kind}:${type}:${level}` };
    if (kind === 'topping') {
      buildTopping(type, inner, level);
      g.add(blobShadow(0.42));
    } else if (kind === 'cloud') {
      buildCloud(inner);
    } else {
      OBSTACLES[type].build(inner, g.userData, level);
      g.add(blobShadow(OBSTACLES[type].cat === 'high' ? 0.55 : 0.8));
    }
    scene.add(g);
    return g;
  }

  const api = {
    get(kind, type = kind, level = 0) {
      const key = `${kind}:${type}:${level}`;
      if (!pools.has(key)) pools.set(key, []);
      const g = pools.get(key).pop() || build(kind, type, level);
      g.userData.inner.position.y = 0;
      g.userData.inner.rotation.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.visible = true;
      return g;
    },
    release(g) {
      g.visible = false;
      pools.get(g.userData.key).push(g);
    },
    /** Build a level's pieces ahead of time so a level change doesn't stutter. */
    warm(level) {
      for (const k of TOPPING_KEYS) api.release(api.get('topping', k, level));
      for (const k of OBSTACLE_KEYS) api.release(api.get('obstacle', k, level));
    },
  };

  api.warm(0);
  api.release(api.get('cloud'));
  // the other worlds warm up a moment later, after the first frame is on screen
  setTimeout(() => LEVELS.forEach((_, i) => i && api.warm(i)), 1500);
  return api;
}
