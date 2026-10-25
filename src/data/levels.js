import { WORLD_LENGTHS } from '../config.js';

/**
 * The three worlds. Index = level - 1.
 * baseChallenge: where the difficulty dial sits for this world when adaptive mode is off
 *                (and a floor for it when adaptive mode is on).
 * halo: color of the ring around toppings.  powerups: what can spawn here.
 */
export const LEVELS = [
  {
    name: 'Winter Mountain',
    tagline: 'A stone causeway above the clouds',
    speedMult: 1.0,
    baseChallenge: 0.2,
    fog: '#efe6da',
    fogNear: 26,
    fogFar: 100,
    halo: '#b8955c',
    powerups: ['shield'],
  },
  {
    name: 'Forest Bridge',
    tagline: 'A timber bridge through the dusk pines',
    speedMult: 1.22,
    baseChallenge: 0.45,
    fog: '#a5aa92',
    fogNear: 28,
    fogFar: 105,
    halo: '#d1b36a',
    powerups: ['shield', 'sword'],
  },
  {
    name: 'Ocean Surf',
    tagline: 'Surfing a pale morning sea',
    speedMult: 1.32,
    baseChallenge: 0.7,
    fog: '#e3e9e6',
    fogNear: 30,
    fogFar: 110,
    halo: '#c08a6e',
    powerups: ['shield', 'sword', 'magnet'],
  },
];

export const MAX_LEVEL = LEVELS.length;

const lengthOf = (i) => WORLD_LENGTHS[i] ?? 1000;

/** Distance (m) at which world `i` (0-based) begins. */
export const worldStart = (i) => {
  let d = 0;
  for (let k = 0; k < i; k++) d += lengthOf(k);
  return d;
};

/** How long world `i` lasts; the last world never ends. */
export const worldLength = (i) => (i < MAX_LEVEL - 1 ? lengthOf(i) : Infinity);

/** 0-based level index for a distance run so far. */
export function levelIndexForDistance(metres) {
  let i = 0;
  while (i < MAX_LEVEL - 1 && metres >= worldStart(i + 1)) i++;
  return i;
}
