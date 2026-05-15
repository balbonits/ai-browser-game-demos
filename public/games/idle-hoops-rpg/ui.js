// DOM UI — single render(state) function that rebuilds from state.
// Uses only vanilla DOM APIs; no frameworks.

import { UPGRADES, MAX_UPGRADE_LEVEL, costFor } from './upgrades.js';
import { ACHIEVEMENTS } from './achievements.js';
import { computeMultipliers } from './multipliers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'textContent') e.textContent = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (!child) continue;
    if (typeof child === 'string') e.appendChild(document.createTextNode(child));
    else e.appendChild(child);
  }
  return e;
}

function xpBar(player) {
  const needed = 500 + player.level * 200;
  const pct = Math.min(100, Math.round((player.xp / needed) * 100));
  return el('div', { className: 'xp-bar-wrap' },
    el('div', { className: 'xp-bar-fill', style: `width:${pct}%` }),
  );
}

// Stat badge — kept for player detail modal.
function statBadge(label, value) {
  return el('span', { className: 'stat-badge' },
    el('span', { className: 'stat-label', textContent: label }),
    el('span', { className: 'stat-val', textContent: value }),
  );
}

// Graphical stat bar row for player cards.
function statBar(label, value) {
  const pct = Math.round((value / 99) * 100);
  return el('div', { className: 'stat-bar-row' },
    el('span', { className: 'stat-bar-label', textContent: label }),
    el('div', { className: 'stat-bar' },
      el('div', { className: 'stat-bar-fill', style: `width:${pct}%` }),
    ),
    el('span', { className: 'stat-bar-val', textContent: value }),
  );
}

// ---------------------------------------------------------------------------
// State refs (set by mount())
// ---------------------------------------------------------------------------

let _state = null;
let _callbacks = {};
let _activeTab = 'roster';
let _welcomeBackData = null;
let _showResetConfirm = false;
let _playerDetailIdx = null;

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Mount the UI into the given container element.
 * @param {HTMLElement} container
 * @param {object} callbacks - { onReset, onCopySettings, onImport, onPause, onBuyUpgrade }
 */
export function mount(container, callbacks) {
  _callbacks = callbacks;
  _container = container;
}

let _container = null;

/**
 * Show the welcome-back modal after offline catch-up.
 * @param {{ ticks, wins, losses, money, rings, levelUps }} data
 */
export function showWelcomeBack(data) {
  _welcomeBackData = data;
}

/**
 * Idempotently re-render the entire UI from state.
 * Called after every state mutation.
 * @param {object} state - full SaveState
 * @param {object} uiOpts - { paused, tickMs, saveString }
 */
