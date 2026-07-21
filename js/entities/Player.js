/**
 * Player.js
 * ---------------------------------------------------------------------------
 * A controllable arena combatant. Handles free (non-grid-locked) movement with
 * circle-vs-grid collision, the three abilities (Dash, Shield, deploy Energy
 * Core), teleport-pad travel, an energy economy, and the downed/respawn cycle.
 *
 * The `Bot` subclass reuses everything here and simply overrides how intent is
 * produced. Human players receive intent from InputManager via applyIntent().
 * ---------------------------------------------------------------------------
 */
import { Entity } from './Entity.js';
import { PLAYER, TILE, CORE_ORDER, CORE_TYPES, CLASSES, ITEMS } from '../core/constants.js';
import { TAU, clamp, rgba, angleBetween, shadowEllipse } from '../core/utils.js';
import { drawDrone } from '../ui/DroneArt.js';

export class Player extends Entity {
  /**
   * @param {number} x spawn x
   * @param {number} y spawn y
   * @param {object} faction faction descriptor {id, name, color, glow}
   * @param {number} index faction index
   * @param {boolean} isHuman
   */
  constructor(x, y, faction, index, isHuman, classId = 'specter') {
    super(x, y);
    this.faction = faction;
    this.factionIndex = index;
    this.color = faction.color;
    this.isHuman = isHuman;

    // Class profile: scales the base PLAYER stats + selects the vector look.
    this.classId = CLASSES[classId] ? classId : 'specter';
    this.cls = CLASSES[this.classId];
    this.radius = PLAYER.RADIUS * (this.cls.radiusMul || 1);
    this.maxEnergy = PLAYER.MAX_ENERGY * (this.cls.maxEnergyMul || 1);
    this.speedMul = this.cls.speedMul || 1;
    this.regenMul = this.cls.regenMul || 1;
    this.dashCooldown = PLAYER.DASH_COOLDOWN * (this.cls.dashCdMul || 1);
    this.shieldTime = PLAYER.SHIELD_TIME * (this.cls.shieldTimeMul || 1);
    this.shieldCooldown = PLAYER.SHIELD_COOLDOWN;

    this.spawnX = x;
    this.spawnY = y;

    this.energy = this.maxEnergy;
    this.facing = 0;              // radians, for the directional pointer

    // Timed item buffs (0 = inactive). See constants.ITEMS.
    this.overchargeTimer = 0;
    this.hasteTimer = 0;
    this.cloakTimer = 0;
    this.magnetTimer = 0;
    this.rapidTimer = 0;

    // Pulse knockback velocity (px/s), decays over a fraction of a second.
    this.knockVx = 0;
    this.knockVy = 0;

    // Abilities / timers.
    this.coreType = 'standard';
    this.dashTimer = 0;          // >0 while dashing
    this.dashCd = 0;
    this.shieldTimer = 0;        // >0 while shielded
    this.shieldCd = 0;
    this.invuln = 0;             // post-respawn grace

    // Freeze-core slow effect.
    this.slowTimer = 0;
    this.slowFactor = 1;

    // Downed state.
    this.downed = false;
    this.downTimer = 0;

    // Teleport debounce so we don't ping-pong between linked pads.
    this._teleCooldown = 0;

    // Per-frame intent (filled by applyIntent / bot logic).
    this.intent = { move: { x: 0, y: 0 }, deploy: false, dash: false, shield: false, cycle: false };

    // Score is tracked here for convenience (crystals collected).
    this.crystals = 0;
  }

  /** Feed normalised intent from the input layer (human players). */
  applyIntent(actions) {
    this.intent.move = actions.move;
    this.intent.deploy = actions.deploy;
    this.intent.dash = actions.dash;
    this.intent.shield = actions.shield;
    this.intent.cycle = actions.cycle;
  }

  get shielded() { return this.shieldTimer > 0; }
  get invulnerable() { return this.shieldTimer > 0 || this.invuln > 0 || this.dashTimer > 0; }
  get slowed() { return this.slowTimer > 0; }
  get overcharged() { return this.overchargeTimer > 0; }
  get hasted() { return this.hasteTimer > 0; }
  get cloaked() { return this.cloakTimer > 0; }
  get magnetized() { return this.magnetTimer > 0; }
  get rapid() { return this.rapidTimer > 0; }

