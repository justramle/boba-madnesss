// The three worlds. Each theme owns its scenery; the path and the ground plane are shared and
// swap material. When a level changes, the old scenery is allowed to run out behind the player
// while the new scenery streams in from ahead.
import * as THREE from 'three';
import { rand, pick } from '../utils/math.js';
import { toon, toonMap, basic, gloss, canvasTexture, roundRect, mesh, ball, rod, block } from '../engine/materials.js';

const LOOP = 120;

/* =================== helpers =================== */

/** Things that roll toward the camera. While the theme is active they recycle; otherwise they run out. */
function scroller(items, { limit = 14, loop = LOOP, onRecycle = () => {} } = {}) {
  return {
    update(move, active) {
      for (const it of items) {
        it.position.z += move;
        if (it.position.z > limit) {
          if (active) {
            it.position.z -= loop;
            onRecycle(it);
            it.visible = true;
          } else it.visible = false;
        }
      }
    },
    /** Place every item ahead of the camera; `full` also fills the stretch already in view. */
    enter(full = false) {
      for (const it of items) {
        it.position.z = full ? rand(limit - loop, limit) : -rand(30, loop + 5);
        onRecycle(it);
        it.visible = true;
      }
    },
    hide() {
      for (const it of items) it.visible = false;
    },
  };
}

/** Ambient point particles in a box around the player. `step` moves one particle. */
function particles({ count, color, size, opacity, box, step }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(box.x[0], box.x[1]);
    pos[i * 3 + 1] = rand(box.y[0], box.y[1]);
    pos[i * 3 + 2] = rand(box.z[0], box.z[1]);
    seeds[i] = rand(0, 6.28);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false }),
  );
  const wrap = (v, lo, hi) => (v < lo ? hi - (lo - v) : v > hi ? lo + (v - hi) : v);
  return {
    object: points,
    update(dt, move, time) {
      for (let i = 0; i < count; i++) {
        step(pos, i * 3, dt, move, time, seeds[i]);
        pos[i * 3] = wrap(pos[i * 3], box.x[0], box.x[1]);
        pos[i * 3 + 1] = wrap(pos[i * 3 + 1], box.y[0], box.y[1]);
        pos[i * 3 + 2] = wrap(pos[i * 3 + 2], box.z[0], box.z[1]);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function birds(group, { count, color, y, flat = false }) {
  const mat = basic(color, { fog: false });
  const flock = Array.from({ length: count }, () => {
    const b = new THREE.Group();
    const left = new THREE.Group();
    const right = new THREE.Group();
    left.add(block(mat, 0.9, 0.05, 0.22, -0.45, 0, 0));
    right.add(block(mat, 0.9, 0.05, 0.22, 0.45, 0, 0));
    b.add(left, right);
    b.userData = { left, right, phase: rand(0, 6), speed: rand(1.5, 3) };
    b.position.set(rand(-60, 60), rand(y[0], y[1]), rand(-110, -60));
    b.scale.setScalar(rand(0.7, 1.2));
    group.add(b);
    return b;
  });
  return (dt, time) => {
    for (const b of flock) {
      const u = b.userData;
      const flap = Math.sin(time * u.speed * 2 + u.phase) * (flat ? 0.25 : 0.45);
      u.left.rotation.z = flap;
      u.right.rotation.z = -flap;
      b.position.x += dt * u.speed;
      b.position.y += Math.sin(time * 0.5 + u.phase) * dt * 0.3;
      if (b.position.x > 70) {
        b.position.x = -70;
        b.position.y = rand(y[0], y[1]);
      }
    }
  };
}

const flat = (c) => basic(c, { fog: false });
function hazeBand(group, color, z, y = -14) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    map: canvasTexture(8, 64, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color.replace(')', ',0)').replace('rgb(', 'rgba('));
      g.addColorStop(1, color.replace(')', ',.95)').replace('rgb(', 'rgba('));
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    }),
  });
  group.add(mesh(new THREE.PlaneGeometry(420, 26), mat, 0, y, z));
}

/** A floating islet: an inverted stone cone with a flat top. */
const ROCK = ['#b8b0a2', '#aea697', '#c1b9ab'];
const rockGeo = new THREE.ConeGeometry(1.5, 2, 6);
const topGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.22, 6);
function islet(g, r = 1, rock = ROCK, top = '#c9c3b5') {
  const c = mesh(rockGeo, toon(pick(rock)), 0, -r, 0);
  c.rotation.x = Math.PI;
  c.scale.setScalar(r);
  const t = mesh(topGeo, toon(top), 0, 0.11 * r, 0);
  t.scale.set(r, 1, r);
  g.add(c, t);
}

