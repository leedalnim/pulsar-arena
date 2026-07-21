/**
 * Entity.js
 * ---------------------------------------------------------------------------
 * Minimal base class for anything that lives in the world. Provides position,
 * a "dead" flag for pooled removal, and the update/render contract subclasses
 * override. Keeping this deliberately tiny keeps the hierarchy flexible.
 * ---------------------------------------------------------------------------
 */
export class Entity {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.dead = false;
  }

  /** @param {number} dt seconds  @param {Game} game */
  update(dt, game) {}

  /** @param {CanvasRenderingContext2D} ctx */
  render(ctx) {}
}