export function render(state, uiOpts = {}) {
  _state = state;
  if (!_container) return;

  _container.innerHTML = '';

  // If state is null (corrupt / first boot before state is ready), show nothing.
  if (!state) return;

  const root = el('div', { className: 'app' },
    renderHeader(state, uiOpts),
    renderTabs(state, uiOpts),
    renderTabContent(state, uiOpts),
  );

  _container.appendChild(root);

  // Modals (on top).
  if (_welcomeBackData) {
    _container.appendChild(renderWelcomeBackModal(_welcomeBackData));
  }
  if (_showResetConfirm) {
    _container.appendChild(renderResetConfirmModal());
  }
  if (_playerDetailIdx !== null && state.roster[_playerDetailIdx]) {
    _container.appendChild(renderPlayerDetailModal(state.roster[_playerDetailIdx], _playerDetailIdx));
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function renderHeader(state, { paused, tickMs }) {
  const s = state.season;
  const phaseLabel = s.phase === 'regular'
    ? `Day ${s.day + 1} — Regular Season`
    : s.phase === 'playoffs'
      ? `Day ${s.day + 1} — Playoffs (R${s.playoff?.round ?? 1})`
      : 'Off-Season';

  const pauseLabel = paused ? 'Resume' : 'Pause';

  return el('header', { className: 'header' },
    el('div', { className: 'header-top' },
      el('div', { className: 'team-name' }, '🏀 ', el('span', { textContent: state.team.name })),
      el('div', { className: 'record' }, `${s.wins} - ${s.losses}`),
    ),
    el('div', { className: 'header-badges' },
      el('span', { className: 'badge' }, '💰 $', el('span', { textContent: fmtMoney(state.team.money) })),
      el('span', { className: 'badge' }, '🎟️ ', el('span', { textContent: fmtFans(state.team.fans) })),
      el('span', { className: 'badge' }, '🏆 ', el('span', { textContent: state.team.rings })),
    ),
    el('div', { className: 'header-status' },
      el('span', { className: 'phase-pill', textContent: phaseLabel }),
      el('button', {
        className: 'btn btn-ghost',
        textContent: pauseLabel,
        onClick: () => _callbacks.onPause?.(),
      }),
    ),
  );
}

function fmtMoney(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function fmtFans(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'roster',      label: 'Roster' },
  { id: 'schedule',    label: 'Schedule' },
  { id: 'standings',   label: 'Standings' },
  { id: 'shop',        label: 'Shop' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'offseason',   label: 'Off-Season' },
  { id: 'settings',    label: 'Settings' },
];

function renderTabs(state) {
  return el('nav', { className: 'tab-bar' },
    ...TABS.map(t => {
      const disabled = t.id === 'offseason' && state.season.phase !== 'offseason';
      return el('button', {
        className: `tab-btn${_activeTab === t.id ? ' active' : ''}${disabled ? ' disabled' : ''}`,
        textContent: t.label,
        disabled: disabled ? 'disabled' : undefined,
        onClick: () => {
          if (!disabled) { _activeTab = t.id; render(_state, {}); }
        },
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function renderTabContent(state, opts) {
  switch (_activeTab) {
    case 'roster':       return renderRoster(state);
    case 'schedule':     return renderSchedule(state);
    case 'standings':    return renderStandings(state);
    case 'shop':         return renderShop(state);
    case 'achievements': return renderAchievements(state);
    case 'offseason':    return renderOffseason(state);
    case 'settings':     return renderSettings(state, opts);
    default:             return renderRoster(state);
  }
}

// --- Roster tab ---

function renderRoster(state) {
  const mult = computeMultipliers(state);
  const moneyX = mult.money.toFixed(2);
  const xpX    = mult.xp.toFixed(2);

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Roster' }),
    el('div', { className: 'team-boost-pill' },
      `💰 ×${moneyX}  •  ⭐ ×${xpX}`,
    ),
    el('div', { className: 'player-grid' },
      ...state.roster.map((p, i) => renderPlayerCard(p, i)),
    ),
  );
}

function renderPlayerCard(player, idx) {
  return el('div', {
    className: 'player-card',
    onClick: () => { _playerDetailIdx = idx; render(_state, {}); },
  },
    el('div', { className: 'player-header' },
      el('span', { className: 'player-emoji', textContent: player.emoji }),
      el('div', { className: 'player-info' },
        el('span', { className: 'player-name', textContent: player.name }),
        el('span', { className: 'player-pos-pill', textContent: player.position }),
      ),
      el('div', { className: 'player-level', textContent: `Lv.${player.level}` }),
    ),
    xpBar(player),
    el('div', { className: 'player-stats player-stats-bars' },
      statBar('SHT', player.stats.shooting),
      statBar('DEF', player.stats.defense),
      statBar('ATH', player.stats.athleticism),
      statBar('IQ',  player.stats.iq),
    ),
  );
}

// --- Schedule tab ---

function renderSchedule(state) {
  const schedule = state.season.schedule;
  const last5 = schedule.slice(-5).reverse();

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Schedule' }),
    el('h3', { className: 'sub-title', textContent: 'Recent Results' }),
    last5.length === 0
      ? el('p', { className: 'muted-text', textContent: 'No games played yet.' })
      : el('div', { className: 'schedule-list' },
          ...last5.map(g => renderGameRow(g)),
        ),
    el('h3', { className: 'sub-title', textContent: 'Upcoming (simulated)' }),
    el('p', { className: 'muted-text', textContent: 'Next 5 games will be simulated in real time.' }),
  );
}

function renderGameRow(g) {
  const winClass = g.win ? 'win' : 'loss';
  return el('div', { className: `game-row ${winClass}` },
    el('span', { className: 'game-day', textContent: `Day ${g.day + 1}` }),
    el('span', { className: 'game-result', textContent: g.win ? 'W' : 'L' }),
    el('span', { className: 'game-score', textContent: `${g.ourScore}-${g.oppScore}` }),
    el('span', { className: 'game-opp', textContent: `vs. Opp.${g.opponentRating}` }),
    el('span', { className: 'game-top', textContent: g.topScorer }),
  );
}

// --- Standings tab ---

function renderStandings(state) {
  const s = state.season;
  const winPct = (s.wins + s.losses) > 0
    ? (s.wins / (s.wins + s.losses) * 100).toFixed(1)
    : '0.0';
  const rings = state.team.rings;

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Standings' }),
    el('div', { className: 'card standings-card' },
      el('div', { className: 'standings-record' }, `${s.wins} - ${s.losses}`),
      el('div', { className: 'standings-detail' }, `Win %: ${winPct}% | Season ${state.team.seasonsPlayed + 1}`),
      s.phase === 'playoffs'
        ? el('div', { className: 'standings-detail playoff' },
            `Playoffs — Round ${s.playoff?.round ?? 1} | Series: ${s.playoff?.seriesWins}-${s.playoff?.seriesLosses}`,
          )
        : null,
      state.career
        ? el('div', { className: 'standings-detail' },
            `Career: ${state.career.totalWins}W - ${state.career.totalLosses}L`,
          )
        : null,
    ),
    rings > 0
      ? el('div', { className: 'card' },
          el('h3', { className: 'sub-title', textContent: 'Championship History' }),
          el('p', { textContent: `🏆 x${rings} Championship${rings > 1 ? 's' : ''} won!` }),
        )
      : el('p', { className: 'muted-text', textContent: 'No rings yet. Keep grinding.' }),
  );
}

// --- Shop tab ---

function renderShop(state) {
  const upgrades = state.upgrades ?? {};
  const money = state.team.money;

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Upgrades' }),
    el('p', { className: 'muted-text', style: 'margin-bottom: 1rem;',
      textContent: 'Money buys permanent multipliers. Each upgrade caps at level 10.' }),
    ...UPGRADES.map(upg => {
      const level = upgrades[upg.id] ?? 0;
      const atCap = level >= MAX_UPGRADE_LEVEL;
      const cost = costFor(upg.id, level);
      const canBuy = !atCap && money >= cost;

      return el('div', { className: 'upgrade-card card' },
        el('div', { className: 'upgrade-header' },
          el('span', { className: 'upgrade-name', textContent: upg.name }),
          el('span', { className: 'upgrade-level', textContent: `Lv. ${level} / ${MAX_UPGRADE_LEVEL}` }),
        ),
        el('p', { className: 'muted-text', textContent: upg.description }),
        el('p', { className: 'upgrade-effect', textContent: upg.effectText }),
        el('div', { className: 'upgrade-footer' },
          el('span', { className: 'upgrade-cost',
            textContent: atCap ? 'MAXED' : `Cost: $${fmtMoney(cost)}` }),
          el('button', {
            className: 'btn btn-primary upgrade-buy',
            textContent: atCap ? 'MAX' : 'Buy',
            disabled: (!canBuy || atCap) ? 'disabled' : undefined,
            onClick: () => _callbacks.onBuyUpgrade?.(upg.id),
          }),
        ),
      );
    }),
  );
}

// --- Achievements tab ---

function renderAchievements(state) {
  const unlocked = new Set(state.achievements ?? []);

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Achievements' }),
    el('p', { className: 'muted-text', style: 'margin-bottom: 1rem;',
      textContent: `${unlocked.size} / ${ACHIEVEMENTS.length} unlocked` }),
    el('div', { className: 'achievement-grid' },
      ...ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlocked.has(ach.id);
        const rewardParts = [];
        if (ach.reward.money) rewardParts.push(`+${Math.round(ach.reward.money * 100)}% 💰`);
        if (ach.reward.xp)    rewardParts.push(`+${Math.round(ach.reward.xp    * 100)}% ⭐`);
        const rewardStr = rewardParts.join('  ');

        return el('div', {
          className: `achievement-card${isUnlocked ? '' : ' locked'}`,
        },
          el('div', { className: 'achievement-name' }, isUnlocked ? '🏆 ' : '🔒 ', ach.name),
          el('div', { className: 'achievement-desc', textContent: ach.description }),
          rewardStr
            ? el('div', { className: 'achievement-reward', textContent: rewardStr })
            : null,
        );
      }),
    ),
  );
}

// --- Off-Season tab ---

function renderOffseason(state) {
  if (state.season.phase !== 'offseason') {
    return el('section', { className: 'tab-content' },
      el('p', { className: 'muted-text', textContent: 'Off-season not active.' }),
    );
  }

  const phaseIdx = state.season.offseasonPhase ?? 0;
  const phaseNames = ['Draft', 'Free Agency', 'Training Camp'];
  const current = phaseNames[phaseIdx] ?? 'Done';

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Off-Season' }),
    el('div', { className: 'card' },
      el('p', { className: 'muted-text', textContent: 'Defaults are applied automatically each tick.' }),
      el('div', { className: 'offseason-phases' },
        ...phaseNames.map((name, i) =>
          el('div', {
            className: `phase-step${i < phaseIdx ? ' done' : i === phaseIdx ? ' active' : ''}`,
            textContent: name,
          }),
        ),
      ),
    ),
  );
}