/* =================== Level 1: Winter Mountain =================== */
function buildWinter(group) {
  const statics = new THREE.Group();
  group.add(statics);
  group.userData.statics = statics;
  const sideTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#e9e3d8';
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 24; i++) {
      const cx = rand(0, w);
      const cy = rand(0, w);
      const r = rand(24, 70);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = pick(['248,245,239', '248,245,239', '222,224,216', '238,231,220']);
      g.addColorStop(0, `rgba(${c},.9)`);
      g.addColorStop(1, `rgba(${c},0)`);
      for (const ox of [-w, 0, w])
        for (const oy of [-w, 0, w]) {
          x.save();
          x.translate(ox, oy);
          x.fillStyle = g;
          x.fillRect(cx - r, cy - r, r * 2, r * 2);
          x.restore();
        }
    }
  });
  sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping;
  sideTex.repeat.set(7, 10);

  const pathTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#bdb3a3';
    x.fillRect(0, 0, w, w);
    const tones = ['#ddd5c7', '#d6cebf', '#e1dacd', '#d9d1c3'];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        x.fillStyle = tones[(r * 3 + c * 2) % 4];
        roundRect(x, (c * w) / 3 + 2, r * 64 + 2, w / 3 - 4, 60, 3);
        x.fill();
        x.fillStyle = 'rgba(160,150,135,.18)';
        for (let k = 0; k < 6; k++) {
          x.beginPath();
          x.arc((c * w) / 3 + rand(8, w / 3 - 8), r * 64 + rand(8, 56), rand(1, 2.4), 0, 7);
          x.fill();
        }
      }
  });
  pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;
  pathTex.repeat.set(1, 30);

  statics.add(block(toon('#b3aa9b'), 6.5, 0.9, 260, 0, -0.46, -100));
  for (const s of [-1, 1]) statics.add(block(toon('#9d9384'), 0.14, 0.08, 260, s * 3.25, 0.04, -100));

  const mistMat = toon('#f2efe8');
  const banks = Array.from({ length: 56 }, (_, i) => {
    const s = i % 2 ? 1 : -1;
    const b = ball(mistMat, rand(1, 1.8), s * rand(4.2, 6.2), rand(-0.9, -0.4), 8 - (i / 56) * LOOP, 1.7, 0.4, 1.1);
    b.userData.side = s;
    group.add(b);
    return b;
  });

  const cypressGeo = new THREE.ConeGeometry(0.32, 2.4, 8);
  const cypress = (g, x, z, s) => {
    const c = mesh(cypressGeo, toon(pick(['#5f7268', '#6c7f73', '#56685e'])), x, 0.22 + 1.2 * s, z);
    c.scale.setScalar(s);
    g.add(c);
  };
  const kinds = [
    (g) => {
      islet(g);
      cypress(g, -0.4, 0.1, 1);
      cypress(g, 0.3, -0.3, 0.8);
      cypress(g, 0.8, 0.4, 0.6);
    },
    (g) => {
      for (let i = 0; i < 3; i++) {
        const m = block(
          toon(pick(['#cfc8ba', '#c2baab', '#d8d1c4'])),
          rand(0.5, 0.8),
          rand(2.2, 4.2),
          rand(0.4, 0.7),
          (i - 1) * 1.1,
          0,
          rand(-0.4, 0.4),
        );
        m.position.y = m.scale.y / 2 - 0.4;
        m.rotation.set(rand(-0.06, 0.06), rand(0, 3), rand(-0.08, 0.08));
        g.add(m);
      }
    },
    (g) => {
      islet(g, 1.1);
      const dark = toon('#3c4541');
      for (const [x, z] of [
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ])
        g.add(rod(dark, 0.05, 1.3, x, 0.9, z));
      const roof = mesh(new THREE.ConeGeometry(1.35, 0.55, 4), toon('#4a5550'), 0, 1.92, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(block(dark, 1.8, 0.1, 1.8, 0, 1.6, 0), roof, block(toon('#d8cfbf'), 1.3, 0.08, 1.3, 0, 0.27, 0));
    },
    (g) => {
      islet(g, 0.6);
      const stone = toon('#cbc3b4');
      const roof = mesh(new THREE.ConeGeometry(0.42, 0.3, 4), toon('#9d9384'), 0, 1.5, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(
        block(stone, 0.45, 0.14, 0.45, 0, 0.3, 0),
        rod(stone, 0.1, 0.7, 0, 0.72, 0),
        block(stone, 0.4, 0.3, 0.4, 0, 1.2, 0),
        block(basic('#f4dcb0'), 0.26, 0.18, 0.41, 0, 1.2, 0),
        roof,
      );
    },
    (g) => {
      for (let i = 0; i < 3; i++) {
        const b = mesh(
          new THREE.IcosahedronGeometry(rand(0.4, 0.8), 0),
          toon(pick(ROCK)),
          rand(-1, 1),
          rand(0.5, 2),
          rand(-0.6, 0.6),
        );
        b.rotation.set(rand(0, 3), rand(0, 3), 0);
        g.add(b);
      }
      g.userData.spin = true;
    },
  ];
  const place = (g) => {
    g.position.x = g.userData.side * rand(7.5, 16);
    g.userData.baseY = g.userData.spin ? rand(1, 3.5) : rand(-0.6, 1.8);
    g.rotation.y = rand(0, 6.28);
  };
  const decos = Array.from({ length: 30 }, (_, i) => {
    const g = new THREE.Group();
    kinds[i % kinds.length](g);
    g.userData.side = i % 2 ? 1 : -1;
    g.userData.phase = rand(0, 6);
    place(g);
    g.position.z = 8 - (i / 30) * LOOP;
    g.scale.setScalar(rand(0.9, 1.3));
    group.add(g);
    return g;
  });

  const gateGeo = new THREE.TorusGeometry(4.45, 0.1, 10, 72, Math.PI);
  const gates = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group();
    g.add(mesh(gateGeo, toon(i % 2 ? '#b39467' : '#38413d'), 0, 0.1, 0));
    for (const s of [-1, 1]) g.add(block(toon('#9d9384'), 0.5, 0.5, 0.5, s * 4.45, -0.1, 0));
    g.position.z = -16 - i * 36;
    group.add(g);
    return g;
  });

  // backdrop: layered ranges, a pale sun
  const far = new THREE.Group();
  far.position.z = -150;
  statics.add(far);
  for (const L of [
    {
      z: -70,
      c: '#cdd5d2',
      snow: '#eef0ec',
      peaks: [
        [-120, 70, 48],
        [-60, 92, 52],
        [0, 110, 60],
        [70, 84, 50],
        [130, 66, 44],
      ],
    },
    {
      z: -40,
      c: '#b9c4bf',
      snow: '#e6e9e4',
      peaks: [
        [-95, 52, 40],
        [-30, 64, 44],
        [40, 58, 42],
        [105, 50, 38],
      ],
    },
    {
      z: -12,
      c: '#a6b3ad',
      peaks: [
        [-75, 32, 34],
        [-15, 40, 36],
        [55, 34, 34],
        [120, 30, 30],
        [-140, 28, 30],
      ],
    },
  ]) {
    for (const [x, h, r] of L.peaks) {
      far.add(mesh(new THREE.ConeGeometry(r, h, 6), flat(L.c), x, h / 2 - 24, L.z + rand(-4, 4)));
      if (L.snow)
        far.add(mesh(new THREE.ConeGeometry(r * 0.26, h * 0.26, 6), flat(L.snow), x, h - 24 - h * 0.13 + 0.3, L.z));
    }
    hazeBand(far, 'rgb(239,230,218)', L.z + 8);
  }
  far.add(mesh(new THREE.CircleGeometry(13, 48), flat('#f7f0e3'), -48, 46, -90));
  far.add(
    mesh(
      new THREE.CircleGeometry(20, 48),
      basic('#f6eee1', { fog: false, transparent: true, opacity: 0.35 }),
      -48,
      46,
      -91,
    ),
  );
  const flock = birds(statics, { count: 7, color: '#59625d', y: [16, 30] });

  const snow = particles({
    count: 420,
    color: '#ffffff',
    size: 0.11,
    opacity: 0.85,
    box: { x: [-16, 16], y: [-1, 13], z: [-50, -1] },
    step(p, i, dt, move, time, seed) {
      p[i] += Math.sin(time * 0.8 + seed) * dt * 0.5;
      p[i + 1] -= dt * (1.1 + Math.sin(seed) * 0.3);
      p[i + 2] += move;
    },
  });
  statics.add(snow.object);

  const sc = [
    scroller(banks, { limit: 12, onRecycle: (b) => (b.position.x = b.userData.side * rand(4.2, 6.2)) }),
    scroller(decos, { onRecycle: place }),
    scroller(gates, { loop: 144 }),
  ];
  return {
    pathMat: toonMap(pathTex),
    sideMat: new THREE.MeshBasicMaterial({ map: sideTex }),
    pathTex,
    sideTex,
    sideScroll: 1 / 40,
    enter(full) {
      sc.forEach((s) => s.enter(full));
    },
    update(move, dt, time, active) {
      sc.forEach((s) => s.update(move, active));
      for (const g of decos) {
        g.position.y = g.userData.baseY + Math.sin(time * 0.6 + g.userData.phase) * 0.18;
        if (g.userData.spin) g.rotation.y += dt * 0.25;
      }
      flock(dt, time);
      snow.update(dt, move, time);
    },
  };
}

