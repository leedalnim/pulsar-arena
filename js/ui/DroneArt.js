/**
 * DroneArt.js
 * ---------------------------------------------------------------------------
 * Procedural, asset-free drone art shared by the game world and the menus.
 *   - drawDrone(ctx, ...)  paints a TOP-DOWN drone on the canvas (in-match).
 *   - portraitSVG(cls)     returns a 3/4 PORTRAIT as an SVG string (menu).
 *
 * All four classes share ONE base drone form (a rounded mech body); they are
 * told apart by BODY COLOUR, EYE shape/count, and a head accessory:
 *   SPECTER  cyan   · halo    · two round eyes
 *   NOVA     gold   · horns   · two sharp slanted eyes
 *   PHANTOM  purple · ears    · two narrow slit eyes
 *   GUARDIAN blue   · antenna · one wide visor eye
 * Everything is drawn from primitives — no image assets. Class visual fields
 * live on CLASSES in constants.js (shape selects accessory + eye style).
 * ---------------------------------------------------------------------------
 */
import { TAU, rgba } from '../core/utils.js';

/* =======================================================================
 * IN-GAME TOP-DOWN (canvas) — shared round hull, per-class colour + marker
 * ===================================================================== */

export function drawDrone(ctx, cls, color, radius, facing, t = 0) {
  const R = radius;
  const accent = cls.accent || color;
  const eye = cls.eye || accent;
  const pulse = 0.85 + 0.15 * Math.sin(t / 180);
  ctx.save();
  ctx.rotate(facing + Math.PI / 2);       // the drone's face (−Y) points along facing

  // Back thruster pods.
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * R * 0.82, R * 0.74, R * 0.22, 0, TAU);
    ctx.fillStyle = '#9fb3d0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx * R * 0.82, R * 0.74, R * 0.1, 0, TAU);
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 7;
    ctx.fill(); ctx.shadowBlur = 0;
  }

  // Class accessory above the head (halo / horns / ears / antenna).
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.95);
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.lineWidth = Math.max(1.4, R * 0.1);
  ctx.lineCap = 'round';
  if (cls.shape === 'chevron') {            // NOVA — horns
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, -R * 0.95); ctx.lineTo(-R * 0.72, -R * 1.5);
    ctx.moveTo(R * 0.42, -R * 0.95); ctx.lineTo(R * 0.72, -R * 1.5);
    ctx.stroke();
  } else if (cls.shape === 'teardrop') {    // PHANTOM — ears
    ctx.beginPath();
    ctx.moveTo(-R * 0.5, -R * 0.9); ctx.lineTo(-R * 0.58, -R * 1.45);
    ctx.moveTo(R * 0.5, -R * 0.9); ctx.lineTo(R * 0.58, -R * 1.45);
    ctx.stroke();
  } else if (cls.shape === 'armored') {     // GUARDIAN — antenna
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.1); ctx.lineTo(0, -R * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -R * 1.6, R * 0.15, 0, TAU);
    ctx.fill();
  } else {                                  // SPECTER — halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1.4, R * 0.09);
    ctx.beginPath();
    ctx.ellipse(0, -R * 1.42, R * 0.6, R * 0.22, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // Rounded body hull, faction-tinted.
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.12);
  ctx.quadraticCurveTo(R, -R, R, 0);
  ctx.quadraticCurveTo(R, R * 1.05, 0, R * 1.15);
  ctx.quadraticCurveTo(-R, R * 1.05, -R, 0);
  ctx.quadraticCurveTo(-R, -R, 0, -R * 1.12);
  ctx.closePath();
  const g = ctx.createRadialGradient(-R * 0.32, -R * 0.5, R * 0.2, 0, 0, R * 1.7);
  g.addColorStop(0, '#f4f8ff');
  g.addColorStop(0.5, color);
  g.addColorStop(1, '#182740');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.9);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Specular highlight.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(-R * 0.3, -R * 0.55, R * 0.34, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  ctx.restore();

  // Dark visor band near the front, with the class eyes (matches the portrait).
  ctx.beginPath();
  ctx.moveTo(-R * 0.62, -R * 0.5);
  ctx.quadraticCurveTo(0, -R * 0.8, R * 0.62, -R * 0.5);
  ctx.quadraticCurveTo(R * 0.5, -R * 0.18, 0, -R * 0.14);
  ctx.quadraticCurveTo(-R * 0.5, -R * 0.18, -R * 0.62, -R * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#08111c';
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = eye;
  ctx.strokeStyle = eye;
  ctx.shadowColor = eye; ctx.shadowBlur = 6;
  ctx.lineCap = 'round';
  if (cls.shape === 'chevron') {            // sharp slanted eyes
    ctx.lineWidth = R * 0.13;
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, -R * 0.32); ctx.lineTo(-R * 0.16, -R * 0.42);
    ctx.moveTo(R * 0.42, -R * 0.32); ctx.lineTo(R * 0.16, -R * 0.42);
    ctx.stroke();
  } else if (cls.shape === 'teardrop') {    // narrow slit eyes
    ctx.lineWidth = R * 0.1;
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, -R * 0.4); ctx.lineTo(-R * 0.16, -R * 0.38);
    ctx.moveTo(R * 0.4, -R * 0.4); ctx.lineTo(R * 0.16, -R * 0.38);
    ctx.stroke();
  } else if (cls.shape === 'armored') {     // one wide visor eye
    ctx.lineWidth = R * 0.16;
    ctx.beginPath();
    ctx.moveTo(-R * 0.32, -R * 0.4); ctx.lineTo(R * 0.32, -R * 0.4);
    ctx.stroke();
  } else {                                  // two round eyes
    ctx.beginPath();
    ctx.arc(-R * 0.26, -R * 0.42, R * 0.11, 0, TAU);
    ctx.arc(R * 0.26, -R * 0.42, R * 0.11, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Chest core glow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cr = R * 0.68 * pulse;
  const cg = ctx.createRadialGradient(0, R * 0.3, 0, 0, R * 0.3, cr);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.4, color);
  cg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, R * 0.3, cr, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* =======================================================================
 * MENU PORTRAIT (SVG) — one base body; colour + eyes + accessory vary
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

/** Head accessory on the shared round head. */
function accessorySVG(cls) {
  const k = cls.id, a = cls.accent, m = `url(#mtl_${k})`;
  switch (cls.shape) {
    case 'chevron': // NOVA — horns
      return `<path d="M-34,-118 Q-58,-150 -74,-190 Q-40,-160 -12,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
              <path d="M34,-118 Q58,-150 74,-190 Q40,-160 12,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>`;
    case 'teardrop': // PHANTOM — ears
      return `<path d="M-44,-112 Q-70,-192 -18,-134 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
              <path d="M44,-112 Q70,-192 18,-134 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
              <path d="M-50,-146 Q-56,-170 -32,-138" fill="${a}" opacity=".5"/>
              <path d="M50,-146 Q56,-170 32,-138" fill="${a}" opacity=".5"/>`;
    case 'armored': // GUARDIAN — antenna
      return `<line x1="0" y1="-146" x2="0" y2="-186" stroke="${m}" stroke-width="7"/>
              <circle cx="0" cy="-192" r="10" fill="${a}" filter="url(#g_${k})"/>`;
    default: // SPECTER — halo
      return `<g filter="url(#g_${k})"><ellipse cx="0" cy="-152" rx="72" ry="22" fill="none" stroke="${a}" stroke-width="6"/>
              <ellipse cx="0" cy="-152" rx="72" ry="22" fill="none" stroke="#eaffff" stroke-width="2"/></g>`;
  }
}

/** Eyes inside the visor — shape and count vary per class. */
function eyesSVG(cls) {
  const k = cls.id, e = `url(#eye_${k})`, gl = `filter="url(#g_${k})"`;
  switch (cls.shape) {
    case 'chevron': // NOVA — two sharp slanted eyes (aggressive)
      return `<path d="M-46,-86 L-14,-74 L-14,-62 L-46,-70 Z" fill="${e}" ${gl}/>
              <path d="M46,-86 L14,-74 L14,-62 L46,-70 Z" fill="${e}" ${gl}/>`;
    case 'teardrop': // PHANTOM — two narrow slit eyes
      return `<rect x="-46" y="-80" width="30" height="8" rx="4" transform="rotate(-6 -31 -76)" fill="${e}" ${gl}/>
              <rect x="16" y="-80" width="30" height="8" rx="4" transform="rotate(6 31 -76)" fill="${e}" ${gl}/>`;
    case 'armored': // GUARDIAN — one wide visor eye
      return `<rect x="-42" y="-84" width="84" height="16" rx="8" fill="${e}" ${gl}/>
              <rect x="-30" y="-80" width="60" height="7" rx="3.5" fill="#ffffff" opacity=".6"/>`;
    default: // SPECTER — two round eyes
      return `<ellipse cx="-27" cy="-77" rx="13" ry="15" fill="${e}" ${gl}/>
              <ellipse cx="27" cy="-77" rx="13" ry="15" fill="${e}" ${gl}/>
              <circle cx="-31" cy="-83" r="3.5" fill="#fff"/><circle cx="23" cy="-83" r="3.5" fill="#fff"/>`;
  }
}

export function portraitSVG(cls, size = 150) {
  const k = cls.id;
  const body = `d="M-90,-36 Q-92,116 0,140 Q92,116 90,-36 Q88,-146 0,-154 Q-88,-146 -90,-36 Z"`;
  const visor = `d="M-66,-92 Q0,-120 66,-92 Q72,-62 54,-42 Q0,-30 -54,-42 Q-72,-62 -66,-92 Z"`;
  return `<svg viewBox="-160 -210 320 400" width="${size}" height="${size * 1.25}" xmlns="http://www.w3.org/2000/svg">
   ${defs(cls)}
   <ellipse cx="0" cy="150" rx="118" ry="24" fill="${cls.accent}" opacity=".14" filter="url(#sf_${k})"/>
   <ellipse cx="0" cy="166" rx="84" ry="16" fill="#00040a" opacity=".45" filter="url(#sf_${k})"/>
   ${accessorySVG(cls)}
   <path ${body} fill="url(#bv_${k})"/>
   <path ${body} fill="url(#rim_${k})"/>
   <ellipse cx="-32" cy="-88" rx="34" ry="22" fill="#ffffff" opacity=".45" filter="url(#sf_${k})"/>
   <path d="M-84,-24 Q0,10 84,-24" fill="none" stroke="${cls.dark}" stroke-width="2" opacity=".4"/>
   <circle cx="0" cy="42" r="38" fill="url(#core_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="42" r="16" fill="#ffffff" filter="url(#g_${k})"/>
   <path ${visor} fill="url(#visor_${k})" stroke="${cls.accent}" stroke-width="2" stroke-opacity=".7"/>
   ${eyesSVG(cls)}
  </svg>`;
}
