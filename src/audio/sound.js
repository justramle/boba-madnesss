// Audio facade used by the game: owns the AudioContext, the music bus and every sound effect.
// Browsers only allow audio after a user gesture, so call `sound.init()` from an input handler.
import { createSynth, midiToHz as hz } from './synth.js';
import { createMusic } from './music.js';
import { loadSoundPrefs, saveSoundPrefs } from '../services/storage.js';

const MUSIC_VOLUME = 0.5;
const SCALE = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86]; // D natural minor

class Sound {
  constructor() {
    const prefs = loadSoundPrefs();
    this.musicOn = prefs.music;
    this.sfxOn = prefs.sfx;
    this.ctx = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);

    // small hall reverb from decaying noise
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    verb.connect(wet).connect(master);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.sfx.connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.3;
    this.sfx.connect(send).connect(verb);

    this.mus = ctx.createGain();
    this.mus.gain.value = 0;
    this.musFilter = ctx.createBiquadFilter();
    this.musFilter.type = 'lowpass';
    this.musFilter.frequency.value = 18000;
    this.mus.connect(this.musFilter);
    this.musFilter.connect(master);
    this.musFilter.connect(verb);

    this.ctx = ctx;
    this.synth = createSynth(ctx);
    this.music = createMusic(ctx, this.synth, this.mus);
  }

  get now() {
    return this.ctx.currentTime;
  }

  /* ---------- music ---------- */
  startMusic() {
    if (!this.ctx || this.music.playing) return;
    const t = this.now;
    this.musFilter.frequency.cancelScheduledValues(t);
    this.musFilter.frequency.setValueAtTime(18000, t);
    this.mus.gain.cancelScheduledValues(t);
    this.mus.gain.setTargetAtTime(this.musicOn ? MUSIC_VOLUME : 0, t, 0.3);
    this.music.start();
  }

  /** @param {boolean} tapeStop sweep the music down like a stopping tape (used on a crash) */
  stopMusic(tapeStop = false) {
    if (!this.ctx || !this.music.playing) return;
    this.music.stop();
    const t = this.now;
    this.mus.gain.cancelScheduledValues(t);
    this.musFilter.frequency.cancelScheduledValues(t);
    if (tapeStop) {
      this.musFilter.frequency.setValueAtTime(12000, t);
      this.musFilter.frequency.exponentialRampToValueAtTime(140, t + 0.7);
      this.mus.gain.setValueAtTime(this.mus.gain.value, t);
      this.mus.gain.linearRampToValueAtTime(0, t + 0.8);
    } else this.mus.gain.setTargetAtTime(0, t, 0.15);
  }

  setTempo(bpm) {
    this.music?.setTempo(bpm);
  }

  setIntensity(v) {
    this.music?.setIntensity(v);
  }

  setLevel(i) {
    this.music?.setLevel(i);
  }

  setMusic(on) {
    this.musicOn = on;
    this.#save();
    if (this.ctx && this.music.playing) this.mus.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, this.now, 0.2);
  }

  setSfx(on) {
    this.sfxOn = on;
    this.#save();
    if (this.ctx) this.sfx.gain.value = on ? 1 : 0;
  }

  #save() {
    saveSoundPrefs({ music: this.musicOn, sfx: this.sfxOn });
  }

  /* ---------- effects ---------- */
  #fx(fn) {
    if (this.ctx) fn(this.synth, this.now, this.sfx);
  }

  click() {
    this.#fx(({ voice }, t, bus) => voice({ type: 'triangle', f: 1300, f2: 1000, at: t, d: 0.05, v: 0.05, bus }));
  }

  lane() {
    this.#fx(({ noise }, t, bus) => noise({ at: t, d: 0.1, v: 0.05, f: 2600, f2: 1400, q: 0.7, bus }));
  }

  /** Chimes climb the scale while the pickup streak continues. */
  collect(streak) {
    this.#fx(({ voice }, t, bus) => {
      const m = SCALE[Math.min(streak, SCALE.length - 1)] + 12;
      voice({ type: 'triangle', f: hz(m), at: t, d: 0.35, a: 0.003, r: 0.3, v: 0.09, bus });
      voice({ f: hz(m + 7), at: t + 0.03, d: 0.25, a: 0.003, r: 0.22, v: 0.04, bus });
    });
  }

  /** Each jump in a chain plays a higher note. */
  jump(chain) {
    this.#fx(({ voice, noise }, t, bus) => {
      const m = SCALE[Math.min(chain * 2, SCALE.length - 1)];
      noise({ at: t, d: 0.28, v: 0.1, f: 500, f2: 2600, q: 0.6, bus });
      voice({
        type: 'sawtooth',
        f: hz(m),
        f2: hz(m + 12),
        at: t,
        d: 0.22,
        a: 0.005,
        r: 0.15,
        v: 0.05,
        filt: { f: 900, f2: 3200, t: 0.15 },
        bus,
      });
      voice({ type: 'triangle', f: hz(m + 12), at: t + 0.06, d: 0.3, a: 0.003, r: 0.25, v: 0.06, bus });
    });
  }

  land(splash = false) {
    this.#fx(({ kick, noise }, t, bus) => {
      kick(t, splash ? 0.14 : 0.22, bus);
      if (splash) noise({ at: t, d: 0.35, v: 0.12, f: 2400, f2: 900, q: 0.5, bus });
    });
  }

  /** A warm swell when a new world begins: a few soft timpani, a brass chord that blooms, a shimmer. */
  levelUp() {
    this.#fx(({ voice, brass, timpani, crash }, t, bus) => {
      for (let i = 0; i < 4; i++) timpani(t + i * 0.12, 73.42, 0.07 + i * 0.025, bus);
      brass([50, 57, 62], t + 0.5, 1.2, 0.018, bus);
      brass([57, 62, 66, 69], t + 1.3, 2.4, 0.024, bus, true);
      [74, 78, 81, 86].forEach((m, i) =>
        voice({ type: 'triangle', f: hz(m), at: t + 1.3 + i * 0.12, d: 1.6, a: 0.02, r: 1.2, v: 0.04, bus }),
      );
      crash(t + 1.3, 0.04, bus);
    });
    this.dipMusic(2.4);
  }

  /** Lower the music for a moment so a fanfare can breathe, then bring it back slowly. */
  dipMusic(seconds) {
    if (!this.ctx || !this.musicOn || !this.music.playing) return;
    const g = this.mus.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(MUSIC_VOLUME * 0.45, t, 0.15);
    g.setTargetAtTime(MUSIC_VOLUME, t + seconds, 0.7);
  }

  swordDraw() {
    this.#fx(({ voice, noise }, t, bus) => {
      noise({ at: t, d: 0.5, v: 0.14, f: 3200, f2: 9000, q: 0.8, bus });
      voice({ type: 'triangle', f: 1800, f2: 3600, at: t, d: 0.5, a: 0.005, r: 0.4, v: 0.06, bus });
      voice({ type: 'sawtooth', f: hz(62), at: t + 0.05, d: 0.6, a: 0.01, r: 0.5, v: 0.04, filt: { f: 1200 }, bus });
    });
  }

  slice() {
    this.#fx(({ voice, noise }, t, bus) => {
      noise({ at: t, d: 0.22, v: 0.2, f: 900, f2: 5000, q: 0.7, bus });
      voice({ type: 'triangle', f: 2200, f2: 700, at: t + 0.03, d: 0.18, a: 0.003, r: 0.15, v: 0.08, bus });
      noise({ at: t + 0.06, d: 0.25, v: 0.16, f: 400, type: 'lowpass', bus });
    });
  }

  magnetOn() {
    this.#fx(({ voice }, t, bus) => {
      [57, 64, 69, 76].forEach((m, i) =>
        voice({
          type: 'sawtooth',
          f: hz(m),
          f2: hz(m + 12),
          at: t + i * 0.05,
          d: 0.5,
          a: 0.01,
          r: 0.4,
          v: 0.035,
          filt: { f: 1600 },
          bus,
        }),
      );
    });
  }

  magnetTick() {
    this.#fx(({ voice }, t, bus) =>
      voice({ type: 'triangle', f: 1046, f2: 1568, at: t, d: 0.08, a: 0.003, r: 0.06, v: 0.03, bus }),
    );
  }

  /** Slide whoosh, plus a quick muffle on the music. */
  duck() {
    this.#fx(({ noise }, t, bus) => {
      noise({ at: t, d: 0.32, v: 0.1, f: 3000, f2: 400, q: 0.5, bus });
      if (this.music.playing) {
        const f = this.musFilter.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(f.value, t);
        f.exponentialRampToValueAtTime(700, t + 0.08);
        f.exponentialRampToValueAtTime(18000, t + 0.75);
      }
    });
  }

  clear(slide) {
    this.#fx(({ voice }, t, bus) =>
      [74, 81].forEach((m, i) =>
        voice({
          type: 'triangle',
          f: hz(m - (slide ? 5 : 0)),
          at: t + i * 0.06,
          d: 0.3,
          a: 0.003,
          r: 0.25,
          v: 0.07,
          bus,
        }),
      ),
    );
  }

  comboUp(level) {
    this.#fx(({ voice, brass }, t, bus) => {
      for (let i = 0; i < level + 3; i++)
        voice({
          type: 'sawtooth',
          f: hz(SCALE[(i * 2) % SCALE.length] + 12),
          at: t + i * 0.045,
          d: 0.2,
          a: 0.004,
          r: 0.15,
          v: 0.035,
          filt: { f: 2600 },
          bus,
        });
      brass([62, 69, 74], t + (level + 3) * 0.045, 0.5, 0.02, bus);
    });
  }

  milestone() {
    this.#fx(({ brass, timpani, crash }, t, bus) => {
      brass([50, 57, 62, 69], t, 0.9, 0.025, bus);
      timpani(t, 73.42, 0.4, bus);
      crash(t, 0.08, bus);
    });
  }

  /** Drum roll + brass swell when the live score passes the previous best. */
  newBest() {
    this.#fx(({ voice, brass, timpani, crash }, t, bus) => {
      for (let i = 0; i < 10; i++) timpani(t + i * 0.045, 73.42, 0.1 + i * 0.025, bus);
      brass([62, 66, 69, 74], t + 0.45, 1.6, 0.03, bus, true);
      [74, 78, 81, 86, 90].forEach((m, i) =>
        voice({ type: 'triangle', f: hz(m), at: t + 0.45 + i * 0.08, d: 0.7, a: 0.004, r: 0.6, v: 0.06, bus }),
      );
      crash(t + 0.45, 0.1, bus);
    });
  }

  cloud() {
    this.#fx(({ voice }, t, bus) =>
      [62, 65, 69, 72, 74, 77, 81].forEach((m, i) =>
        voice({ type: 'triangle', f: hz(m + 12), at: t + i * 0.035, d: 0.7, a: 0.003, r: 0.6, v: 0.05, bus }),
      ),
    );
  }

  shieldGet() {
    this.#fx(({ voice }, t, bus) =>
      [69, 74, 78, 81].forEach((m, i) =>
        voice({ type: 'triangle', f: hz(m), at: t + i * 0.06, d: 0.6, a: 0.004, r: 0.5, v: 0.06, bus }),
      ),
    );
  }

  shieldPop() {
    this.#fx(({ noise, kick }, t, bus) => {
      noise({ at: t, d: 0.4, v: 0.16, f: 3000, q: 0.7, bus });
      kick(t, 0.4, bus);
    });
  }

  start() {
    this.#fx(({ brass, timpani }, t, bus) => {
      brass([50, 57, 62], t, 0.7, 0.025, bus);
      timpani(t, 73.42, 0.4, bus);
    });
  }

  hit(bomb) {
    this.#fx(({ voice, noise, kick }, t, bus) => {
      kick(t, 0.7, bus);
      noise({ at: t, d: bomb ? 1.3 : 0.5, v: bomb ? 0.5 : 0.3, f: bomb ? 1200 : 500, f2: 90, type: 'lowpass', bus });
      voice({
        type: 'sawtooth',
        f: 330,
        f2: 40,
        at: t + 0.05,
        d: 0.8,
        a: 0.01,
        r: 0.6,
        v: 0.06,
        filt: { f: 1800, f2: 200, t: 0.7 },
        bus,
      });
    });
  }

  best() {
    this.#fx(({ voice, brass }, t, bus) => {
      brass([62, 66, 69], t, 1.2, 0.025, bus, true);
      [74, 78, 81, 86].forEach((m, i) =>
        voice({ type: 'triangle', f: hz(m), at: t + i * 0.1, d: 0.9, a: 0.004, r: 0.8, v: 0.06, bus }),
      );
    });
  }
}

export const sound = new Sound();