/* =================== Level 2: Forest Bridge =================== */
// A timber bridge through a pine valley at dusk: deep muted greens, warm lantern light,
// fireflies, a thread of brass. Darker than the mountain, but the same restraint.
function buildForest(group) {
  const statics = new THREE.Group();
  group.add(statics);
  group.userData.statics = statics;

  // forest floor in shadow: soft moss patches
  const sideTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#4b5a4d';
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 24; i++) {
      const cx = rand(0, w);
      const cy = rand(0, w);
      const r = rand(26, 74);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = pick(['84,104,90', '66,84,72', '96,116,100', '76,96,82']);
      g.addColorStop(0, `rgba(${c},.9)`);
      g.addColorStop(1, `rgba(${c},0)`);
      for (const ox of [-w, 0, w])
        for (const oy of [-w, 0, w]) {
          x.save();
          x.translate(ox, oy);
          x.fillStyle = g;
          x.fillRect(cx - r, cy - r, r * 2, r * 2);
          x.restore();
        }
    }
  });
  sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping;
  sideTex.repeat.set(7, 10);

  // weathered timber planks with narrow shadow gaps; two faint stringers mark the lanes
  const pathTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#3f3328';
    x.fillRect(0, 0, w, w);
    const tones = ['#8b7557', '#80694d', '#927b5d', '#7a6549'];
    for (let r = 0; r < 8; r++) {
      x.fillStyle = tones[r % 4];
      roundRect(x, 2, r * 32 + 3, w - 4, 26, 2);
      x.fill();
      x.fillStyle = 'rgba(40,28,14,.3)';
      for (let k = 0; k < 3; k++) x.fillRect(rand(8, w - 50), r * 32 + rand(7, 22), rand(12, 40), 1.2);
    }
    x.fillStyle = 'rgba(45,32,20,.55)';
    for (const u of [w / 3, (2 * w) / 3]) x.fillRect(u - 1.5, 0, 3, w);
  });
  pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;
  pathTex.repeat.set(1, 30);

  // deck + slim rails: charcoal posts under a thin brass hand-rail, warm lanterns on top
  statics.add(block(toon('#54432f'), 6.5, 0.7, 260, 0, -0.36, -100));
  const stone = toon('#8a9188');
  const dark = toon('#2a3230');
  for (const s of [-1, 1]) {
    const r1 = rod(toon('#b39467'), 0.035, 260, s * 3.3, 1.02, -100);
    r1.rotation.x = Math.PI / 2;
    const r2 = rod(toon('#6a5a44'), 0.03, 260, s * 3.3, 0.56, -100);
    r2.rotation.x = Math.PI / 2;
    statics.add(r1, r2);
  }
  const lampMat = basic('#ffd9a0');
  const glowMat = basic('#ffc46a', { transparent: true, opacity: 0.28, depthWrite: false });
  const posts = Array.from({ length: 20 }, (_, i) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      g.add(
        rod(dark, 0.07, 1.2, s * 3.3, 0.5, 0),
        block(dark, 0.2, 0.06, 0.2, s * 3.3, 1.08, 0),
        block(lampMat, 0.13, 0.13, 0.13, s * 3.3, 1.18, 0),
        block(dark, 0.2, 0.05, 0.2, s * 3.3, 1.28, 0),
        ball(glowMat, 0.42, s * 3.3, 1.18, 0),
      );
    }
    g.position.z = 8 - (i / 20) * LOOP;
    group.add(g);
    return g;
  });

  // scenery: dusk pines, a slender tree, floating islets, stone lanterns, moss stones
  const SAGE = ['#3f5548', '#4a6254', '#36493f', '#52705f'];
  const trunkMat = toon('#5a4a3a');
  const pine = (g, x, z, h) => {
    g.add(
      mesh(new THREE.ConeGeometry(h * 0.27, h, 7), toon(pick(SAGE)), x, 0.6 + h / 2, z),
      rod(trunkMat, 0.07, 0.7, x, 0.3, z),
    );
  };
  const lantern = (g, x, z, s = 1) => {
    const l = new THREE.Group();
    l.position.set(x, 0, z);
    l.scale.setScalar(s);
    const roof = mesh(new THREE.ConeGeometry(0.46, 0.3, 4), toon('#4a5550'), 0, 1.4, 0);
    roof.rotation.y = Math.PI / 4;
    l.add(
      block(stone, 0.5, 0.14, 0.5, 0, 0.07, 0),
      rod(stone, 0.1, 0.8, 0, 0.54, 0),
      block(stone, 0.42, 0.32, 0.42, 0, 1.1, 0),
      block(lampMat, 0.26, 0.18, 0.43, 0, 1.1, 0),
      ball(glowMat, 0.55, 0, 1.1, 0),
      roof,
    );
    g.add(l);
  };
  const kinds = [
    (g) => {
      for (let i = 0; i < 5; i++) pine(g, rand(-1.6, 1.6), rand(-1.6, 1.6), rand(2.4, 5));
    },
    (g) => {
      g.add(rod(trunkMat, 0.16, 8, 0, 3.4, 0));
      for (let i = 0; i < 4; i++) {
        const h = 3.2 - i * 0.5;
        g.add(mesh(new THREE.ConeGeometry(h * 0.24, h, 7), toon(pick(SAGE)), 0, 3.6 + i * 1.5, 0));
      }
    },
    (g) => {
      islet(g, 1.1, ['#6e6a5f', '#625e54', '#7a756a'], '#7f8277');
      pine(g, -0.5, 0.2, 2.6);
      pine(g, 0.5, -0.4, 2);
      lantern(g, 0.3, 0.7, 0.6);
      g.userData.float = true;
    },
    (g) => {
      lantern(g, 0, 0, 1.3);
      pine(g, 1.3, -0.6, 3);
    },
    (g) => {
      for (let i = 0; i < 3; i++)
        g.add(
          ball(
            toon(pick(['#56685a', '#4f6052', '#637565'])),
            rand(0.5, 0.9),
            rand(-1, 1),
            rand(0.1, 0.4),
            rand(-0.6, 0.6),
            1.3,
            0.7,
            1.1,
          ),
        );
    },
  ];
  const place = (g) => {
    const s = g.userData.side;
    if (g.userData.float) {
      g.position.x = s * rand(8, 16);
      g.userData.baseY = rand(2.2, 4.4);
    } else {
      const d = rand(5.4, 15);
      g.position.x = s * d;
      g.userData.baseY = -1.3 + (d - 5) * 0.3; // the valley walls rise away from the bridge
    }
    g.rotation.y = rand(0, 6.28);
  };
  const decos = Array.from({ length: 36 }, (_, i) => {
    const g = new THREE.Group();
    kinds[i % kinds.length](g);
    g.userData.side = i % 2 ? 1 : -1;
    g.userData.phase = rand(0, 6);
    place(g);
    g.position.y = g.userData.baseY;
    g.position.z = 8 - (i / 36) * LOOP;
    g.scale.setScalar(rand(0.9, 1.3));
    group.add(g);
    return g;
  });

  // slim frame gates: charcoal posts, a thin lintel in brass or near-black
  const gates = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group();
    for (const s of [-1, 1])
      g.add(rod(dark, 0.11, 7.2, s * 4.4, 3.6, 0), block(dark, 0.34, 0.12, 0.34, s * 4.4, 7.26, 0));
    g.add(
      block(toon(i % 2 ? '#b39467' : '#1f2724'), 9.8, 0.11, 0.22, 0, 7.2, 0),
      block(toon('#4a5550'), 9.0, 0.07, 0.2, 0, 6.6, 0),
    );
    g.position.z = -16 - i * 36;
    group.add(g);
    return g;
  });

  // backdrop: dusk ridges, a tree line on the nearest one, a low moon
  const far = new THREE.Group();
  far.position.z = -150;
  statics.add(far);
  for (const L of [
    {
      z: -70,
      c: '#8e9a86',
      hills: [
        [-110, 44, 70],
        [-30, 56, 80],
        [60, 48, 76],
        [140, 40, 64],
      ],
    },
    {
      z: -40,
      c: '#76857a',
      hills: [
        [-80, 32, 60],
        [10, 40, 66],
        [95, 34, 58],
      ],
    },
    {
      z: -12,
      c: '#5f6f64',
      hills: [
        [-130, 22, 52],
        [-45, 26, 54],
        [40, 24, 50],
        [125, 22, 48],
      ],
    },
  ]) {
    for (const [x, h, r] of L.hills) far.add(ball(flat(L.c), 1, x, -24, L.z, r, h, r * 0.6));
    hazeBand(far, 'rgb(165,170,146)', L.z + 10, -16);
  }
  for (let i = 0; i < 44; i++) {
    const h = rand(6, 15);
    far.add(mesh(new THREE.ConeGeometry(h * 0.17, h, 5), flat('#4f5f55'), rand(-150, 150), -8 + h / 2, rand(-8, 2)));
  }
  far.add(mesh(new THREE.CircleGeometry(8, 48), flat('#f3ead0'), 52, 48, -90));
  far.add(
    mesh(
      new THREE.CircleGeometry(15, 48),
      basic('#f3ead0', { fog: false, transparent: true, opacity: 0.22 }),
      52,
      48,
      -91,
    ),
  );
  const flock = birds(statics, { count: 4, color: '#1f2b26', y: [12, 24] });

  // fireflies
  const motes = particles({
    count: 150,
    color: '#ffe08a',
    size: 0.15,
    opacity: 0.8,
    box: { x: [-12, 12], y: [0.3, 5], z: [-44, -1] },
    step(p, i, dt, move, time, seed) {
      p[i] += Math.sin(time * 1.3 + seed) * dt * 0.7;
      p[i + 1] += Math.cos(time * 0.9 + seed * 2) * dt * 0.4;
      p[i + 2] += move * 0.85;
    },
  });
  statics.add(motes.object);

  const sc = [scroller(posts, { limit: 12 }), scroller(decos, { onRecycle: place }), scroller(gates, { loop: 144 })];
  return {
    pathMat: toonMap(pathTex),
    sideMat: new THREE.MeshBasicMaterial({ map: sideTex }),
    pathTex,
    sideTex,
    sideScroll: 1 / 50,
    enter(full) {
      sc.forEach((s) => s.enter(full));
    },
    update(move, dt, time, active) {
      sc.forEach((s) => s.update(move, active));
      for (const g of decos)
        g.position.y = g.userData.baseY + (g.userData.float ? Math.sin(time * 0.6 + g.userData.phase) * 0.18 : 0);
      flock(dt, time);
      motes.update(dt, move, time);
      motes.object.material.opacity = 0.6 + Math.sin(time * 3) * 0.25;
    },
  };
}

