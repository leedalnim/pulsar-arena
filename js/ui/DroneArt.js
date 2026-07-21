/**
 * DroneArt.js
 * ---------------------------------------------------------------------------
 * Procedural, asset-free drone art shared by the game world and the menus.
 *   - drawDrone(ctx, ...)  paints a class-specific TOP-DOWN drone on the canvas
 *                          (used in-match). Nose points at the unit's facing;
 *                          the body is tinted by faction colour.
 *   - portraitSVG(cls)     returns a self-contained 3/4 PORTRAIT as an SVG
 *                          string (used in the DOM character picker).
 *
 * Each class has a bespoke silhouette, face and detailing so the four read as
 * clearly different characters — SPECTER (round medic), NOVA (angular racer),
 * PHANTOM (slim stealth), GUARDIAN (heavy tank) — all drawn from primitives,
 * no image assets. Class visual fields live on CLASSES in constants.js.
 * ---------------------------------------------------------------------------
 */
import { TAU, rgba } from '../core/utils.js';

/* =======================================================================
 * IN-GAME TOP-DOWN (canvas)
 * ===================================================================== */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Trace a class hull with the nose pointing up (−Y). Radius R sets scale. */
function hullPath(ctx, shape, R) {
  ctx.beginPath();
  if (shape === 'chevron') {              // NOVA — sharp dart
    ctx.moveTo(0, -R * 1.55);
    ctx.lineTo(R * 0.5, -R * 0.2);
    ctx.lineTo(R * 1.15, R * 0.55);
    ctx.lineTo(R * 0.5, R * 0.95);
    ctx.lineTo(-R * 0.5, R * 0.95);
    ctx.lineTo(-R * 1.15, R * 0.55);
    ctx.lineTo(-R * 0.5, -R * 0.2);
    ctx.closePath();
  } else if (shape === 'teardrop') {      // PHANTOM — sleek drop
    ctx.moveTo(0, -R * 1.55);
    ctx.quadraticCurveTo(R * 0.98, -R * 0.15, R * 0.66, R * 0.9);
    ctx.quadraticCurveTo(0, R * 1.3, -R * 0.66, R * 0.9);
    ctx.quadraticCurveTo(-R * 0.98, -R * 0.15, 0, -R * 1.55);
    ctx.closePath();
  } else if (shape === 'armored') {       // GUARDIAN — wide bulwark
    roundRectPath(ctx, -R * 1.25, -R * 0.95, R * 2.5, R * 2.0, R * 0.5);
  } else {                                // SPECTER — round
    ctx.moveTo(0, -R * 1.25);
    ctx.quadraticCurveTo(R * 1.05, -R * 1.05, R * 1.05, 0);
    ctx.quadraticCurveTo(R * 1.05, R * 1.15, 0, R * 1.25);
    ctx.quadraticCurveTo(-R * 1.05, R * 1.15, -R * 1.05, 0);
    ctx.quadraticCurveTo(-R * 1.05, -R * 1.05, 0, -R * 1.25);
    ctx.closePath();
  }
}

