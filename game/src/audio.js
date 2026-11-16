// audio.js — all sound is synthesized with WebAudio. No audio files.
// Engine hum follows speed, skid is filtered noise, the rest are blips.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.skidGain = null;
    this.muted = false;
  }

  // Call from a user gesture (key/click). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 900;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 70;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 35;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.4;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(g2);
      g2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();

      // looping noise buffer for skids
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1100;
      band.Q.value = 1.2;
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      noise.connect(band);
      band.connect(this.skidGain);
      this.skidGain.connect(this.master);
      noise.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setEngine(speedPercent, boosting, racing) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const freq = 62 + speedPercent * 235 + (boosting ? 55 : 0);
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(500 + speedPercent * 2400, t, 0.1);
    this.engineGain.gain.setTargetAtTime(racing ? 0.055 + speedPercent * 0.075 : 0, t, 0.1);
  }

  setSkid(amount) {
    if (!this.ctx || !this.skidGain) return;
    this.skidGain.gain.setTargetAtTime(Math.max(0, Math.min(0.16, amount)), this.ctx.currentTime, 0.08);
  }

  blip(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  countdown(final) {
    this.blip(final ? 880 : 440, final ? 0.35 : 0.16, 'square', 0.2);
  }

  checkpoint() {
    this.blip(660, 0.12, 'sine', 0.28);
    this.blip(990, 0.2, 'sine', 0.28, 0.1);
  }

  bump() {
    this.blip(110, 0.22, 'sawtooth', 0.3);
  }

  finish() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.28, i * 0.13));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