/* =================== Level 3: Ocean Surf =================== */
// A pale morning sea: seafoam water, cream sand, slender palms and white sails, pale stone arches.
function buildOcean(group) {
  const statics = new THREE.Group();
  group.add(statics);
  group.userData.statics = statics;
  const water = (lane) =>
    canvasTexture(256, 256, (x, w) => {
      const g = x.createLinearGradient(0, 0, 0, w);
      g.addColorStop(0, lane ? '#c7dcda' : '#a7c4c6');
      g.addColorStop(1, lane ? '#d0e2df' : '#b2cccd');
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
      x.strokeStyle = lane ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.32)';
      x.lineCap = 'round';
      for (let i = 0; i < (lane ? 8 : 16); i++) {
        x.lineWidth = rand(1.2, 2.6);
        x.beginPath();
        const y0 = rand(0, w);
        const x0 = rand(0, w);
        for (let j = 0; j <= 50; j += 5) x.lineTo(x0 + j, y0 + Math.sin(j / 9) * 3);
        x.stroke();
      }
      if (lane) {
        x.fillStyle = 'rgba(255,255,255,.55)';
        for (const u of [w / 3, (2 * w) / 3]) for (let v = 6; v < w; v += 22) x.fillRect(u - 1.2, v, 2.4, 10);
      }
    });
  const sideTex = water(false);
  sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping;
  sideTex.repeat.set(10, 14);
  const pathTex = water(true);
  pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;
  pathTex.repeat.set(1, 30);

  // foam edges instead of curbs
  for (const s of [-1, 1]) statics.add(block(toon('#f3f1ea'), 0.3, 0.06, 260, s * 3.22, 0.03, -100));
  const crestMat = toon('#eaf0ec');
  const crests = Array.from({ length: 40 }, (_, i) => {
    const s = i % 2 ? 1 : -1;
    const c = ball(crestMat, rand(0.5, 1.1), s * rand(4.5, 12), 0.02, 8 - (i / 40) * LOOP, 2.4, 0.1, 0.36);
    c.userData.side = s;
    group.add(c);
    return c;
  });

  const sand = toon('#e9e0cf');
  const cream = toon('#f1ece3');
  const clay = toon('#c08a6e');
  const frond = [toon('#8fa392'), toon('#9fb39f')];
  const palm = (g, x, z, lean) => {
    const t = rod(toon('#c4b49c'), 0.1, 2.6, x, 1.2, z);
    t.rotation.z = lean;
    g.add(t);
    for (let i = 0; i < 6; i++) {
      const leaf = ball(frond[i % 2], 1, x - lean * 1.1, 2.5, z, 0.95, 0.07, 0.26);
      leaf.rotation.set(0, (i / 6) * Math.PI * 2, -0.45);
      g.add(leaf);
    }
  };
  const kinds = [
    (g) => {
      g.add(ball(sand, 2, 0, -0.6, 0, 1, 0.3, 1));
      palm(g, -0.4, 0, 0.2);
      palm(g, 0.5, -0.2, -0.22);
    },
    (g) => {
      g.add(
        rod(toon('#efe9dc'), 0.18, 1.5, 0, 0.75, 0),
        rod(clay, 0.19, 0.28, 0, 1.05, 0),
        ball(gloss('#b8955c', 0, 60), 0.1, 0, 1.56, 0),
      );
      g.userData.bob = true;
    },
    (g) => {
      for (let i = 0; i < 3; i++) {
        // smooth sea stacks: rounded pillars with a cap of moss
        const h = rand(1.6, 3.4);
        const r = rand(0.45, 0.8);
        const x = rand(-1, 1);
        const z = rand(-0.8, 0.8);
        g.add(
          ball(toon(pick(['#cbc3b4', '#c1b9ab', '#d3cdbf'])), 1, x, h * 0.5 - 0.4, z, r, h * 0.5, r),
          ball(toon('#a8b9a5'), r * 0.8, x, h * 0.5 - 0.4 + h * 0.5 - 0.1, z, 1, 0.35, 1),
        );
      }
    },
    (g) => {
      const hull = ball(cream, 1, 0, 0.15, 0, 1.3, 0.35, 0.55);
      const mast = rod(toon('#cdc3b2'), 0.04, 2.6, 0, 1.4, 0);
      const sailGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.05, 0.3, 0),
        new THREE.Vector3(0.05, 2.6, 0),
        new THREE.Vector3(1.3, 0.5, 0),
      ]);
      sailGeo.computeVertexNormals();
      const sail = mesh(sailGeo, toon(pick(['#f6f2ea', '#d9cfc0', '#e7c9b8']), { side: THREE.DoubleSide }));
      g.add(hull, mast, sail);
      g.userData.bob = true;
      g.userData.farOnly = true;
    },
    (g) => {
      const cap = mesh(new THREE.ConeGeometry(0.4, 0.36, 8), toon('#38413d'), 0, 2.78, 0);
      g.add(
        ball(sand, 1.6, 0, -0.5, 0, 1, 0.3, 1),
        rod(cream, 0.3, 2.3, 0, 1.15, 0),
        rod(clay, 0.31, 0.3, 0, 1.3, 0),
        block(basic('#f4dcb0'), 0.34, 0.3, 0.34, 0, 2.45, 0),
        cap,
      );
    },
  ];
  const place = (g) => {
    const s = g.userData.side;
    g.position.x = s * (g.userData.farOnly ? rand(14, 24) : rand(6, 16));
    g.userData.baseY = 0;
    g.rotation.y = rand(0, 6.28);
  };
  const decos = Array.from({ length: 30 }, (_, i) => {
    const g = new THREE.Group();
    kinds[i % kinds.length](g);
    g.userData.side = i % 2 ? 1 : -1;
    g.userData.phase = rand(0, 6);
    place(g);
    g.position.z = 8 - (i / 30) * LOOP;
    g.scale.setScalar(rand(0.9, 1.3));
    group.add(g);
    return g;
  });

  // pale stone sea arches
  const archGeo = new THREE.TorusGeometry(4.45, 0.18, 10, 72, Math.PI);
  const gates = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group();
    g.add(mesh(archGeo, toon(i % 2 ? '#b39467' : '#cbc3b4'), 0, 0.1, 0));
    for (const s of [-1, 1]) g.add(block(toon('#b3aa9b'), 0.7, 0.5, 0.7, s * 4.45, -0.1, 0));
    g.position.z = -16 - i * 36;
    group.add(g);
    return g;
  });

  // backdrop: soft headlands, a haze line, a pale sun, a few cream clouds
  const far = new THREE.Group();
  far.position.z = -150;
  statics.add(far);
  for (const [x, h, r, c] of [
    [-120, 18, 40, '#c3d0d0'],
    [-40, 26, 48, '#b7c6c7'],
    [70, 20, 44, '#c3d0d0'],
    [150, 14, 36, '#cfdad9'],
  ]) {
    far.add(mesh(new THREE.ConeGeometry(r, h, 7), flat(c), x, h / 2 - 22, -40));
  }
  hazeBand(far, 'rgb(229,234,231)', -30, -16);
  far.add(mesh(new THREE.CircleGeometry(13, 48), flat('#f7f0e3'), 40, 50, -90));
  far.add(
    mesh(
      new THREE.CircleGeometry(22, 48),
      basic('#f6eee1', { fog: false, transparent: true, opacity: 0.3 }),
      40,
      50,
      -91,
    ),
  );
  for (let i = 0; i < 6; i++)
    far.add(ball(flat('#f3efe6'), rand(5, 9), rand(-140, 140), rand(34, 58), rand(-20, 10), 2.4, 0.55, 1.2));
  const flock = birds(statics, { count: 7, color: '#8f9a95', y: [8, 22], flat: true });

  const spray = particles({
    count: 160,
    color: '#ffffff',
    size: 0.12,
    opacity: 0.55,
    box: { x: [-8, 8], y: [0, 2.4], z: [-40, -1] },
    step(p, i, dt, move, time, seed) {
      p[i + 1] += (Math.sin(time * 3 + seed) > 0.6 ? 2 : -1.3) * dt;
      p[i + 2] += move;
    },
  });
  statics.add(spray.object);

  const sc = [
    scroller(crests, { limit: 12, onRecycle: (c) => (c.position.x = c.userData.side * rand(4.5, 12)) }),
    scroller(decos, { onRecycle: place }),
    scroller(gates, { loop: 144 }),
  ];
  return {
    pathMat: toonMap(pathTex),
    sideMat: new THREE.MeshBasicMaterial({ map: sideTex }),
    pathTex,
    sideTex,
    sideScroll: 1 / 30,
    enter(full) {
      sc.forEach((s) => s.enter(full));
    },
    update(move, dt, time, active) {
      sc.forEach((s) => s.update(move, active));
      for (const c of crests) c.position.x += Math.sin(time * 2 + c.position.z) * dt * 0.3;
      for (const g of decos) {
        if (g.userData.bob) g.position.y = Math.sin(time * 1.4 + g.userData.phase) * 0.12;
        if (g.userData.farOnly) g.position.x += dt * 0.4 * g.userData.side;
      }
      pathTex.offset.x = Math.sin(time * 0.8) * 0.01;
      flock(dt, time);
      spray.update(dt, move, time);
    },
  };
}

