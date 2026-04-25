// Web Audio engine for Neon Tower Defense.
//
// All sounds are synthesized at runtime — no audio files. AudioContext is
// lazy-initialized on the first user gesture (browsers gate audio).
//
// Voice palette:
//   - Tower fires: short blips with sharp envelopes, distinct timbres
//                  per tower so the player can tell what's firing.
//   - Enemy hits/kills: brief noise + pitched chirp.
//   - Wave start: rising chord stab.
//   - Lose life: descending alert.
//   - Victory / defeat: longer cadences.
//   - Music: looped ambient triangle pad + a short pentatonic lead.

import { STORAGE } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem(STORAGE.MUTED) === '1';
    this._musicTimer = null;
    this._musicStep = 0;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(on) {
    this.muted = on;
    localStorage.setItem(STORAGE.MUTED, on ? '1' : '0');
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0 : 1, t, 0.04);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _note({
    freq = 440, type = 'square',
    dur = 0.1, attack = 0.005, release = 0.08,
    bend = 0, vol = 0.4,
    dest = this.sfxGain, when = 0,
  } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (bend !== 0) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq + bend),
        t0 + dur,
      );
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.05);
  }

  _noise({ dur = 0.12, vol = 0.3, cutoff = 1200, when = 0, dest = this.sfxGain } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const samples = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
  }

  // --- Tower fire SFX ---

  fireBolt() {
    this._note({ freq: 980, type: 'square', dur: 0.04, attack: 0.001, release: 0.04, bend: 240, vol: 0.16 });
  }

  firePulse() {
    this._note({ freq: 220, type: 'sawtooth', dur: 0.08, attack: 0.002, release: 0.06, bend: -60, vol: 0.20 });
    this._noise({ dur: 0.08, vol: 0.10, cutoff: 600 });
  }

  fireSpike() {
    this._note({ freq: 1450, type: 'square', dur: 0.05, attack: 0.001, release: 0.03, bend: -800, vol: 0.20 });
  }

  // --- Combat feedback ---

  enemyHit() {
    this._note({ freq: 320, type: 'square', dur: 0.03, attack: 0.001, release: 0.02, vol: 0.10 });
  }

  enemyKill() {
    this._note({ freq: 520, type: 'triangle', dur: 0.08, attack: 0.002, release: 0.06, bend: -200, vol: 0.18 });
    this._noise({ dur: 0.06, vol: 0.10, cutoff: 1800 });
  }

  bossKill() {
    // Bigger pop for the boss.
    this._note({ freq: 320, type: 'sawtooth', dur: 0.5, attack: 0.005, release: 0.2, bend: -240, vol: 0.30 });
    this._noise({ dur: 0.3, vol: 0.22, cutoff: 800 });
    this._note({ freq: 110, type: 'sine', dur: 0.4, attack: 0.005, release: 0.3, vol: 0.40 });
  }

  // --- Game-flow cues ---

  build() {
    this._note({ freq: 660, type: 'triangle', dur: 0.07, vol: 0.18 });
    this._note({ freq: 880, type: 'triangle', dur: 0.10, vol: 0.18, when: 0.06 });
  }

  upgrade() {
    this._note({ freq: 660, type: 'triangle', dur: 0.06, vol: 0.16 });
    this._note({ freq: 880, type: 'triangle', dur: 0.06, vol: 0.16, when: 0.05 });
    this._note({ freq: 1175, type: 'triangle', dur: 0.10, vol: 0.18, when: 0.10 });
  }

  sell() {
    this._note({ freq: 520, type: 'square', dur: 0.05, vol: 0.12 });
    this._note({ freq: 392, type: 'square', dur: 0.08, vol: 0.12, when: 0.04 });
  }

  invalid() {
    this._note({ freq: 200, type: 'square', dur: 0.06, vol: 0.12, bend: -50 });
  }

  waveStart() {
    this._note({ freq: 392, type: 'triangle', dur: 0.10, vol: 0.22 });
    this._note({ freq: 523, type: 'triangle', dur: 0.10, vol: 0.22, when: 0.06 });
    this._note({ freq: 659, type: 'triangle', dur: 0.18, vol: 0.24, when: 0.12 });
  }

  waveClear() {
    this._note({ freq: 659, type: 'triangle', dur: 0.10, vol: 0.20 });
    this._note({ freq: 784, type: 'triangle', dur: 0.10, vol: 0.20, when: 0.07 });
    this._note({ freq: 988, type: 'triangle', dur: 0.18, vol: 0.22, when: 0.14 });
  }

  loseLife() {
    this._note({ freq: 540, type: 'square', dur: 0.10, attack: 0.002, release: 0.06, bend: -180, vol: 0.22 });
  }

  victory() {
    // Ascending major arpeggio + triumphant pad.
    const phrase = [523, 659, 784, 1047];
    let t = 0;
    for (const f of phrase) {
      this._note({ freq: f, type: 'triangle', dur: 0.18, vol: 0.30, when: t });
      this._note({ freq: f / 2, type: 'square', dur: 0.18, vol: 0.16, when: t });
      t += 0.18;
    }
    this._note({ freq: 1047, type: 'triangle', dur: 0.6, attack: 0.01, release: 0.4, vol: 0.30, when: 0.7 });
  }

  defeat() {
    // Slow descending minor sweep.
    const phrase = [{ f: 440, d: 0.25 }, { f: 392, d: 0.25 }, { f: 330, d: 0.30 }, { f: 220, d: 0.9 }];
    let t = 0;
    for (const n of phrase) {
      this._note({ freq: n.f, type: 'sawtooth', dur: n.d * 0.92, attack: 0.01, release: 0.1, vol: 0.30, when: t });
      this._note({ freq: n.f * 0.5, type: 'square', dur: n.d * 0.92, vol: 0.14, when: t });
      t += n.d;
    }
  }

  // --- Music ---
  //
  // A 16-step ambient phrase. Triangle pad on long held notes, plus a
  // short square-wave bass arpeggio every 4 steps. The phrase is in A
  // minor pentatonic; loops indefinitely until stopMusic() is called.

  startMusic(bpm = 96) {
    if (!this.ctx || this._musicTimer) return;
    const eighth = 60 / bpm / 2;
    const lead = [
      // bar 1: A C E A   (held / rest)
      440, 0, 523, 0, 659, 0, 880, 0,
      // bar 2: G E D A
      784, 0, 659, 0, 587, 0, 440, 0,
    ];
    const bass = [
      110, 0, 0, 0, 165, 0, 0, 0,
      147, 0, 0, 0, 110, 0, 0, 0,
    ];
    const pad = [
      220, 0, 0, 0, 0, 0, 0, 0,
      196, 0, 0, 0, 0, 0, 0, 0,
    ];
    this._musicStep = 0;
    const tick = () => {
      const i = this._musicStep % lead.length;
      const f = lead[i];
      if (f) {
        this._note({
          freq: f, type: 'triangle',
          dur: eighth * 0.55, attack: 0.005, release: 0.08,
          vol: 0.18, dest: this.musicGain,
        });
      }
      const bf = bass[i];
      if (bf) {
        this._note({
          freq: bf, type: 'square',
          dur: eighth * 0.85, attack: 0.005, release: 0.04,
          vol: 0.16, dest: this.musicGain,
        });
      }
      const pf = pad[i];
      if (pf) {
        // Long pad note.
        this._note({
          freq: pf, type: 'triangle',
          dur: eighth * 7, attack: 0.06, release: 0.5,
          vol: 0.10, dest: this.musicGain,
        });
        this._note({
          freq: pf * 1.5, type: 'sine',
          dur: eighth * 7, attack: 0.06, release: 0.5,
          vol: 0.06, dest: this.musicGain,
        });
      }
      this._musicStep++;
    };
    tick();
    this._musicTimer = setInterval(tick, eighth * 1000);
  }

  stopMusic(fadeSec = 0.4) {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setTargetAtTime(0, t, fadeSec / 3);
      setTimeout(() => {
        if (this.musicGain) this.musicGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      }, fadeSec * 1000 + 50);
    }
  }
}
