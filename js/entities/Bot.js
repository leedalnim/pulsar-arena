/**
 * Bot.js
 * ---------------------------------------------------------------------------
 * A lightweight AI opponent. It extends Player and only overrides think() to
 * synthesise intent. The behaviour is a small state machine:
 *
 *   SEEK    - roam toward the nearest crystal/shard to gather energy + score.
 *   HUNT    - when an enemy is close and we have energy, close in and deploy.
 *   FLEE    - when a pulse wave or armed core is dangerously near, run away
 *             (dashing / shielding when available).
 *
 * Danger avoidance is prioritised so bots convincingly dodge their own cores.
 * ---------------------------------------------------------------------------
 */
import { Player } from './Player.js';
import { CORE_TYPES } from '../core/constants.js';
import { dist, rand, angleBetween, chance } from '../core/utils.js';

export class Bot extends Player {
  constructor(x, y, faction, index, classId) {
    super(x, y, faction, index, false, classId);
    this.state = 'SEEK';
    this._decisionTimer = 0;
    this._wanderAngle = rand(0, Math.PI * 2);
    this._deployCooldown = rand(1, 3);
  }

  think(dt, game) {
    // Reset intent each frame; we'll set flags below.
    const it = this.intent;
    it.deploy = it.dash = it.shield = it.cycle = false;
    this._decisionTimer -= dt;
    this._deployCooldown -= dt;

    // 1. Assess danger from pulse waves and armed cores.
    const danger = this._nearestDanger(game);
    if (danger && danger.d < danger.range) {
      this.state = 'FLEE';
      const away = angleBetween(danger.x, danger.y, this.x, this.y);
      it.move = { x: Math.cos(away), y: Math.sin(away) };
      // Emergency abilities.
      if (this.shieldCd <= 0 && danger.d < danger.range * 0.5) it.shield = true;
      else if (this.dashCd <= 0) it.dash = true;
      return;
    }

    // 2. Look for a target enemy to attack.
    const enemy = this._nearestEnemy(game);
    if (enemy && enemy.d < 190 && this.energy > 40 && this._deployCooldown <= 0) {
      this.state = 'HUNT';
      const toward = angleBetween(this.x, this.y, enemy.x, enemy.y);
      it.move = { x: Math.cos(toward), y: Math.sin(toward) };
      if (enemy.d < 130) {
        it.deploy = true;
        this._deployCooldown = rand(1.6, 2.8);
      }
      return;
    }

    // 3. Otherwise seek the nearest crystal shard or crystal tile to farm.
    this.state = 'SEEK';
    const target = this._nearestFarmTarget(game);
    if (target) {
      const toward = angleBetween(this.x, this.y, target.x, target.y);
      // Add slight wander so movement looks organic.
      const a = toward + rand(-0.25, 0.25);
      it.move = { x: Math.cos(a), y: Math.sin(a) };
      // Occasionally deploy to break crystal clusters for shards.
      if (target.isCrystalTile && target.d < 90 && this.energy > 30 && this._deployCooldown <= 0) {
        it.deploy = true;
        this._deployCooldown = rand(2, 3.5);
      }
    } else {
      // Pure wander.
      if (this._decisionTimer <= 0) {
        this._wanderAngle += rand(-1, 1);
        this._decisionTimer = rand(0.6, 1.4);
      }
      it.move = { x: Math.cos(this._wanderAngle), y: Math.sin(this._wanderAngle) };
    }
  }

  _nearestDanger(game) {
    let best = null;
    // Active pulse fronts.
    for (const w of game.waves) {
      const d = dist(this.x, this.y, w.x, w.y);
      // Danger if we're near the expanding front (within a reaction band).
      if (d < w.maxRadius + 40 && d > w.radius - 30) {
        const urgency = w.maxRadius - Math.abs(d - w.radius);
        if (!best || urgency > best.urgency) {
          best = { x: w.x, y: w.y, d, range: w.maxRadius, urgency };
        }
      }
    }
    // Armed cores about to blow.
    for (const core of game.cores) {
      if (core.detonated) continue;
      const d = dist(this.x, this.y, core.x, core.y);
      const range = core.type.radius;
      if (d < range && core.timer < 1.2) {
        const urgency = (1.2 - core.timer) * 200 + (range - d);
        if (!best || urgency > best.urgency) best = { x: core.x, y: core.y, d, range, urgency };
      }
    }
    return best;
  }

  _nearestEnemy(game) {
    let best = null, bd = Infinity;
    for (const p of game.players) {
      if (p === this || p.downed || p.cloaked) continue;   // cloak hides a target
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { x: best.x, y: best.y, d: bd } : null;
  }

  _nearestFarmTarget(game) {
    let best = null, bd = 520;
    // Item pickups are worth grabbing — treat them like priority shards.
    for (const it of game.items || []) {
      const d = dist(this.x, this.y, it.x, it.y);
      if (d < bd) { bd = d; best = { x: it.x, y: it.y, d, isCrystalTile: false }; }
    }
    // Prefer floating shards (fast energy).
    for (const s of game.shards) {
      const d = dist(this.x, this.y, s.x, s.y);
      if (d < bd) { bd = d; best = { x: s.x, y: s.y, d, isCrystalTile: false }; }
    }
    if (best) return best;
    // Otherwise head to the closest crystal tile to farm shards.
    const grid = game.grid;
    const { c, r } = grid.toTile(this.x, this.y);
    const R = 6;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        if (grid.get(c + dc, r + dr) === 2 /* CRYSTAL */) {
          const w = grid.toWorld(c + dc, r + dr);
          const d = dist(this.x, this.y, w.x, w.y);
          if (d < bd) { bd = d; best = { x: w.x, y: w.y, d, isCrystalTile: true }; }
        }
      }
    }
    return best;
  }
}
