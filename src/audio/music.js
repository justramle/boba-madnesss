// An original D-minor action theme. Layers switch on as `intensity` rises (speed + combo):
// Each world transposes the theme and changes the drum feel: Winter in D minor, Forest down a
// whole step with a rolling half-time groove, Ocean up a fourth with a bright surf beat.
// Tempo, intensity and world changes are all eased in: a world change waits for the next bar
// and plays two bars of simplified drums so the hand-off breathes.
// 0      quiet menu theme
// >0.05  drums + driving bass
// >0.32  string ostinato
// >0.48  brass stabs
// >0.6   heroic lead melody
// >0.82  choir pad
import { midiToHz as hz } from './synth.js';

// Dm – Bb – F – C | Dm – Bb – C – A
const CHORDS = [
  [62, 65, 69],
  [58, 62, 65],
  [65, 69, 72],
  [60, 64, 67],
  [62, 65, 69],
  [58, 62, 65],
  [60, 64, 67],
  [57, 61, 64],
];
const BASS = [38, 34, 41, 36, 38, 34, 36, 33];
const OSTINATO = [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 3, 2];
// [sixteenth step in the 8-bar loop, midi note, length in sixteenths]
const LEAD = [
  [0, 74, 6],
  [6, 72, 2],
  [8, 74, 4],
  [12, 77, 4],
  [16, 74, 8],
  [24, 70, 4],
  [28, 72, 4],
  [32, 72, 6],
  [38, 70, 2],
  [40, 69, 4],
  [44, 72, 4],
  [48, 67, 12],
  [60, 69, 4],
  [64, 74, 6],
  [70, 76, 2],
  [72, 77, 4],
  [76, 79, 4],
  [80, 81, 8],
  [88, 79, 4],
  [92, 77, 4],
  [96, 76, 6],
  [102, 77, 2],
  [104, 79, 4],
  [108, 76, 4],
  [112, 73, 8],
  [120, 76, 4],
  [124, 81, 4],
];
const STEPS = 128; // 8 bars of sixteenths

