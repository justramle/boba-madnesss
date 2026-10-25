// Adaptive Learning difficulty.
//
// The game learns how you play and keeps serving obstacle rows that you clear about 75% of
// the time: hard enough to be exciting, never hopeless. Read this file top to bottom; it is
// laid out as the five steps the director takes for every row:
//
//   step 1  describe a row as a few numbers                 → describeRow()
//   step 2  predict the chance you clear it                 → predictClearChance()
//   step 3  make a "random guess" from a win/loss scoreboard → randomGuessFromScoreboard()
//   step 4  choose the next row                             → AdaptiveDirector.choose()
//   step 5  learn from what happened                        → AdaptiveDirector.report()
//
// Everything is plain JavaScript, runs on the player's device, and is saved to localStorage
// so the next session starts where this one ended. The maths helpers (sigmoid, Beta sampling)
// sit at the very bottom; you do not need them to follow the logic.
import { ADAPTIVE } from '../config.js';
import { loadJSON, saveJSON } from '../services/storage.js';

/** The nine kinds of obstacle row, easiest first. `difficulty` is a 0–1 guess made before any data. */
export const PATTERNS = [
  { id: 'lowSingle', difficulty: 0.08, label: 'single hop' },
  { id: 'normalSingle', difficulty: 0.18, label: 'single jump' },
  { id: 'highSingle', difficulty: 0.22, label: 'single slide' },
  { id: 'double', difficulty: 0.38, label: 'two lanes blocked' },
  { id: 'mover', difficulty: 0.5, label: 'lane-hopping bottle' },
  { id: 'wall', difficulty: 0.58, label: 'full wall' },
  { id: 'bombPair', difficulty: 0.64, label: 'twin bombs' },
  { id: 'closedLane', difficulty: 0.72, label: 'closed lane' },
  { id: 'mixedWall', difficulty: 0.84, label: 'mixed wall' },
];

const TARGET_CLEAR_RATE = ADAPTIVE.target; // 0.75: the clear rate we aim for
const LEARNING_RATE = ADAPTIVE.learningRate; // how big each correction to the model is
const MEMORY = ADAPTIVE.window; // how many recent rows the dial looks at
const STORAGE_KEY = 'boba-madness-ai';

/* =========================================================================================
   step 1 · describe a row
   ========================================================================================= */

/**
 * Turns "this pattern, at this speed, in this world" into the numbers the model reads.
 * `speed` and `world` are both 0–1. Exactly one `is_<pattern>` flag is 1 and the rest are 0,
 * which lets the model learn that you are good or bad at one specific pattern.
 */
function describeRow(patternIndex, speed, world) {
  const row = {
    always: 1, // gives the model a baseline to start from
    difficulty: PATTERNS[patternIndex].difficulty,
    speed,
    world,
  };
  PATTERNS.forEach((pattern, i) => {
    row['is_' + pattern.id] = i === patternIndex ? 1 : 0;
  });
  return row;
}

/** The weights before any play: easy rows ≈ 90% clear, hard rows ≈ 35%, faster and later = harder. */
function startingWeights() {
  const weights = { always: 2.6, difficulty: -3.4, speed: -1.1, world: -0.5 };
  for (const pattern of PATTERNS) weights['is_' + pattern.id] = 0;
  return weights;
}

/* =========================================================================================
   step 2 · predict the chance of clearing a row  (logistic regression)
   ========================================================================================= */

/** Multiply each number of the row by its weight, add them up, squash the total into a 0–1 chance. */
function predictClearChance(weights, row) {
  let score = 0;
  for (const name in row) score += weights[name] * row[name];
  return sigmoid(score);
}

/* =========================================================================================
   step 3 · the scoreboard and the random guess  (Thompson sampling)
   ========================================================================================= */

/**
 * The model alone has a blind spot: once it believes a pattern is too hard for you it would
 * stop showing it, so it could never find out that you improved. The fix is a second opinion
 * drawn at random from a win/loss scoreboard. With 1 win and 1 loss the guess swings anywhere
 * from 0.1 to 0.9; with 40 wins and 10 losses it lands near 0.8 almost every time. Rarely-seen
 * patterns therefore sometimes get a lucky, optimistic guess and get picked. That is the
 * exploration, and it fades by itself as the scoreboard fills up.
 */
