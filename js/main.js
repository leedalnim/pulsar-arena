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
import { NetPeer } from './net/NetPeer.js';
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

  /* ------------------------------ networking ----------------------------- */
  // P2P 1v1 over WebRTC with manual (copy-paste) signaling — no server.
  let net = null;
  function wireNet(n) {
    n.onOpen = () => menu.netOpen(n.isHost);
    n.onClose = () => {
      if (game.netRole) { game.quitToMenu(); menu.show('main'); }
    };
    n.onMessage = (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'in') game.setRemoteInput(m);              // host <- client input
      else if (m.t === 'init') { sound.unlock(); game.applyNetInit(net, m); menu.hide(); }
      else if (m.t === 's') game.applyNetSnapshot(m);        // client <- snapshot
      else if (m.t === 'over') { game.state = STATE.OVER; menu.show('over', { scores: m.scores }); }
    };
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
    // Online (P2P) signaling callbacks.
    net: {
      hostCreateOffer: async () => { net = new NetPeer(); wireNet(net); return net.createOffer(); },
      hostAcceptAnswer: async (ans) => { await net.acceptAnswer(ans); },
      joinAcceptOffer: async (off) => { net = new NetPeer(); wireNet(net); return net.acceptOfferCreateAnswer(off); },
    },
    onNetHostStart: () => { sound.unlock(); game.startNetHost(net, null); menu.hide(); },
  }, settings);

  // Game -> menu bridges.
  game.onGameOver = (scores) => menu.show('over', { scores });
  game.onPauseRequested = () => menu.show('pause');
  game.onReturnMenu = () => menu.show('main');

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
