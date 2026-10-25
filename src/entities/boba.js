// The playable boba: a tall cup with a small face, slim legs and big feathered wings.
import * as THREE from 'three';
import { rand } from '../utils/math.js';
import {
  toon,
  toonMap,
  gloss,
  canvasTexture,
  roundRect,
  GEO,
  mesh,
  ball,
  rod,
  block,
  blobShadow,
  INK,
  WHITE,
} from '../engine/materials.js';

const LEG = 0.32; // leg length; the cup sits on top
const CUP_H = 1.3;
const radiusAt = (y) => 0.44 + (0.12 * y) / CUP_H; // the cup flares toward the rim

/* ---------- tea texture ---------- */
const PATTERNS = {
  flower(x, w, h, top) {
    for (let i = 0; i < 7; i++) {
      const cx = rand(10, w - 10);
      const cy = rand(16, top - 18);
      x.fillStyle = 'rgba(255,255,255,.75)';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        x.beginPath();
        x.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5, 0, 7);
        x.fill();
      }
    }
  },
  cubes(x, w, h, top) {
    for (let i = 0; i < 14; i++) {
      x.save();
      x.translate(rand(10, w - 10), rand(14, top - 14));
      x.rotate(rand(-0.6, 0.6));
      x.fillStyle = 'rgba(255,255,255,.45)';
      x.strokeStyle = 'rgba(255,255,255,.8)';
      x.lineWidth = 2;
      roundRect(x, -12, -12, 24, 24, 5);
      x.fill();
      x.stroke();
      x.restore();
    }
  },
  swirl(x, w, h, top) {
    x.strokeStyle = 'rgba(255,255,255,.42)';
    x.lineWidth = 6;
    x.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      const y0 = 20 + (k * (top - 36)) / 3;
      for (let i = 0; i <= w; i += 8) x.lineTo(i, y0 + Math.sin((i / w) * Math.PI * 6 + k) * 8);
      x.stroke();
    }
  },
  tiger(x, w, h, top) {
    x.fillStyle = '#7a3e1d';
    x.fillRect(0, 0, w, 12);
    x.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const x0 = (i * w) / 18 + rand(-6, 6);
      const len = rand(0.4, 0.85) * top;
      const ph = rand(0, 6);
      x.strokeStyle = `rgba(${(118 + rand(-12, 12)) | 0},58,26,.82)`;
      x.lineWidth = rand(7, 14);
      x.beginPath();
      for (let y = 0; y <= len; y += 6) x.lineTo(x0 + Math.sin(y / 22 + ph) * 7, y);
      x.stroke();
    }
  },
  coco(x, w) {
    x.fillStyle = '#faf6ec';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(w, 0);
    for (let i = w; i >= 0; i -= 8) x.lineTo(i, 54 + Math.sin((i / w) * Math.PI * 6) * 5);
    x.closePath();
    x.fill();
  },
  rice(x, w, h, top) {
    for (let i = 0; i < 50; i++) {
      x.save();
      x.translate(rand(4, w - 4), rand(8, top - 6));
      x.rotate(rand(0, 3.14));
      x.fillStyle = Math.random() < 0.3 ? 'rgba(140,96,52,.8)' : 'rgba(255,246,228,.85)';
      x.beginPath();
      x.ellipse(0, 0, 5, 2.5, 0, 0, 7);
      x.fill();
      x.restore();
    }
  },
};

function teaTexture(def) {
  return canvasTexture(512, 256, (x, w, h) => {
    const top = h * 0.66; // pearls sit below this line
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, def.tea[0]);
    g.addColorStop(0.7, def.tea[1]);
    g.addColorStop(1, def.tea[1]);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    PATTERNS[def.pattern](x, w, h, top);
    for (let row = 2; row >= 0; row--)
      for (let i = 0; i < 17; i++) {
        const cx = ((i + (row % 2) * 0.5) * w) / 16 + rand(-4, 4);
        const cy = top + 15 + row * 27 + rand(-3, 3);
        x.fillStyle = def.pearl || '#33190f';
        x.beginPath();
        x.arc(cx, cy, 14, 0, 7);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,.35)';
        x.beginPath();
        x.arc(cx - 5, cy - 5, 3.5, 0, 7);
        x.fill();
      }
  });
}

/* ---------- parts ---------- */
const shellGeo = new THREE.CylinderGeometry(0.56, 0.44, CUP_H, 36, 1, true);
const shellMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.18,
  shininess: 120,
  specular: 0xffffff,
  depthWrite: false,
});
const lidGeo = new THREE.SphereGeometry(0.56, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const lidMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.36,
  shininess: 120,
  specular: 0xffffff,
  depthWrite: false,
});
const rimGeo = new THREE.TorusGeometry(0.56, 0.035, 8, 36);
const FEATHER = [toon('#f3eee5'), toon('#e5ded1'), toon('#faf8f3')];
const SNEAKER = toon('#f4f1ea');
const SOLE = toon('#3a403c');