  /** Apply a picked-up item — a timed buff or an instant effect. */
  applyItem(item, game) {
    if (item.instant) {
      if (item.id === 'cell') this.energy = this.maxEnergy;              // full refill
      else if (item.id === 'barrier') this.shieldTimer = Math.max(this.shieldTimer, item.duration || 4);
      else if (item.id === 'blink') {                                   // teleport away
        const spot = game && game._randomFloor && game._randomFloor();
        if (spot) { this.x = spot.x; this.y = spot.y; this.knockVx = this.knockVy = 0; }
      }
      return;
    }
    if (item.id === 'overcharge') this.overchargeTimer = item.duration;
    else if (item.id === 'haste') this.hasteTimer = item.duration;
    else if (item.id === 'cloak') this.cloakTimer = item.duration;
    else if (item.id === 'magnet') this.magnetTimer = item.duration;
    else if (item.id === 'rapidcore') this.rapidTimer = item.duration;
  }

  /** Add a pulse knockback impulse (px/s) in the given direction. */
  applyKnockback(angle, power) {
    this.knockVx += Math.cos(angle) * power;
    this.knockVy += Math.sin(angle) * power;
  }

  /** Apply a movement slow from a freeze wave. Blocked while invulnerable. */
  applySlow(factor, time) {
    if (this.invulnerable) return false;
    // Keep the strongest slow, and refresh its duration.
    this.slowFactor = Math.min(this.slowFactor === 1 ? factor : this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, time);
    return true;
  }

