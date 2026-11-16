// game.js — the race itself: states, driving physics, laps, HUD, scoring.
// Menu -> countdown -> race -> results -> restart. Original code.

import { SEG_LEN, ROAD_WIDTH, buildTrack, segmentAt, segmentPercent, lerp, makeRidge, CAMERA_HEIGHT } from './track.js';
import { Renderer } from './render.js';
import { carSprite, propSprite } from './sprites.js';
import { makeRacers, updateCars, rankOf, MAX_SPEED } from './cars.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';

export const TOTAL_LAPS = 3;
const ACCEL = MAX_SPEED / 4.2;
const BRAKE = -MAX_SPEED * 1.1;
const COAST = -MAX_SPEED / 6;
const OFFROAD_DECEL = -MAX_SPEED / 1.1;
const OFFROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.32;
const NITRO_DRAIN = 34;
const NITRO_REFILL = 7;
const NITRO_BOOST = 1.45;

const PLACE_WORDS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function fmtTime(sec) {
  if (!isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = new Renderer(canvas);
    this.audio = new AudioSys();
    this.input = new Input();
    this.input.onFirstGesture = () => this.audio.ensure();
    this.track = buildTrack();
    this.renderer.setRidges(
      makeRidge(7, 24, 0.5, 0.55),
      makeRidge(21, 24, 0.5, 0.9),
    );
    // resolve roadside props to drawn sprites
    for (const seg of this.track.segments) {
      for (const spr of seg.sprites) {
        spr.sprite = propSprite(spr.kind, spr.text || '');
      }
    }
    const { racers, traffic } = makeRacers(this.track);
    this.racers = racers;
    this.traffic = traffic;
    this.playerSprite = carSprite('#ff5a1f', { stripe: '#ffe9a8', number: '1' });
    this.state = 'menu';
    this.timeSec = 0;
    this.frozen = false;
    this.reset();
    this.bestKey = 'sunset-ridge-rush-best';
    try {
      this.bestMs = Number(localStorage.getItem(this.bestKey)) || 0;
    } catch (e) {
      this.bestMs = 0;
    }
    this.bindButtons();
  }

  bindButtons() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startRace());
    const againBtn = document.getElementById('again-btn');
    if (againBtn) againBtn.addEventListener('click', () => this.startRace());
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.audio.ensure();
        muteBtn.textContent = this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON';
      });
    }
  }

  reset() {
    this.position = 0;
    this.playerX = 0;
    this.speed = 0;
    this.steerVis = 0;
    this.lap = 1;
    this.lapStart = 0;
    this.lapTimes = [];
    this.raceTime = 0;
    this.nitro = 100;
    this.boosting = false;
    this.invuln = 0;
    this.countdown = 0;
    this.countStep = 4;
    this.message = '';
    this.messageUntil = 0;
    this.finished = null;
    this.shake = 0;
    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i];
      r.z = (i + 1) * SEG_LEN * 6;
      r.offset = [-0.5, 0.4, -0.2, 0.55, -0.6][i];
      r.speed = 0;
      r.lap = 0;
      r.progress = r.z;
    }
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      t.z = 8000 + i * 11000 + ((i * 3700) % 5000);
      t.lap = 0;
      t.progress = t.z;
    }
  }

  startRace() {
    this.audio.ensure();
    this.reset();
    this.state = 'countdown';
    this.countdown = 3.2;
    this.countStep = 4;
    this.show('countdown');
    this.setMessage('GET READY', 3.2);
  }

  show(name) {
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('show');
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('show');
    if (name === 'results') this.fillResults();
    if (name === 'menu') this.fillMenu();
  }

  fillMenu() {
    const best = document.getElementById('menu-best');
    if (best) {
      best.textContent = this.bestMs > 0
        ? `Best finish: ${fmtTime(this.bestMs / 1000)}`
        : 'No finish yet — set the first time on the ridge.';
    }
  }

  fillResults() {
    const f = this.finished;
    if (!f) return;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('res-place', PLACE_WORDS[f.rank - 1]);
    set('res-title', f.rank === 1 ? 'RIDGE CHAMPION!' : f.rank <= 3 ? 'PODIUM FINISH!' : 'RACE COMPLETE');
    set('res-time', fmtTime(f.total));
    set('res-best', fmtTime(f.bestLap));
    set('res-score', String(f.score));
  }

  setMessage(text, dur = 2) {
    this.message = text;
    this.messageUntil = this.timeSec + dur;
  }

  get playerY() {
    const seg = segmentAt(this.track, this.position);
    return lerp(seg.p1.world.y, seg.p2.world.y, segmentPercent(this.position));
  }

  get progress() {
    return (this.lap - 1) * this.track.length + this.position;
  }

  get speedPercent() {
    return this.speed / MAX_SPEED;
  }

  update(dt) {
    if (this.frozen) return;
    this.timeSec += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.invuln > 0) this.invuln -= dt;

    if (this.input.pressed('m', 'M')) {
      this.audio.ensure();
      const btn = document.getElementById('mute-btn');
      if (btn) btn.textContent = this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON';
    }
    if (this.input.pressed('p', 'P')) {
      if (this.state === 'race') {
        this.state = 'paused';
        document.getElementById('pause-tip').classList.add('show');
        this.audio.setEngine(0, false, false);
        this.audio.setSkid(0);
      } else if (this.state === 'paused') {
        this.state = 'race';
        document.getElementById('pause-tip').classList.remove('show');
      }
    }
    if (this.state === 'paused') {
      this.updateHud();
      return;
    }

    if (this.state === 'menu') {
      if (this.input.pressed('Enter', ' ')) this.startRace();
      this.updateHud();
      return;
    }

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const step = Math.ceil(this.countdown);
      if (step !== this.countStep && step >= 1) {
        this.countStep = step;
        this.audio.countdown(false);
      }
      if (this.countdown <= 0) {
        this.state = 'race';
        this.raceTime = 0;
        this.lapStart = 0;
        this.audio.countdown(true);
        this.setMessage('GO!', 0.9);
      }
      this.updateHud();
      return;
    }

    if (this.state === 'results') {
      if (this.input.pressed('r', 'R', 'Enter')) this.startRace();
      this.audio.setEngine(0, false, false);
      this.audio.setSkid(0);
      this.updateHud();
      return;
    }

    // racing
    this.raceTime += dt;
    const seg = segmentAt(this.track, this.position);
    const speedPercent = this.speedPercent;

    // steering
    const steer = this.input.steer;
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 8);
    const dx = dt * 2.1 * speedPercent;
    this.playerX += dx * steer;

    // forward
    if (this.input.up) this.speed += ACCEL * dt;
    else if (this.input.downKey) this.speed += BRAKE * dt;
    else this.speed += COAST * dt;

    // nitro
    this.boosting = false;
    if (this.input.nitro && this.nitro > 12 && this.speed > MAX_SPEED * 0.25) {
      this.boosting = true;
      this.nitro = Math.max(0, this.nitro - NITRO_DRAIN * dt);
      this.speed += ACCEL * (NITRO_BOOST - 1) * dt;
    } else {
      this.nitro = Math.min(100, this.nitro + NITRO_REFILL * dt);
    }

    // curve push + off-road
    this.playerX -= dx * speedPercent * seg.curve * CENTRIFUGAL;
    if (Math.abs(this.playerX) > 1) {
      if (this.speed > OFFROAD_LIMIT) this.speed += OFFROAD_DECEL * dt;
      this.audio.setSkid(0.1 + speedPercent * 0.06);
    } else {
      this.audio.setSkid(Math.abs(steer) > 0 && speedPercent > 0.55 ? 0.06 : 0);
    }
    this.playerX = Math.max(-2.2, Math.min(2.2, this.playerX));
    this.speed = Math.max(0, Math.min(this.boosting ? MAX_SPEED * NITRO_BOOST : MAX_SPEED, this.speed));
    this.position += this.speed * dt;

    // rivals + traffic
    const events = updateCars(dt, this.track, this.racers, this.traffic, this);
    for (const ev of events) {
      if (ev.type === 'bump') {
        this.speed *= 0.42;
        this.shake = 1;
        this.audio.bump();
        this.setMessage('BUMP!', 0.9);
      }
    }

    // lap line
    if (this.position >= this.track.length) {
      this.position -= this.track.length;
      const lapTime = this.raceTime - this.lapStart;
      this.lapTimes.push(lapTime);
      this.lapStart = this.raceTime;
      this.nitro = Math.min(100, this.nitro + 45);
      this.audio.checkpoint();
      if (this.lap >= TOTAL_LAPS) {
        this.finishRace();
      } else {
        this.lap += 1;
        this.setMessage(this.lap === TOTAL_LAPS ? 'FINAL LAP!' : `LAP ${this.lap}`, 1.6);
      }
    }

    this.audio.setEngine(speedPercent, this.boosting, true);
    this.updateHud();
  }

  finishRace() {
    const rank = rankOf(this.progress, this.racers);
    const bestLap = Math.min(...this.lapTimes);
    const score = Math.max(0, (7 - rank) * 1000 + Math.max(0, Math.round((150 - this.raceTime) * 20)));
    this.finished = { rank, total: this.raceTime, bestLap, score };
    if (rank === 1) {
      const ms = Math.round(this.raceTime * 1000);
      if (this.bestMs === 0 || ms < this.bestMs) {
        this.bestMs = ms;
        try { localStorage.setItem(this.bestKey, String(ms)); } catch (e) {}
      }
    }
    this.state = 'results';
    this.audio.finish();
    this.audio.setEngine(0, false, false);
    this.audio.setSkid(0);
    this.show('results');
  }

  updateHud() {
    const h = this.hud;
    const kmh = Math.round(this.speedPercent * 320);
    if (h.speed) h.speed.textContent = String(kmh);
    if (h.lap) h.lap.textContent = `${Math.min(this.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
    if (h.pos) {
      const rank = this.state === 'race' ? rankOf(this.progress, this.racers) : 1;
      h.pos.textContent = PLACE_WORDS[rank - 1];
    }
    if (h.time) h.time.textContent = fmtTime(this.raceTime);
    if (h.nitro) h.nitro.style.width = `${Math.round(this.nitro)}%`;
    if (h.nitroWrap) h.nitroWrap.classList.toggle('low', this.nitro < 15);
    if (h.msg) {
      const show = this.message && this.timeSec < this.messageUntil;
      h.msg.textContent = show ? this.message : '';
      h.msg.classList.toggle('show', !!show);
    }
    if (h.count) {
      if (this.state === 'countdown') {
        const n = Math.ceil(this.countdown);
        h.count.textContent = n >= 1 ? String(n) : 'GO!';
        h.count.classList.add('show');
      } else {
        h.count.classList.remove('show');
      }
    }
  }

  render() {
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 14 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0;
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.renderer.render({
      track: this.track,
      position: this.position,
      playerX: this.playerX,
      playerY: this.playerY,
      cars: [],
      playerSprite: this.playerSprite,
      steer: this.steerVis,
      boosting: this.boosting,
      speedPercent: this.speedPercent,
      timeSec: this.timeSec,
    });
    ctx.restore();
  }

  frame(dt) {
    this.update(dt);
    this.render();
    this.input.endFrame();
  }

  // Screenshot hooks: ?shot=menu|race|results (+&freeze=1 to hold a frame).
  applyShot(params) {
    const shot = params.get('shot');
    if (!shot) return;
    if (shot === 'menu') {
      this.state = 'menu';
      this.show('menu');
      this.position = SEG_LEN * 40;
      this.speed = MAX_SPEED * 0.4;
    } else if (shot === 'race') {
      this.state = 'race';
      this.show('race'); // hides the menu/results overlays (no screen-race)
      const segNum = Number(params.get('seg') || 152);
      this.position = SEG_LEN * segNum;
      this.playerX = 0.25;
      this.speed = MAX_SPEED * 0.92;
      this.raceTime = 48.36;
      this.lap = 2;
      this.lapStart = 0;
      this.nitro = 62;
      this.boosting = true;
      // park rivals and traffic around the camera for a busy frame
      const put = (car, z, offset) => {
        car.z = z; car.offset = offset; car.speed = MAX_SPEED * 0.8;
        car.progress = car.lap * this.track.length + z;
      };
      put(this.racers[0], this.position + SEG_LEN * 9, -0.35);
      put(this.racers[1], this.position + SEG_LEN * 14, 0.45);
      put(this.racers[2], this.position + SEG_LEN * 22, 0.1);
      put(this.traffic[0], this.position + SEG_LEN * 6, 0.55);
      put(this.traffic[1], this.position + SEG_LEN * 17, -0.6);
      for (const seg of this.track.segments) seg.cars.length = 0;
      for (const car of [...this.racers, ...this.traffic]) {
        segmentAt(this.track, car.z).cars.push(car);
      }
      this.setMessage('', 0);
      this.updateHud();
    } else if (shot === 'results') {
      this.finished = { rank: 1, total: 132.47, bestLap: 41.83, score: 7840 };
      this.state = 'results';
      this.show('results');
      this.updateHud();
    }
    if (params.get('freeze') === '1') this.frozen = true;
  }

  // Built-in smoke test: ?selftest=1 runs the real loop with scripted input
  // and writes PASS/FAIL into #selftest.
  selfTest() {
    const out = document.getElementById('selftest');
    const log = [];
    try {
      this.startRace();
      // skip the countdown by fast-forwarding it
      this.update(3.3);
      if (this.state !== 'race') throw new Error('never reached race, state=' + this.state);
      this.input.keys = { ArrowUp: true };
      // up to 70 simulated seconds of driving, steering toward the road centre
      let finishedEarly = false;
      for (let i = 0; i < 4200; i++) {
        const seg = segmentAt(this.track, this.position);
        this.input.keys.ArrowLeft = this.playerX > 0.1;
        this.input.keys.ArrowRight = this.playerX < -0.1;
        if (i % 600 === 0) this.input.keys.Shift = true;
        if (i % 600 === 300) this.input.keys.Shift = false;
        this.update(1 / 60);
        this.input.endFrame();
        if (this.state === 'results') { finishedEarly = true; break; }
        if (this.state !== 'race') throw new Error('left race early, state=' + this.state);
      }
      log.push(`speed=${Math.round(this.speed)} lap=${this.lap} pos=${Math.round(this.position)}`);
      if (!finishedEarly && this.lap < 2) throw new Error('did not complete a lap');
      if (!finishedEarly) {
        // finish the race fast: warp near the line and run the last lap out
        this.lap = TOTAL_LAPS;
        this.position = this.track.length - SEG_LEN * 2;
        this.speed = MAX_SPEED;
        for (let i = 0; i < 240; i++) {
          this.input.keys = { ArrowUp: true };
          this.update(1 / 60);
          this.input.endFrame();
          if (this.state === 'results') break;
        }
      }
      if (this.state !== 'results') throw new Error('never reached results');
      if (!this.finished) throw new Error('no finish record');
      log.push(`finished rank=${this.finished.rank} time=${fmtTime(this.finished.total)}`);
      // restart works
      this.startRace();
      this.update(3.3);
      if (this.state !== 'race') throw new Error('restart failed');
      log.push('restart ok');
      if (out) {
        out.textContent = 'SELFTEST PASS — ' + log.join(' | ');
        out.dataset.result = 'pass';
      }
    } catch (e) {
      if (out) {
        out.textContent = 'SELFTEST FAIL — ' + e.message + ' | ' + log.join(' | ');
        out.dataset.result = 'fail';
      }
    }
  }
}
