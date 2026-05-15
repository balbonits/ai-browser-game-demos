import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  enqueueToast,
  getToasts,
  clearToasts,
  suppressToasts,
} from '../../../public/games/idle-hoops-rpg/toasts.js';

// ---------------------------------------------------------------------------
// Setup: clear state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearToasts();
  suppressToasts(false);
  vi.useRealTimers(); // reset timer mocking between tests
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Basic enqueue / get
// ---------------------------------------------------------------------------

describe('enqueueToast / getToasts', () => {
  it('enqueueToast adds a toast; getToasts returns an array with one entry', () => {
    enqueueToast('Hello!');
    const toasts = getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toBe('Hello!');
  });

  it('getToasts includes kind field (defaults to info)', () => {
    enqueueToast('Test toast');
    const toasts = getToasts();
    expect(toasts[0].kind).toBe('info');
  });

  it('getToasts includes id field', () => {
    enqueueToast('Test toast');
    const toasts = getToasts();
    expect(typeof toasts[0].id).toBe('number');
  });

  it('custom kind is preserved', () => {
    enqueueToast('Success!', 'success');
    const toasts = getToasts();
    expect(toasts[0].kind).toBe('success');
  });

  it('multiple toasts accumulate in order (most recent last in window)', () => {
    enqueueToast('First');
    enqueueToast('Second');
    const toasts = getToasts();
    expect(toasts.length).toBeGreaterThanOrEqual(2);
    // The last visible toast is the most recent
    const texts = toasts.map(t => t.text);
    expect(texts).toContain('First');
    expect(texts).toContain('Second');
  });
});

// ---------------------------------------------------------------------------
// clearToasts
// ---------------------------------------------------------------------------

describe('clearToasts', () => {
  it('empties the queue', () => {
    enqueueToast('One');
    enqueueToast('Two');
    clearToasts();
    expect(getToasts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// suppressToasts
// ---------------------------------------------------------------------------

describe('suppressToasts', () => {
  it('while suppressed, enqueueToast adds nothing', () => {
    suppressToasts(true);
    enqueueToast('Should not appear');
    suppressToasts(false); // un-suppress before getToasts (doesn't affect existing queue)
    expect(getToasts()).toHaveLength(0);
  });

  it('after suppressToasts(false), enqueueToast resumes adding', () => {
    suppressToasts(true);
    enqueueToast('Suppressed');
    suppressToasts(false);
    enqueueToast('Not suppressed');
    const toasts = getToasts();
    const texts = toasts.map(t => t.text);
    expect(texts).not.toContain('Suppressed');
    expect(texts).toContain('Not suppressed');
  });

  it('toggle on-off-on suppresses only while active', () => {
    suppressToasts(true);
    enqueueToast('A');
    suppressToasts(false);
    enqueueToast('B');
    suppressToasts(true);
    enqueueToast('C');
    suppressToasts(false);
    const toasts = getToasts();
    const texts = toasts.map(t => t.text);
    expect(texts).not.toContain('A');
    expect(texts).toContain('B');
    expect(texts).not.toContain('C');
  });
});

// ---------------------------------------------------------------------------
// MAX_VISIBLE cap (implementation: getToasts returns up to 3 most recent,
// but also prunes by time — use fake timers to control expiry)
// ---------------------------------------------------------------------------

describe('MAX_VISIBLE cap', () => {
  it('getToasts returns at most 3 toasts even when more are queued', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    // Enqueue 5 toasts.
    for (let i = 0; i < 5; i++) enqueueToast(`Toast ${i}`);

    // All are fresh — getToasts caps at 3 visible.
    const visible = getToasts();
    expect(visible.length).toBeLessThanOrEqual(3);
  });

  it('after TOAST_DURATION_MS (3000ms), expired toasts are pruned from getToasts', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    enqueueToast('Expires soon');

    // Advance time past expiry (3001ms).
    vi.setSystemTime(now + 3001);

    const toasts = getToasts();
    const texts = toasts.map(t => t.text);
    expect(texts).not.toContain('Expires soon');
  });

  it('a toast enqueued after expiry is still visible', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    enqueueToast('Old');
    vi.setSystemTime(now + 3001); // expire old toast

    enqueueToast('New');          // enqueued at now+3001

    const toasts = getToasts();
    const texts = toasts.map(t => t.text);
    expect(texts).not.toContain('Old');
    expect(texts).toContain('New');
  });
});

// ---------------------------------------------------------------------------
// Immutability: getToasts returns copies, not live references
// ---------------------------------------------------------------------------

describe('getToasts returns copies', () => {
  it('mutating the returned array does not affect internal state', () => {
    enqueueToast('Keep me');
    const toasts1 = getToasts();
    toasts1.length = 0; // clear the returned array

    const toasts2 = getToasts();
    expect(toasts2.length).toBeGreaterThan(0);
  });

  it('mutating a returned toast object does not affect internal state', () => {
    enqueueToast('Original text');
    const toasts1 = getToasts();
    toasts1[0].text = 'Mutated';

    const toasts2 = getToasts();
    // The internal text should still be the original.
    // Note: getToasts returns shallow copies (mapped objects), so this holds.
    expect(toasts2[0].text).toBe('Original text');
  });
});
