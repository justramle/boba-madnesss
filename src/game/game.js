// Game state machine and main loop: menu → running ⇄ paused → dying → over.
// Also owns the level progression, the power-ups and the hand-off to the adaptive director.
import * as THREE from 'three';
import { SPEED, COMBO, SCORE, MILESTONE_STEP, SPAWN_Z, TEMPO, POWERUP, rowGap } from '../config.js';
import { damp, smoothstep, rand } from '../utils/math.js';
import { BOBAS } from '../data/bobas.js';
import { LEVELS, levelIndexForDistance, worldStart, worldLength } from '../data/levels.js';
import { TOPPINGS, TOPPING_KEYS } from '../entities/toppings.js';
import { OBSTACLES, CLEAR_HEIGHT } from '../entities/obstacles.js';
import { animateCloud } from '../entities/cloud.js';
import { loadBest, saveBest } from '../services/storage.js';
import { dial } from '../ai/adaptive.js';
import { Player } from './player.js';

const DEATH_PAUSE = 1.15; // seconds of crash animation before the results panel
const HIT_WINDOW = 0.8; // depth at which obstacles and pickups meet the player
const MAGNET_REACH = 22; // how far ahead the magnet pulls toppings

export class Game {
  constructor({ stage, environment, effects, pools, spawnRow, active, models, icons, ui, sound, director }) {
    Object.assign(this, { stage, environment, effects, pools, spawnRow, active, icons, ui, sound, director });
    this.player = new Player(models);
    this.state = 'menu';
    this.startWorld = 0; // which world the next run begins in (chosen on the menu)
    this.best = loadBest();
    this.time = 0;
    this.runs = 0;
    this.camPos = new THREE.Vector3(0, 1.7, 5.5);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.tmp = new THREE.Vector3();
    this.resetRun();
  }

  resetRun() {
    Object.assign(this, {
      score: 0,
      speed: SPEED.start,
      elapsed: 0,
      distance: 0,
      nextRow: 14,
      level: 0,
      shield: false,
      swordT: 0,
      magnetT: 0,
      counts: {},
      streak: 0,
      lastPickup: -9,
      combo: 0,
      comboTime: 0,
      mult: 1,
      topMult: 1,
      clears: 0,
      slices: 0,
      nextMilestone: MILESTONE_STEP,
      passedBest: false,
      startBest: this.best,
      jumpChain: 0,
      lastJump: -9,
      deadTime: 0,
      shake: 0,
      hit: null,
      rows: new Map(), // rowId → { pattern, left, failed, speedNorm, level }
      rowSeq: 0,
      magnetTick: 0,
    });
  }

