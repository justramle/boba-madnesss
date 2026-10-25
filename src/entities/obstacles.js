// Obstacles. Three categories, each re-skinned per level:
//   low    – hop over      (noodle cup → mossy noodle cup → noodle cup in a life ring)
//   normal – full jump     (fish sauce → bamboo fish sauce → message bottle)
//   high   – slide under   (bomb → thorn bomb → sea mine)
import * as THREE from 'three';
import { rand } from '../utils/math.js';
import { toon, toonMap, gloss, basic, canvasTexture, GEO, mesh, ball, rod, block, BRASS } from '../engine/materials.js';

/* ---------- labels ---------- */
function noodleWrap({ paper, band, title, sub }) {
  return canvasTexture(512, 256, (x, w) => {
    x.fillStyle = paper;
    x.fillRect(0, 0, w, 256);
    x.fillStyle = band;
    x.fillRect(0, 18, w, 6);
    x.fillRect(0, 62, w, 120);
    x.fillStyle = paper;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '400 112px "Instrument Serif", Georgia, serif';
    x.fillText(title, w / 2, 124);
    x.fillStyle = '#3a2f2a';
    x.font = '700 15px Manrope, Arial, sans-serif';
    x.fillText(sub, w / 2, 208);
    x.fillStyle = band;
    x.fillRect(w / 2 - 18, 230, 36, 2);
  });
}
const broth = canvasTexture(128, 128, (x, w) => {
  x.fillStyle = '#c99447';
  x.fillRect(0, 0, w, w);
  x.strokeStyle = '#efd28f';
  x.lineWidth = 4;
  x.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    x.beginPath();
    const y0 = 14 + i * 12;
    for (let j = 0; j <= w; j += 4) x.lineTo(j, y0 + Math.sin(j / 7 + i) * 4);
    x.stroke();
  }
  for (let i = 0; i < 14; i++) {
    x.fillStyle = Math.random() < 0.6 ? '#6d9a52' : '#b8352c';
    x.fillRect(10 + Math.random() * 108, 10 + Math.random() * 108, 4, 3);
  }
});
// "40°N" is the protein rating printed on Vietnamese fish sauce labels.
function fishLabel({ paper, ink, title, faded }) {
  return canvasTexture(512, 160, (x, w, h) => {
    x.fillStyle = paper;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = ink;
    x.lineWidth = 2;
    x.strokeRect(150, 10, 212, h - 20);
    x.strokeRect(156, 16, 200, h - 32);
    x.fillStyle = ink;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '400 40px "Instrument Serif", Georgia, serif';
    x.fillText(title, w / 2, 58);
    x.strokeStyle = faded ? '#6f8794' : '#3a2f2a';
    x.beginPath();
    x.ellipse(w / 2 - 6, 100, 30, 11, 0, 0, 7);
    x.moveTo(w / 2 + 24, 100);
    x.lineTo(w / 2 + 40, 90);
    x.lineTo(w / 2 + 40, 110);
    x.closePath();
    x.stroke();
    x.fillStyle = faded ? '#6f8794' : '#3a2f2a';
    x.font = '700 12px Manrope, Arial, sans-serif';
    x.fillText('4 0 °N', w / 2, 132);
  });
}

const WRAPS = [
  noodleWrap({ paper: '#f6f1e7', band: '#b8352c', title: 'Mì', sub: 'I N S T A N T   N O O D L E' }),
  noodleWrap({ paper: '#efeadc', band: '#5a7260', title: 'Mì', sub: 'F O R E S T   N O O D L E' }),
  noodleWrap({ paper: '#f3f4f0', band: '#7f9ba3', title: 'Mì', sub: 'S E A   N O O D L E' }),
];
const LABELS = [
  fishLabel({ paper: '#efe5d0', ink: '#8f2f25', title: 'Nước Mắm' }),
  fishLabel({ paper: '#ebe5d2', ink: '#5a6a52', title: 'Nước Mắm' }),
  fishLabel({ paper: '#e8ecea', ink: '#6f8791', title: 'Nước Mắm', faded: true }),
];

/* ---------- parts ---------- */
const cupGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.62, 40, 1, false, Math.PI);
const FOIL = gloss('#d9dde2', 0, 140);
function noodleCup(o, level) {
  o.add(mesh(cupGeo, [toonMap(WRAPS[level]), toonMap(broth), toon('#f6f1e7')], 0, 0.31, 0));
  const rim = mesh(new THREE.TorusGeometry(0.5, 0.022, 8, 40), toon('#f6f1e7'), 0, 0.62, 0);
  rim.rotation.x = Math.PI / 2;
  const hinge = new THREE.Group(); // half-peeled foil lid
  hinge.position.set(0, 0.63, -0.5);
  hinge.rotation.x = -0.42;
  hinge.add(
    mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 40), FOIL, 0, 0, 0.5),
    block(FOIL, 0.16, 0.012, 0.12, 0, 0, 1.03),
  );
  o.add(rim, hinge);
}
function bottle(o, { glass, dark, label, capColor, cork }) {
  const glassM = gloss(glass, 0.5, 140);
  o.add(rod(toon(dark), 0.25, 0.66, 0, 0.36, 0), rod(glassM, 0.29, 0.76, 0, 0.38, 0));
  o.add(mesh(new THREE.CylinderGeometry(0.296, 0.296, 0.4, 36, 1, true, Math.PI), toonMap(label), 0, 0.38, 0));
  const shoulder = mesh(GEO.hemisphere, glassM, 0, 0.76, 0);
  shoulder.scale.set(0.29, 0.2, 0.29);
  o.add(shoulder, rod(glassM, 0.095, 0.26, 0, 1.0, 0));
  if (cork) o.add(rod(toon('#c9a26a'), 0.1, 0.2, 0, 1.2, 0));
  else o.add(rod(toon(capColor), 0.11, 0.13, 0, 1.17, 0), rod(BRASS, 0.112, 0.025, 0, 1.12, 0));
}
function spikes(g, mat, count, r, len) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = (i % 3) * 0.9 - 0.9;
    const s = mesh(new THREE.ConeGeometry(0.06, len, 6), mat);
    s.position.set(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r);
    s.lookAt(s.position.clone().multiplyScalar(2));
    s.rotateX(Math.PI / 2);
    g.add(s);
  }
}
function fuse(g, u, y) {
  const f = mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 16, Math.PI * 0.8), toon('#c9b48c'), 0.1, y, 0);
  f.rotation.z = 0.3;
  const glow = ball(basic('#ffb85a', { transparent: true, opacity: 0.35, depthWrite: false }), 0.13, 0.22, y + 0.06, 0);
  g.add(f, ball(basic('#ffd27a'), 0.05, 0.22, y + 0.06, 0), glow);
  u.spark = glow;
}