  /* ------------------------------- update -------------------------------- */
  update(dt, game) {
    // Cooldown / timer bookkeeping.
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this._teleCooldown = Math.max(0, this._teleCooldown - dt);
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }
    if (this.overchargeTimer > 0) this.overchargeTimer -= dt;
    if (this.hasteTimer > 0) this.hasteTimer -= dt;
    if (this.cloakTimer > 0) this.cloakTimer -= dt;
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.rapidTimer > 0) this.rapidTimer -= dt;

    // Knockback slides the unit even while downed (blown-away read).
    this._applyKnockback(dt, game);

    // Downed players do nothing but count down to respawn.
    if (this.downed) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this._respawn(game);
      return;
    }

    // Passive energy regeneration (class-scaled).
    this.energy = clamp(this.energy + PLAYER.ENERGY_REGEN * this.regenMul * dt, 0, this.maxEnergy);

    // Let subclasses (Bot) compute their intent right before we act on it.
    this.think(dt, game);

    this._handleAbilities(game);
    this._move(dt, game);
    this._checkTeleport(game);
  }

  /** Overridden by Bot. Human intent is already set via applyIntent(). */
  think(dt, game) {}

  /** Integrate + decay the pulse knockback impulse, resolving wall collisions. */
  _applyKnockback(dt, game) {
    if (this.knockVx * this.knockVx + this.knockVy * this.knockVy < 4) {
      this.knockVx = this.knockVy = 0;
      return;
    }
    const nx = this.x + this.knockVx * dt;
    const ny = this.y + this.knockVy * dt;
    const res = game.grid.resolveCircle(nx, ny, this.radius);
    this.x = res.x;
    this.y = res.y;
    const decay = Math.exp(-dt * 11);   // ~impulse dies within ~0.25s
    this.knockVx *= decay;
    this.knockVy *= decay;
  }

  _handleAbilities(game) {
    const it = this.intent;

    if (it.cycle) {
      const i = CORE_ORDER.indexOf(this.coreType);
      this.coreType = CORE_ORDER[(i + 1) % CORE_ORDER.length];
      game.sound.ui();
    }

    if (it.dash && this.dashCd <= 0 && (it.move.x || it.move.y)) {
      this.dashTimer = PLAYER.DASH_TIME;
      this.dashCd = this.dashCooldown;
      game.sound.dash();
    }

    if (it.shield && this.shieldCd <= 0) {
      this.shieldTimer = this.shieldTime;
      this.shieldCd = this.shieldCooldown;
      game.sound.shield();
    }

    if (it.deploy) this.deployCore(game);
  }

  /** Attempt to place an Energy Core on the current tile. */
  deployCore(game) {
    let type = CORE_TYPES[this.coreType];
    // OVERCHARGE item: cheaper, larger pulses.
    const cost = this.overcharged
      ? Math.round(type.cost * ITEMS.overcharge.costMul) : type.cost;
    if (this.energy < cost) return false;
    const { c, r } = game.grid.toTile(this.x, this.y);
    if (game.grid.get(c, r) !== TILE.FLOOR) return false;
    if (game.coreAt(c, r)) return false;              // one core per tile
    if (this.overcharged) type = { ...type, radius: type.radius * ITEMS.overcharge.radiusMul };
    if (this.rapid) type = { ...type, fuse: type.fuse * ITEMS.rapidcore.fuseMul };
    const w = game.grid.toWorld(c, r);
    this.energy -= cost;
    game.deployCore(w.x, w.y, type, this.factionIndex, this.color);
    game.sound.deploy();
    return true;
  }

  _move(dt, game) {
    let { x: mx, y: my } = this.intent.move;
    const moving = mx !== 0 || my !== 0;
    if (moving) this.facing = Math.atan2(my, mx);

    // Dashing ignores the slow (it stays a reliable escape); walking is slowed.
    const haste = this.hasteTimer > 0 ? ITEMS.haste.speedMul : 1;
    const speed = this.dashTimer > 0
      ? PLAYER.DASH_SPEED
      : PLAYER.SPEED * this.speedMul * haste * (this.slowTimer > 0 ? this.slowFactor : 1);
    if (this.dashTimer > 0) {
      // While dashing, drive along facing even without fresh input.
      mx = Math.cos(this.facing);
      my = Math.sin(this.facing);
      this.dashTimer -= dt;
      game.particles.trail(this.x, this.y, this.color, this.facing + Math.PI, 2);
    }

    const nx = this.x + mx * speed * dt;
    const ny = this.y + my * speed * dt;
    const res = game.grid.resolveCircle(nx, ny, this.radius);
    this.x = res.x;
    this.y = res.y;

    if (moving && Math.random() < 0.25) {
      game.particles.trail(this.x, this.y, this.color, this.facing + Math.PI, 1);
    }
  }

  _checkTeleport(game) {
    if (this._teleCooldown > 0) return;
    const { c, r } = game.grid.toTile(this.x, this.y);
    if (game.grid.get(c, r) !== TILE.TELEPORT) return;
    const pad = game.grid.teleports.find((p) => p.c === c && p.r === r);
    if (!pad) return;
    const target = game.grid.linkedPad(pad);
    if (!target) return;
    const w = game.grid.toWorld(target.c, target.r);
    this.x = w.x; this.y = w.y;
    this._teleCooldown = 0.8;
    game.onTeleport(this);
  }

  /** Take a pulse hit: knocked down unless protected. Returns true if downed. */
  takeHit(game, wave, distance) {
    if (this.invulnerable) return false;
    this.downed = true;
    this.downTimer = PLAYER.STUN_TIME;
    // Drop some collected crystals as shards.
    const drop = Math.min(this.crystals, 2);
    this.crystals -= drop;
    for (let i = 0; i < drop; i++) game.spawnShard(this.x, this.y, true);
    game.particles.burst(this.x, this.y, this.color, 30, 300);
    game.sound.hit();
    return true;
  }

  _respawn(game) {
    this.downed = false;
    this.invuln = PLAYER.RESPAWN_INVULN;
    this.energy = Math.max(this.energy, this.maxEnergy * 0.5);
    this.knockVx = this.knockVy = 0;
    this.x = this.spawnX;
    this.y = this.spawnY;
    game.particles.burst(this.x, this.y, this.color, 24, 220);
  }

  /* ------------------------------- render -------------------------------- */
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.downed) {
      this._renderDowned(ctx);
      ctx.restore();
      return;
    }

    // Contact shadow grounds the unit on the floor.
    shadowEllipse(ctx, 0, this.radius * 0.62, this.radius * 1.15, this.radius * 0.5, 0.34);

    // Shield bubble.
    if (this.shielded) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, TAU);
      ctx.strokeStyle = rgba('#ffffff', 0.5 + 0.3 * Math.sin(performance.now() / 90));
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }

    // Frost ring while slowed by a freeze wave.
    if (this.slowed) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, TAU);
      ctx.strokeStyle = rgba('#9fe8ff', 0.5 + 0.25 * Math.sin(performance.now() / 110));
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Human players get a bright ground ring so they stand out from bots.
    if (this.isHuman) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Class-specific vector drone body (tinted by faction colour).
    ctx.globalAlpha = this.cloaked ? (this.isHuman ? 0.55 : 0.32) : 1;
    // Invuln flicker keeps the respawn grace legible.
    if (!(this.invuln > 0 && Math.floor(performance.now() / 120) % 2)) {
      drawDrone(ctx, this.cls, this.color, this.radius, this.facing, performance.now());
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  _renderDowned(ctx) {
    const t = 1 - this.downTimer / PLAYER.STUN_TIME;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, TAU);
    ctx.strokeStyle = rgba(this.color, 0.6);
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // Reassembly progress arc.
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + TAU * t);
    ctx.strokeStyle = rgba(this.color, 0.8);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
