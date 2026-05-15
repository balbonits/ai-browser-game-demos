// Toast notification queue — non-modal feedback for in-game events.
// Decoupled from main render; manages its own DOM container.

const TOAST_DURATION_MS = 3000;
const MAX_VISIBLE = 3;

let _queue = [];        // { id, text, kind, expiresAt }
let _suppressed = false;
let _nextId = 0;
let _renderContainer = null;
let _renderIntervalId = null;

/**
 * Enable or disable toast suppression.
 * While suppressed, enqueueToast is a no-op.
 * Used during offline catch-up to avoid flooding.
 * @param {boolean} flag
 */
export function suppressToasts(flag) {
  _suppressed = flag;
}

/**
 * Add a toast to the queue.
 * @param {string} text
 * @param {'info'|'success'|'gold'} [kind='info']
 */
export function enqueueToast(text, kind = 'info') {
  if (_suppressed) return;
  _queue.push({
    id: _nextId++,
    text,
    kind,
    expiresAt: Date.now() + TOAST_DURATION_MS,
  });
}

/**
 * Prune expired toasts and return up to MAX_VISIBLE current ones.
 * @returns {Array<{ id, text, kind }>}
 */
export function getToasts() {
  const now = Date.now();
  _queue = _queue.filter(t => t.expiresAt > now);
  return _queue.slice(-MAX_VISIBLE).map(t => ({ id: t.id, text: t.text, kind: t.kind }));
}

/**
 * Clear all toasts from the queue. Used by tests.
 */
export function clearToasts() {
  _queue = [];
}

/**
 * Render toasts into a container element.
 * Idempotent — safe to call every frame with the same container.
 * Sets up a pruning interval if not already running.
 * @param {HTMLElement} container
 */
export function renderToasts(container) {
  if (!container) return;
  _renderContainer = container;

  // Start prune-and-redraw interval once.
  if (!_renderIntervalId) {
    _renderIntervalId = setInterval(() => {
      if (_renderContainer) _drawToasts(_renderContainer);
    }, 500);
  }

  _drawToasts(container);
}

function _drawToasts(container) {
  const visible = getToasts();

  // Build a keyed set of existing toast elements to minimise DOM churn.
  const existing = {};
  for (const child of Array.from(container.children)) {
    existing[child.dataset.toastId] = child;
  }

  const newIds = new Set(visible.map(t => String(t.id)));

  // Remove stale children.
  for (const [id, node] of Object.entries(existing)) {
    if (!newIds.has(id)) container.removeChild(node);
  }

  // Append new toasts (in order).
  for (const toast of visible) {
    const sid = String(toast.id);
    if (!existing[sid]) {
      const div = document.createElement('div');
      div.className = `toast ${toast.kind}`;
      div.dataset.toastId = sid;
      div.textContent = toast.text;
      container.appendChild(div);
    }
  }
}
