/**
 * SoundManager.js
 * ---------------------------------------------------------------------------
 * All sound effects are synthesised at runtime with the Web Audio API — there
 * are NO external audio assets, keeping the game fully procedural and original.
 *
 * Each effect is a short envelope over one or more oscillators / noise bursts.
 * A master gain node handles global volume and muting. The AudioContext is
 * created lazily and resumed on first user gesture (browser autoplay policy).
 * ---------------------------------------------------------------------------
 */
import { clamp } from './utils.js';

export class SoundManager {
  constructor(settings) {
    this.enabled = settings.sfx;
    this.volume = settings.volume;
    this.ctx = null;
    this.master = null;
  }

  /** Lazily create the audio graph. Safe to call repeatedly. */
  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this.volume;
  }

  setEnabled(v) { this.enabled = v; }

  /* --------------------------- low level voices -------------------------- */

  _tone({ type = 'sine', freq = 440, to = null, dur = 0.2, gain = 0.3, delay = 0 }) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.3, gain = 0.3, delay = 0, cutoff = 1200, sweep = null }) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t0);
    if (sweep !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ------------------------------ named SFX ------------------------------ */

  deploy()   { this._tone({ type: 'square', freq: 300, to: 520, dur: 0.12, gain: 0.18 }); }
  arm()      { this._tone({ type: 'sine', freq: 880, dur: 0.05, gain: 0.08 }); }
  detonate() {
    this._noise({ dur: 0.5, gain: 0.35, cutoff: 2400, sweep: 120 });
    this._tone({ type: 'sine', freq: 180, to: 40, dur: 0.5, gain: 0.3 });
  }
  chain()    { this._tone({ type: 'triangle', freq: 620, to: 240, dur: 0.28, gain: 0.22 }); }
  pickup()   { this._tone({ type: 'sine', freq: 660, to: 990, dur: 0.14, gain: 0.2 }); }
  crystal()  { this._noise({ dur: 0.18, gain: 0.22, cutoff: 5200, sweep: 1400 }); }
  dash()     { this._noise({ dur: 0.22, gain: 0.24, cutoff: 3000, sweep: 500 }); }
  shield()   { this._tone({ type: 'sine', freq: 400, to: 820, dur: 0.3, gain: 0.2 }); }
  teleport() {
    this._tone({ type: 'sine', freq: 520, to: 1200, dur: 0.16, gain: 0.18 });
    this._tone({ type: 'sine', freq: 1200, to: 400, dur: 0.16, gain: 0.14, delay: 0.08 });
  }
  hit()      { this._noise({ dur: 0.3, gain: 0.3, cutoff: 900, sweep: 200 }); }
  ui()       { this._tone({ type: 'square', freq: 520, dur: 0.05, gain: 0.1 }); }
  win()      {
    [523, 659, 784, 1046].forEach((f, i) =>
      this._tone({ type: 'triangle', freq: f, dur: 0.5, gain: 0.16, delay: i * 0.12 }));
  }
}
