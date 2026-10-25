// Touch swipes + keyboard, translated into game intents.
// `game` must expose: state, steer(dir), jump(), slide(), pause(), resume(), startRun(), onGesture().

const SWIPE_MIN = 24; // px before a drag counts as a swipe

export function bindInput(game) {
  let sx = 0;
  let sy = 0;
  let tracking = false;
  let used = false;

  window.addEventListener(
    'pointerdown',
    (e) => {
      game.onGesture();
      if (e.target.closest('button')) return;
      tracking = true;
      used = false;
      sx = e.clientX;
      sy = e.clientY;
    },
    true,
  );

  window.addEventListener('pointermove', (e) => {
    if (!tracking || used) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    used = true;
    if (Math.abs(dx) > Math.abs(dy)) game.steer(dx > 0 ? 1 : -1);
    else if (game.state === 'running') dy < 0 ? game.jump() : game.slide();
  });

  const stop = () => (tracking = false);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);

  window.addEventListener('keydown', (e) => {
    game.onGesture();
    const k = e.key;
    const onButton = e.target?.tagName === 'BUTTON';

    if (game.state === 'running') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') game.steer(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') game.steer(1);
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') !e.repeat && game.jump();
      else if (k === 'ArrowDown' || k === 's' || k === 'S') !e.repeat && game.slide();
      else if (k === 'p' || k === 'P' || k === 'Escape') game.pause();
      else return;
      e.preventDefault();
      return;
    }
    if (
      game.state === 'paused' &&
      (k === 'p' || k === 'P' || k === 'Escape' || ((k === ' ' || k === 'Enter') && !onButton))
    ) {
      e.preventDefault();
      game.resume();
      return;
    }
    if (game.state === 'menu' && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      game.steer(k === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (game.state === 'menu' && k >= '1' && k <= '3') {
      game.selectWorld(+k - 1); // shortcut for testing: the next run starts in that world
      return;
    }
    if ((k === ' ' || k === 'Enter') && !onButton && (game.state === 'menu' || game.state === 'over')) {
      e.preventDefault();
      game.startRun();
    }
  });

  document.addEventListener('visibilitychange', () => game.onVisibility(document.hidden));
}
