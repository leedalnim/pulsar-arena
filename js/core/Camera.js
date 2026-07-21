/**
 * Camera.js
 * ---------------------------------------------------------------------------
 * A 2D follow camera with smoothed tracking and decaying screen shake.
 * World -> screen transform is applied via ctx.translate before the world is
 * drawn. Shake is a random offset that decays exponentially.
 * ---------------------------------------------------------------------------
 */
import { lerp, rand, clamp } from './utils.js';
import { CAMERA } from './constants.js';

export class Camera {
  constructor(viewW, viewH) {
    this.x = 0; this.y = 0;          // top-left of the view in world space
    this.viewW = viewW;
    this.viewH = viewH;
    this.shake = 0;
    this._ox = 0; this._oy = 0;      // current shake offset
    this.shakeEnabled = true;
  }

  resize(w, h) { this.viewW = w; this.viewH = h; }

  /** Instantly centre on a point (used on spawn / teleport). */
  snapTo(cx, cy) {
    this.x = cx - this.viewW / 2;
    this.y = cy - this.viewH / 2;
  }

  /** Smoothly follow a target centre point, clamped to world bounds. */
  follow(cx, cy, worldW, worldH, dt) {
    const tx = cx - this.viewW / 2;
    const ty = cy - this.viewH / 2;
    this.x = lerp(this.x, tx, 1 - Math.pow(1 - CAMERA.LERP, dt * 60));
    this.y = lerp(this.y, ty, 1 - Math.pow(1 - CAMERA.LERP, dt * 60));
    // Clamp so we never show outside the arena (unless arena < view).
    if (worldW > this.viewW) this.x = clamp(this.x, 0, worldW - this.viewW);
    else this.x = (worldW - this.viewW) / 2;
    if (worldH > this.viewH) this.y = clamp(this.y, 0, worldH - this.viewH);
    else this.y = (worldH - this.viewH) / 2;
  }

  addShake(amount) {
    if (!this.shakeEnabled) return;
    this.shake = Math.min(CAMERA.SHAKE_MAX, this.shake + amount);
  }

  update(dt) {
    if (this.shake > 0.1) {
      this._ox = rand(-this.shake, this.shake);
      this._oy = rand(-this.shake, this.shake);
      this.shake -= this.shake * CAMERA.SHAKE_DECAY * dt;
    } else {
      this.shake = this._ox = this._oy = 0;
    }
  }

  /** Apply the camera transform. Call ctx.save() before and restore() after. */
  apply(ctx) {
    ctx.translate(-Math.round(this.x + this._ox), -Math.round(this.y + this._oy));
  }
}