/* =================== facade =================== */
export function createEnvironment(scene) {
  const groups = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  groups.forEach((g) => scene.add(g));
  const themes = [buildWinter(groups[0]), buildForest(groups[1]), buildOcean(groups[2])];

  const side = mesh(new THREE.PlaneGeometry(260, 340), themes[0].sideMat, 0, -3.2, -120);
  side.rotation.x = -Math.PI / 2;
  const path = mesh(new THREE.PlaneGeometry(6.3, 260), themes[0].pathMat, 0, 0.012, -100);
  path.rotation.x = -Math.PI / 2;
  scene.add(side, path);

  let current = 0;
  let fading = null; // { index, travelled } — a theme whose scenery is running out
  groups.forEach((g, i) => (g.visible = i === 0));

  return {
    get level() {
      return current;
    },
    /**
     * Switch worlds. Mid-run the old scenery keeps scrolling until it has passed the camera;
     * with `instant` (menu preview) it is swapped on the spot.
     */
    setTheme(i, instant = false) {
      if (i === current) return;
      if (fading) groups[fading.index].visible = false;
      if (instant) {
        groups[current].visible = false;
        fading = null;
      } else {
        fading = { index: current, travelled: 0 };
        groups[current].userData.statics.visible = false;
      }
      current = i;
      const t = themes[i];
      path.material = t.pathMat;
      side.material = t.sideMat;
      groups[i].visible = true;
      groups[i].userData.statics.visible = true;
      t.enter(instant);
    },
    update(move, dt, time) {
      const t = themes[current];
      t.pathTex.offset.y = (t.pathTex.offset.y + move / (260 / 30)) % 1;
      t.sideTex.offset.y = (t.sideTex.offset.y + move * t.sideScroll) % 1;
      themes.forEach((th, i) => {
        if (groups[i].visible) th.update(move, dt, time, i === current);
      });
      if (fading) {
        fading.travelled += move;
        if (fading.travelled > 26) {
          groups[fading.index].visible = false;
          fading = null;
        }
      }
    },
  };
}