export const OBSTACLES = {
  noodle: {
    cat: 'low',
    names: ['an instant noodle cup', 'a mossy noodle cup', 'a floating noodle cup'],
    build(o, u, level) {
      noodleCup(o, level);
      if (level === 1) {
        const moss = [toon('#6f8a70'), toon('#5f7a62')];
        for (let i = 0; i < 6; i++)
          o.add(ball(moss[i % 2], rand(0.08, 0.15), rand(-0.45, 0.45), rand(0.05, 0.55), rand(0.2, 0.45), 1, 0.7, 1));
        const sprig = ball(toon('#7f9a84'), 1, 0.32, 0.74, 0.08, 0.06, 0.2, 0.06);
        sprig.rotation.z = -0.5;
        o.add(sprig);
      }
      if (level === 2) {
        const ring = mesh(new THREE.TorusGeometry(0.62, 0.14, 10, 32), toon('#f1ece3'), 0, 0.18, 0);
        ring.rotation.x = Math.PI / 2;
        o.add(ring);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          o.add(ball(toon('#c08a6e'), 0.15, Math.cos(a) * 0.62, 0.18, Math.sin(a) * 0.62, 1, 0.9, 1));
        }
        u.bob = o;
        u.base = 0;
      }
    },
  },
  fish: {
    cat: 'normal',
    names: ['the fish sauce', 'the bamboo fish sauce', 'a drifting fish sauce bottle'],
    build(o, u, level) {
      if (level === 0) bottle(o, { glass: '#9a5422', dark: '#5e2a0c', label: LABELS[0], capColor: '#8f2f25' });
      else if (level === 1) {
        bottle(o, { glass: '#8a6a3a', dark: '#4a3418', label: LABELS[1], cork: true });
        for (let i = 0; i < 3; i++) {
          const leaf = ball(toon('#6f8a70'), 0.14, 0.26, 0.5 + i * 0.12, 0.15, 1, 0.22, 0.45);
          leaf.rotation.z = -0.6 - i * 0.3;
          o.add(leaf);
        }
      } else {
        bottle(o, { glass: '#a9c2c8', dark: '#6f8c93', label: LABELS[2], cork: true });
        o.rotation.z = 0.22;
        u.bob = o;
        u.base = 0;
      }
    },
  },
  bomb: {
    cat: 'high',
    names: ['a bomb', 'a thorn bomb', 'a sea mine'],
    build(o, u, level) {
      const g = new THREE.Group();
      g.position.y = 1.72;
      o.add(g);
      u.bob = g;
      u.base = 1.72;
      if (level === 0) {
        g.add(
          ball(toon('#2a2e2c'), 0.36),
          ball(gloss('#ffffff', 0.12, 140), 0.12, -0.14, 0.14, 0.26),
          rod(BRASS, 0.12, 0.1, 0, 0.37, 0),
        );
        fuse(g, u, 0.44);
      } else if (level === 1) {
        g.add(ball(toon('#2f3d2a'), 0.34));
        spikes(g, toon('#1f2a1c'), 14, 0.33, 0.22);
        g.add(rod(toon('#5a3f2a'), 0.1, 0.12, 0, 0.36, 0));
        fuse(g, u, 0.44);
      } else {
        g.add(ball(toon('#2b3338'), 0.36));
        spikes(g, toon('#1e2428'), 12, 0.36, 0.26);
        g.add(ball(basic('#e07a5f'), 0.08, 0, 0.42, 0));
        const glow = ball(basic('#e07a5f', { transparent: true, opacity: 0.3, depthWrite: false }), 0.2, 0, 0.42, 0);
        g.add(glow);
        u.spark = glow;
        for (let i = 0; i < 4; i++) {
          const link = mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), toon('#4a545a'), 0, -0.42 - i * 0.14, 0);
          link.rotation.y = i % 2 ? Math.PI / 2 : 0;
          g.add(link);
        }
      }
    },
  },
};

export const OBSTACLE_KEYS = Object.keys(OBSTACLES);
export const TYPE_FOR_CAT = { low: 'noodle', normal: 'fish', high: 'bomb' };

/** Height the boba's feet must clear to pass over a ground obstacle (with a little forgiveness). */
export const CLEAR_HEIGHT = { low: 0.55, normal: 1.12 };
