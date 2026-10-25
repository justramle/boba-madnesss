// Collectible toppings and power-ups. Each floats inside a thin halo tinted for the level.
import * as THREE from 'three';
import { rand } from '../utils/math.js';
import { toon, toonMap, gloss, basic, canvasTexture, GEO, mesh, ball, rod, block } from '../engine/materials.js';
import { LEVELS } from '../data/levels.js';

const peachSkin = canvasTexture(128, 64, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#f2c68e');
  g.addColorStop(0.35, '#efa47c');
  g.addColorStop(0.55, '#d86f61');
  g.addColorStop(0.75, '#efa47c');
  g.addColorStop(1, '#f2c68e');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.12)';
  for (let i = 0; i < 120; i++) x.fillRect(rand(0, w), rand(0, h), 1, 1);
});
const lycheeSkin = canvasTexture(128, 64, (x, w, h) => {
  x.fillStyle = '#b8434f';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(120,30,40,.55)' : 'rgba(230,120,120,.4)';
    x.beginPath();
    x.arc(rand(0, w), rand(0, h), rand(1.5, 3), 0, 7);
    x.fill();
  }
});

/**
 * pts: base points · weight: spawn weight (0 = special spawn only) · spark: burst color
 * power: name of the power-up this grants, if any
 */
export const TOPPINGS = {
  boba: {
    name: 'Oolong Boba',
    pts: 10,
    weight: 35,
    spark: '#5a3423',
    build(s) {
      const m = gloss('#2a140b', 0, 120);
      for (const [x, y, z] of [
        [-0.15, -0.1, 0.05],
        [0.15, -0.1, 0.05],
        [0, -0.1, -0.13],
        [0, 0.14, 0],
        [-0.02, -0.08, 0.2],
      ])
        s.add(ball(m, 0.14, x, y, z));
    },
  },
  popping: {
    name: 'Popping Pearls',
    pts: 15,
    weight: 22,
    spark: '#e8a35a',
    build(s) {
      for (const [x, y, shell, core] of [
        [-0.15, -0.06, '#e9a24a', '#f6c97a'],
        [0.16, -0.04, '#d6687a', '#f1a3ae'],
        [0, 0.17, '#ddc05a', '#f3dd8c'],
      ])
        s.add(ball(gloss(shell, 0.55, 140), 0.16, x, y, 0), ball(toon(core), 0.09, x, y, 0));
    },
  },
  jelly: {
    name: 'Cascara Tea Jelly',
    pts: 15,
    weight: 18,
    spark: '#b8692c',
    build(s) {
      for (const [x, y, z, r, size] of [
        [-0.12, -0.08, 0, 0.3, 0.26],
        [0.14, -0.06, 0.06, -0.4, 0.22],
        [0, 0.16, -0.02, 0.7, 0.2],
      ]) {
        const outer = mesh(GEO.box, gloss('#b05a22', 0.62, 140), x, y, z);
        outer.scale.setScalar(size);
        outer.rotation.set(r, r * 0.7, 0.2);
        const inner = mesh(GEO.box, toon('#7a3510'), x, y, z);
        inner.scale.setScalar(size * 0.55);
        inner.rotation.copy(outer.rotation);
        s.add(outer, inner);
      }
    },
  },
  lychee: {
    name: 'Fresh Lychee',
    pts: 20,
    weight: 15,
    spark: '#d0566a',
    build(s) {
      const shell = mesh(GEO.hemisphere, toonMap(lycheeSkin, { side: THREE.DoubleSide }), 0, -0.02, 0);
      shell.scale.set(0.27, -0.2, 0.27);
      const leaf = ball(toon('#7d9a6a'), 0.14, 0.2, 0.2, 0, 1, 0.22, 0.45);
      leaf.rotation.z = -0.6;
      s.add(shell, ball(gloss('#f7f2ea', 0.9, 140), 0.21, 0, 0.04, 0, 1, 1.05, 1), leaf);
    },
  },
  peach: {
    name: 'Fresh Peach',
    pts: 25,
    weight: 10,
    spark: '#e8956f',
    build(s) {
      const fruit = ball(toonMap(peachSkin), 0.27, 0, 0, 0, 1, 0.96, 0.94);
      fruit.rotation.y = -1.2;
      const leaf = ball(toon('#7d9a6a'), 0.16, 0.1, 0.3, 0, 1, 0.22, 0.45);
      leaf.rotation.z = -0.45;
      s.add(fruit, rod(toon('#5e4330'), 0.022, 0.1, 0, 0.28, 0), leaf);
    },
  },
  shield: {
    name: 'Cheese Foam Shield',
    pts: 30,
    weight: 0,
    power: 'shield',
    spark: '#efd9a0',
    build(s) {
      const foam = toon('#fbf4e2');
      s.add(
        rod(gloss('#ffffff', 0.35, 140), 0.2, 0.32, 0, -0.06, 0),
        rod(toon('#c9a26a'), 0.19, 0.2, 0, -0.12, 0),
        ball(foam, 0.21, 0, 0.12, 0, 1, 0.55, 1),
        ball(foam, 0.12, 0.04, 0.2, 0),
      );
    },
  },
  sword: {
    name: 'Brown Sugar Blade',
    pts: 20,
    weight: 0,
    power: 'sword',
    spark: '#f2c14e',
    build(s) {
      const blade = block(gloss('#3e1c0c', 0, 160), 0.09, 0.62, 0.025, 0, 0.14, 0);
      const edge = block(gloss('#c98a4a', 0, 160), 0.03, 0.6, 0.03, -0.04, 0.14, 0);
      const tip = mesh(new THREE.ConeGeometry(0.045, 0.12, 4), gloss('#3e1c0c', 0, 160), 0, 0.5, 0);
      tip.rotation.y = Math.PI / 4;
      s.add(
        blade,
        edge,
        tip,
        block(gloss('#f2c14e', 0, 90), 0.3, 0.05, 0.07, 0, -0.18, 0),
        rod(toon('#2a1a12'), 0.035, 0.2, 0, -0.3, 0),
        ball(gloss('#f2c14e', 0, 90), 0.045, 0, -0.42, 0),
      );
      s.rotation.z = -0.5;
    },
  },
  magnet: {
    name: 'Pearl Magnet',
    pts: 20,
    weight: 0,
    power: 'magnet',
    spark: '#ff6a6a',
    build(s) {
      const arc = mesh(new THREE.TorusGeometry(0.22, 0.08, 10, 24, Math.PI), toon('#d8402f'), 0, 0.05, 0);
      s.add(arc);
      for (const x of [-0.22, 0.22])
        s.add(rod(toon('#d8402f'), 0.08, 0.2, x, -0.05, 0), rod(toon('#e9e4dc'), 0.082, 0.1, x, -0.2, 0));
      s.add(
        ball(gloss('#2a140b', 0, 120), 0.07, -0.22, -0.34, 0),
        ball(gloss('#2a140b', 0, 120), 0.07, 0.22, -0.34, 0),
      );
      s.rotation.z = Math.PI;
      s.position.y = 0.05;
    },
  },
};

export const TOPPING_KEYS = Object.keys(TOPPINGS);

export function randomToppingType() {
  let r = Math.random() * 100;
  for (const k of TOPPING_KEYS) {
    if (!TOPPINGS[k].weight) continue;
    r -= TOPPINGS[k].weight;
    if (r <= 0) return k;
  }
  return 'boba';
}

const HALO_MATS = LEVELS.map((l) => gloss(l.halo, 0, 60));

/** Builds a topping (with its halo) into `group`. */
export function buildTopping(type, group, level = 0) {
  TOPPINGS[type].build(group);
  const halo = mesh(GEO.halo, HALO_MATS[level]);
  if (TOPPINGS[type].power) halo.scale.setScalar(1.2);
  group.add(halo);
  group.userData.halo = halo;
}
