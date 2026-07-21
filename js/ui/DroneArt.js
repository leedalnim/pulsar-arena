/**
 * DroneArt.js
 * ---------------------------------------------------------------------------
 * Procedural, asset-free drone art shared by the game world and the menus.
 *   - drawDrone(ctx, ...)  paints a class-specific TOP-DOWN drone on the canvas
 *                          (used in-match for players/bots). Nose points at the
 *                          unit's facing; the body is tinted by faction colour.
 *   - portraitSVG(cls)     returns a self-contained 3/4 PORTRAIT as an SVG
 *                          string (used in the DOM character picker).
 *
 * The silhouettes (round / chevron / teardrop / armoured) and the emissive
 * core+rim glow language deliberately echo the concept sheet, but everything
 * is drawn from primitives — no external images. Class visual fields live on
 * the CLASSES table in constants.js.
 * ---------------------------------------------------------------------------
 */
import { TAU, rgba } from '../core/utils.js';

/* --------------------------- in-game top-down --------------------------- */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Trace a class hull with the nose pointing up (−Y). Radius R sets the scale. */
function hullPath(ctx, shape, R) {
  ctx.beginPath();
  if (shape === 'chevron') {              // NOVA — arrow
    ctx.moveTo(0, -R * 1.45);
    ctx.lineTo(R * 1.15, R * 0.45);
    ctx.lineTo(R * 0.7, R * 1.0);
    ctx.lineTo(-R * 0.7, R * 1.0);
    ctx.lineTo(-R * 1.15, R * 0.45);
    ctx.closePath();
  } else if (shape === 'teardrop') {      // PHANTOM — sleek drop
    ctx.moveTo(0, -R * 1.5);
    ctx.quadraticCurveTo(R * 1.02, -R * 0.15, R * 0.72, R * 0.9);
    ctx.quadraticCurveTo(0, R * 1.28, -R * 0.72, R * 0.9);
    ctx.quadraticCurveTo(-R * 1.02, -R * 0.15, 0, -R * 1.5);
    ctx.closePath();
  } else if (shape === 'armored') {       // GUARDIAN — thick hull
    roundRectPath(ctx, -R * 1.15, -R * 1.1, R * 2.3, R * 2.2, R * 0.55);
  } else {                                // SPECTER — round
    ctx.moveTo(0, -R * 1.25);
    ctx.quadraticCurveTo(R * 1.05, -R * 1.05, R * 1.05, 0);
    ctx.quadraticCurveTo(R * 1.05, R * 1.15, 0, R * 1.25);
    ctx.quadraticCurveTo(-R * 1.05, R * 1.15, -R * 1.05, 0);
    ctx.quadraticCurveTo(-R * 1.05, -R * 1.05, 0, -R * 1.25);
    ctx.closePath();
  }
}

/**
 * Paint a top-down drone centred at the current origin.
 * @param ctx     canvas context (caller has translated to the unit centre)
 * @param cls     class descriptor {shape, accent, ...}
 * @param color   faction colour (#hex) — drives the emissive glow/read
 * @param radius  unit radius in px
 * @param facing  heading in radians (0 = +X)
 * @param t       time in ms for subtle idle animation
 */
export function drawDrone(ctx, cls, color, radius, facing, t = 0) {
  const R = radius;
  const accent = cls.accent || color;
  ctx.save();
  ctx.rotate(facing + Math.PI / 2);       // hull nose (−Y) aligns with facing

  // GUARDIAN shield ring / SPECTER halo — faint, drawn under the hull.
  if (cls.shape === 'armored') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.6, 0, TAU);
    ctx.strokeStyle = rgba(accent, 0.4);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Side thruster pods with a faction-coloured glow.
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * R * 0.98, R * 0.5, R * 0.28, 0, TAU);
    ctx.fillStyle = '#9fb3d0'; // metal pod
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx * R * 0.98, R * 0.5, R * 0.13, 0, TAU);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Hull body: volumetric gradient tinted by the faction colour.
  hullPath(ctx, cls.shape, R);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.2, 0, 0, R * 1.7);
  g.addColorStop(0, '#f4f8ff');
  g.addColorStop(0.55, color);
  g.addColorStop(1, '#182740');
  ctx.fillStyle = g;
  ctx.fill();
  // Accent rim.
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Specular highlight (top-left).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(-R * 0.32, -R * 0.5, R * 0.42, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();

  // Emissive core.
  const pulse = 0.85 + 0.15 * Math.sin(t / 180);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(0, R * 0.05, 0, 0, R * 0.05, R * 0.95 * pulse);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.4, color);
  cg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, R * 0.05, R * 0.95 * pulse, 0, TAU);
  ctx.fill();
  // Nose glow.
  ctx.beginPath();
  ctx.arc(0, -R * 1.05, R * 0.24, 0, TAU);
  ctx.fillStyle = rgba(accent, 0.9);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* ----------------------------- menu portrait ---------------------------- */

