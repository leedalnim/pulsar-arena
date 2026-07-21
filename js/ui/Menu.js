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
import { CLASSES, CLASS_ORDER } from '../core/constants.js';
import { portraitSVG } from './DroneArt.js';

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
    if (screen === 'stage') return this._stageHTML(data);
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
    const nm = (this.settings.playerName || '').replace(/[<>&"']/g, '');
    return `<div class="panel panel-main">
      ${this._logo(T)}
      <div class="name-row">
        <input class="name-input" type="text" maxlength="12" spellcheck="false"
          placeholder="${T.namePlaceholder || '이름 입력'}" value="${nm}">
      </div>
      ${this._classPicker(T)}
      <div class="btn-col">
        <button class="btn btn-primary" data-act="start">${T.enterArena}</button>
        <button class="btn" data-act="stages">${T.stageMode || '스테이지 모드'}${this.settings.bestStage ? ` · ${(T.bestStage || 'BEST {n}').replace('{n}', this.settings.bestStage)}` : ''}</button>
        <button class="btn" data-act="online">${T.online || '온라인 1v1 (P2P)'}</button>
        <button class="btn" data-act="howto">${T.howToPlay}</button>
        <button class="btn" data-act="settings">${T.settings}</button>
      </div>
      <p class="footnote">${T.mainFootnote}</p>
    </div>`;
  }

  /** Drone class picker: vector portraits selectable before entering the arena. */
  _classPicker(T) {
    const lang = this.settings.lang;
    const sel = CLASSES[this.settings.charClass] ? this.settings.charClass : 'specter';
    const cards = CLASS_ORDER.map((id) => {
      const cls = CLASSES[id];
      const role = (cls.role && cls.role[lang]) || cls.role.en || '';
      return `<button class="cls-card ${id === sel ? 'sel' : ''}" data-cls="${id}" style="--c:${cls.accent}">
        <span class="cls-art">${portraitSVG(cls, 66)}</span>
        <span class="cls-name">${cls.name}</span>
        <span class="cls-role">${role}</span>
      </button>`;
    }).join('');
    return `<div class="cls-pick">
      <div class="cls-label">${T.chooseDrone || 'CHOOSE YOUR DRONE'}</div>
      <div class="cls-row">${cards}</div>
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
      <p class="howto-note">${T.p2Hint}</p>
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
      <div class="setting row">
        <label>${T.local2p}</label>
        <button class="toggle ${s.coop ? 'on' : ''}" data-set="coop">${s.coop ? T.on : T.off}</button>
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

  _stageHTML(data) {
    const T = strings(this.settings.lang);
    const next = (data.stage || 1) + 1;
    const rows = (data.scores || []).map((s, i) => `
      <div class="result-row ${s.isHuman ? 'you' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="chip" style="--c:${s.color}"></span>
        <span class="rname">${s.name}${s.isHuman ? ' ' + T.youParen : ''}</span>
        <span class="rtotal">${s.total}</span>
      </div>`).join('');
    return `<div class="panel panel-wide">
      <h2 class="winner" style="--c:#7dffa8">${(T.stageClear || 'STAGE {n} CLEAR!').replace('{n}', data.stage)}</h2>
      ${data.best ? `<p class="stage-reached">${(T.bestStage || 'BEST {n}').replace('{n}', data.best)}</p>` : ''}
      <p class="howto-note">${T.nextStageHint || '다음 스테이지는 더 강해집니다.'}</p>
      <div class="results">${rows}</div>
      <div class="btn-col">
        <button class="btn btn-primary" data-act="nextstage">${(T.nextStage || 'STAGE {n} →').replace('{n}', next)}</button>
        <button class="btn btn-ghost" data-act="quit">${T.mainMenu}</button>
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
    const stageLine = data.stage
      ? `<p class="stage-reached">${(T.stageReached || 'STAGE {n} 도달').replace('{n}', data.stage)}${data.best ? ` · ${(T.bestStage || 'BEST {n}').replace('{n}', data.best)}` : ''}</p>` : '';
    return `<div class="panel panel-wide">
      <h2 class="winner" style="--c:${winner.color}">${T.dominates.replace('{name}', winner.name)}</h2>
      ${stageLine}
      <div class="results">${rows}</div>
      <div class="btn-col">
        ${data.net ? '' : `<button class="btn btn-primary" data-act="restart">${T.playAgain}</button>`}
        <button class="btn ${data.net ? 'btn-primary' : 'btn-ghost'}" data-act="quit">${T.mainMenu}</button>
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
          case 'online': this.showOnline(); break;
          case 'stages': this.cb.onStages?.(); break;
          case 'nextstage': this.cb.onNextStage?.(); break;
          case 'howto': this.show('howto'); break;
          case 'back':
            this.show(btn.dataset.from === 'pause' ? 'pause' : 'main');
            break;
        }
      });
    });

    // Player name input (main screen) — persisted live; no re-render on typing.
    const nameInput = this.root.querySelector('.name-input');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.settings.playerName = nameInput.value.replace(/[<>&"']/g, '').slice(0, 12);
        this.cb.onSettingsChange(this.settings);
      });
    }

    // Drone class selection (main screen).
    q('[data-cls]').forEach((card) => {
      card.addEventListener('click', () => {
        this.settings.charClass = card.dataset.cls;
        this.cb.onSettingsChange(this.settings);
        this.cb.onUI?.();
        this.show('main');
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

  /* ------------------------- online (P2P) 1v1 ---------------------------- */
  _netStrings() {
    return this.settings.lang === 'en' ? {
      title: 'ONLINE 1v1 (P2P)',
      hint: 'No server needed — connect by exchanging codes (copy/paste). Works over the internet peer-to-peer.',
      host: 'Create Room (Host)', join: 'Join a Room', back: 'Back',
      step1: '1. Send this code to your opponent',
      step2: "2. Paste your opponent's answer code here",
      copy: 'Copy code', copied: 'Copied!', connect: 'Connect',
      connecting: 'Connecting…', fail: 'Failed: ',
      jStep1: "1. Paste the host's code", jGen: 'Generate answer',
      jStep2: '2. Send this answer code back to the host',
      wait: 'Waiting…', connected: 'Connected!', startMatch: 'Start Match',
      waitHost: 'Connected! The match starts when the host begins.',
      gen: 'Generating…',
    } : {
      title: '온라인 1v1 (P2P)',
      hint: '서버 없이 코드만 주고받으면(복사·붙여넣기) 연결됩니다. 인터넷 P2P로 동작해요.',
      host: '방 만들기 (호스트)', join: '방 참가하기', back: '뒤로',
      step1: '1. 이 코드를 상대에게 보내세요',
      step2: '2. 상대의 응답 코드를 아래에 붙여넣으세요',
      copy: '코드 복사', copied: '복사됨!', connect: '연결',
      connecting: '연결 중…', fail: '실패: ',
      jStep1: '1. 호스트가 준 코드를 붙여넣으세요', jGen: '응답 코드 생성',
      jStep2: '2. 이 응답 코드를 호스트에게 다시 보내세요',
      wait: '대기 중…', connected: '연결됨!', startMatch: '게임 시작',
      waitHost: '연결됨! 호스트가 시작하면 자동으로 시작됩니다.',
      gen: '생성 중…',
    };
  }

  showOnline() {
    this.screen = 'online';
    this.root.style.display = 'flex';
    this._online('home');
  }

  /** Called by main.js when the data channel opens. */
  netOpen(isHost) {
    if (this.screen !== 'online') return;
    this._online(isHost ? 'hostready' : 'joinready');
  }

  _online(state, data = {}) {
    const L = this._netStrings();
    const ta = (cls, val, ph, ro) =>
      `<textarea class="${cls}" ${ro ? 'readonly' : ''} placeholder="${ph || ''}">${val || ''}</textarea>`;
    let body;
    if (state === 'home') {
      body = `<p class="howto-note">${L.hint}</p>
        <div class="btn-col">
          <button class="btn btn-primary" data-on="host">${L.host}</button>
          <button class="btn" data-on="join">${L.join}</button>
          <button class="btn btn-ghost" data-on="back">${L.back}</button>
        </div>`;
    } else if (state === 'host') {
      this._lastOffer = data.offer || this._lastOffer || '';
      body = `<label class="net-lbl">${L.step1}</label>
        ${ta('net-code', this._lastOffer, '', true)}
        <button class="btn" data-on="copy">${L.copy}</button>
        <label class="net-lbl">${L.step2}</label>
        ${ta('net-in', '', 'answer code', false)}
        <div class="btn-col">
          <button class="btn btn-primary" data-on="hostconnect">${L.connect}</button>
          <button class="btn btn-ghost" data-on="back">${L.back}</button>
        </div>
        <p class="howto-note net-status">${data.status || ''}</p>`;
    } else if (state === 'hostready') {
      body = `<p class="net-ok">${L.connected}</p>
        <div class="btn-col"><button class="btn btn-primary" data-on="hoststart">${L.startMatch}</button></div>`;
    } else if (state === 'join') {
      body = `<label class="net-lbl">${L.jStep1}</label>
        ${ta('net-in', '', 'host code', false)}
        <div class="btn-col">
          <button class="btn btn-primary" data-on="joingen">${L.jGen}</button>
          <button class="btn btn-ghost" data-on="back">${L.back}</button>
        </div>
        <p class="howto-note net-status">${data.status || ''}</p>`;
    } else if (state === 'joinanswer') {
      body = `<label class="net-lbl">${L.jStep2}</label>
        ${ta('net-code', data.answer, '', true)}
        <button class="btn" data-on="copy">${L.copy}</button>
        <p class="howto-note net-status">${L.wait}</p>`;
    } else if (state === 'joinready') {
      body = `<p class="net-ok">${L.connected}</p><p class="howto-note">${L.waitHost}</p>`;
    }
    this.root.innerHTML = `<div class="panel panel-wide"><h2>${L.title}</h2>${body}</div>`;
    this._bindOnline(L);
  }

  _bindOnline(L) {
    this.root.querySelectorAll('[data-on]').forEach((b) => {
      b.addEventListener('click', async () => {
        const act = b.dataset.on;
        this.cb.onUI?.();
        if (act === 'back') { this.show('main'); return; }
        if (act === 'copy') {
          const el = this.root.querySelector('.net-code');
          if (el) { el.select(); try { document.execCommand('copy'); } catch { /* */ }
            try { navigator.clipboard?.writeText(el.value); } catch { /* */ }
            b.textContent = L.copied; }
          return;
        }
        if (act === 'host') {
          this._online('host', { offer: L.gen });
          try { const offer = await this.cb.net.hostCreateOffer(); this._online('host', { offer }); }
          catch (e) { this._online('host', { status: L.fail + e.message }); }
          return;
        }
        if (act === 'hostconnect') {
          const ans = (this.root.querySelector('.net-in')?.value || '').trim();
          if (!ans) return;
          this._online('host', { status: L.connecting });
          try { await this.cb.net.hostAcceptAnswer(ans); }
          catch (e) { this._online('host', { status: L.fail + e.message }); }
          return;
        }
        if (act === 'join') { this._online('join'); return; }
        if (act === 'joingen') {
          const off = (this.root.querySelector('.net-in')?.value || '').trim();
          if (!off) return;
          this._online('join', { status: L.gen });
          try { const answer = await this.cb.net.joinAcceptOffer(off); this._online('joinanswer', { answer }); }
          catch (e) { this._online('join', { status: L.fail + e.message }); }
          return;
        }
        if (act === 'hoststart') { this.cb.onNetHostStart?.(); return; }
      });
    });
  }
}