// --- Settings tab ---

function renderSettings(state, { saveString } = {}) {
  const ss = saveString ?? null;

  return el('section', { className: 'tab-content' },
    el('h2', { className: 'section-title', textContent: 'Settings' }),

    el('div', { className: 'card settings-section' },
      el('label', { className: 'settings-label', textContent: 'Seed (read-only)' }),
      el('div', { className: 'seed-row' },
        el('code', { className: 'seed-display', textContent: state.seed }),
        el('button', {
          className: 'btn btn-ghost',
          textContent: 'Copy',
          onClick: () => {
            navigator.clipboard?.writeText(state.seed).catch(() => {});
            _callbacks.onCopySettings?.('seed');
          },
        }),
      ),
    ),

    el('div', { className: 'card settings-section' },
      el('label', { className: 'settings-label', textContent: 'Save String (export / import)' }),
      el('textarea', {
        className: 'save-textarea',
        readonly: 'readonly',
        textContent: ss ?? '',
        rows: '3',
      }),
      el('div', { className: 'settings-row' },
        el('button', {
          className: 'btn btn-ghost',
          textContent: 'Copy Save',
          onClick: () => {
            if (ss) navigator.clipboard?.writeText(ss).catch(() => {});
            _callbacks.onCopySettings?.('save');
          },
        }),
        el('button', {
          className: 'btn btn-ghost',
          textContent: 'Import Save',
          onClick: () => _callbacks.onImport?.(),
        }),
      ),
    ),

    el('div', { className: 'card settings-section danger-zone' },
      el('h3', { className: 'sub-title', textContent: 'Danger Zone' }),
      el('button', {
        className: 'btn btn-ghost danger',
        textContent: 'Reset Save',
        onClick: () => { _showResetConfirm = true; render(_state, {}); },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function renderWelcomeBackModal(data) {
  const winsLosses = `${data.wins}W - ${data.losses}L`;
  const rings = data.rings > 0 ? `🏆 Won ${data.rings} ring${data.rings > 1 ? 's' : ''}!` : '';

  return el('div', { className: 'modal-backdrop' },
    el('div', { className: 'modal card' },
      el('h2', { className: 'modal-title', textContent: 'Welcome Back!' }),
      el('p', { textContent: `While you were away, your team played ${data.ticks} game${data.ticks !== 1 ? 's' : ''}.` }),
      el('div', { className: 'modal-stats' },
        el('div', { textContent: `Record: ${winsLosses}` }),
        el('div', { textContent: `Money earned: $${fmtMoney(data.money)}` }),
        data.levelUps > 0 ? el('div', { textContent: `Level-ups: ${data.levelUps}` }) : null,
        rings ? el('div', { className: 'ring-line', textContent: rings }) : null,
      ),
      el('p', { className: 'muted-text', textContent: 'Note: offline catch-up is capped at 30 days.' }),
      el('button', {
        className: 'btn btn-primary',
        textContent: 'Continue',
        onClick: () => { _welcomeBackData = null; render(_state, {}); },
      }),
    ),
  );
}

function renderResetConfirmModal() {
  return el('div', { className: 'modal-backdrop' },
    el('div', { className: 'modal card' },
      el('h2', { className: 'modal-title', textContent: 'Reset Save?' }),
      el('p', { textContent: 'This will wipe all progress and start a fresh career. This cannot be undone.' }),
      el('div', { className: 'modal-actions' },
        el('button', {
          className: 'btn btn-ghost',
          textContent: 'Cancel',
          onClick: () => { _showResetConfirm = false; render(_state, {}); },
        }),
        el('button', {
          className: 'btn btn-ghost danger',
          textContent: 'Reset',
          onClick: () => { _showResetConfirm = false; _callbacks.onReset?.(); },
        }),
      ),
    ),
  );
}

function renderPlayerDetailModal(player, idx) {
  return el('div', {
    className: 'modal-backdrop',
    onClick: (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        _playerDetailIdx = null;
        render(_state, {});
      }
    },
  },
    el('div', { className: 'modal card player-detail' },
      el('div', { className: 'player-header' },
        el('span', { className: 'player-emoji-lg', textContent: player.emoji }),
        el('div', {},
          el('h2', { className: 'modal-title', textContent: player.name }),
          el('span', { className: 'player-pos-pill', textContent: player.position }),
        ),
      ),
      el('div', { className: 'modal-stats' },
        el('div', {}, `Level ${player.level} | Age ${player.age}`),
        el('div', {}, `Contract: ${player.contractYears}y / $${fmtMoney(player.contractValue)}`),
        el('div', {}, `Morale: ${player.morale}%`),
      ),
      el('div', { className: 'player-stats' },
        statBadge('SHT', player.stats.shooting),
        statBadge('DEF', player.stats.defense),
        statBadge('ATH', player.stats.athleticism),
        statBadge('IQ', player.stats.iq),
      ),
      el('div', { className: 'xp-section' },
        el('span', { className: 'muted-text', textContent: `XP: ${player.xp} / ${500 + player.level * 200}` }),
        xpBar(player),
      ),
      el('button', {
        className: 'btn btn-ghost',
        textContent: 'Close',
        onClick: () => { _playerDetailIdx = null; render(_state, {}); },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Tab activation (for keyboard shortcut)
// ---------------------------------------------------------------------------
export function setActiveTab(tabId) {
  _activeTab = tabId;
}
