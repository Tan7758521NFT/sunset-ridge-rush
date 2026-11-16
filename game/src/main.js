// main.js — boot: wire the canvas, HUD, game loop and screenshot hooks.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const hud = {
  speed: document.getElementById('hud-speed'),
  lap: document.getElementById('hud-lap'),
  pos: document.getElementById('hud-pos'),
  time: document.getElementById('hud-time'),
  nitro: document.getElementById('nitro-fill'),
  nitroWrap: document.getElementById('nitro-wrap'),
  msg: document.getElementById('hud-msg'),
  count: document.getElementById('hud-count'),
};

const game = new Game(canvas, hud);
window.__game = game;

const params = new URLSearchParams(location.search);
game.applyShot(params);

if (params.get('selftest') === '1') {
  game.selfTest();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.frame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// surface unexpected errors in the DOM so a headless run can see them
window.addEventListener('error', (e) => {
  const el = document.getElementById('jserror');
  if (el) el.textContent = 'JSERROR: ' + (e.message || 'unknown');
});