/** Class-specific extras drawn UNDER the hull (wings, shoulders, trail...). */
function underDetail(ctx, shape, R, color, accent, t) {
  ctx.save();
  if (shape === 'chevron') {              // NOVA — swept wings + exhaust
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, R * 0.1); ctx.lineTo(-R * 1.7, R * 0.7); ctx.lineTo(-R * 0.5, R * 0.7);
    ctx.moveTo(R * 0.4, R * 0.1); ctx.lineTo(R * 1.7, R * 0.7); ctx.lineTo(R * 0.5, R * 0.7);
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, R * 0.9); ctx.quadraticCurveTo(0, R * 2.1, R * 0.4, R * 0.9);
    ctx.fillStyle = rgba(accent, 0.55);
    ctx.fill();
  } else if (shape === 'teardrop') {      // PHANTOM — smoke wisp trail
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const yy = R * (1.1 + i * 0.5), rr = R * (0.5 - i * 0.12);
      ctx.beginPath();
      ctx.arc((i % 2 ? 1 : -1) * R * 0.18, yy, rr, 0, TAU);
      ctx.fillStyle = rgba(accent, 0.18 - i * 0.05);
      ctx.fill();
    }
  } else if (shape === 'armored') {       // GUARDIAN — shoulder pods + shield ring
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.75, 0, TAU);
    ctx.strokeStyle = rgba(accent, 0.4);
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * R * 1.35, -R * 0.1, R * 0.5, 0, TAU);
      ctx.fillStyle = '#8ba1bf';
      ctx.fill();
      ctx.strokeStyle = rgba(accent, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {                                // SPECTER — halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.ellipse(0, -R * 1.5, R * 0.85, R * 0.3, 0, 0, TAU);
    ctx.strokeStyle = rgba(accent, 0.8);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDrone(ctx, cls, color, radius, facing, t = 0) {
  const R = radius;
  const accent = cls.accent || color;
  ctx.save();
  ctx.rotate(facing + Math.PI / 2);       // hull nose (−Y) aligns with facing

  underDetail(ctx, cls.shape, R, color, accent, t);

  // Side thruster pods (skip for guardian — it has shoulder pods already).
  if (cls.shape !== 'armored') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * R * 0.95, R * 0.55, R * 0.26, 0, TAU);
      ctx.fillStyle = '#9fb3d0';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx * R * 0.95, R * 0.55, R * 0.12, 0, TAU);
      ctx.fillStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  // Hull body: volumetric gradient tinted by faction colour.
  hullPath(ctx, cls.shape, R);
  const dark = cls.shape === 'chevron' ? '#141a2c' : '#182740';
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.2, 0, 0, R * 1.8);
  g.addColorStop(0, '#f4f8ff');
  g.addColorStop(0.5, color);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.9);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Specular highlight (top-left).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(-R * 0.32, -R * 0.5, R * 0.4, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.restore();

  // Emissive core — dimmer for stealthy PHANTOM.
  const coreA = cls.shape === 'teardrop' ? 0.6 : 1;
  const pulse = 0.85 + 0.15 * Math.sin(t / 180);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = coreA;
  const cr = R * (cls.shape === 'armored' ? 0.8 : 0.9) * pulse;
  const cg = ctx.createRadialGradient(0, R * 0.05, 0, 0, R * 0.05, cr);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.4, color);
  cg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, R * 0.05, cr, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Nose read — a bright accent glow / eye slit up front.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (cls.shape === 'chevron') {          // NOVA — angry slit
    ctx.strokeStyle = rgba(accent, 0.95);
    ctx.lineWidth = R * 0.18;
    ctx.beginPath();
    ctx.moveTo(-R * 0.35, -R * 0.55); ctx.lineTo(R * 0.35, -R * 0.55);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -R * 1.05, R * 0.22, 0, TAU);
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

/* =======================================================================
 * MENU PORTRAIT (SVG) — bespoke body + face per class
 * ===================================================================== */

function defs(cls) {
  const k = cls.id;
  return `<defs>
    <filter id="g_${k}" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="sf_${k}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
    <radialGradient id="bv_${k}" cx="38%" cy="26%" r="84%"><stop offset="0%" stop-color="${cls.light}"/><stop offset="46%" stop-color="${cls.mid}"/><stop offset="100%" stop-color="${cls.dark}"/></radialGradient>
    <linearGradient id="rim_${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cls.accent}" stop-opacity="0"/><stop offset="78%" stop-color="${cls.accent}" stop-opacity="0"/><stop offset="100%" stop-color="${cls.accent}" stop-opacity=".9"/></linearGradient>
    <radialGradient id="eye_${k}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="${cls.eye}"/><stop offset="100%" stop-color="${cls.dark}"/></radialGradient>
    <radialGradient id="core_${k}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="${cls.eye}"/><stop offset="100%" stop-color="${cls.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="visor_${k}" cx="50%" cy="35%" r="75%"><stop offset="0%" stop-color="#0b1622"/><stop offset="100%" stop-color="#02060d"/></radialGradient>
    <linearGradient id="mtl_${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cls.light}"/><stop offset="100%" stop-color="${cls.dark}"/></linearGradient>
  </defs>`;
}

function ground(cls) {
  const k = cls.id;
  return `<ellipse cx="0" cy="152" rx="120" ry="26" fill="${cls.accent}" opacity=".14" filter="url(#sf_${k})"/>
   <ellipse cx="0" cy="168" rx="86" ry="18" fill="#00040a" opacity=".45" filter="url(#sf_${k})"/>`;
}

