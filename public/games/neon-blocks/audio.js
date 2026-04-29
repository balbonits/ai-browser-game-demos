// Neon Blocks — layered synth engine.
//
// All sound is synthesized via Web Audio API — no audio files.
// AudioContext is lazy-initialized on the first user gesture.
//
// Music: A-minor pentatonic, layered by level. Single scheduler tick
// that gates which layers emit per beat. Fades in/out on pause/resume.
//
// SFX palette:
//   move      — tick (square, short)
//   rotate    — chirp (triangle, pitched up)
//   softDrop  — light tick
//   hardDrop  — thud (sine + noise)
//   lock      — lower thud
//   lineSingle — chime (triangle)
//   tetris    — 4-note ascending arpeggio
//   tspin     — high triangle cluster
//   tspinMini — short cluster
//   levelUp   — rising chord
//   gameOver  — descending sawtooth phrase
//   hold      — low pop

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
    this._currentLevel = 1;
    this._currentBPM = 96;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
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

  // --- Internal note/noise primitives ---

  _note({
    freq = 440, type = 'square',
    dur = 0.1, attack = 0.005, release = 0.08,
    bend = 0, vol = 0.35,
    dest = null, when = 0,
  } = {}) {
    if (!this.ctx) return;
    const d = dest || this.sfxGain;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (bend !== 0) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq + bend), t0 + dur
      );
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g);
    g.connect(d);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.05);
  }

  _noise({ dur = 0.12, vol = 0.25, cutoff = 1000, when = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const d = dest || this.sfxGain;
    const t0 = this.ctx.currentTime + when;
    const samples = Math.max(1, Math.floor(this.ctx.sampleRate * (dur + 0.05)));
    const buf = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(d);
    src.start(t0);
  }

  // --- SFX ---

  move() {
    this._note({ freq: 660, type: 'square', dur: 0.02, attack: 0.001, release: 0.015, vol: 0.10 });
  }

  rotate() {
    this._note({ freq: 880, type: 'triangle', dur: 0.04, attack: 0.001, release: 0.03, bend: 120, vol: 0.14 });
  }

  softDrop() {
    this._note({ freq: 440, type: 'square', dur: 0.015, attack: 0.001, release: 0.01, vol: 0.08 });
  }

  hardDrop() {
    this._note({ freq: 110, type: 'sine', dur: 0.08, attack: 0.002, release: 0.06, vol: 0.28 });
    this._noise({ dur: 0.06, vol: 0.18, cutoff: 800 });
  }

  lock() {
    this._note({ freq: 180, type: 'square', dur: 0.07, attack: 0.002, release: 0.06, vol: 0.22 });
    this._noise({ dur: 0.04, vol: 0.10, cutoff: 600 });
  }

  lineSingle() {
    this._note({ freq: 880, type: 'triangle', dur: 0.12, attack: 0.003, release: 0.10, vol: 0.22 });
    this._note({ freq: 1109, type: 'triangle', dur: 0.08, attack: 0.003, release: 0.06, vol: 0.16, when: 0.06 });
  }

  lineDouble() {
    this._note({ freq: 880, type: 'triangle', dur: 0.10, attack: 0.002, release: 0.08, vol: 0.22 });
    this._note({ freq: 1109, type: 'triangle', dur: 0.10, attack: 0.002, release: 0.08, vol: 0.20, when: 0.06 });
    this._note({ freq: 1318, type: 'triangle', dur: 0.12, attack: 0.002, release: 0.10, vol: 0.22, when: 0.12 });
  }

  lineTriple() {
    const freqs = [880, 1109, 1318, 1568];
    for (let i = 0; i < freqs.length; i++) {
      this._note({ freq: freqs[i], type: 'triangle', dur: 0.10, attack: 0.002, release: 0.08, vol: 0.20, when: i * 0.05 });
    }
  }

  tetris() {
    // 4-note ascending arpeggio — the triumph sound.
    const freqs = [880, 1109, 1318, 1760];
    for (let i = 0; i < freqs.length; i++) {
      this._note({ freq: freqs[i], type: 'triangle', dur: 0.14, attack: 0.003, release: 0.10, vol: 0.26, when: i * 0.07 });
      this._note({ freq: freqs[i] / 2, type: 'square', dur: 0.14, vol: 0.12, when: i * 0.07 });
    }
  }

  tspin() {
    // High triangle cluster.
    const freqs = [1760, 2093, 2349, 2637];
    for (let i = 0; i < freqs.length; i++) {
      this._note({ freq: freqs[i], type: 'triangle', dur: 0.08, attack: 0.001, release: 0.06, vol: 0.18, when: i * 0.025 });
    }
  }

  tspinMini() {
    this._note({ freq: 1318, type: 'triangle', dur: 0.08, attack: 0.002, release: 0.06, vol: 0.18 });
    this._note({ freq: 1760, type: 'triangle', dur: 0.07, attack: 0.002, release: 0.05, vol: 0.15, when: 0.04 });
  }

  levelUp() {
    const freqs = [523, 659, 784, 1047, 1319];
    for (let i = 0; i < freqs.length; i++) {
      this._note({ freq: freqs[i], type: 'triangle', dur: 0.12, attack: 0.003, release: 0.08, vol: 0.22, when: i * 0.06 });
    }
  }

  gameOver() {
    const phrase = [
      { f: 440, d: 0.22 }, { f: 392, d: 0.22 }, { f: 330, d: 0.28 },
      { f: 294, d: 0.28 }, { f: 220, d: 0.80 },
    ];
    let t = 0;
    for (const n of phrase) {
      this._note({ freq: n.f, type: 'sawtooth', dur: n.d * 0.90, attack: 0.01, release: 0.12, vol: 0.28, when: t });
      this._note({ freq: n.f * 0.5, type: 'square', dur: n.d * 0.90, vol: 0.14, when: t });
      t += n.d;
    }
  }

  hold() {
    this._note({ freq: 220, type: 'triangle', dur: 0.07, attack: 0.002, release: 0.05, vol: 0.18 });
  }

  perfectClear() {
    // Bright ascending arpeggio — same vocabulary as tetris() but higher and wider.
    const freqs = [523, 784, 1047, 1319, 1568, 2093];
    for (let i = 0; i < freqs.length; i++) {
      this._note({ freq: freqs[i], type: 'triangle', dur: 0.16, attack: 0.003, release: 0.12, vol: 0.28, when: i * 0.07 });
      if (i < 3) {
        this._note({ freq: freqs[i] / 2, type: 'square', dur: 0.14, vol: 0.10, when: i * 0.07 });
      }
    }
    // Trailing shimmer.
    this._note({ freq: 2637, type: 'triangle', dur: 0.30, attack: 0.01, release: 0.25, vol: 0.18, when: 0.42 });
  }

  // --- Music ---
  //
  // Layered A-minor pentatonic. All layers share one scheduler interval.
  // Level gates which layers fire per beat.
  //
  // Layer 0 (L1+):  square-wave bass, root + fifth, half-note pulse.
  // Layer 1 (L3+):  triangle melody — 4-bar phrase.
  // Layer 2 (L5+):  square arpeggio, 16th notes through chord tones.
  // Layer 3 (L8+):  filtered noise hat on off-beat 8ths.
  // BPM ratchets: L13 → 120, L17 → 140.

  startMusic(level = 1) {
    if (!this.ctx) return;
    this._currentLevel = level;
    this._currentBPM = this._bpmForLevel(level);
    this._musicStep = 0;

    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }

    // Fade music gain in.
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(0.18, t, 0.2);

    const eighth = 60 / this._currentBPM / 2;
    this._scheduleTick(eighth);
    this._musicTimer = setInterval(() => this._scheduleTick(eighth), eighth * 1000);
  }

  _bpmForLevel(level) {
    if (level >= 17) return 140;
    if (level >= 13) return 120;
    return 96;
  }

  // Called when level changes mid-game — restarts music at new BPM.
  setMusicLevel(level) {
    if (!this.ctx || !this._musicTimer) return;
    const newBPM = this._bpmForLevel(level);
    if (newBPM !== this._currentBPM || level !== this._currentLevel) {
      this._currentLevel = level;
      if (newBPM !== this._currentBPM) {
        this._currentBPM = newBPM;
        clearInterval(this._musicTimer);
        this._musicTimer = null;
        const eighth = 60 / this._currentBPM / 2;
        this._scheduleTick(eighth);
        this._musicTimer = setInterval(() => this._scheduleTick(eighth), eighth * 1000);
      } else {
        this._currentLevel = level;
      }
    }
  }

  _scheduleTick(eighth) {
    const step = this._musicStep;
    const level = this._currentLevel;
    const d = this.musicGain;

    // A-minor pentatonic: A2=110, E3=165, A3=220, C4=262, E4=330, G4=392,
    //                      A4=440, C5=524, E5=659, G5=784, A5=880.
    // Bass notes: A2(110), E3(165). Pattern: half-note pulse.
    const bassPattern = [110, 0, 165, 0, 110, 0, 110, 0, 0,0,165,0,110,0,0,0];
    // Melody 4-bar phrase (16 steps = 2 bars of 8th notes at this resolution).
    const melodyPattern = [
      440, 0, 524, 0, 659, 0, 524, 0,  // bar 1: A4 C5 E5 C5
      659, 0, 784, 0, 880, 0, 784, 0,  // bar 2: E5 G5 A5 G5
      659, 0, 524, 0, 440, 0, 392, 0,  // bar 3: E5 C5 A4 G4
      392, 0, 440, 0, 524, 0, 659, 0,  // bar 4: G4 A4 C5 E5
    ];
    const arpPattern = [440, 524, 659, 784, 880, 784, 659, 524]; // 8-step arp
    const i = step % 32; // melody repeats every 32 steps

    // Layer 0: Bass (L1+).
    const bf = bassPattern[step % bassPattern.length];
    if (bf) {
      this._note({
        freq: bf, type: 'square',
        dur: eighth * 1.6, attack: 0.01, release: 0.08,
        vol: 0.14, dest: d,
      });
    }

    // Layer 1: Melody (L3+).
    if (level >= 3) {
      const mf = melodyPattern[i];
      if (mf) {
        this._note({
          freq: mf, type: 'triangle',
          dur: eighth * 0.7, attack: 0.006, release: 0.10,
          vol: 0.16, dest: d,
        });
      }
    }

    // Layer 2: Arp (L5+, 16th notes — fire on every step).
    if (level >= 5) {
      const af = arpPattern[step % arpPattern.length];
      this._note({
        freq: af * 2, type: 'square',
        dur: eighth * 0.35, attack: 0.001, release: 0.04,
        vol: 0.07, dest: d,
      });
    }

    // Layer 3: Noise hat on off-beat 8ths (L8+, step is odd).
    if (level >= 8 && step % 2 === 1) {
      this._noise({ dur: 0.04, vol: 0.06, cutoff: 4000, dest: d });
    }

    this._musicStep++;
  }

  pauseMusic(fadeSec = 0.25) {
    if (!this.musicGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(0, t, fadeSec / 3);
  }

  resumeMusic(fadeSec = 0.3) {
    if (!this.musicGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(0.18, t, fadeSec / 3);
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
    }
    this._musicStep = 0;
  }
}
