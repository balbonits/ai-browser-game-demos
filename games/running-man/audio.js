// Web Audio engine for Running Man.
//
// All sounds are synthesized at runtime — no audio files.
// The AudioContext is lazy-initialized on the first user gesture because
// browsers block audio until then.

const STORAGE_KEY = 'running-man:muted';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    this._musicTimer = null;
    this._musicStep = 0;
  }

  // Call on the first user gesture (click / key / tap).
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(on) {
    this.muted = on;
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
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

  // Schedule a simple envelope-shaped oscillator note.
  _note({
    freq = 440,
    type = 'square',
    dur = 0.1,
    attack = 0.005,
    release = 0.08,
    bend = 0,
    vol = 0.4,
    dest = this.sfxGain,
    when = 0,
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

  _noise({ dur = 0.15, vol = 0.4, cutoff = 800, when = 0 } = {}) {
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
    g.connect(this.sfxGain);
    src.start(t0);
  }

  // --- SFX ---

  start() {
    this._note({ freq: 523, type: 'triangle', dur: 0.09, vol: 0.3 });
    this._note({ freq: 784, type: 'triangle', dur: 0.12, vol: 0.3, when: 0.08 });
  }

  jump() {
    this._note({ freq: 440, type: 'square', dur: 0.1, bend: 240, vol: 0.28 });
  }

  milestone() {
    this._note({ freq: 880, type: 'triangle', dur: 0.08, vol: 0.22 });
    this._note({ freq: 1175, type: 'triangle', dur: 0.12, vol: 0.22, when: 0.08 });
  }

  death() {
    // falling tone
    this._note({
      freq: 380,
      type: 'sawtooth',
      dur: 0.5,
      release: 0.1,
      attack: 0.01,
      bend: -320,
      vol: 0.32,
    });
    // impact burst
    this._noise({ dur: 0.18, vol: 0.35, cutoff: 700 });
    // low thud
    this._note({
      freq: 110,
      type: 'sine',
      dur: 0.15,
      attack: 0.005,
      release: 0.2,
      vol: 0.45,
      when: 0.02,
    });
  }

  // Game-over jingle — a slow descending minor-key cadence that plays after
  // the death thud. Kicks off with a ~0.6 s delay so it doesn't step on the
  // impact SFX, then resolves on a held low tonic.
  deathTune() {
    if (!this.ctx) return;
    // Notes (freq Hz, duration seconds). A minor: A4, G4, E4, A3 held.
    const phrase = [
      { f: 440, d: 0.22 }, // A4
      { f: 392, d: 0.22 }, // G4
      { f: 330, d: 0.22 }, // E4
      { f: 220, d: 0.9  }, // A3 (held)
    ];
    let t = 0.55;
    for (const n of phrase) {
      // Triangle lead
      this._note({
        freq: n.f,
        type: 'triangle',
        dur: n.d * 0.92,
        attack: 0.008,
        release: 0.12,
        vol: 0.32,
        dest: this.sfxGain,
        when: t,
      });
      // Square-wave harmony a third below for weight
      this._note({
        freq: n.f * 0.8, // minor third-ish
        type: 'square',
        dur: n.d * 0.92,
        attack: 0.01,
        release: 0.1,
        vol: 0.14,
        dest: this.sfxGain,
        when: t,
      });
      t += n.d;
    }
  }

  // --- Music ---
  //
  // Simple looping chip-tune phrase: a pentatonic melody with a bass note
  // on every other beat. Driven by setInterval — good enough for a short
  // background loop, not sample-accurate but doesn't need to be.

  startMusic(bpm = 132) {
    if (!this.ctx || this._musicTimer) return;
    const eighth = 60 / bpm / 2; // seconds per eighth note
    // C major pentatonic phrase, 8 eighths:
    const melody = [523, 659, 784, 988, 784, 659, 784, 988];
    const bass = [131, 0, 196, 0, 175, 0, 147, 0];
    this._musicStep = 0;
    const tick = () => {
      const i = this._musicStep % melody.length;
      this._note({
        freq: melody[i],
        type: 'triangle',
        dur: eighth * 0.55,
        attack: 0.004,
        release: 0.03,
        vol: 0.28,
        dest: this.musicGain,
      });
      const b = bass[i];
      if (b) {
        this._note({
          freq: b,
          type: 'square',
          dur: eighth * 0.9,
          attack: 0.005,
          release: 0.04,
          vol: 0.22,
          dest: this.musicGain,
        });
      }
      this._musicStep++;
    };
    tick();
    this._musicTimer = setInterval(tick, eighth * 1000);
  }

  stopMusic(fadeSec = 0.35) {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setTargetAtTime(0, t, fadeSec / 3);
      // Restore volume after fade so next start is audible.
      setTimeout(() => {
        if (this.musicGain) this.musicGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      }, fadeSec * 1000 + 50);
    }
  }
}
