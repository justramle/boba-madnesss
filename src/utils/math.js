export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

/** Frame-rate independent smoothing toward a target. */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export const smoothstep = (t) => t * t * (3 - 2 * t);
