// The runner: lane movement, jump/slide physics, gear per level and the pose animation for
// every game state.
import { LANES, JUMP, SLIDE_TIME } from '../config.js';
import { damp } from '../utils/math.js';

export class Player {
  /** @param {import('three').Group[]} models one prebuilt model per boba */
  constructor(models) {
    this.models = models;
    this.index = 0;
    this.level = 0; // 0-based world index
    this.sword = false;
    this.swing = 0; // seconds left on the current slash
    this.reset();
  }

  get model() {
    return this.models[this.index];
  }

  /** Feet height above the path. */
  get y() {
    return this.height;
  }

  get airborne() {
    return this.height > 0.02;
  }

  get sliding() {
    return this.slideT > 0 && this.height < 0.35;
  }

  /** On a surfboard in the ocean world: no run cycle, the board does the moving. */
  get surfing() {
    return this.level === 2;
  }

  /** Top of the body, used for collecting floating toppings. */
  get top() {
    return this.height + (this.sliding ? 1.1 : 2.3);
  }

  get x() {
    return this.model.position.x;
  }

  select(i) {
    this.index = (i + this.models.length) % this.models.length;
    this.models.forEach((m, k) => (m.visible = k === this.index));
    this.resetPose();
    this.setLevel(this.level);
  }

  reset() {
    this.lane = 1;
    this.height = 0;
    this.vy = 0;
    this.slideT = 0;
    this.invulnerable = 0;
    this.jumpBuffer = 0;
    this.runPhase = 0;
    this.sword = false;
    this.swing = 0;
  }

  resetPose() {
    const m = this.model;
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    m.visible = true;
    m.userData.body.rotation.set(0, 0, 0);
    m.userData.body.position.y = 0;
  }

  /** Show the gear this world unlocks. */
  setLevel(i) {
    this.level = i;
    const g = this.model.userData.gear;
    g.scarf.visible = i >= 1;
    g.sheath.visible = i >= 1 && !this.sword;
    g.shades.visible = i >= 2;
    g.board.visible = i >= 2;
  }

  setSword(on) {
    this.sword = on;
    const g = this.model.userData.gear;
    g.sword.visible = on;
    g.sheath.visible = this.level >= 1 && !on;
    if (on) this.swing = 0.35;
  }

  slash() {
    this.swing = 0.3;
  }

  setDizzy(on) {
    const f = this.model.userData.face;
    f.eyes.visible = !on;
    f.xeyes.visible = on;
  }

  steer(dir) {
    const lane = Math.max(0, Math.min(2, this.lane + dir));
    if (lane === this.lane) return false;
    this.lane = lane;
    return true;
  }

  /** Returns true if the jump started now (false if it was buffered for landing). */
  jump() {
    if (this.height <= 0.001) {
      this.#launch();
      return true;
    }
    this.jumpBuffer = JUMP.buffer;
    return false;
  }

  slide() {
    this.slideT = SLIDE_TIME;
    this.jumpBuffer = 0;
    if (this.height > 0) this.vy = Math.min(this.vy, -22); // fast-fall into the slide
  }

