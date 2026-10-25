// Entry point: builds the world, wires UI + input, starts the loop.
import './styles/main.css';
import { BOBAS } from './data/bobas.js';
import { sound } from './audio/sound.js';
import { bindInput } from './engine/input.js';
import { buildBoba } from './entities/boba.js';
import { createStage } from './world/stage.js';
import { createEnvironment } from './world/environment.js';
import { createEffects } from './world/effects.js';
import { renderIcons } from './world/icons.js';
import { createPools } from './game/pools.js';
import { createSpawner } from './game/spawner.js';
import { AdaptiveDirector } from './ai/adaptive.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';

/** Wait briefly for web fonts so canvas-drawn labels use them. */
async function fontsReady() {
  if (!document.fonts?.load) return;
  const fonts = ['400 40px "Instrument Serif"', '800 16px Manrope'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(fonts).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
}

async function boot() {
  const ui = new UI();
  await fontsReady();

  let stage;
  try {
    stage = createStage(document.getElementById('c'));
  } catch (err) {
    console.error(err);
    ui.showWebGLError();
    return;
  }

  const environment = createEnvironment(stage.scene);
  const models = BOBAS.map((def) => {
    const m = buildBoba(def);
    m.visible = false;
    stage.scene.add(m);
    return m;
  });
  const icons = renderIcons(models, stage.scene);
  const effects = createEffects(stage.scene);
  const pools = createPools(stage.scene);
  const active = [];
  const spawnRow = createSpawner(pools, active);
  const director = new AdaptiveDirector();

  const game = new Game({ stage, environment, effects, pools, spawnRow, active, models, icons, ui, sound, director });

  ui.buildPicker(BOBAS, icons, (i) => game.select(i));
  ui.setGuideIcons(icons);
  ui.bindToggles(sound, director);
  ui.bindButtons({
    start: () => game.startRun(),
    menu: () => game.toMenu(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    click: () => sound.click(),
  });
  bindInput(game);
  game.start();

  if (import.meta.env.DEV) window.game = game; // handy for debugging in the console
}

boot();
