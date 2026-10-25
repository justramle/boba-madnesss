# Boba Madness

I created a cute 3D runner called Boba Madness, inspired by classic coin-collecting running games. Player pick boba, run to collect topping to score, hit the obstackles will end the game.
Built with [three.js](https://threejs.org) and [Vite](https://vite.dev); only support Web Audio API

## Levels

There are only 3 levels. Every 2,000 m (`LEVEL_LENGTH` in `src/config.js`) the run moves to the next world. Each one re-skins the scenery, the sky, the UI colors, the obstacles, the music and the boba's gear.

| World | Theme                                                          | Obstacles                                              | Boba gear           | Power-ups |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------- | --------- |
| 1     | Winter Mountain: stone causeway, snow, moon gates              | noodle cup · fish sauce · bomb                         | wings               | shield    |
| 2     | Forest Bridge: rope bridge at dusk, pines, lanterns, fireflies | mossy noodle cup · bamboo fish sauce · thorn bomb      | + scarf, sheath     | + sword   |
| 3     | Ocean Surf: a water lane, buoys, palm islands, sailboats       | noodle cup in a life ring · drifting bottle · sea mine | + shades, surfboard | + magnet  |

**Power-ups:** the cheese-foam shield absorbs one hit; the Brown Sugar Blade cuts through obstacles for 7 s (+20 each); the Pearl Magnet pulls toppings in from every lane for 8 s.

## Adaptive Learning difficulty

`src/ai/adaptive.js` is a small on-device learner, not a trained offline model: no neural net, no batching, just a linear model updated one example at a time as you play. It frames difficulty as three cooperating parts:

**1. Predictive model — online logistic regression**
- Task: binary classification — will you clear the next row?
- Nine obstacle patterns (single hop … mixed wall), each with a hand-set prior difficulty
- Each row is encoded as a 13-dim feature vector: `[bias, pattern difficulty, normalized speed, normalized level, one-hot pattern id]`
- Scored by a single linear layer + sigmoid: `P(clear) = σ(w · x)`
- After every row, one SGD step updates the weights toward the observed outcome: `err = cleared − P(clear)`, `w += learningRate * err * x`, `learningRate = 0.12`
- Incremental, per-sample training — no replay buffer

**2. Exploration — Thompson-sampling bandit**
- Alongside the model, each pattern keeps a Beta(wins, losses) posterior (prior Beta(1,1))
- A sample from that posterior is blended with the model's prediction (`0.65 * model + 0.35 * bandit sample`) so under-tried patterns still get picked even if the model is confident about them
- The next pattern isn't the argmax — candidates are scored by closeness of this blended estimate to the 75% target (a Gaussian kernel around the target, penalized for repeating a pattern), then sampled from that score distribution — keeping some variety instead of always picking the single best option

**3. Control loop — the challenge dial**
- Separately from the model and bandit, a scalar **challenge dial** (0–100%) tracks your clear rate over the last 8 rows (`ADAPTIVE.window`)
- Nudged toward a 75% target (`ADAPTIVE.target`) each row: eases down fast on a crash, drifts toward the target afterward (faster when easing than when tightening)
- This dial is what actually scales speed, row spacing and shield frequency, and caps how hard a pattern may be — a feedback controller sitting on top of the model, not a learned parameter itself

**Constants:** `ADAPTIVE = { target: 0.75, window: 8, learningRate: 0.12 }` in `src/config.js`.

Everything (weights, win/loss counts, dial) saves to `localStorage`, so it picks up where you left off. The **Adaptive AI** toggle turns it off in favor of a fixed curve; the results panel shows what it did.

## Getting started

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

## Controls

| Action      | Touch        | Keyboard       |
| ----------- | ------------ | -------------- |
| Change lane | Swipe ← / →  | ← / → or A / D |
| Jump        | Swipe ↑      | ↑, W or Space  |
| Slide       | Swipe ↓      | ↓ or S         |
| Pause       | Pause button | P or Esc       |