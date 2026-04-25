// Web Audio engine for Maze Runner.
//
// All sounds are synthesized at runtime — no audio files. AudioContext is
// lazy-initialized on the first user gesture (browsers gate audio).
//
// Voice palette:
//   - footstep: soft low-freq tick, one per cell move
//   - bump: dissonant blip when the player walks into a wall
//   - gem pickup: bright ascending chirp
//   - win chime: ascending arpeggio + long pad
//   - start tone: short rising two-note cue

const STORAGE_KEY = 'maze-runner:muted';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === '1';
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
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

  _note({
    freq = 440, type = 'square',
    dur = 0.1, attack = 0.005, release = 0.08,
    bend = 0, vol = 0.3,
    dest = null, when = 0,
  } = {}) {
    if (!this.ctx) return;
    dest = dest ?? this.sfxGain;
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

  _noise({ dur = 0.06, vol = 0.12, cutoff = 800, when = 0 } = {}) {
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

  // Soft tick — one per cell traversed.
  footstep() {
    this._note({ freq: 120, type: 'sine', dur: 0.025, attack: 0.002, release: 0.03, vol: 0.18 });
    this._noise({ dur: 0.03, vol: 0.08, cutoff: 400 });
  }

  // Dissonant blip when walking into a wall.
  bump() {
    this._note({ freq: 180, type: 'square', dur: 0.04, attack: 0.001, release: 0.04, bend: -60, vol: 0.22 });
  }

  // Bright ascending chirp on gem pickup.
  gemPickup() {
    this._note({ freq: 660, type: 'triangle', dur: 0.06, attack: 0.002, release: 0.06, vol: 0.28 });
    this._note({ freq: 880, type: 'triangle', dur: 0.08, attack: 0.002, release: 0.07, vol: 0.26, when: 0.05 });
    this._note({ freq: 1320, type: 'triangle', dur: 0.10, attack: 0.002, release: 0.08, vol: 0.24, when: 0.10 });
  }

  // Short two-note rising cue at run start.
  startTone() {
    this._note({ freq: 440, type: 'triangle', dur: 0.08, attack: 0.005, release: 0.06, vol: 0.28 });
    this._note({ freq: 660, type: 'triangle', dur: 0.12, attack: 0.005, release: 0.08, vol: 0.30, when: 0.08 });
  }

  // Ascending arpeggio + pad on maze completion.
  winChime() {
    const phrase = [523, 659, 784, 1047, 1319];
    let t = 0;
    for (const f of phrase) {
      this._note({ freq: f, type: 'triangle', dur: 0.14, attack: 0.005, release: 0.10, vol: 0.28, when: t });
      t += 0.13;
    }
    // Long held pad note.
    this._note({ freq: 523, type: 'sine', dur: 0.8, attack: 0.02, release: 0.5, vol: 0.20, when: t });
    this._note({ freq: 784, type: 'sine', dur: 0.8, attack: 0.02, release: 0.5, vol: 0.16, when: t });
  }
}
