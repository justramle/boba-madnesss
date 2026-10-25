// Particle bursts, the bomb blast and the shield bubble.
import * as THREE from 'three';
import { rand } from '../utils/math.js';
import { basic, GEO, mesh } from '../engine/materials.js';

const SPARK_LIFE = 0.5;

export function createEffects(scene) {
  const sparks = Array.from({ length: 80 }, () => {
    const m = mesh(GEO.octahedron, basic('#ffffff'));
    m.scale.setScalar(0.06);
    m.visible = false;
    scene.add(m);
    return { m, v: new THREE.Vector3(), life: 0 };
  });
  let nextSpark = 0;

  const bubble = mesh(
    new THREE.SphereGeometry(1.45, 32, 20),
    new THREE.MeshPhongMaterial({
      color: '#f3e3b8',
      transparent: true,
      opacity: 0.16,
      shininess: 140,
      specular: 0xffffff,
      depthWrite: false,
    }),
  );
  bubble.visible = false;
  bubble.renderOrder = 6;

  const blast = mesh(
    GEO.sphere,
    new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false }),
  );
  blast.visible = false;
  let blastT = 0;
  scene.add(bubble, blast);

  return {
    bubble,

    burst(pos, color, count = 9, power = 1) {
      for (let i = 0; i < count; i++) {
        const s = sparks[nextSpark++ % sparks.length];
        s.m.material = basic(i % 3 ? color : '#ffffff');
        s.m.position.copy(pos);
        s.m.scale.setScalar(0.07);
        s.m.visible = true;
        s.life = SPARK_LIFE;
        s.v.set(rand(-2.4, 2.4) * power, rand(1.2, 4) * power, rand(-1, 2.4) * power);
      }
    },

    boom(pos) {
      blast.position.copy(pos);
      blast.visible = true;
      blastT = 0.6;
      this.burst(pos, '#ffb85a', 22, 1.6);
    },

    update(dt) {
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.v.y -= 9 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(0.07 * Math.max(0, s.life / SPARK_LIFE) + 0.005);
        if (s.life <= 0) s.m.visible = false;
      }
      if (blastT > 0) {
        blastT -= dt;
        const k = 1 - blastT / 0.6;
        blast.scale.setScalar(0.3 + k * 2.6);
        blast.material.opacity = 0.7 * (1 - k);
        if (blastT <= 0) blast.visible = false;
      }
    },
  };
}