export function createMusic(ctx, synth, bus) {
  const { voice, kick, snare, hat, tom, crash, timpani, brass } = synth;
  let timer = null;
  let next = 0;
  let step = 0;
  let loops = 0;
  let tempo = 100;
  let tempoTarget = 100;
  let intensity = 0;
  let intensityTarget = 0;
  let level = 0;
  let pendingLevel = null;
  let barsInLevel = 99;
  const TRANSPOSE = [0, -2, 5];
  const T = (m) => hz(m + TRANSPOSE[level]);

  function playStep(s, at) {
    const s16 = 60 / tempo / 4;
    const bar = Math.floor(s / 16);
    const e = s % 16;
    if (e === 0) {
      barsInLevel++;
      if (pendingLevel !== null) {
        level = pendingLevel;
        pendingLevel = null;
        barsInLevel = 0;
      }
    }
    const ch = CHORDS[bar];
    const I = intensity;
    const fresh = barsInLevel < 2; // just changed world: keep the drums simple for two bars

    if (I <= 0.05) {
      if (e === 0) {
        for (const m of ch)
          voice({
            type: 'sawtooth',
            f: T(m - 12),
            at,
            d: s16 * 16,
            a: 0.6,
            r: 0.6,
            v: 0.012,
            det: 5,
            filt: { f: 700 },
            bus,
          });
        timpani(at, T(BASS[bar]), 0.22, bus);
      }
      if (e % 4 === 0) {
        const m = ch[(e / 4) % 3] + (e === 12 ? 12 : 0);
        voice({ type: 'triangle', f: T(m + 12), at, d: s16 * 6, a: 0.005, r: 0.3, v: 0.045, bus });
      }
      if (loops % 2 === 1)
        for (const [ps, m, dd] of LEAD)
          if (ps === s)
            voice({ type: 'triangle', f: T(m), at, d: dd * s16 * 1.1, a: 0.04, r: 0.2, v: 0.05, vib: 0.006, bus });
      return;
    }

    // drums: each world has its own feel
    if (fresh) {
      if (e === 0 || e === 8) kick(at, 0.42, bus);
      if (e === 4 || e === 12) snare(at, 0.12, bus);
      if (e % 2 === 1) hat(at, 0.02, false, bus);
    } else if (level === 1) {
      // forest: a rolling half-time groove, toms only as a soft fill
      if (e === 0 || (I > 0.5 && e === 10)) kick(at, 0.48, bus);
      if (e === 8) snare(at, 0.18, bus);
      if (e % 2 === 1) hat(at, 0.022, false, bus);
      if (I > 0.4 && bar % 2 === 1 && (e === 13 || e === 15)) tom(at, e === 13 ? 150 : 110, 0.2, bus);
      if (I > 0.65 && e === 6) tom(at, 180, 0.14, bus);
    } else if (level === 2) {
      // ocean: bright surf beat, hats on the off-beats, double snare
      if (e === 0 || e === 8 || (I > 0.45 && e === 11)) kick(at, 0.46, bus);
      if (e === 4 || e === 12 || (I > 0.5 && e === 14)) snare(at, e === 14 ? 0.1 : 0.2, bus);
      if (e % 2 === 1) hat(at, 0.04, e % 8 === 7, bus);
      if (bar === 7 && e >= 12 && I > 0.3) tom(at, [180, 150, 120, 95][e - 12], 0.26, bus);
    } else {
      if (e === 0 || e === 8 || (I > 0.45 && (e === 6 || e === 11))) kick(at, 0.48, bus);
      if (e === 4 || e === 12) snare(at, 0.2, bus);
      if (I > 0.55 && e === 15 && bar % 2 === 1) snare(at, 0.09, bus);
      if (e % 2 === 0 || I > 0.75) hat(at, e % 4 === 2 ? 0.035 : 0.022, I > 0.7 && e % 8 === 6, bus);
      if (bar === 7 && e >= 8 && I > 0.3 && e % 2 === 0) tom(at, [200, 170, 140, 110][(e - 8) / 2], 0.26, bus);
    }
    if (s === 0 && I > 0.4 && !fresh) crash(at, 0.07, bus);

    // bass: driving eighths with a sub layer
    if (e % 2 === 0) {
      const m = BASS[bar] + (e === 14 ? 12 : 0);
      voice({
        type: 'sawtooth',
        f: T(m),
        at,
        d: s16 * 1.8,
        a: 0.004,
        r: 0.08,
        v: 0.06,
        filt: { f: 300, f2: 700, f3: 300, t: 0.03 },
        bus,
      });
      voice({ f: T(m - 12), at, d: s16 * 1.8, a: 0.004, r: 0.08, v: 0.14, bus });
    }
    // string ostinato
    if (I > 0.32) {
      const idx = OSTINATO[e];
      const m = idx === 3 ? ch[0] + 12 : ch[idx];
      for (const det of [-7, 7])
        voice({
          type: 'sawtooth',
          f: T(m),
          at,
          d: s16 * 0.9,
          a: 0.003,
          r: 0.05,
          v: 0.03,
          det,
          filt: { f: 2200 },
          bus,
        });
    }
    // brass stabs
    if (I > 0.48 && (e === 0 || (I > 0.7 && e === 10)))
      brass(
        ch.map((m) => m - 12),
        at,
        s16 * (e === 0 ? 5 : 3),
        0.022,
        bus,
      );
    // choir-like pad
    if (I > 0.82 && e === 0)
      for (const m of ch)
        voice({
          type: 'sawtooth',
          f: T(m),
          at,
          d: s16 * 16,
          a: 0.3,
          r: 0.4,
          v: 0.01,
          det: 9,
          filt: { type: 'bandpass', f: 900, q: 1.4 },
          bus,
        });
    // heroic lead
    if (I > 0.6)
      for (const [ps, m, dd] of LEAD)
        if (ps === s)
          voice({
            type: 'sawtooth',
            f: T(m),
            at,
            d: dd * s16 * 1.05,
            a: 0.03,
            r: 0.12,
            v: 0.05,
            vib: 0.007,
            filt: { f: 1800, q: 1 },
            bus,
          });
  }

  function schedule() {
    while (next < ctx.currentTime + 0.12) {
      // ease toward the targets a little every sixteenth (about a bar to settle)
      tempo += (tempoTarget - tempo) * 0.06;
      intensity += (intensityTarget - intensity) * 0.06;
      playStep(step, next);
      next += 60 / tempo / 4;
      if (++step >= STEPS) {
        step = 0;
        loops++;
      }
    }
  }

  return {
    get playing() {
      return timer !== null;
    },
    start() {
      if (timer) return;
      next = ctx.currentTime + 0.08;
      step = 0;
      timer = setInterval(schedule, 25);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    setTempo(bpm) {
      tempoTarget = bpm;
      if (timer === null) tempo = bpm;
    },
    setIntensity(v) {
      intensityTarget = v;
      if (timer === null) intensity = v;
    },
    /** Takes effect on the next bar line, so the key change lands on a downbeat. */
    setLevel(i) {
      if (i === level) {
        pendingLevel = null;
        return;
      }
      if (timer === null) {
        level = i;
        barsInLevel = 99;
      } else pendingLevel = i;
    },
  };
}
