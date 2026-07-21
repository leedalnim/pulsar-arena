/**
 * Menu.js
 * ---------------------------------------------------------------------------
 * Manages the DOM overlay screens (main menu, settings, pause, game over) that
 * sit above the canvas. Keeping menus as accessible DOM — rather than drawing
 * them on the canvas — gives us real buttons, sliders and focus handling for
 * free, while the canvas stays dedicated to the game world.
 *
 * The Menu is intentionally "dumb": it renders state and reports user actions
 * back to the Game through a small set of callbacks passed in the constructor.
 * ---------------------------------------------------------------------------
 */
import { strings, LANG_NAMES } from '../core/i18n.js';

export class Menu {
  /**
   * @param {HTMLElement} root overlay container
   * @param {object} cb callbacks { onStart, onResume, onRestart, onQuit, onSettingsChange }
   * @param {object} settings current persisted settings
   */
  constructor(root, cb, settings) {
    this.root = root;
    this.cb = cb;
    this.settings = settings;
    this.screen = 'main';
  }

  /* ------------------------------ show/hide ------------------------------ */
  show(screen, data = {}) {
    this.screen = screen;
    this.root.style.display = 'flex';
    this.root.innerHTML = this._html(screen, data);
    this._bind(screen);
  }

  hide() {
    this.root.style.display = 'none';
    this.root.innerHTML = '';
  }

  /* ------------------------------- markup -------------------------------- */
  _html(screen, data) {
    if (screen === 'main') return this._mainHTML();
    if (screen === 'settings') return this._settingsHTML(data.from || 'main');
    if (screen === 'howto') return this._howtoHTML();
    if (screen === 'pause') return this._pauseHTML();
    if (screen === 'over') return this._overHTML(data);
    return '';
  }

  _logo(T) {
    return `<div class="logo">
      <span class="logo-mark" aria-hidden="true"></span>
      <h1>PULSAR</h1>
      <p class="tagline">${T.tagline}</p>
    </div>`;
  }

  _mainHTML() {
    const T = strings(this.settings.lang);
    return `<div class="panel panel-main">
      ${this._logo(T)}
      <div class="btn-col">
        <button class="btn btn-primary" data-act="start">${T.enterArena}</button>
        <button class="btn" data-act="howto">${T.howToPlay}</button>
        <button class="btn" data-act="settings">${T.settings}</button>
      </div>
      <p class="footnote">${T.mainFootnote}</p>
    </div>`;
  }

  _howtoHTML() {
    const T = strings(this.settings.lang);
    return `<div class="panel panel-wide">
      <h2>${T.howToPlay}</h2>
      <div class="howto-grid">
        <div><span class="kbd">WASD</span> / <span class="kbd">◄▲▼►</span><em>${T.move}</em></div>
        <div><span class="kbd">Space</span><em>${T.deployCore}</em></div>
        <div><span class="kbd">Shift</span><em>${T.dash}</em></div>
        <div><span class="kbd">E</span><em>${T.shield}</em></div>
        <div><span class="kbd">Q</span><em>${T.cycleCore}</em></div>
        <div><span class="kbd">Esc</span><em>${T.pause}</em></div>
      </div>
      <p class="howto-note">${T.howtoNote1}</p>
      <p class="howto-note">${T.howtoNote2}</p>
      <div class="btn-col">
        <button class="btn btn-primary" data-act="back">${T.back}</button>
      </div>
    </div>`;
  }

  _settingsHTML(from) {
    const s = this.settings;
    const T = strings(s.lang);
    return `<div class="panel panel-wide">
      <h2>${T.settings}</h2>
      <div class="setting row">
        <label>${T.language}</label>
        <button class="toggle on" data-lang="1" data-from="${from}">${LANG_NAMES[s.lang] || s.lang}</button>
      </div>
      <div class="setting">
        <label>${T.masterVolume} <output>${Math.round(s.volume * 100)}%</output></label>
        <input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-set="volume">
      </div>
      <div class="setting row">
        <label>${T.soundEffects}</label>
        <button class="toggle ${s.sfx ? 'on' : ''}" data-set="sfx">${s.sfx ? T.on : T.off}</button>
      </div>
      <div class="setting row">
        <label>${T.screenShake}</label>
        <button class="toggle ${s.shake ? 'on' : ''}" data-set="shake">${s.shake ? T.on : T.off}</button>
      </div>
      <div class="setting">
        <label>${T.opponentBots} <output>${s.botCount}</output></label>
        <input type="range" min="1" max="3" value="${s.botCount}" data-set="botCount">
      </div>
      <div class="setting">
        <label>${T.matchLength} <output>${s.duration}${T.secShort}</output></label>
        <input type="range" min="60" max="300" step="30" value="${s.duration}" data-set="duration">
      </div>
      <div class="btn-col">
        <button class="btn btn-primary" data-act="back" data-from="${from}">${T.back}</button>
      </div>
    </div>`;
  }