  #launch() {
    this.vy = JUMP.velocity;
    this.slideT = 0;
    this.jumpBuffer = 0;
  }

  /** Physics step while running. Returns events for sound/feedback. */
  step(dt, speed) {
    const events = { landed: false, bufferedJump: false };
    const m = this.model;
    m.position.x = damp(m.position.x, LANES[this.lane], 16, dt);
    this.vy -= JUMP.gravity * dt;
    this.height += this.vy * dt;
    if (this.height <= 0) {
      events.landed = this.vy < -6;
      this.height = 0;
      this.vy = 0;
      if (this.jumpBuffer > 0) {
        this.#launch();
        events.bufferedJump = true;
      }
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.slideT = Math.max(0, this.slideT - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.runPhase += dt * (6.5 + speed * 0.3);
    return events;
  }

  /** Pose + wing + gear animation for the current game state. */
  animate(state, dt, time, deadTime) {
    const m = this.model;
    const U = m.userData;
    const { arms, legs, body, gear } = U;
    const surf = this.surfing;
    let facing = 0;
    let fold = 0.4;
    let lift = 0;

    if (state === 'menu') {
      m.position.x = damp(m.position.x, 0, 8, dt);
      m.position.y = 0;
      facing = -0.35 + Math.sin(time * 0.5) * 0.25;
      body.position.y = Math.sin(time * 1.6) * 0.02;
      body.rotation.set(0, 0, Math.sin(time * 1.6) * 0.02);
      arms.forEach((a, i) => a.rotation.set(Math.sin(time * 1.6 + i) * 0.08, 0, (i ? 1 : -1) * 0.42));
      legs.forEach((l) => (l.rotation.x = damp(l.rotation.x, 0, 8, dt)));
      fold = 0.3;
      lift = 0.12 + Math.sin(time * 1.3) * 0.1;
    } else if (state === 'running' || state === 'paused') {
      const lean = LANES[this.lane] - m.position.x;
      const air = this.airborne;
      const sliding = this.sliding;
      m.position.y = this.height + (surf && !air ? Math.sin(time * 2.2) * 0.04 : 0);
      m.scale.x = m.scale.z = damp(m.scale.x, sliding ? 1.1 : 1, 20, dt);
      m.scale.y = damp(m.scale.y, sliding ? 0.46 : 1, 20, dt);
      facing = Math.PI - 0.35 * lean;
      body.position.y = air || sliding || surf ? 0 : Math.abs(Math.sin(this.runPhase)) * 0.1;
      body.rotation.set(air ? -0.08 : surf ? 0.05 : 0.08, 0, lean * -0.1);
      arms.forEach((a, i) => {
        if (i === 1 && this.sword) {
          // sword arm: held out to the side so the blade shows from behind; sweeps forward on a slash
          const k = this.swing > 0 ? 1 - this.swing / 0.3 : 1;
          a.rotation.set(-0.5 - Math.sin(k * Math.PI) * 1.9, 0, 1.3);
        } else if (air) a.rotation.set(0, 0, (i ? 1 : -1) * 1.2);
        else if (surf) a.rotation.set(0.2 + Math.sin(time * 2 + i) * 0.1, 0, (i ? 1 : -1) * 0.9);
        else a.rotation.set(Math.sin(this.runPhase + i * Math.PI) * 0.8, 0, (i ? 1 : -1) * 0.42);
      });
      legs.forEach((l, i) => {
        if (surf) l.rotation.x = damp(l.rotation.x, i ? 0.35 : -0.3, 12, dt);
        else l.rotation.x = air ? (i ? 0.55 : -0.3) : Math.sin(this.runPhase + i * Math.PI + Math.PI) * 0.85;
      });
      if (air) {
        fold = 0.15;
        lift = Math.sin(time * 11) * 0.5 + 0.1;
      } else if (sliding) {
        fold = 1.4;
        lift = 0.2;
      } else {
        fold = 1.15;
        lift = 0.32 + Math.sin(this.runPhase * 0.5) * 0.05;
      }
      gear.board.rotation.set(air ? -0.25 : Math.sin(time * 2.2) * 0.05, 0, lean * 0.35);
      m.visible = this.invulnerable > 0 ? Math.floor(time * 12) % 2 === 0 : true;
    } else {
      // dying / over: hop back, face the camera, wings droop
      m.visible = true;
      facing = Math.PI * 2;
      m.scale.x = m.scale.z = damp(m.scale.x, 1, 10, dt);
      m.scale.y = damp(m.scale.y, 1, 10, dt);
      m.position.y = state === 'dying' ? Math.sin(Math.min(deadTime * 4.5, Math.PI)) * 0.6 : 0;
      m.position.z = damp(m.position.z, 1.4, 7, dt);
      body.position.y = 0;
      body.rotation.set(damp(body.rotation.x, -0.22, 6, dt), 0, Math.sin(time * 2) * 0.04);
      arms.forEach((a, i) => a.rotation.set(0, 0, (i ? 1 : -1) * (1.7 + Math.sin(time * 4 + i) * 0.1)));
      legs.forEach((l, i) => (l.rotation.x = damp(l.rotation.x, i ? 0.4 : -0.4, 6, dt)));
      gear.board.rotation.set(0, 0, 0);
      fold = 0.55;
      lift = -0.35;
    }

    // scarf ribbons flutter harder the faster the run
    const flutter = state === 'running' ? 0.35 : 0.12;
    gear.ribbons.forEach((segs, r) =>
      segs.forEach((seg, k) => {
        seg.rotation.x = Math.sin(time * 9 + k * 0.9 + r) * flutter * (0.4 + k * 0.2) + (k ? 0.05 : 0.35);
        seg.rotation.y = Math.sin(time * 5 + k * 0.7 + r * 2) * 0.12;
      }),
    );

    U.fold = damp(U.fold, fold, 9, dt);
    U.lift = damp(U.lift, lift, state === 'running' && this.airborne ? 30 : 9, dt);
    U.wings.forEach((w, k) => {
      const s = k ? 1 : -1;
      w.rotation.set(0, s * U.fold, s * U.lift);
    });
    m.rotation.y = damp(m.rotation.y, facing, state === 'running' ? 14 : 6, dt);

    // keep the blob shadow on the ground while jumping
    const hy = m.position.y;
    U.shadow.position.y = (0.025 - hy) / Math.max(m.scale.y, 0.01);
    U.shadow.scale.setScalar(0.7 * (1 - Math.min(hy, 1.8) * 0.28));
  }
}
