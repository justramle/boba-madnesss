// Gameplay tuning. Change numbers here, not inside the systems.

/** x position of the three lanes */
export const LANES = [-2.1, 0, 2.1];

export const SPEED = {
  start: 20, // world units per second at the start of a run
  max: 36,
  ramp: 0.36, // added per second
};

export const JUMP = {
  velocity: 10,
  gravity: 24,
  buffer: 0.18, // a jump pressed this long before landing still fires
};

export const SLIDE_TIME = 0.75;

export const COMBO = {
  window: 2.6, // seconds to keep a combo alive
  perLevel: 8, // combo hits per multiplier step
  maxMult: 4,
};

export const SCORE = {
  cleanClear: 5,
  cloud: 50,
  slice: 20, // sword cut through an obstacle
  powerup: 20,
};

/** Metres each world lasts before the next begins (the last world is endless): forest at 1500 m, ocean at 3000 m. */
export const WORLD_LENGTHS = [1500, 1500];

/** How long each power-up lasts, in seconds. */
export const POWERUP = { sword: 7, magnet: 8 };

/** Adaptive difficulty: aim for this fraction of obstacle rows cleared. */
export const ADAPTIVE = { target: 0.75, window: 8, learningRate: 0.12 };

export const MILESTONE_STEP = 500; // metres between distance banners (worlds are the big moments)
export const SPAWN_Z = -82;

/** Row spacing grows with speed so reaction time stays fair. */
export const rowGap = (speed) => 15 + speed * 0.45;

export const TEMPO = { menu: 100, runMin: 124, runMax: 144 };