/* -- SPECTER: round medic with halo -- */
function specter(cls) {
  const k = cls.id;
  const body = `d="M-90,-36 Q-92,116 0,140 Q92,116 90,-36 Q88,-146 0,-154 Q-88,-146 -90,-36 Z"`;
  return `
   <g filter="url(#g_${k})"><ellipse cx="0" cy="-150" rx="72" ry="22" fill="none" stroke="${cls.accent}" stroke-width="6"/>
     <ellipse cx="0" cy="-150" rx="72" ry="22" fill="none" stroke="#eaffff" stroke-width="2"/></g>
   <path ${body} fill="url(#bv_${k})"/><path ${body} fill="url(#rim_${k})"/>
   <ellipse cx="-32" cy="-88" rx="34" ry="22" fill="#ffffff" opacity=".45" filter="url(#sf_${k})"/>
   <path d="M-84,-24 Q0,10 84,-24" fill="none" stroke="${cls.dark}" stroke-width="2" opacity=".4"/>
   <circle cx="0" cy="40" r="40" fill="url(#core_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="40" r="17" fill="#ffffff" filter="url(#g_${k})"/>
   <path d="M-66,-92 Q0,-120 66,-92 Q72,-62 54,-42 Q0,-30 -54,-42 Q-72,-62 -66,-92 Z" fill="url(#visor_${k})" stroke="${cls.accent}" stroke-width="2" stroke-opacity=".7"/>
   <ellipse cx="-27" cy="-78" rx="13" ry="15" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <ellipse cx="27" cy="-78" rx="13" ry="15" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <circle cx="-31" cy="-84" r="3.5" fill="#fff"/><circle cx="23" cy="-84" r="3.5" fill="#fff"/>`;
}

/* -- NOVA: angular racer, black+gold, angry slit -- */
function nova(cls) {
  const k = cls.id, a = cls.accent, m = `url(#mtl_${k})`;
  // dark angular body
  const body = `d="M-78,-30 L-88,64 Q-70,120 0,138 Q70,120 88,64 L78,-30 Q60,-120 0,-134 Q-60,-120 -78,-30 Z"`;
  return `
   <path d="M-30,-116 L-96,-196 L-6,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
   <path d="M30,-116 L96,-196 L6,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
   <path d="M-88,20 L-140,54 L-84,74 Z" fill="${m}" stroke="${a}" stroke-width="2"/>
   <path d="M88,20 L140,54 L84,74 Z" fill="${m}" stroke="${a}" stroke-width="2"/>
   <path ${body} fill="url(#bv_${k})"/>
   <path ${body} fill="none" stroke="${a}" stroke-width="2.5" stroke-opacity=".8"/>
   <ellipse cx="-30" cy="-80" rx="28" ry="18" fill="#ffffff" opacity=".28" filter="url(#sf_${k})"/>
   <path d="M0,-120 L0,120" stroke="${a}" stroke-width="2" opacity=".35"/>
   <path d="M-66,-84 L-8,-64 L-8,-40 L-70,-56 Z" fill="url(#visor_${k})" stroke="${a}" stroke-width="2"/>
   <path d="M66,-84 L8,-64 L8,-40 L70,-56 Z" fill="url(#visor_${k})" stroke="${a}" stroke-width="2"/>
   <path d="M-58,-70 L-16,-56" stroke="${cls.eye}" stroke-width="7" stroke-linecap="round" filter="url(#g_${k})"/>
   <path d="M58,-70 L16,-56" stroke="${cls.eye}" stroke-width="7" stroke-linecap="round" filter="url(#g_${k})"/>
   <path d="M-16,18 L16,18 L26,44 L0,58 L-26,44 Z" fill="none" stroke="${a}" stroke-width="3" filter="url(#g_${k})"/>
   <circle cx="0" cy="34" r="10" fill="${a}" filter="url(#g_${k})"/>
   <path d="M-20,120 Q0,168 20,120 Z" fill="${a}" opacity=".5" filter="url(#g_${k})"/>`;
}

