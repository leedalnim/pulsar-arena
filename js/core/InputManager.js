/**
 * InputManager.js
 * ---------------------------------------------------------------------------
 * Unifies keyboard and touch input into a single normalised "intent" object
 * that gameplay reads each frame:
 *
 *   { move: {x, y},  deploy, dash, shield, cycle, pause }
 *
 * `move` is a normalised vector. Action flags are edge-triggered (true only on
 * the frame they are first pressed) so a held key does not spam abilities.
 *
 * On touch devices it renders a virtual joystick (left) and an action cluster
 * (right) as pure DOM overlays. No external libraries.
 * ---------------------------------------------------------------------------
 */
export class InputManager {
  constructor(rootEl) {
    this.root = rootEl;
    this.keys = new Set();

    // Continuous move vector.
    this.move = { x: 0, y: 0 };

    // Edge-triggered action buffer. Consumed once per frame by poll().
    this._pending = { deploy: false, dash: false, shield: false, cycle: false, pause: false };

    // Joystick state.
    this._stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };

    this._bindKeyboard();
    this.touchEnabled = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.touchEnabled) this._buildTouchUI();
  }

  /* ------------------------------- keyboard ------------------------------ */
  _bindKeyboard() {
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (this._isGameKey(k)) e.preventDefault();
      if (this.keys.has(k)) return; // ignore auto-repeat for edge actions
      this.keys.add(k);
      if (k === ' ' || k === 'spacebar') this._pending.deploy = true;
      if (k === 'shift') this._pending.dash = true;
      if (k === 'e') this._pending.shield = true;
      if (k === 'q') this._pending.cycle = true;
      if (k === 'escape' || k === 'p') this._pending.pause = true;
    };
    const up = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
  }

  _isGameKey(k) {
    return [' ', 'spacebar', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'w', 'a', 's', 'd', 'e', 'q', 'shift'].includes(k);
  }

  _keyboardMove() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    return { x, y };
  }

  /* -------------------------------- touch -------------------------------- */
  _buildTouchUI() {
    const layer = document.createElement('div');
    layer.className = 'touch-layer';
    layer.innerHTML = `
      <div class="joystick" id="joyBase"><div class="joystick-knob" id="joyKnob"></div></div>
      <div class="touch-actions">
        <button class="tbtn tbtn-cycle" data-act="cycle" aria-label="Cycle core">⟳</button>
        <button class="tbtn tbtn-shield" data-act="shield" aria-label="Shield">◈</button>
        <button class="tbtn tbtn-dash" data-act="dash" aria-label="Dash">»</button>
        <button class="tbtn tbtn-deploy" data-act="deploy" aria-label="Deploy core">◉</button>
      </div>`;
    this.root.appendChild(layer);
    this.touchLayer = layer;

    // Action buttons -> edge triggers.
    layer.querySelectorAll('.tbtn').forEach((btn) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._pending[btn.dataset.act] = true;
        btn.classList.add('pressed');
      }, { passive: false });
      btn.addEventListener('touchend', () => btn.classList.remove('pressed'));
    });

    // Virtual joystick.
    const base = layer.querySelector('#joyBase');
    const knob = layer.querySelector('#joyKnob');
    const radius = 56;

    const start = (e) => {
      const t = e.changedTouches[0];
      const r = base.getBoundingClientRect();
      this._stick.active = true;
      this._stick.id = t.identifier;
      this._stick.cx = r.left + r.width / 2;
      this._stick.cy = r.top + r.height / 2;
      move(e);
    };
    const move = (e) => {
      if (!this._stick.active) return;
      const t = [...e.changedTouches].find((x) => x.identifier === this._stick.id);
      if (!t) return;
      let dx = t.clientX - this._stick.cx;
      let dy = t.clientY - this._stick.cy;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, radius);
      dx = (dx / len) * clamped;
      dy = (dy / len) * clamped;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this._stick.dx = dx / radius;
      this._stick.dy = dy / radius;
    };
    const end = (e) => {
      const has = [...e.changedTouches].some((x) => x.identifier === this._stick.id);
      if (!has) return;
      this._stick.active = false;
      this._stick.dx = this._stick.dy = 0;
      knob.style.transform = 'translate(0,0)';
    };
    base.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); }, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  setTouchVisible(v) {
    if (this.touchLayer) this.touchLayer.style.display = v ? 'block' : 'none';
  }

  /** Drop any buffered edge actions (used when (re)entering play). */
  flush() {
    this._pending = { deploy: false, dash: false, shield: false, cycle: false, pause: false };
  }

  /* -------------------------------- poll --------------------------------- */
  /**
   * Returns the current frame intent and clears edge-triggered actions.
   * Call exactly once per update.
   */
  poll() {
    // Combine keyboard + joystick move, then normalise.
    const kb = this._keyboardMove();
    let mx = kb.x + this._stick.dx;
    let my = kb.y + this._stick.dy;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx;
    this.move.y = my;

    const actions = { ...this._pending, move: this.move };
    // Reset edge triggers for next frame.
    this._pending = { deploy: false, dash: false, shield: false, cycle: false, pause: false };
    return actions;
  }
}
