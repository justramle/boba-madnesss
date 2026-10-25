// Shared materials, geometries and small mesh factories. Materials are cached by color so
// hundreds of meshes reuse a handful of GPU programs.
import * as THREE from 'three';

/* ---------- materials ---------- */
// three-step toon ramp for the soft, flat-shaded look
export const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([168, 214, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const toon = (color, extra) =>
  cached(
    `t${color}${extra ? JSON.stringify(extra) : ''}`,
    () => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra }),
  );

export const toonMap = (map, extra) => new THREE.MeshToonMaterial({ map, gradientMap: toonRamp, ...extra });

export const gloss = (color, opacity, shininess = 80) =>
  cached(
    `g${color}${opacity || 1}${shininess}`,
    () =>
      new THREE.MeshPhongMaterial({
        color,
        shininess,
        specular: 0x666666,
        transparent: !!opacity,
        opacity: opacity || 1,
        depthWrite: !opacity,
      }),
  );

export const basic = (color, extra) =>
  cached(`b${color}${extra ? JSON.stringify(extra) : ''}`, () => new THREE.MeshBasicMaterial({ color, ...extra }));

/* ---------- canvas textures ---------- */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/* ---------- shared geometry ---------- */
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 24, 16),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  box: new THREE.BoxGeometry(1, 1, 1),
  hemisphere: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  octahedron: new THREE.OctahedronGeometry(1, 0),
  arc: new THREE.TorusGeometry(1, 0.22, 8, 18, Math.PI),
  halo: new THREE.TorusGeometry(0.56, 0.014, 8, 64),
  circle: new THREE.CircleGeometry(1, 24),
};

/* ---------- mesh factories ---------- */
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Sphere of radius r, optionally squashed per axis. */
export function ball(mat, r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = mesh(GEO.sphere, mat, x, y, z);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}

/** Vertical cylinder of radius r and height h centred on (x, y, z). */
export function rod(mat, r, h, x = 0, y = 0, z = 0) {
  const m = mesh(GEO.cylinder, mat, x, y, z);
  m.scale.set(r, h, r);
  return m;
}

export function block(mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = mesh(GEO.box, mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

const shadowMat = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false,
  map: canvasTexture(64, 64, (x, w) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(60,66,60,.3)');
    g.addColorStop(1, 'rgba(60,66,60,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  }),
});

/** Soft blob shadow lying on the ground. */
export function blobShadow(r) {
  const m = mesh(GEO.circle, shadowMat, 0, 0.025, 0);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(r);
  return m;
}

/* ---------- palette shortcuts ---------- */
export const INK = toon('#1f2421');
export const WHITE = basic('#ffffff');
export const BRASS = gloss('#b8955c', 0, 60);
