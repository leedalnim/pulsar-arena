/**
 * main.js
 * ---------------------------------------------------------------------------
 * Application entry point. Wires the independent subsystems together, connects
 * the menu overlay to the Game via callbacks, handles canvas sizing/DPR, and
 * kicks off the render loop. This is the only file that knows about the DOM
 * page structure; everything else stays framework-free and portable.
 * ---------------------------------------------------------------------------
 */
import { Game } from './core/Game.js';
import { InputManager } from './core/InputManager.js';
import { SoundManager } from './core/SoundManager.js';
import { ParticleSystem } from './core/ParticleSystem.js';
import { Storage } from './core/Storage.js';
import { Menu } from './ui/Menu.js';
import { STATE } from './core/constants.js';

function boot() {
  window.__PULSAR_BOOTED__ = true; // signals index.html the modules loaded
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  const app = document.getElementById('app');

  const settings = Storage.load();
  const sound = new SoundManager(settings);
  const input = new InputManager(app);
  const particles = new ParticleSystem();
  const game = new Game(canvas, settings, sound, input, particles);

  /* ------------------------- canvas sizing / DPR ------------------------- */
  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.resize(window.innerWidth, window.innerHeight, dpr);
  }

  /* ------------------------------- menu ---------------------------------- */
  const menu = new Menu(overlay, {
    onStart: () => { sound.unlock(); game.start(); menu.hide(); },
    onResume: () => { game.resume(); menu.hide(); },
    onRestart: () => { game.restart(); menu.hide(); },
    onQuit: () => { game.quitToMenu(); menu.show('main'); },
    onSettingsChange: (s) => {
      Storage.save(s);
      sound.setVolume(s.volume);
      sound.setEnabled(s.sfx);
      game.camera.shakeEnabled = s.shake;
    },
    onUI: () => sound.ui(),
  }, settings);

  // Game -> menu bridges.
  game.onGameOver = (scores) => menu.show('over', { scores });
  game.onPauseRequested = () => menu.show('pause');

  /* ------------------------------ lifecycle ------------------------------ */
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();

  menu.show('main');
  game.startLoop();

  // First interaction anywhere unlocks audio (autoplay policy).
  const unlock = () => { sound.unlock(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}

// The game requires ES modules served over http(s). If opened via file:// the
// module simply won't run; index.html shows a hint in that case.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