function randomGuessFromScoreboard(wins, losses) {
  return sampleBeta(wins, losses);
}

/* =========================================================================================
   the director: steps 4 and 5, plus the difficulty dial and the saved memory
   ========================================================================================= */

export class AdaptiveDirector {
  constructor() {
    const saved = loadJSON(STORAGE_KEY, null) || {};
    this.enabled = saved.enabled ?? true;
    this.weights = hasEveryWeight(saved.weights) ? saved.weights : startingWeights();
    this.wins = saved.wins?.length === PATTERNS.length ? saved.wins : PATTERNS.map(() => 1);
    this.losses = saved.losses?.length === PATTERNS.length ? saved.losses : PATTERNS.map(() => 1);
    this.challenge = saved.challenge ?? 0.3; // the difficulty dial: 0 = gentle, 1 = everything
    this.rowsSeen = saved.rowsSeen ?? 0;
    this.recentResults = []; // 1 = cleared, 0 = hit, for the last MEMORY rows
    this.recentPatterns = []; // ids of the last few rows, so the same one is not shown three times
    this.trend = 0; // +1 or -1 after the last dial move, for the HUD arrow
    this.runStart = this.challenge;
  }

  /* ---------- step 4 · choose the next row ---------- */

  /**
   * Picks the pattern for the next row.
   * `challenge` is the effective dial: the director's own dial blended with the world's level.
   */
  choose({ speedNorm, level, challenge }) {
    const world = (level - 1) / 2;
    const maxDifficulty = challenge + 0.3; // the dial caps how hard a row may be
    const candidates = PATTERNS.filter((pattern) => pattern.difficulty <= maxDifficulty);

    const weights = candidates.map((pattern) => this.#howGoodIs(pattern, speedNorm, world, challenge));
    const chosen = candidates[pickWeightedIndex(weights)];

    this.recentPatterns.push(chosen.id);
    if (this.recentPatterns.length > 6) this.recentPatterns.shift();
    return chosen;
  }

  /** How good a candidate is: 1 when its clear chance sits right on the target, fading away from it. */
  #howGoodIs(pattern, speed, world, challenge) {
    if (!this.enabled) {
      // adaptive mode off: a fixed curve that prefers patterns whose difficulty sits near the dial
      return bell(pattern.difficulty - challenge, 0.25);
    }
    const index = PATTERNS.indexOf(pattern);
    const modelChance = predictClearChance(this.weights, describeRow(index, speed, world));
    const guess = randomGuessFromScoreboard(this.wins[index], this.losses[index]);
    const chance = 0.65 * modelChance + 0.35 * guess; // the guess keeps a little exploration in the mix

    const shownTwiceAlready = this.recentPatterns.slice(-2).filter((id) => id === pattern.id).length === 2;
    const repeatPenalty = shownTwiceAlready ? 0.15 : 1;
    const neverZero = 0.02; // every allowed pattern keeps a small chance
    return bell(chance - TARGET_CLEAR_RATE, 0.18) * repeatPenalty + neverZero;
  }

  /* ---------- step 5 · learn from the result ---------- */

  /** Called once per row with whether it was cleared. Updates the scoreboard, the model and the dial. */
  report({ pattern, speedNorm, level, cleared }) {
    const index = PATTERNS.indexOf(pattern);
    if (index < 0 || !this.enabled) return;
    this.rowsSeen++;
    this.#updateScoreboard(index, cleared);
    this.#updateModel(index, speedNorm, (level - 1) / 2, cleared);
    this.#updateDial(cleared);
    this.save();
  }

