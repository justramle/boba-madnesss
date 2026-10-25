// All DOM work: screens, picker, HUD, banners, the results panel and the level re-theme.
import { LEVELS, worldStart } from '../data/levels.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'hud', 'paused', 'over'];

/** Restart a CSS animation on an element. */
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export class UI {
  constructor() {
    this.el = {
      score: $('score'),
      pill: $('pill'),
      pop: $('pop'),
      shield: $('shieldTag'),
      sword: $('swordTag'),
      swordBar: $('swordBar'),
      magnet: $('magnetTag'),
      magnetBar: $('magnetBar'),
      combo: $('comboTag'),
      comboX: $('comboX'),
      comboLbl: $('comboLbl'),
      comboBar: $('comboBar'),
      lvlNum: $('lvlNum'),
      lvlName: $('lvlName'),
      lvlBar: $('lvlBar'),
      lvlNext: $('lvlNext'),
      ai: $('aiTag'),
      aiVal: $('aiVal'),
      aiArrow: $('aiArrow'),
      banner: $('banner'),
      tip: $('tip'),
      flash: $('flash'),
      icons: $('icons'),
    };
    this.lastAi = -1;
  }

  show(...ids) {
    for (const s of SCREENS) $(s).hidden = !ids.includes(s);
  }

  showWebGLError() {
    $('menu').hidden = true;
    $('noGL').hidden = false;
  }

  /** Re-tints the whole page for a world (sky cross-fade + color tokens). */
  setTheme(levelIndex) {
    document.documentElement.dataset.level = String(levelIndex + 1);
  }

  /* ---------- menu ---------- */
  buildPicker(bobas, icons, onSelect) {
    bobas.forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = 'icon';
      btn.type = 'button';
      btn.title = b.name;
      btn.setAttribute('aria-label', b.name);
      if (icons.boba[i]) {
        const img = document.createElement('img');
        img.src = icons.boba[i];
        img.alt = '';
        btn.appendChild(img);
      }
      btn.addEventListener('click', () => onSelect(i));
      this.el.icons.appendChild(btn);
    });
  }

  setSelected(i, boba, total) {
    $('bname').textContent = boba.name;
    $('bnote').textContent = boba.note;
    $('pickCount').textContent = `${i + 1} / ${total}`;
    this.el.icons
      .querySelectorAll('.icon')
      .forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
  }

  setGuideIcons(icons) {
    $('gNoodle').src = icons.obstacle.noodle || '';
    $('gFish').src = icons.obstacle.fish || '';
    $('gBomb').src = icons.obstacle.bomb || '';
    $('gCloud').src = icons.cloud || '';
  }

  setBest(best, skill) {
    $('bestMenu').innerHTML =
      (best > 0 ? `Best <b>${best}</b>` : 'No best yet') + (skill ? ` · Skill <b>${skill.toLocaleString()}</b>` : '');
  }

  /** Wires the Music/Sound toggles (menu + pause) and the Adaptive AI toggle. */
  bindToggles(sound, director) {
    const sync = () => {
      document.querySelectorAll('.tg-music').forEach((b) => b.setAttribute('aria-pressed', String(sound.musicOn)));
      document.querySelectorAll('.tg-sfx').forEach((b) => b.setAttribute('aria-pressed', String(sound.sfxOn)));
      document.querySelectorAll('.tg-ai').forEach((b) => b.setAttribute('aria-pressed', String(director.enabled)));
      $('aiHint').textContent = director.enabled
        ? 'Adaptive AI watches every obstacle you clear or miss and tunes the next ones to your skill.'
        : 'Adaptive AI is off: each world uses a fixed difficulty curve.';
    };
    document
      .querySelectorAll('.tg-music')
      .forEach((b) => b.addEventListener('click', () => (sound.setMusic(!sound.musicOn), sync())));
    document
      .querySelectorAll('.tg-sfx')
      .forEach((b) => b.addEventListener('click', () => (sound.setSfx(!sound.sfxOn), sync())));
    document
      .querySelectorAll('.tg-ai')
      .forEach((b) => b.addEventListener('click', () => (director.setEnabled(!director.enabled), sync())));
    sync();
  }

  bindButtons(handlers) {
    $('startBtn').addEventListener('click', handlers.start);
    $('againBtn').addEventListener('click', handlers.start);
    $('chooseBtn').addEventListener('click', handlers.menu);
    $('pauseBtn').addEventListener('click', handlers.pause);
    $('resumeBtn').addEventListener('click', handlers.resume);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && b.id !== 'startBtn' && b.id !== 'againBtn') handlers.click();
    });
  }

  focus(id) {
    $(id).focus({ preventScroll: true });
  }

  blurActive() {
    document.activeElement?.blur?.();
  }

  /* ---------- HUD ---------- */
  resetHud(showTip, adaptive) {
    this.setScore(0);
    this.setShield(false);
    this.setPower('sword', 0);
    this.setPower('magnet', 0);
    this.el.combo.hidden = true;
    this.el.banner.hidden = true;
    this.el.ai.hidden = !adaptive;
    this.lastAi = -1;
    const tip = this.el.tip;
    tip.hidden = !showTip;
    if (showTip) {
      tip.style.animation = 'none';
      void tip.offsetWidth;
      tip.style.animation = '';
    }
  }

  setScore(v) {
    this.el.score.textContent = v;
  }

  popText(text) {
    replay(this.el.pill, 'bump');
    this.el.pop.textContent = text;
    replay(this.el.pop, 'go');
  }

  setShield(on) {
    this.el.shield.hidden = !on;
  }

  /** @param {'sword'|'magnet'} kind  @param {number} remaining 0..1 */
  setPower(kind, remaining) {
    const tag = this.el[kind];
    tag.hidden = remaining <= 0;
    if (!tag.hidden) this.el[`${kind}Bar`].style.transform = `scaleX(${remaining})`;
  }

  setLevel(levelIndex, progress, distance) {
    this.el.lvlNum.textContent = levelIndex + 1;
    this.el.lvlName.textContent = LEVELS[levelIndex].name;
    const last = levelIndex >= LEVELS.length - 1;
    this.el.lvlBar.style.transform = `scaleX(${last ? 1 : Math.max(0, Math.min(1, progress))})`;
    this.el.lvlNext.textContent = last
      ? `${Math.round(distance)} m`
      : `${Math.max(0, Math.ceil(worldStart(levelIndex + 1) - distance))} m to go`;
  }

  setAi(challenge, trend) {
    const pct = Math.round(challenge * 100);
    if (pct === this.lastAi) return;
    this.el.aiVal.textContent = `${pct}%`;
    if (this.lastAi >= 0 && trend) {
      this.el.aiArrow.textContent = trend > 0 ? '▲' : '▼';
      this.el.aiArrow.className = '';
      void this.el.aiArrow.offsetWidth;
      this.el.aiArrow.className = trend > 0 ? 'up' : 'down';
    }
    this.lastAi = pct;
  }

  updateCombo(combo, mult, remaining) {
    const c = this.el.combo;
    c.hidden = combo < 3;
    if (c.hidden) return;
    this.el.comboX.textContent = combo;
    this.el.comboLbl.textContent = mult > 1 ? `Combo · ×${mult} points` : 'Combo';
    this.el.comboBar.style.transform = `scaleX(${Math.max(0, remaining)})`;
  }

  comboLevelUp() {
    replay(this.el.combo, 'up');
  }

  hideCombo() {
    this.el.combo.hidden = true;
  }

  banner(small, big, gold = false) {
    const b = this.el.banner;
    $('bannerSmall').textContent = small;
    $('bannerBig').textContent = big;
    b.classList.toggle('gold', gold);
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (b.hidden = true), 1850);
  }

  flash() {
    replay(this.el.flash, 'go');
  }

  /* ---------- results ---------- */
  showResults({ score, best, isBest, why, haul, clears, slices, distance, level, topCombo }) {
    $('why').textContent = why;
    $('finalScore').textContent = score;
    $('newBest').hidden = !isBest;
    const box = $('haul');
    box.textContent = '';
    if (!haul.length && !clears && !slices) {
      const none = document.createElement('span');
      none.className = 'none';
      none.textContent = 'No toppings collected';
      box.appendChild(none);
    }
    for (const { name, icon, count } of haul) {
      const chip = document.createElement('span');
      chip.title = name;
      if (icon) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = name;
        chip.appendChild(img);
      }
      chip.append(`×${count}`);
      box.appendChild(chip);
    }
    for (const [n, label] of [
      [clears, 'Clean jumps'],
      [slices, 'Sword cuts'],
    ]) {
      if (!n) continue;
      const chip = document.createElement('span');
      chip.className = 'text';
      chip.textContent = `${label} ×${n}`;
      box.appendChild(chip);
    }
    $('rDist').textContent = `${Math.round(distance)} m`;
    $('rLevel').textContent = `${level + 1} of ${LEVELS.length}`;
    $('rCombo').textContent = `×${topCombo}`;
    $('rBest').textContent = best;

    this.show('over');
    this.focus('againBtn');
  }
}