  _pauseHTML() {
    const T = strings(this.settings.lang);
    return `<div class="panel">
      <h2>${T.paused}</h2>
      <div class="btn-col">
        <button class="btn btn-primary" data-act="resume">${T.resume}</button>
        <button class="btn" data-act="settings" data-from="pause">${T.settings}</button>
        <button class="btn" data-act="restart">${T.restart}</button>
        <button class="btn btn-ghost" data-act="quit">${T.quitToMenu}</button>
      </div>
    </div>`;
  }

  _overHTML(data) {
    const T = strings(this.settings.lang);
    const rows = data.scores.map((s, i) => `
      <div class="result-row ${s.isHuman ? 'you' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="chip" style="--c:${s.color}"></span>
        <span class="rname">${s.name}${s.isHuman ? ' ' + T.youParen : ''}</span>
        <span class="rterr">${s.tiles} ${T.tilesUnit}</span>
        <span class="rcry">${s.crystals}◆</span>
        <span class="rtotal">${s.total}</span>
      </div>`).join('');
    const winner = data.scores[0];
    return `<div class="panel panel-wide">
      <h2 class="winner" style="--c:${winner.color}">${T.dominates.replace('{name}', winner.name)}</h2>
      <div class="results">${rows}</div>
      <div class="btn-col">
        <button class="btn btn-primary" data-act="restart">${T.playAgain}</button>
        <button class="btn btn-ghost" data-act="quit">${T.mainMenu}</button>
      </div>
    </div>`;
  }

  /* ------------------------------ bindings ------------------------------- */
  _bind(screen) {
    const q = (sel) => this.root.querySelectorAll(sel);

    q('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        this.cb.onUI?.();
        switch (act) {
          case 'start': this.cb.onStart(); break;
          case 'resume': this.cb.onResume(); break;
          case 'restart': this.cb.onRestart(); break;
          case 'quit': this.cb.onQuit(); break;
          case 'settings': this.show('settings', { from: btn.dataset.from || 'main' }); break;
          case 'howto': this.show('howto'); break;
          case 'back':
            this.show(btn.dataset.from === 'pause' ? 'pause' : 'main');
            break;
        }
      });
    });

    if (screen === 'settings') this._bindSettings();
  }

  _bindSettings() {
    const s = this.settings;
    const T = strings(s.lang);

    // Language toggle: flip ko<->en and re-render so labels update live.
    this.root.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        s.lang = s.lang === 'ko' ? 'en' : 'ko';
        this.cb.onSettingsChange(s);
        this.cb.onUI?.();
        this.show('settings', { from: btn.dataset.from || 'main' });
      });
    });

    this.root.querySelectorAll('input[type="range"]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.set;
        let val = Number(inp.value);
        if (key === 'volume') { val /= 100; }
        s[key] = val;
        const out = inp.previousElementSibling.querySelector('output');
        if (out) out.textContent = key === 'volume' ? `${Math.round(val * 100)}%`
          : key === 'duration' ? `${val}${T.secShort}` : val;
        this.cb.onSettingsChange(s);
      });
    });
    this.root.querySelectorAll('.toggle[data-set]').forEach((tg) => {
      tg.addEventListener('click', () => {
        const key = tg.dataset.set;
        s[key] = !s[key];
        tg.classList.toggle('on', s[key]);
        tg.textContent = s[key] ? T.on : T.off;
        this.cb.onSettingsChange(s);
        this.cb.onUI?.();
      });
    });
  }
}