  #updateScoreboard(index, cleared) {
    if (cleared) this.wins[index]++;
    else this.losses[index]++;
  }

  /**
   * One small correction, the whole of the "training": compare what the model predicted with
   * what really happened and move every weight a little toward the truth (gradient descent).
   * Predicted 0.8 but you crashed? The error is -0.8, so the weights for this pattern, for
   * speed and for difficulty all drop a little, and the next prediction is lower.
   */
  #updateModel(index, speed, world, cleared) {
    const row = describeRow(index, speed, world);
    const actual = cleared ? 1 : 0;
    const error = actual - predictClearChance(this.weights, row);
    for (const name in row) this.weights[name] += LEARNING_RATE * error * row[name];
  }

  /**
   * The dial follows your recent clear rate. Above the target it creeps up; below it, it comes
   * down faster than it went up, and a crash always eases things a little right away.
   */
  #updateDial(cleared) {
    this.recentResults.push(cleared ? 1 : 0);
    if (this.recentResults.length > MEMORY) this.recentResults.shift();

    const before = this.challenge;
    if (!cleared) this.challenge -= 0.05;
    if (this.recentResults.length >= 4) {
      const gap = this.clearRate - TARGET_CLEAR_RATE; // negative = struggling
      const stepSize = gap < 0 ? 0.2 : 0.14;
      this.challenge += gap * stepSize;
    }
    this.challenge = clamp(this.challenge, 0.05, 1);
    this.trend = Math.sign(Math.round((this.challenge - before) * 100));
  }

  /* ---------- what the rest of the game reads ---------- */

  /** Share of the recent rows that were cleared (the target until there is data). */
  get clearRate() {
    if (this.recentResults.length === 0) return TARGET_CLEAR_RATE;
    return average(this.recentResults);
  }

  /** A rating in the 600–2000 range, from the dial and the lifetime win rate. */
  get skill() {
    const wins = sum(this.wins) - PATTERNS.length; // minus the 1 each scoreboard starts with
    const losses = sum(this.losses) - PATTERNS.length;
    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0.5;
    return Math.round(600 + this.challenge * 1000 + winRate * 400);
  }

  /** Your weakest pattern so far, once it has been tried at least three times. */
  get weakest() {
    let worst = null;
    PATTERNS.forEach((pattern, i) => {
      const tries = this.wins[i] + this.losses[i] - 2;
      if (tries < 3) return;
      const rate = (this.wins[i] - 1) / tries;
      if (!worst || rate < worst.rate) worst = { label: pattern.label, rate };
    });
    return worst;
  }

  startRun() {
    this.recentResults = [];
    this.runStart = this.challenge;
    this.trend = 0;
  }

  setEnabled(on) {
    this.enabled = on;
    this.save();
  }

  resetMemory() {
    this.weights = startingWeights();
    this.wins = PATTERNS.map(() => 1);
    this.losses = PATTERNS.map(() => 1);
    this.challenge = 0.3;
    this.rowsSeen = 0;
    this.save();
  }

  save() {
    saveJSON(STORAGE_KEY, {
      enabled: this.enabled,
      weights: this.weights,
      wins: this.wins,
      losses: this.losses,
      challenge: this.challenge,
      rowsSeen: this.rowsSeen,
    });
  }
}

/** How the dial changes the run: a little faster, rows a little closer, shields a little rarer. */
export const dial = {
  speedMult: (challenge) => 0.92 + 0.26 * challenge,
  gapMult: (challenge) => 1.12 - 0.28 * challenge,
  shieldChance: (challenge) => 0.09 - 0.06 * challenge,
};

/* =========================================================================================
   maths helpers · no need to read these to follow the logic above
   ========================================================================================= */

/** Squashes any number into 0–1: big negative → near 0, zero → 0.5, big positive → near 1. */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/** A bump that is 1 at x = 0 and fades toward 0 as |x| grows; `width` sets how fast. */
function bell(x, width) {
  return Math.exp(-((x / width) ** 2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values) {
  return sum(values) / values.length;
}

/** True when a saved weights object has every key the model expects. */
function hasEveryWeight(saved) {
  if (!saved || typeof saved !== 'object') return false;
  return Object.keys(startingWeights()).every((name) => typeof saved[name] === 'number');
}

/** Picks an index at random, where a bigger weight means a bigger chance. */
function pickWeightedIndex(weights) {
  let remaining = Math.random() * sum(weights);
  for (let i = 0; i < weights.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return i;
  }
  return weights.length - 1;
}

/** A random number from a Beta(a, b) distribution, built from two Gamma samples. */
function sampleBeta(a, b) {
  const x = sampleGamma(a);
  return x / (x + sampleGamma(b));
}

/** Marsaglia–Tsang method for Gamma(k, 1); JavaScript has no built-in for it. */
function sampleGamma(k) {
  if (k < 1) return sampleGamma(k + 1) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = sampleNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** A standard normal random number (Box–Muller). */
function sampleNormal() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
