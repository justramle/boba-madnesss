// Builds each row of the course from a pattern chosen by the adaptive director, then lays
// toppings, reward clouds and power-ups around it. Every row stays passable.
import { LANES } from '../config.js';
import { pick, shuffle } from '../utils/math.js';
import { randomToppingType } from '../entities/toppings.js';
import { TYPE_FOR_CAT } from '../entities/obstacles.js';

/** Lane plan for a pattern: array of 3 categories (or null), plus a mover / closed lane. */
function planFor(pattern) {
  const lanes = shuffle([0, 1, 2]);
  const plan = [null, null, null];
  let mover = null;
  let closed = -1;
  switch (pattern.id) {
    case 'lowSingle':
      plan[lanes[0]] = 'low';
      break;
    case 'normalSingle':
      plan[lanes[0]] = 'normal';
      break;
    case 'highSingle':
      plan[lanes[0]] = 'high';
      break;
    case 'double':
      plan[lanes[0]] = pick(['low', 'normal']);
      plan[lanes[1]] = pick(['low', 'normal', 'high']);
      break;
    case 'mover':
      plan[lanes[0]] = 'normal';
      mover = { lane: lanes[0], from: lanes[1] };
      break;
    case 'wall':
      plan.fill(pick(['low', 'low', 'high', 'normal']));
      break;
    case 'bombPair':
      plan[lanes[0]] = 'high';
      plan[lanes[1]] = 'high';
      plan[lanes[2]] = 'low';
      break;
    case 'closedLane':
      closed = lanes[0];
      plan[lanes[0]] = 'low';
      plan[lanes[1]] = pick(['low', 'normal']);
      break;
    case 'mixedWall':
      plan[lanes[0]] = 'low';
      plan[lanes[1]] = 'normal';
      plan[lanes[2]] = 'high';
      break;
  }
  return { plan, mover, closed };
}

export function createSpawner(pools, active) {
  function addObstacle(cat, lane, z, level, rowId) {
    const type = TYPE_FOR_CAT[cat];
    const g = pools.get('obstacle', type, level);
    g.position.set(LANES[lane], 0, z);
    g.rotation.y = cat === 'normal' ? Math.random() * 0.6 - 0.3 : Math.random() * 0.8 - 0.4;
    const o = { g, kind: 'obstacle', cat, row: rowId, phase: Math.random() * 6 };
    active.push(o);
    return o;
  }

  function addTopping(type, lane, z, phase, level, height = 0.8) {
    const g = pools.get('topping', type, level);
    g.position.set(LANES[lane], 0, z);
    active.push({ g, kind: 'topping', phase, height });
  }

  function addCloud(lane, z, height) {
    const g = pools.get('cloud');
    g.position.set(LANES[lane], 0, z);
    active.push({ g, kind: 'cloud', phase: Math.random() * 6, height });
  }

  /**
   * @param {number} z    spawn depth
   * @param {number} gap  distance to the next row
   * @param {object} ctx  { pattern, level, rowId, powerups: string[], activePower, shieldChance }
   * @returns {number}    how many obstacles the row has
   */
  return function spawnRow(z, gap, ctx) {
    const { pattern, level, rowId } = ctx;
    const { plan, mover, closed } = planFor(pattern);

    let count = 0;
    for (let l = 0; l < 3; l++) {
      if (!plan[l]) continue;
      const o = addObstacle(plan[l], l, z, level, rowId);
      count++;
      if (mover && mover.lane === l) {
        Object.assign(o, { moving: true, x0: LANES[mover.from], x1: LANES[l], zStart: -58, zEnd: -30 });
        o.g.position.x = o.x0;
      }
    }
    if (closed >= 0) {
      addObstacle('high', closed, z, level, rowId);
      count++;
    }

    const free = [0, 1, 2].filter((l) => !plan[l]);
    const jumpable = [0, 1, 2].filter((l) => (plan[l] === 'low' || plan[l] === 'normal') && l !== closed);
    const anyLane = free.length ? free : jumpable.length ? jumpable : [0, 1, 2];

    // reward cloud right above a jumpable obstacle
    if (jumpable.length && Math.random() < 0.2) addCloud(pick(jumpable), z, 3.1);

    // power-ups: rare, never while one of the same kind is running
    const roll = Math.random();
    if (!ctx.activePower.shield && roll < ctx.shieldChance && ctx.powerups.includes('shield')) {
      addTopping('shield', pick(anyLane), z + gap * 0.5, 0, level);
      return count;
    }
    if (!ctx.activePower.sword && roll < 0.035 && ctx.powerups.includes('sword')) {
      addTopping('sword', pick(anyLane), z + gap * 0.5, 0, level);
      return count;
    }
    if (!ctx.activePower.magnet && roll < 0.07 && roll >= 0.035 && ctx.powerups.includes('magnet')) {
      addTopping('magnet', pick(anyLane), z + gap * 0.5, 0, level);
      return count;
    }

    const type = randomToppingType();
    const bottles = [0, 1, 2].filter((l) => plan[l] === 'normal' && l !== closed);
    if (bottles.length && Math.random() < 0.35) {
      // arc over a bottle: rewards jumping it
      const l = pick(bottles);
      for (let k = -2; k <= 2; k++) addTopping(type, l, z + k * 1.8, k * 0.6, level, 1.1 + (1 - (k * k) / 4) * 1.6);
    } else if (free.length) {
      // trail in an open lane leading up to the row
      const l = pick(free);
      const n = Math.max(3, Math.min(6, Math.floor((gap - 6) / 2.4)));
      for (let k = 0; k < n; k++) addTopping(type, l, z + 1.6 + 2.4 * k, k * 0.6, level);
    }
    return count;
  };
}