/** One feathered wing. `side` is -1 (left) or 1 (right). */
function buildWing(side) {
  const s = side;
  const wing = new THREE.Group();
  const base = ball(FEATHER[2], 1, s * 0.42, 0.1, 0.03, 0.48, 0.28, 0.035);
  base.rotation.z = s * 0.18;
  wing.add(base);
  // long primaries fanning out
  for (let i = 0; i < 9; i++) {
    const th = ((30 - i * 8.5) * Math.PI) / 180;
    const len = 1.18 - Math.abs(i - 2) * 0.07;
    const off = 0.14 + len / 2;
    const f = ball(
      FEATHER[i % 2],
      1,
      s * Math.cos(th) * off,
      Math.sin(th) * off - 0.02,
      -i * 0.006,
      len / 2,
      0.11,
      0.022,
    );
    f.rotation.z = s * th;
    wing.add(f);
  }
  // shorter coverts on top
  for (let i = 0; i < 6; i++) {
    const th = ((26 - i * 10) * Math.PI) / 180;
    const len = 0.62 - i * 0.03;
    const off = 0.1 + len / 2;
    const f = ball(FEATHER[2], 1, s * Math.cos(th) * off, Math.sin(th) * off + 0.02, 0.03, len / 2, 0.12, 0.026);
    f.rotation.z = s * th;
    wing.add(f);
  }
  wing.add(ball(FEATHER[2], 0.17, s * 0.08, 0.03, 0.04, 1.3, 1, 0.45));
  return wing;
}

/** Small minimal face. Returns the normal eyes and the "dizzy" X eyes so they can be swapped. */
export function addFace(parent, { y, R, spread = 0.26, eye = 0.055 }) {
  const eyes = new THREE.Group();
  const xeyes = new THREE.Group();
  xeyes.visible = false;
  parent.add(eyes, xeyes);
  for (const s of [-1, 1]) {
    const a = s * spread;
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R;
    const e = ball(INK, eye, x, y, z, 1, 1.2, 0.45);
    e.rotation.y = a;
    eyes.add(e, ball(WHITE, eye * 0.3, x - eye * 0.25, y + eye * 0.38, z + eye * 0.38));
    for (const k of [-1, 1]) {
      const b = block(INK, eye * 2.2, eye * 0.38, 0.02, x, y, z + 0.01);
      b.rotation.set(0, a, (k * Math.PI) / 4);
      xeyes.add(b);
    }
  }
  const mouth = mesh(GEO.arc, INK, 0, y - eye * 1.7, R + 0.008);
  mouth.scale.setScalar(eye * 0.55);
  mouth.rotation.z = Math.PI;
  parent.add(mouth);
  return { eyes, xeyes };
}

/**
 * Builds a boba model. The returned group's `userData` exposes the animated parts:
 * body, arms, legs, wings, face, shadow, plus wing pose values `fold` and `lift`.
 */
export function buildBoba(def) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const y0 = 0.03;
  const teaH = CUP_H - 0.1;
  body.add(
    mesh(
      new THREE.CylinderGeometry(radiusAt(y0 + teaH) - 0.03, radiusAt(y0) - 0.03, teaH, 36),
      toonMap(teaTexture(def)),
      0,
      LEG + y0 + teaH / 2,
    ),
  );
  const shell = mesh(shellGeo, shellMat, 0, LEG + CUP_H / 2);
  shell.renderOrder = 2;
  const rim = mesh(rimGeo, toon('#ffffff'), 0, LEG + CUP_H);
  rim.rotation.x = Math.PI / 2;
  const lid = mesh(lidGeo, lidMat, 0, LEG + CUP_H);
  lid.scale.y = 0.42;
  lid.renderOrder = 3;
  const straw = rod(toon('#ffffff'), 0.055, 1.2, 0.12, LEG + CUP_H + 0.38, -0.04);
  straw.rotation.z = -0.12;
  body.add(shell, rim, lid, straw);

  const face = addFace(body, { y: LEG + 0.86, R: radiusAt(0.86) + 0.01 });

  const limb = toon(def.limb);
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * (radiusAt(0.66) - 0.01), LEG + 0.66, 0);
    arm.rotation.z = s * 0.45;
    arm.add(rod(limb, 0.042, 0.32, 0, -0.16, 0), ball(limb, 0.065, 0, -0.33, 0));
    body.add(arm);
    return arm;
  });
  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.17, LEG, 0);
    leg.add(
      rod(limb, 0.055, 0.24, 0, -0.12, 0),
      ball(SNEAKER, 0.1, 0, -0.27, 0.05, 0.95, 0.55, 1.55),
      block(SOLE, 0.19, 0.03, 0.3, 0, -0.315, 0.05),
    );
    root.add(leg);
    return leg;
  });
  const wings = [-1, 1].map((s) => {
    const w = buildWing(s);
    w.position.set(s * 0.14, LEG + 1.0, -(radiusAt(1.0) - 0.03));
    body.add(w);
    return w;
  });
  const shadow = blobShadow(0.7);
  root.add(shadow);

  const gear = buildGear(body, root, arms[1], def);
  root.userData = { body, arms, legs, wings, face, shadow, gear, fold: 0.4, lift: 0 };
  return root;
}