  /* ---------- lifecycle ---------- */
  start() {
    this.ui.setTheme(0);
    this.ui.setBest(this.best, this.director.enabled ? this.director.skill : 0);
    this.select(0);
    this.ui.show('menu');
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (this.state !== 'paused') this.update(dt);
      this.stage.render();
    };
    requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });
  }

  select(i) {
    this.player.select(i);
    this.ui.setSelected(this.player.index, BOBAS[this.player.index], BOBAS.length);
  }

  /** Menu: choose where the next run starts (keys 1–3). The menu scene switches to that world. */
  selectWorld(i) {
    if (this.state !== 'menu' || i < 0 || i >= LEVELS.length) return;
    this.startWorld = i;
    this.applyLevel(i, false);
    this.sound.click();
  }

  onGesture() {
    this.sound.init();
    if (this.state === 'menu') this.sound.startMusic();
  }

  onVisibility(hidden) {
    if (hidden) {
      if (this.state === 'running') this.pause();
      else this.sound.stopMusic();
    } else if (this.state === 'menu') this.sound.startMusic();
  }

  startRun() {
    const { sound, ui, player, director } = this;
    sound.init();
    sound.start();
    sound.setTempo(TEMPO.runMin);
    sound.setIntensity(0.25);
    sound.startMusic();
    this.clearWorld();
    this.resetRun();
    director.startRun();
    player.reset();
    player.setDizzy(false);
    const x = player.model.position.x;
    player.resetPose();
    player.model.position.x = x;
    this.distance = worldStart(this.startWorld);
    this.nextRow = this.distance + 14;
    this.nextMilestone = this.distance + MILESTONE_STEP;
    this.applyLevel(this.startWorld, false);
    this.state = 'running';
    ui.show('hud');
    ui.resetHud(this.runs < 2, director.enabled);
    ui.setLevel(this.startWorld, 0, this.distance);
    ui.blurActive();
    this.runs++;
  }

  toMenu() {
    const { player } = this;
    this.clearWorld();
    player.setDizzy(false);
    this.setShield(false);
    this.endPower('sword');
    this.endPower('magnet');
    this.state = 'menu';
    this.ui.show('menu');
    const m = player.model;
    m.rotation.y %= Math.PI * 2;
    m.position.set(m.position.x, 0, 0);
    m.scale.set(1, 1, 1);
    m.userData.body.rotation.set(0, 0, 0);
    this.applyLevel(this.startWorld, false);
    this.ui.setBest(this.best, this.director.enabled ? this.director.skill : 0);
    this.sound.setIntensity(0);
    this.sound.setTempo(TEMPO.menu);
    this.sound.startMusic();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.ui.show('hud', 'paused');
    this.sound.stopMusic();
    this.ui.focus('resumeBtn');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.ui.show('hud');
    this.sound.startMusic();
    this.ui.blurActive();
  }

  /* ---------- levels ---------- */
  applyLevel(i, celebrate) {
    this.level = i;
    const L = LEVELS[i];
    this.environment.setTheme(i, !celebrate);
    this.stage.setFog(L.fog, L.fogNear, L.fogFar);
    this.ui.setTheme(i);
    this.player.setLevel(i);
    this.sound.setLevel(i);
    if (!celebrate) return;
    // obstacles still far out in the haze get swapped for the new world's pieces
    for (let k = this.active.length - 1; k >= 0; k--) if (this.active[k].g.position.z < -45) this.#remove(k, true);
    this.ui.banner(`World ${i + 1}`, L.name, true);
    this.ui.flash();
    this.sound.levelUp();
    this.shake = 0.3;
    this.effects.burst(this.tmp.set(this.player.x, 1.4, 0), '#ffffff', 18, 1.5);
  }

  /**
   * The difficulty dial in use right now, 0–1.
   * Adaptive on:  the director's dial blended with the world's own level, never below 80% of that level.
   * Adaptive off: the world's level, creeping up a little over the first five minutes.
   */
  get challenge() {
    const world = LEVELS[this.level];
    if (!this.director.enabled) {
      const creep = Math.min(0.3, this.elapsed / 300);
      return Math.min(1, world.baseChallenge + creep);
    }
    const blended = 0.65 * this.director.challenge + 0.45 * world.baseChallenge;
    const floor = world.baseChallenge * 0.8;
    return Math.min(1, Math.max(floor, blended));
  }

  /* ---------- intents ---------- */
  steer(dir) {
    if (this.state === 'running') {
      if (this.player.steer(dir)) this.sound.lane();
    } else if (this.state === 'menu') {
      this.select(this.player.index + dir);
      this.sound.click();
    }
  }

  jump() {
    if (this.state === 'running' && this.player.jump()) this.#onJump();
  }

  slide() {
    if (this.state !== 'running') return;
    this.player.slide();
    this.sound.duck();
  }

  #onJump() {
    this.jumpChain = this.time - this.lastJump < 2.2 ? this.jumpChain + 1 : 0;
    this.lastJump = this.time;
    this.sound.jump(this.jumpChain);
  }

  /* ---------- scoring ---------- */
  addPoints(base, label) {
    const pts = base * this.mult;
    this.score += pts;
    this.ui.setScore(this.score);
    this.ui.popText(`+${pts} ${label}${this.mult > 1 ? ` · ×${this.mult}` : ''}`);
  }

  bumpCombo() {
    this.combo++;
    this.comboTime = COMBO.window;
    const mult = 1 + Math.min(COMBO.maxMult - 1, Math.floor(this.combo / COMBO.perLevel));
    if (mult > this.mult) {
      this.mult = mult;
      this.topMult = Math.max(this.topMult, mult);
      this.sound.comboUp(mult);
      this.ui.comboLevelUp();
    }
  }

  setShield(on) {
    this.shield = on;
    this.ui.setShield(on);
  }

  startPower(kind) {
    if (kind === 'shield') {
      if (!this.shield) {
        this.setShield(true);
        this.sound.shieldGet();
      }
      return;
    }
    if (kind === 'sword') {
      this.swordT = POWERUP.sword;
      this.player.setSword(true);
      this.sound.swordDraw();
      this.ui.banner('Power-up', 'Brown Sugar Blade');
    } else {
      this.magnetT = POWERUP.magnet;
      this.sound.magnetOn();
      this.ui.banner('Power-up', 'Pearl Magnet');
    }
  }

  endPower(kind) {
    if (kind === 'sword') {
      this.swordT = 0;
      this.player.setSword(false);
      this.ui.setPower('sword', 0);
    } else {
      this.magnetT = 0;
      this.ui.setPower('magnet', 0);
    }
  }

  collectTopping(o) {
    const type = o.g.userData.type;
    const def = TOPPINGS[type];
    this.effects.burst(this.tmp.set(o.g.position.x, o.height, o.g.position.z), def.spark);
    this.counts[type] = (this.counts[type] || 0) + 1;
    this.streak = this.time - this.lastPickup < 0.9 ? this.streak + 1 : 0;
    this.lastPickup = this.time;
    if (def.power) this.startPower(def.power);
    else this.sound.collect(this.streak);
    this.bumpCombo();
    this.addPoints(def.pts, def.name);
  }

  collectCloud(o) {
    const p = this.tmp.set(o.g.position.x, o.height, o.g.position.z);
    this.effects.burst(p, '#e6c88a', 16, 1.2);
    this.effects.burst(p, '#ffffff', 10, 1.4);
    this.counts.cloud = (this.counts.cloud || 0) + 1;
    this.sound.cloud();
    this.bumpCombo();
    this.addPoints(SCORE.cloud, 'Reward cloud');
  }

  cleanClear(category) {
    this.clears++;
    this.bumpCombo();
    this.addPoints(SCORE.cleanClear, category === 'high' ? 'Clean slide' : 'Clean jump');
    this.sound.clear(category === 'high');
  }

  /** Sword power: the obstacle is cut apart instead of ending the run. */
  slice(o) {
    const g = o.g;
    this.slices++;
    this.player.slash();
    this.effects.burst(this.tmp.set(g.position.x, 1, g.position.z), '#c98a4a', 14, 1.3);
    this.effects.burst(this.tmp, '#ffffff', 6, 1.6);
    this.sound.slice();
    this.shake = Math.max(this.shake, 0.12);
    this.bumpCombo();
    this.addPoints(SCORE.slice, 'Sword cut');
    this.#rowNeutral(o);
  }

  popShield(g) {
    this.setShield(false);
    this.player.invulnerable = 1.3;
    this.shake = 0.25;
    if (g.userData.type === 'bomb') this.effects.boom(this.tmp.set(g.position.x, 1.7, g.position.z));
    else this.effects.burst(this.tmp.set(g.position.x, 1.2, g.position.z), '#efd9a0', 14);
    this.sound.shieldPop();
  }

  die(g) {
    const bomb = g.userData.type === 'bomb';
    this.state = 'dying';
    this.deadTime = 0;
    this.shake = bomb ? 0.8 : 0.4;
    this.hit = { type: g.userData.type, name: OBSTACLES[g.userData.type].names[this.level] };
    this.player.setDizzy(true);
    this.setShield(false);
    this.endPower('sword');
    this.endPower('magnet');
    this.player.height = 0;
    // clear everything between the player and the camera so the crash is visible
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      if ((o.g !== g || bomb) && o.g.position.z > -0.5) this.#remove(i, true);
    }
    if (bomb) this.effects.boom(this.tmp.set(this.player.x, 1.7, 0));
    else g.position.z -= 1.3;
    this.ui.hideCombo();
    this.sound.stopMusic(true);
    this.sound.hit(bomb);
    navigator.vibrate?.(bomb ? [40, 30, 80] : 60);
  }

  showResults() {
    this.state = 'over';
    const isBest = this.score > this.best && this.score > 0;
    if (isBest) {
      this.best = this.score;
      saveBest(this.best);
    }
    const name = BOBAS[this.player.index].name;
    const haul = [...TOPPING_KEYS, 'cloud']
      .filter((k) => this.counts[k])
      .map((k) => ({
        name: k === 'cloud' ? 'Reward cloud' : TOPPINGS[k].name,
        icon: k === 'cloud' ? this.icons.cloud : this.icons.topping[k],
        count: this.counts[k],
      }));
    this.ui.showResults({
      score: this.score,
      best: this.best,
      isBest,
      why: this.hit.type === 'bomb' ? `${name} touched ${this.hit.name}.` : `${name} ran into ${this.hit.name}.`,
      haul,
      clears: this.clears,
      slices: this.slices,
      distance: this.distance,
      level: this.level,
      topCombo: this.topMult,
    });
    if (isBest && !this.passedBest) setTimeout(() => this.sound.best(), 700);
  }

  /* ---------- rows: what the director learns from ---------- */
  #rowFailed(o) {
    const row = this.rows.get(o.row);
    if (!row || row.done) return;
    row.done = true;
    this.director.report({ pattern: row.pattern, speedNorm: row.speedNorm, level: row.level, cleared: false });
    this.ui.setAi(this.director.challenge, this.director.trend);
  }

  #rowNeutral(o) {
    const row = this.rows.get(o.row);
    if (row) row.done = true; // a sword cut says nothing about the player's skill
  }

  #rowPassed(o) {
    const row = this.rows.get(o.row);
    if (!row) return;
    row.left--;
    if (row.left > 0 || row.done) return;
    row.done = true;
    this.director.report({ pattern: row.pattern, speedNorm: row.speedNorm, level: row.level, cleared: true });
    this.ui.setAi(this.director.challenge, this.director.trend);
    this.rows.delete(o.row);
  }

  /* ---------- world objects ---------- */
  clearWorld() {
    while (this.active.length) this.pools.release(this.active.pop().g);
  }

  #remove(i, silent = false) {
    const o = this.active[i];
    if (!silent && o.kind === 'obstacle') this.#rowPassed(o);
    this.pools.release(o.g);
    this.active.splice(i, 1);
  }

  /* ---------- per frame ---------- */

  /** One frame. `dt` is the time since the last frame in seconds. */
  update(dt) {
    this.time += dt;
    const running = this.state === 'running';

    if (running) {
      this.elapsed += dt;
      this.#updateSpeedAndMusic();
      this.#updateTimers(dt);
      this.#updateProgress();
    }

    // how far the world scrolls this frame: the run speed (eased in), a slow drift on the menu
    let worldSpeed = 0;
    if (running) worldSpeed = this.speed * Math.min(1, 0.3 + this.elapsed * 1.2);
    else if (this.state === 'menu') worldSpeed = 3;
    const move = worldSpeed * dt;

    this.environment.update(move, dt, this.time);
    this.#easeFog(dt);

    if (running) {
      this.distance += move;
      if (this.distance >= this.nextRow) this.#spawnNextRow();
      const landedOrJumped = this.player.step(dt, this.speed);
      if (landedOrJumped.landed) this.sound.land(this.player.surfing);
      if (landedOrJumped.bufferedJump) this.#onJump();
    }

    this.#updateObjects(dt, move, running);
    this.effects.update(dt);

    if (this.state === 'dying') {
      this.deadTime += dt;
      if (this.deadTime > DEATH_PAUSE) this.showResults();
    }
    this.player.animate(this.state, dt, this.time, this.deadTime);
    this.#updateShieldBubble();
    this.#updateCamera(dt);
  }

  /** Run speed = base ramp × the world's multiplier × the AI dial; the music follows it. */
  #updateSpeedAndMusic() {
    const world = LEVELS[this.level];
    const baseSpeed = Math.min(SPEED.max, SPEED.start + this.elapsed * SPEED.ramp);
    this.speed = baseSpeed * world.speedMult * dial.speedMult(this.challenge);

    const progress = this.#speedProgress();
    this.sound.setTempo(TEMPO.runMin + progress * (TEMPO.runMax - TEMPO.runMin) + this.level * 2);
    this.sound.setIntensity(Math.min(1, 0.25 + progress * 0.45 + (this.mult - 1) * 0.14 + this.level * 0.05));
  }

  /** Counts down the combo window and the timed power-ups. */
  #updateTimers(dt) {
    const { ui } = this;
    if (this.comboTime > 0) {
      this.comboTime -= dt;
      if (this.comboTime <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }
    ui.updateCombo(this.combo, this.mult, this.comboTime / COMBO.window);

    if (this.swordT > 0) {
      this.swordT -= dt;
      ui.setPower('sword', this.swordT / POWERUP.sword);
      if (this.swordT <= 0) this.endPower('sword');
    }
    if (this.magnetT > 0) {
      this.magnetT -= dt;
      ui.setPower('magnet', this.magnetT / POWERUP.magnet);
      if (this.magnetT <= 0) this.endPower('magnet');
    }
  }

  /** World changes, the level bar, distance milestones and the "new best" moment. */
  #updateProgress() {
    const { ui, sound } = this;
    const worldNow = levelIndexForDistance(this.distance);
    if (worldNow !== this.level) this.applyLevel(worldNow, true);
    ui.setLevel(this.level, (this.distance - worldStart(this.level)) / worldLength(this.level), this.distance);
    if (this.director.enabled) ui.setAi(this.challenge, this.director.trend);

    if (this.distance >= this.nextMilestone) {
      const justChangedWorld = this.distance - worldStart(this.level) <= 100;
      if (!justChangedWorld) {
        ui.banner('Distance', `${this.nextMilestone} m`);
        sound.milestone();
      }
      this.nextMilestone += MILESTONE_STEP;
    }
    if (!this.passedBest && this.startBest > 0 && this.score > this.startBest) {
      this.passedBest = true;
      ui.banner('You beat your record', 'New best', true);
      ui.flash();
      sound.newBest();
    }
  }

  /** Asks the director for a pattern and lays the next row of obstacles and toppings. */
  #spawnNextRow() {
    const challenge = this.challenge;
    const gap = rowGap(this.speed) * dial.gapMult(challenge);
    const speedNorm = this.#speedProgress();
    const pattern = this.director.choose({ speedNorm, level: this.level + 1, challenge });
    const rowId = ++this.rowSeq;
    const obstacleCount = this.spawnRow(SPAWN_Z + (this.distance - this.nextRow), gap, {
      pattern,
      level: this.level,
      rowId,
      powerups: LEVELS[this.level].powerups,
      activePower: { shield: this.shield, sword: this.swordT > 0, magnet: this.magnetT > 0 },
      shieldChance: dial.shieldChance(challenge),
    });
    // remember the row so the director can be told later whether it was cleared
    if (obstacleCount) {
      this.rows.set(rowId, { pattern, left: obstacleCount, done: false, speedNorm, level: this.level + 1 });
    }
    this.nextRow = this.distance + gap;
  }

  /** Fog colour and range glide toward the current world's values. */
  #easeFog(dt) {
    const { stage } = this;
    if (!stage.fogTarget) return;
    const fog = stage.scene.fog;
    fog.color.lerp(stage.fogTarget.color, 1 - Math.exp(-1.5 * dt));
    fog.near = damp(fog.near, stage.fogTarget.near, 1.5, dt);
    fog.far = damp(fog.far, stage.fogTarget.far, 1.5, dt);
  }

  /** 0 at the starting speed, 1 at the cap (the world multiplier and the dial are left out). */
  #speedProgress() {
    return Math.min(1, (this.speed / LEVELS[this.level].speedMult - SPEED.start) / (SPEED.max - SPEED.start));
  }

  #updateObjects(dt, move, running) {
    const { player, time } = this;
    const sliding = player.sliding;
    const px = player.x;
    const py = player.y;
    const magnet = running && this.magnetT > 0;
    const sword = running && this.swordT > 0;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      const g = o.g;
      const u = g.userData;
      const z0 = g.position.z;
      g.position.z += move;
      const z1 = g.position.z;

      // idle animation
      if (o.kind === 'topping') {
        u.inner.rotation.y += dt * 1.8;
        u.inner.position.y = o.height + Math.sin(time * 2.6 + o.phase) * 0.08;
        u.inner.userData.halo.rotation.y = -time * 1.2;
        if (magnet && z1 > -MAGNET_REACH && z1 < 2) {
          // pulled toward the boba, in every lane
          g.position.x = damp(g.position.x, px, 9, dt);
          o.height = damp(o.height, py + 1.1, 7, dt);
          this.magnetTick -= dt;
          if (this.magnetTick <= 0 && Math.abs(g.position.x - px) > 0.3) {
            this.magnetTick = 0.09;
            this.sound.magnetTick();
          }
        }
      } else if (o.kind === 'cloud') {
        u.inner.position.y = o.height + Math.sin(time * 1.6 + o.phase) * 0.12;
        animateCloud(u.inner, time);
      } else {
        if (u.bob) u.bob.position.y = u.base + Math.sin(time * 2.2 + o.phase) * (this.level === 2 ? 0.1 : 0.07);
        if (u.spark) u.spark.scale.setScalar(0.13 * (0.8 + Math.random() * 0.6));
        if (o.moving) {
          const t = Math.min(1, Math.max(0, (z1 - o.zStart) / (o.zEnd - o.zStart)));
          const nx = o.x0 + (o.x1 - o.x0) * smoothstep(t);
          u.inner.rotation.z = damp(u.inner.rotation.z, (nx - g.position.x) * -3, 10, dt);
          g.position.x = nx;
        }
      }

      if (running) {
        const dx = Math.abs(g.position.x - px);
        const crossed = z1 > -HIT_WINDOW && z0 < HIT_WINDOW;
        if (crossed && dx < 1) {
          if (o.kind === 'topping' && o.height > py - 0.3 && o.height < player.top + 0.2) {
            this.collectTopping(o);
            this.#remove(i);
            continue;
          }
          if (o.kind === 'cloud' && py > 0.35) {
            this.collectCloud(o);
            this.#remove(i);
            continue;
          }
        }
        if (o.kind === 'obstacle' && crossed && dx < 0.95 && player.invulnerable <= 0) {
          const cat = OBSTACLES[u.type].cat;
          const hit = cat === 'high' ? !sliding : py < CLEAR_HEIGHT[cat];
          if (hit) {
            if (sword) {
              this.slice(o);
              this.#remove(i, true);
              continue;
            }
            if (this.shield) {
              this.popShield(g);
              this.#rowFailed(o);
              this.#remove(i, true);
              continue;
            }
            this.#rowFailed(o);
            this.die(g);
            return;
          }
          if (!o.cleared && (cat === 'high' ? sliding : py > 0.3)) {
            o.cleared = true;
            this.cleanClear(cat);
          }
        }
      }
      if (z1 > 9) this.#remove(i);
    }
  }

  #updateShieldBubble() {
    const b = this.effects.bubble;
    const m = this.player.model;
    b.visible = this.shield && (this.state === 'running' || this.state === 'paused');
    if (!b.visible) return;
    const p = 1 + Math.sin(this.time * 4) * 0.03;
    b.position.set(m.position.x, m.position.y + 1.2 * m.scale.y, m.position.z);
    b.scale.set(p * m.scale.x, p * Math.max(m.scale.y, 0.6), p * m.scale.z);
  }

  #updateCamera(dt) {
    const { stage, camPos, camLook, tmp, player } = this;
    const m = player.model;
    const px = m.position.x;
    const portrait = stage.aspect < 1;
    if (this.state === 'menu' || this.state === 'over') {
      // front view of the boba; on wide screens shift it left of the results panel
      const off = stage.wide && this.state === 'over' ? 1.2 : 0;
      const lookY = portrait ? (this.state === 'over' ? 0.1 : 0.4) : 1.15;
      camPos.lerp(tmp.set(px + off, 1.75, m.position.z + (portrait ? 7.4 : 5.6)), 1 - Math.exp(-3 * dt));
      camLook.lerp(tmp.set(px + off, lookY, m.position.z), 1 - Math.exp(-3 * dt));
    } else {
      camPos.lerp(tmp.set(px * 0.55, 4.2, 8 + (portrait ? (1 - stage.aspect) * 5 : 0)), 1 - Math.exp(-3.5 * dt));
      camLook.lerp(tmp.set(px * 0.55, 1.1, -6), 1 - Math.exp(-3.5 * dt));
    }
    const cam = stage.camera;
    // widen the lens with speed and while airborne
    const fk = this.state === 'running' ? this.#speedProgress() : 0;
    const fov = stage.baseFov + fk * 7 + (this.state === 'running' && player.y > 0.3 ? 2.5 : 0);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = damp(cam.fov, fov, 3, dt);
      cam.updateProjectionMatrix();
    }
    cam.position.copy(camPos);
    if (this.shake > 0 && !REDUCED_MOTION) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.x += rand(-1, 1) * this.shake * 0.4;
      cam.position.y += rand(-1, 1) * this.shake * 0.4;
    }
    cam.lookAt(camLook);
  }
}

const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