/* -- PHANTOM: slim stealth, hood, slit eyes, wispy -- */
function phantom(cls) {
  const k = cls.id, a = cls.accent, m = `url(#mtl_${k})`;
  const body = `d="M-70,-30 Q-78,110 0,150 Q78,110 70,-30 Q64,-150 0,-160 Q-64,-150 -70,-30 Z"`;
  return `
   <path d="M-40,-110 Q-84,-206 -14,-134 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
   <path d="M40,-110 Q84,-206 14,-134 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
   <path d="M-54,-150 Q-62,-176 -34,-140" fill="${a}" opacity=".5"/>
   <path d="M54,-150 Q62,-176 34,-140" fill="${a}" opacity=".5"/>
   <path ${body} fill="url(#bv_${k})" opacity=".95"/><path ${body} fill="url(#rim_${k})"/>
   <path d="M-70,-40 Q0,-150 70,-40 Q60,-96 0,-104 Q-60,-96 -70,-40 Z" fill="${cls.dark}" opacity=".85"/>
   <ellipse cx="-28" cy="-96" rx="26" ry="16" fill="#ffffff" opacity=".2" filter="url(#sf_${k})"/>
   <path d="M-52,-72 L-14,-58" stroke="${cls.eye}" stroke-width="8" stroke-linecap="round" filter="url(#g_${k})"/>
   <path d="M52,-72 L14,-58" stroke="${cls.eye}" stroke-width="8" stroke-linecap="round" filter="url(#g_${k})"/>
   <path d="M0,20 L14,44 L0,66 L-14,44 Z" fill="url(#core_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="44" r="7" fill="${a}" filter="url(#g_${k})"/>
   <path d="M-16,140 Q0,190 16,140" fill="${a}" opacity=".28" filter="url(#sf_${k})"/>`;
}

/* -- GUARDIAN: heavy tank, big shoulders, shield emitter -- */
function guardian(cls) {
  const k = cls.id, a = cls.accent, m = `url(#mtl_${k})`;
  const body = `d="M-96,10 Q-98,110 0,132 Q98,110 96,10 Q92,-70 40,-92 L-40,-92 Q-92,-70 -96,10 Z"`;
  return `
   <g filter="url(#g_${k})"><path d="M-60,-120 A60 60 0 0 1 60,-120" fill="none" stroke="${a}" stroke-width="4" stroke-opacity=".7"/></g>
   <line x1="0" y1="-92" x2="0" y2="-138" stroke="${m}" stroke-width="7"/><circle cx="0" cy="-144" r="10" fill="${a}" filter="url(#g_${k})"/>
   <ellipse cx="-92" cy="4" rx="34" ry="46" fill="${m}" stroke="${cls.dark}" stroke-width="3"/>
   <ellipse cx="92" cy="4" rx="34" ry="46" fill="${m}" stroke="${cls.dark}" stroke-width="3"/>
   <circle cx="-92" cy="4" r="12" fill="${a}" filter="url(#g_${k})"/><circle cx="92" cy="4" r="12" fill="${a}" filter="url(#g_${k})"/>
   <path ${body} fill="url(#bv_${k})"/><path ${body} fill="url(#rim_${k})"/>
   <ellipse cx="-30" cy="-40" rx="32" ry="20" fill="#ffffff" opacity=".4" filter="url(#sf_${k})"/>
   <path d="M-58,-36 L58,-36" stroke="${cls.dark}" stroke-width="4" opacity=".5"/>
   <circle cx="-56" cy="70" r="5" fill="${cls.dark}"/><circle cx="56" cy="70" r="5" fill="${cls.dark}"/>
   <path d="M-58,-70 Q0,-92 58,-70 Q62,-50 46,-38 Q0,-28 -46,-38 Q-62,-50 -58,-70 Z" fill="url(#visor_${k})" stroke="${a}" stroke-width="2" stroke-opacity=".7"/>
   <ellipse cx="-26" cy="-58" rx="14" ry="12" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <ellipse cx="26" cy="-58" rx="14" ry="12" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="46" r="34" fill="url(#core_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="46" r="14" fill="#ffffff" filter="url(#g_${k})"/>
   <path d="M-22,26 L22,26 M-24,66 L24,66" stroke="${cls.dark}" stroke-width="3" opacity=".5"/>`;
}

const BUILDERS = { round: specter, chevron: nova, teardrop: phantom, armored: guardian };

export function portraitSVG(cls, size = 150) {
  const inner = (BUILDERS[cls.shape] || specter)(cls);
  return `<svg viewBox="-170 -215 340 410" width="${size}" height="${size * 1.25}" xmlns="http://www.w3.org/2000/svg">
   ${defs(cls)}
   ${ground(cls)}
   ${inner}
  </svg>`;
}
