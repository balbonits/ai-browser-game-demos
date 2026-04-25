# Audio

All audio in this repo is **synthesized at runtime using the Web Audio API**. No audio files are committed — the "AI-built, no external assets" premise extends to sound.

This belongs to the **`dev`** agent, not `artist`. PixelLab (our art provider) doesn't produce audio; there's no external audio service in the loop. If you want a sound, write the code that makes it.

## Why Web Audio, not audio files

- **No binary blobs.** Keeps the repo small and text-diffable.
- **Procedural → infinite variation.** A `.jump()` call can subtly pitch-shift per call without shipping 20 variants.
- **No licensing friction.** Synthesized tones have no upstream rights to track.
- **Size.** A 200-line audio engine is smaller than one mp3.

Tradeoff: chip-tune / beep-and-boop aesthetic. Fine for the kind of demos this repo targets. If a game genuinely needs orchestral scores or voice-over, that's a conversation to have — but the default is synth.

## The `AudioEngine` pattern

Games should structure audio as a small class that owns the `AudioContext` and gain nodes. See [`games/running-man/audio.js`](../games/running-man/audio.js) for the reference implementation.

Key pieces every engine needs:

1. **Lazy init on first gesture.** Browsers suspend `AudioContext` until the user interacts. Call `audio.init()` + `audio.resume()` from your `keydown` / `pointerdown` handlers, not on page load.
2. **Master + sub-mixers.** One `GainNode` per logical channel (`master`, `musicGain`, `sfxGain`). Makes muting, ducking, and per-channel volume trivial.
3. **Mute persisted in `localStorage`.** Respect it across page loads. Store under `<slug>:muted`.
4. **Envelope-shaped notes.** Don't play raw oscillators — always wrap in a `GainNode` with attack / release so they don't click. A `_note({ freq, type, dur, attack, release, bend, vol })` helper covers 90% of cases.

## SFX examples

A minimal vocabulary that fits most games:

| Sound | Flavor |
| --- | --- |
| `start()` | Two quick triangle notes ascending (C → G). |
| `jump()` | A single square-wave beep with an upward pitch bend. |
| `milestone()` | Two triangle notes a fifth apart (A5 → D6-ish). |
| `death()` | Sawtooth pitch-drop + short filtered-noise impact + low sine thud. |

Use `triangle` for melodic, `square` for arcade beeps, `sawtooth` for harsh / death, `sine` for deep thumps. Noise bursts = short `AudioBuffer` filled with `Math.random() * 2 - 1`, optionally routed through a `BiquadFilter`.

## Music

For background music, a simple scheduler driven by `setInterval` works fine for loops up to a few bars. Sample-accurate scheduling (using `AudioBufferSourceNode` start times) is only worth the extra code for rhythm-critical games.

Running Man's music: C major pentatonic phrase in triangle wave, with a square-wave bass on every other eighth. BPM around 132. Loops forever until `stopMusic()`. Running tempo matches the obstacle spawn rhythm loosely — intentionally, not tightly.

**Fade out, don't cut.** On state changes (death, pause, menu), call `stopMusic()` with a short `setTargetAtTime` fade on the music gain. Cutting abruptly pops.

## Mute toggle convention

Every game with audio should have:

- A visible mute button in the HUD (🔊 / 🔇 emoji is fine).
- An `M` keyboard shortcut.
- Mute state persisted per-game in `localStorage` as `<slug>:muted`.
- The toggle must work before the first gesture (i.e. first click on the mute button itself is also the audio-unlock gesture).

## Common gotchas

- **Silent on first load.** Forgot to `init()` on the first gesture. Fix: `handleAction()` calls `audio.init()` / `audio.resume()` before anything else.
- **Safari's autoplay rules.** Same as the above — any gesture is fine, but it has to be a real user gesture, not `setTimeout` or an async resolution.
- **Clicks/pops on stopped notes.** Forgot the release envelope. Always ramp gain down before stopping an oscillator.
- **Mobile volume.** iOS respects the ring/silent switch for Web Audio unless you set `<audio playsinline>` somewhere — not applicable to pure Web Audio but worth noting if the game ever loads sample files.

## What NOT to do

- Don't commit `.mp3` / `.wav` / `.ogg` assets. If you think you need to, raise it as a conversation — the default is synth.
- Don't route all sounds directly to `audio.ctx.destination`. Always go through `sfxGain` or `musicGain` so the master mute / sub-mixers can apply.
- Don't create a new `AudioContext` per sound. One per game, ever.
- Don't bundle in Tone.js or similar libraries. The API is small enough that a direct use of Web Audio is cleaner than another dependency (and dependencies are off-limits anyway).