/* ---------- gear: unlocked as the levels go by ---------- */
const BLADE = gloss('#3e1c0c', 0, 160);
const EDGE = gloss('#c98a4a', 0, 160);
const GOLD = gloss('#f2c14e', 0, 90);

/**
 * scarf (level 2), sheath + sword (level 2, sword shown while the power is active),
 * shades + surfboard (level 3). Everything starts hidden.
 */
function buildGear(body, root, rightArm, def) {
  // forest scarf: a band at the rim and two ribbons that trail behind
  const scarf = new THREE.Group();
  scarf.position.set(0, LEG + CUP_H - 0.12, 0);
  const band = mesh(new THREE.TorusGeometry(0.565, 0.05, 8, 36), toon('#7f9a84'));
  band.rotation.x = Math.PI / 2;
  scarf.add(band);
  const ribbons = [-1, 1].map((s) => {
    const segs = [];
    let parent = scarf;
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Group();
      seg.position.set(k ? 0 : s * 0.12, k ? 0 : 0.02, k ? -0.2 : -0.55);
      seg.add(block(toon(k % 2 ? '#7f9a84' : '#8fa892'), 0.12, 0.05, 0.22, 0, 0, -0.11));
      parent.add(seg);
      parent = seg;
      segs.push(seg);
    }
    return segs;
  });
  body.add(scarf);

  // sheath on the back; the sword itself lives in the right hand
  const sheath = block(toon('#2a1a12'), 0.1, 0.85, 0.05, 0.16, LEG + 0.7, -(radiusAt(0.7) + 0.02));
  sheath.rotation.z = -0.35;
  body.add(sheath);
  const sword = new THREE.Group();
  sword.position.set(0, -0.33, 0.02);
  const tip = mesh(new THREE.ConeGeometry(0.05, 0.14, 4), BLADE, 0, 1.05, 0);
  tip.rotation.y = Math.PI / 4;
  sword.add(
    block(BLADE, 0.1, 0.78, 0.028, 0, 0.6, 0),
    block(EDGE, 0.03, 0.76, 0.032, -0.045, 0.6, 0),
    tip,
    block(GOLD, 0.3, 0.05, 0.08, 0, 0.2, 0),
    rod(toon('#2a1a12'), 0.035, 0.22, 0, 0.06, 0),
    ball(GOLD, 0.05, 0, -0.07, 0),
  );
  sword.rotation.z = Math.PI; // the blade continues the line of the arm, away from the hand
  sword.scale.setScalar(1.15);
  sword.visible = false;
  rightArm.add(sword);

  // sunglasses
  const shades = new THREE.Group();
  const R = radiusAt(0.86) + 0.035;
  for (const s of [-1, 1]) {
    const a = s * 0.26;
    const lens = block(gloss('#15181c', 0, 160), 0.2, 0.1, 0.03, Math.sin(a) * R, LEG + 0.86, Math.cos(a) * R);
    lens.rotation.y = a;
    shades.add(lens);
  }
  shades.add(block(toon('#15181c'), 0.08, 0.025, 0.03, 0, LEG + 0.88, R + 0.01));
  shades.visible = false;
  body.add(shades);

  // surfboard under the feet
  const board = new THREE.Group();
  const deck = ball(toon(def.limb), 1, 0, 0.03, 0.15, 0.55, 0.06, 1.45);
  const stripe = ball(toon('#fbf9f4'), 1, 0, 0.04, 0.15, 0.14, 0.065, 1.42);
  const fin = block(toon('#2b3338'), 0.04, 0.2, 0.28, 0, -0.08, -1.05);
  fin.rotation.x = 0.4;
  board.add(deck, stripe, fin);
  board.visible = false;
  root.add(board);

  scarf.visible = false;
  sheath.visible = false;
  return { scarf, ribbons, sheath, sword, shades, board };
}
