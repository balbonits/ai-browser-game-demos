// Web Audio SFX, synthesized in code. No samples, no fetch.
//
// Public API:
//   audio.init()              — lazy-create AudioContext on first user gesture.
//   audio.setMuted(bool)      — toggle SFX globally.
//   audio.isMuted()           — current mute state.
//   audio.stretch(t01)        — slingshot creak; t01 in [0,1] = how stretched.
//   audio.stretchEnd()        — stop the stretch tone.
//   audio.release()           — slingshot snap on launch.
//   audio.thud(intensity01)   — collision; intensity scales volume + pitch.
//   audio.oink()              — pig defeat.
//   audio.win() / audio.lose()— end-of-level jingle.

let ctx = null;
let muted = false;
let masterGain = null;

let stretchOsc = null;
let stretchGain = null;

function ensureCtx() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.7;
  masterGain.connect(ctx.destination);
  return ctx;
}

function tone({ freq = 440, dur = 0.15, type = 'sine', vol = 0.2, attack = 0.005, release = 0.08 }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.02);
}

function noiseBurst({ dur = 0.1, vol = 0.25, lowpass = 1200, highpass = 0 } = {}) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime;
  const sampleCount = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowpass;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = highpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hp).connect(lp).connect(g).connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const audio = {
  init() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); },

  setMuted(m) {
    muted = !!m;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.7;
    if (muted && stretchOsc) this.stretchEnd();
  },
  isMuted() { return muted; },

  stretch(t01) {
    if (!ensureCtx() || muted) return;
    const t = Math.max(0, Math.min(1, t01));
    if (!stretchOsc) {
      stretchOsc = ctx.createOscillator();
      stretchGain = ctx.createGain();
      stretchOsc.type = 'sawtooth';
      stretchOsc.frequency.value = 110;
      stretchGain.gain.value = 0;
      stretchOsc.connect(stretchGain).connect(masterGain);
      stretchOsc.start();
    }
    const now = ctx.currentTime;
    stretchOsc.frequency.linearRampToValueAtTime(110 + t * 180, now + 0.05);
    stretchGain.gain.linearRampToValueAtTime(0.04 + t * 0.06, now + 0.05);
  },
  stretchEnd() {
    if (!stretchOsc || !ctx) return;
    const now = ctx.currentTime;
    stretchGain.gain.cancelScheduledValues(now);
    stretchGain.gain.setValueAtTime(stretchGain.gain.value, now);
    stretchGain.gain.linearRampToValueAtTime(0, now + 0.04);
    stretchOsc.stop(now + 0.06);
    stretchOsc = null;
    stretchGain = null;
  },

  release() {
    this.stretchEnd();
    noiseBurst({ dur: 0.08, vol: 0.18, lowpass: 4000, highpass: 600 });
    tone({ freq: 720, dur: 0.06, type: 'triangle', vol: 0.18 });
  },

  thud(intensity01 = 0.5) {
    const t = Math.max(0.1, Math.min(1, intensity01));
    noiseBurst({ dur: 0.05 + t * 0.08, vol: 0.12 + t * 0.18, lowpass: 600 + t * 600 });
    tone({ freq: 90 + t * 70, dur: 0.07, type: 'sine', vol: 0.10 + t * 0.10 });
  },

  oink() {
    if (!ensureCtx() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.18);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  },

  win() {
    if (muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.18 }), i * 110);
    });
  },

  lose() {
    if (muted) return;
    const notes = [392.0, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      setTimeout(() => tone({ freq: f, dur: 0.22, type: 'sawtooth', vol: 0.14 }), i * 140);
    });
  },
};
