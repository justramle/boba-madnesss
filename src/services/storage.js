// localStorage can be missing or throw (private mode, blocked storage), so every access is guarded.

const KEYS = {
  best: 'boba-madness-best',
  sound: 'boba-madness-sound',
};

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep playing without saving */
  }
}

export function loadJSON(key, fallback) {
  try {
    const raw = read(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  write(key, JSON.stringify(value));
}

export function loadBest() {
  return parseInt(read(KEYS.best) || '0', 10) || 0;
}

export function saveBest(score) {
  write(KEYS.best, String(score));
}

export function loadSoundPrefs() {
  const s = loadJSON(KEYS.sound, {});
  return { music: s.m !== false, sfx: s.s !== false };
}

export function saveSoundPrefs({ music, sfx }) {
  saveJSON(KEYS.sound, { m: music, s: sfx });
}