/** Class crown feature (halo / horns / ears / fins) for the SVG portrait. */
function crownSVG(cls) {
  const a = cls.accent, k = cls.id, m = `url(#mtl_${k})`;
  switch (cls.shape) {
    case 'chevron': // NOVA horns
      return `<path d="M-40,-118 L-70,-186 L-14,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
              <path d="M40,-118 L70,-186 L14,-128 Z" fill="${m}" stroke="${a}" stroke-width="3"/>`;
    case 'teardrop': // PHANTOM ears
      return `<path d="M-46,-108 Q-72,-190 -20,-132 Z" fill="${m}" stroke="${a}" stroke-width="3"/>
              <path d="M46,-108 Q72,-190 20,-132 Z" fill="${m}" stroke="${a}" stroke-width="3"/>`;
    case 'armored': // GUARDIAN fins + antenna
      return `<rect x="-104" y="-118" width="24" height="66" rx="10" fill="${m}" stroke="${cls.dark}" stroke-width="2"/>
              <rect x="80" y="-118" width="24" height="66" rx="10" fill="${m}" stroke="${cls.dark}" stroke-width="2"/>
              <line x1="0" y1="-116" x2="0" y2="-164" stroke="${m}" stroke-width="6"/>
              <circle cx="0" cy="-170" r="9" fill="${a}" filter="url(#g_${k})"/>`;
    default: // SPECTER halo
      return `<g filter="url(#g_${k})"><ellipse cx="0" cy="-150" rx="72" ry="22" fill="none" stroke="${a}" stroke-width="6"/>
              <ellipse cx="0" cy="-150" rx="72" ry="22" fill="none" stroke="#eaffff" stroke-width="2"/></g>`;
  }
}

/**
 * Return a self-contained SVG portrait string for a class.
 * @param cls   class descriptor with visual fields (light/mid/dark/accent/eye)
 * @param size  square viewport size in px
 */
export function portraitSVG(cls, size = 150) {
  const k = cls.id;
  const body = `d="M-92,-38 Q-92,116 0,140 Q92,116 92,-38 Q92,-146 0,-154 Q-92,-146 -92,-38 Z"`;
  return `<svg viewBox="-160 -210 320 400" width="${size}" height="${size * 1.25}" xmlns="http://www.w3.org/2000/svg">
   <defs>
     <filter id="g_${k}" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <filter id="sf_${k}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
     <radialGradient id="bv_${k}" cx="38%" cy="28%" r="82%"><stop offset="0%" stop-color="${cls.light}"/><stop offset="45%" stop-color="${cls.mid}"/><stop offset="100%" stop-color="${cls.dark}"/></radialGradient>
     <linearGradient id="rim_${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cls.accent}" stop-opacity="0"/><stop offset="80%" stop-color="${cls.accent}" stop-opacity="0"/><stop offset="100%" stop-color="${cls.accent}" stop-opacity=".85"/></linearGradient>
     <radialGradient id="eye_${k}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="${cls.eye}"/><stop offset="100%" stop-color="${cls.dark}"/></radialGradient>
     <radialGradient id="core_${k}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="${cls.eye}"/><stop offset="100%" stop-color="${cls.accent}" stop-opacity="0"/></radialGradient>
     <radialGradient id="visor_${k}" cx="50%" cy="35%" r="75%"><stop offset="0%" stop-color="#0b1622"/><stop offset="100%" stop-color="#02060d"/></radialGradient>
     <linearGradient id="mtl_${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cls.light}"/><stop offset="100%" stop-color="${cls.dark}"/></linearGradient>
   </defs>
   <ellipse cx="0" cy="150" rx="120" ry="26" fill="${cls.accent}" opacity=".14" filter="url(#sf_${k})"/>
   <ellipse cx="0" cy="168" rx="86" ry="18" fill="#00040a" opacity=".45" filter="url(#sf_${k})"/>
   ${crownSVG(cls)}
   <path ${body} fill="url(#bv_${k})"/>
   <path ${body} fill="url(#rim_${k})"/>
   <ellipse cx="-32" cy="-88" rx="34" ry="22" fill="#ffffff" opacity=".45" filter="url(#sf_${k})"/>
   <circle cx="0" cy="34" r="40" fill="url(#core_${k})" filter="url(#g_${k})"/>
   <circle cx="0" cy="34" r="18" fill="#ffffff" filter="url(#g_${k})"/>
   <path d="M-68,-92 Q0,-122 68,-92 Q74,-62 56,-42 Q0,-30 -56,-42 Q-74,-62 -68,-92 Z" fill="url(#visor_${k})" stroke="${cls.accent}" stroke-width="2" stroke-opacity=".7"/>
   <ellipse cx="-28" cy="-78" rx="13" ry="15" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <ellipse cx="28" cy="-78" rx="13" ry="15" fill="url(#eye_${k})" filter="url(#g_${k})"/>
   <circle cx="-32" cy="-84" r="3.5" fill="#fff"/><circle cx="24" cy="-84" r="3.5" fill="#fff"/>
  </svg>`;
}
