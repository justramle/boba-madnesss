// Renderer, scene, camera and lights.
import * as THREE from 'three';

// Colors in this project are authored as final on-screen values (flat, hand-tuned palette),
// so color management is turned off and output is written as-is.
THREE.ColorManagement.enabled = false;

const WIDE_QUERY = '(min-width:820px) and (min-aspect-ratio:5/4)';

/** Soft daylight. Intensities are scaled by π for three's physically based light units. */
export function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.34 * Math.PI));
  scene.add(new THREE.HemisphereLight(0xf6f2ea, 0xc6cdc6, 0.3 * Math.PI));
  const sun = new THREE.DirectionalLight(0xfff0de, 0.4 * Math.PI);
  sun.position.set(-6, 10, 6);
  scene.add(sun);
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0); // the sky gradient is CSS behind the canvas

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xefe6da, 26, 100);
  addLights(scene);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 340);
  const wideMQ = window.matchMedia(WIDE_QUERY);

  const stage = {
    renderer,
    scene,
    camera,
    aspect: 1,
    wide: false,
    baseFov: 52,
    resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      stage.aspect = w / h;
      stage.wide = wideMQ.matches;
      // widen the view on tall phones so all three lanes stay visible
      stage.baseFov = stage.aspect < 1 ? 52 + (1 - stage.aspect) * 34 : 52;
      camera.aspect = stage.aspect;
      camera.fov = stage.baseFov;
      camera.updateProjectionMatrix();
    },
    /** Ease the fog toward a level's palette. */
    fogTarget: null,
    setFog(color, near, far) {
      stage.fogTarget = { color: new THREE.Color(color), near, far };
    },
    render() {
      renderer.render(scene, camera);
    },
  };
  window.addEventListener('resize', stage.resize);
  stage.resize();
  return stage;
}
