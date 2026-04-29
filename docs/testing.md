# Testing

How testing works in this repo, what to test, what not to, and the AI workflow that uses it.

This doc is the contract. Tests turn the prose specs into mechanical assertions; this doc turns the prose process into a mechanical workflow. Both exist for the same reason: in an AI-built repo, "spec-driven" only means something if there's something downstream that catches drift.

## Why we test

Three principles, applied in order.

### 1. The spec is the source of truth; tests enforce its boundaries

The implementation should stay as close to the spec as possible. The thing to avoid is **going beyond it** — silent additions, scope creep, undocumented behavior. Removals and modifications happen, but they must be **logical or ethical**: change the spec first (and document why), then change the code. Drift without spec change is the bug.

Tests catch drift. Not by being smarter than the implementer, but by being **mechanical** — they read the spec the same way every run, no fatigue, no judgment, no charity.

### 2. AI is not self-certifying — the spec is

When AI builds a feature, it is not certifying itself. The **spec** is the certificate. The tighter the spec, the better the test; the better the test, the better the outcome.

Failure is welcomed in this model. A test that fails ten times before going green is not a problem — it is the purification process. Each failure narrows the gap between spec and implementation. Tests that never fail are tests that are not testing anything.

### 3. Change is constant; the spec process is permanent

Apps change. New mechanics, new modes, new modules. The repo is alive, and that is good — a frozen codebase is a dead one.

But every change passes through the same gate: **specification first, implementation second**. New feature? Update the doc, write the test, then write the code. Bug fix? Write the failing test, then fix. Refactor? The spec has not changed, so the tests should not change — they are the safety net.

The pipeline is not a one-time scaffold. It is the operating system.

### The meta — why this works for AI specifically

A solo human developer plays every role: client, manager, critic, QA, salesman. Their bottleneck is biology — fatigue, mood, blind spots, an imperfect brain.

AI's bottleneck is the opposite: no biological inconsistency, but no biological judgment either. **Consistency is the advantage. Use it.** A rigorous spec → test → code → pre-push-hook loop is something AI executes identically every time. The same spec, fed through the same pipeline, produces the same kind of output. That is not a limitation; that is the point.

This doc exists to make that loop explicit and repeatable, so the consistency does its job.

## What we test

Four tiers. Each catches a different class of bug.

| Tier | What it tests | Tool | Speed | Example |
| --- | --- | --- | --- | --- |
| **Unit** | Pure logic, no DOM | Vitest | ~ms | "T-piece rotation 0 minos are at expected offsets." |
| **Replay** | Deterministic input → expected state | Vitest | ~ms | "Seed `'X'` + input `[L, L, RotCW, HardDrop]` → board cells == snapshot." |
| **Property** | ∀ legal input sequence, invariant holds | Vitest + fast-check | ~10s | "After any rotate/move sequence, no mino is out of bounds." |
| **E2E** | Real browser, real keys, real localStorage | Playwright | ~sec | "Press ArrowRight on splash → selectedMode advances." |

Order of preference when adding a test for new behavior: **Unit first** (cheapest, fastest), **E2E only when the behavior is user-facing**, **replay/property when the behavior is sequence-dependent or has invariants**.

## What we don't test

- **"Is it fun."** Human playtesting only. Automated tests can't measure feel.
- **Pixel-perfect rendering.** Frozen screenshots are too brittle for hobby-grade games. PixelLab outputs aren't bit-stable across regenerations.
- **Web Audio output waveforms.** We synthesize audio; we don't sample. Test that `audio.init()` doesn't throw and that mute state persists. Don't assert waveform shape.
- **The React shell beyond smoke tests.** It's a 200-line landing page. One test that "registry renders all games" is enough.
- **Third-party libraries.** Three.js, React, etc. are not our responsibility.

If you find yourself writing a test that re-asserts a framework's contract, delete it.

## Tooling — fixed choices

These are not up for debate without a separate conversation:

- **Vitest** for unit / replay / property. Uses Vite's config. Native ES modules. No Jest.
- **Playwright** for E2E. Chromium only by default. No Cypress.
- **fast-check** for property tests. Small, pure JS, well-maintained.
- **Husky** for the pre-push hook. The local hook is the only mechanical gate.
- **No cloud CI.** GitHub Actions / Copilot review are intentionally off. See [CI integration](#ci-integration-currently-disabled) for the reasoning.

Justification: this is the standard stack for **web games** (Phaser, Pixi, vanilla canvas all use it). Game industry tools differ by engine (Unity Test Framework, Unreal Automation, Godot GUT) — for our platform, this is the equivalent.

Why these specifically:

- Vitest because it shares Vite config and we're already on Vite.
- Playwright because it's faster than Cypress, has better APIs, and has deterministic webserver autostart.
- fast-check because property-based testing is genuinely game-industry-coded (heavy use in roguelikes, fighting games, RTSes for invariant verification) and fast-check is the JS standard.
- Husky because we need the pre-push hook to be auto-installed via `npm install` — manual `git config core.hooksPath` is a footgun.

## Folder layout

```text
tests/
├── unit/                              — Vitest. Pure-logic tests, no DOM.
│   └── <game-slug>/
│       ├── <module>.test.js           — one test file per game module
│       └── ...
├── replay/                            — Vitest. Deterministic input replays.
│   └── <game-slug>.replay.test.js
├── property/                          — Vitest + fast-check. Invariants.
│   └── <game-slug>-<aspect>.property.test.js
├── e2e/                               — Playwright. Real browser.
│   └── <game-slug>.spec.ts
└── shared/                            — Shared helpers used across tiers.
    ├── replay-runner.js               — drives Board+Piece+Bag from input list
    └── test-hooks.js                  — typed wrapper for window.__gameTest
```

**Per-game subfolders under `tests/unit/` only.** Replay/property/e2e files are flat, prefixed by slug.

**Test files are `.test.js` for Vitest, `.spec.ts` for Playwright.** Convention matches each tool's defaults.

## The test hook pattern

E2E tests need to read game state that's only in canvas (not DOM). Solution: each game exposes a small read-only debug hook on `window`.

```js
// In each game's main.js, near the top.
if (new URLSearchParams(location.search).has('test')) {
  window.__gameTest = {
    getState: () => gameState,
    getMode:  () => selectedMode,
    getScore: () => score,
    getBoard: () => board?.cells.slice(),  // copy, not live ref
    // Add per-game accessors as tests demand them.
  };
}
```

Rules:

1. **Read-only.** The hook reports state; it never mutates it.
2. **Gated by `?test=1`.** Production users don't see this surface. E2E tests pass `?test=1` when navigating.
3. **Returns copies, not live references.** `board.cells.slice()`, not `board.cells`. The test must not be able to corrupt game state.
4. **Lives in `main.js`, near the top.** One block, easy to find. Don't scatter hooks across modules.
5. **Documented per-game.** The game's `docs/games/<slug>.md` lists the hook surface as part of "Testing."

If a test needs internal state that the hook doesn't expose, **add to the hook** — don't reach into module internals. The hook is the test's contract with the game.

## The four tiers — patterns

### Unit pattern

Test pure logic in isolation. No DOM, no canvas, no audio. Just import modules and assert.

```js
// tests/unit/neon-blocks/piece.test.js
import { describe, it, expect } from 'vitest';
import { Piece } from '../../../public/games/neon-blocks/piece.js';
import { Board } from '../../../public/games/neon-blocks/board.js';
import { P_T } from '../../../public/games/neon-blocks/config.js';

describe('Piece — T-spin detection', () => {
  it('returns "tspin" for a 3-corner T-slot with both front corners', () => {
    const board = new Board();
    // Build a T-slot: floor + walls around the slot
    // ...
    const p = new Piece(P_T);
    p.row = 18; p.col = 4;
    p.rotate(1, board);  // rotate into slot
    expect(p.tspinType(board)).toBe('tspin');
  });
});
```

**Rule:** A unit test must not touch `window`, `document`, or `Image`. If a module under test imports something that does, that module is doing too much — flag it for refactor in a separate PR.

### Replay pattern

Game-industry technique. A replay test is:

1. Fixed seed.
2. Fixed input sequence.
3. Run sequence through pure game modules.
4. Assert resulting state matches a snapshot.

The snapshot is small (board hash, score, piece type). When it breaks, you've changed game behavior — intentionally or not. Useful for: scoring math, RNG-dependent flows, line-clear cascades, T-spin recognition, gravity timing.

```js
// tests/replay/neon-blocks.replay.test.js
import { describe, it, expect } from 'vitest';
import { runReplay } from '../shared/replay-runner.js';

describe('Neon Blocks replay', () => {
  it('seed=alpha + 4 hard drops produces expected board hash', () => {
    const result = runReplay({
      seed: 'alpha',
      inputs: [
        { piece: 1, actions: ['hardDrop'] },
        { piece: 2, actions: ['left', 'left', 'hardDrop'] },
        { piece: 3, actions: ['rotateCW', 'hardDrop'] },
        { piece: 4, actions: ['right', 'hardDrop'] },
      ],
    });
    expect(result.boardHash).toBe('a3f2c1...');
    expect(result.score).toBe(0);  // no clears in this sequence
  });
});
```

**Rule:** Replay tests assert *snapshots*. When a replay test breaks because you intentionally changed scoring, **update the snapshot in the same commit as the change.** Don't update snapshots reflexively — investigate first.

### Property pattern

Use `fast-check` to assert invariants over arbitrary inputs.

```js
// tests/property/neon-blocks-piece.property.test.js
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { Piece } from '../../public/games/neon-blocks/piece.js';
import { Board } from '../../public/games/neon-blocks/board.js';
import { COLS } from '../../public/games/neon-blocks/config.js';

describe('Piece — bounds invariant', () => {
  it('after any move sequence, no mino is out of bounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('left', 'right', 'rotateCW', 'rotateCCW', 'down'), { maxLength: 50 }),
        (moves) => {
          const board = new Board();
          const p = new Piece(1);
          for (const m of moves) {
            // apply move (no-op if illegal)
          }
          for (const [c, r] of p.minos()) {
            if (c < 0 || c >= COLS || r < 0) return false;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});
```

**Rule:** Property tests assert what *can never* happen. "Score never negative." "No piece can phase through a wall." "Bag never produces 8 of the same piece in a row." If you can't state the invariant in one sentence, it's probably an integration test, not a property.

### E2E pattern

Playwright drives a real browser against the dev server.

```ts
// tests/e2e/neon-blocks.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Neon Blocks splash', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/neon-blocks/?test=1');
    await page.waitForFunction(() => window.__gameTest);
  });

  test('arrow keys cycle modes', async ({ page }) => {
    expect(await page.evaluate(() => window.__gameTest.getMode())).toBe('marathon');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.__gameTest.getMode())).toBe('sprint');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.__gameTest.getMode())).toBe('daily');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.__gameTest.getMode())).toBe('marathon');
  });

  test('mute persists across reload', async ({ page }) => {
    await page.keyboard.press('m');
    await page.reload();
    const muted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('neon-blocks:muted'))
    );
    expect(muted).toBe(true);
  });
});
```

**Rule:** E2E tests assert *user-observable* behavior. Don't reach into module internals through the page; use the test hook. If the hook doesn't expose what you need, expand the hook.

## Procedures

### When you add a new game

The order of operations is now:

1. Write the spec (game design, controls, mechanics) in `docs/games/<slug>.md`.
2. Write the **tests first** in `tests/unit/<slug>/`, `tests/e2e/<slug>.spec.ts`. Test hook on `window.__gameTest`.
3. Implement the game until tests pass.
4. Add replay/property tests for any sequence-sensitive behavior.
5. Register in `src/data/games.ts`.
6. Run `npm test` — must be green to merge.

The tests are part of the game, not an afterthought.

### When you fix a bug

1. **Write the failing test first.** Reproduces the bug, fails red.
2. Fix the code.
3. Test goes green. Commit both in the same PR.

This is a regression test. The bug doesn't come back without someone deleting the test, which shows up in review.

### When you change a game

1. Run `npm test` before starting. Green baseline.
2. Make the change.
3. Run `npm test` again. If something went red unexpectedly, that's a regression — investigate before "fixing" the test. If a test broke because behavior intentionally changed, update the test and the snapshot.
4. Add new tests for any new behavior.

### When a replay snapshot needs updating

Don't reflexively update. Ask:

1. Did I intend to change this behavior? (Spec says I did.)
2. Is the new snapshot correct? (Verify by hand: load the game, replay manually, check the result.)
3. Update the snapshot in the same commit as the behavior change, with a commit message that says *why* it changed.

A drift in replay snapshots without a corresponding spec change is a bug, not a flake.

## The AI workflow change

Tests change *who* certifies. Right now, the dev agent writes code and reports done. With tests, that loop is broken into roles:

```text
            ┌────────────┐
            │ orchestrator│ — owns spec, owns commit/push
            └─────┬──────┘
                  │ spec
        ┌─────────┴─────────┐
        ▼                   ▼
   ┌─────────┐         ┌─────────┐
   │ tester  │         │  dev    │
   │ agent   │         │ agent   │
   └────┬────┘         └────┬────┘
        │ tests              │ code
        └─────────┬──────────┘
                  ▼
          ┌──────────────┐
          │  pre-push    │ — final mechanical court
          │     hook     │   (local; no cloud CI)
          └──────────────┘
                  │
                  ▼
          ┌──────────────┐
          │   user PR    │ — final human court
          │    review    │
          └──────────────┘
```

**Roles:**

- **Orchestrator (Claude main thread)** — owns the spec. Writes it, hands it to subagents, owns the final commit.
- **`tester` subagent** *(new — to be defined in `.claude/agents/`)* — reads the spec, writes tests *first*, never touches game code. Tests are committed before implementation.
- **`dev` subagent** *(existing)* — writes game code. May read tests but cannot edit them. Required to run `npm test` and report green before claiming done.
- **Pre-push hook** — runs `npm test` before any push. Red blocks the push. The court that doesn't read prose.
- **PR review (human)** — the user reads the diff and approves the merge. The court that does read prose.

**Why this works:**

- The tester agent isn't motivated to write tests that pass — it's motivated to write tests that *match the spec*, since it doesn't write the implementation.
- The dev agent isn't motivated to write code that the tester likes — it's motivated to write code that passes tests.
- Neither agent can certify itself.

**Until the `tester` agent exists**, the orchestrator does the tester role manually: write tests first, hand both spec and tests to the dev agent, require green local test run before commit.

## The local development cycle

**The local test run is the gate. There is no cloud gate.** Every PR — even one-line fixes — runs `npm test` locally before being committed and pushed. The Husky pre-push hook enforces this mechanically.

This is a deliberate constraint, not a fallback:

- **No cloud-AI tokens spent on routine work.** The user has finite Copilot / cloud-CI capacity. Burning it on every push is waste when the local hook already catches red tests.
- **The orchestrator is the test runner.** When the dev agent reports done, the orchestrator runs `npm test` itself before claiming the work complete.
- **Per-PR turnaround is wall-clock time, not background time.** Slow tests cost the user real time. Keep the suite fast.
- **The user's PR review is the only human gate.** Mechanical = pre-push hook. Human = PR review. No third actor.

### The rhythm

```text
1. Spec written and approved (docs/games/<slug>.md, this doc, etc.)
2. Tester (or orchestrator-as-tester) writes tests   → tests are red
3. Dev agent writes code                              → tests turn green locally
4. Orchestrator runs `npm test` — must be green
5. Orchestrator commits both tests + code in the PR
6. User reviews PR, merges or requests changes
7. If changes requested → goto 3
```

The user is the final reviewer; cloud CI is not. Don't open a PR with red tests on the assumption "CI will catch it" — there is no CI to catch it for.

### Frequency tiers and wall-clock budget

Four test types, three frequency tiers. Each tier has its own command and its own budget:

| Frequency | Command | Tests included | Budget |
| --- | --- | --- | --- |
| **Constant** (every save, watch mode) | `npm run test:unit` | Unit + Replay | under **5 seconds** |
| **Per push / PR** | `npm run test:e2e` | E2E (Playwright) | under **30 seconds** |
| **Per merge / daily** | `npm run test:property` | Property (fast-check) | under **15 seconds** |
| **Full check** | `npm test` | All four | under **45 seconds** |

Why split this way:

- Unit + replay are sub-second per file — fine to run on every save.
- Property tests generate 100–200 scenarios per assertion. They catch deep bugs (e.g. "no input sequence can make a piece phase through a wall") but cost ~10 seconds. Running them every keystroke would make watch mode painful. Run them before merging or as a daily sweep.
- E2E hits a real browser — inherently slower. Run before each push.

If any tier goes past its budget, **fix it before adding more tests**. A slow suite stops being run.

### Pre-push hook (Husky)

A pre-push git hook runs the test suite automatically before allowing a `git push`. If tests fail, the push is blocked. Mechanical enforcement of the local gate — no relying on memory.

We use **Husky** to manage the hook. Husky is a small devDependency that installs git hooks automatically when anyone runs `npm install`. After cloning the repo, no manual setup is needed — `npm install` puts the hook in place.

**The hook runs `npm test`** (the full suite — unit, replay, property, e2e). If that's too slow for routine pushes, the hook can be tuned to run only `npm run test:unit + test:property` and reserve E2E for explicit PR-prep runs. Default is "run everything" until proven painful.

Husky config lives in `.husky/pre-push` (committed). To bypass in an emergency: `git push --no-verify` — but this should be rare and noted in the commit/PR message.

## Running tests

```bash
npm test                # all four tiers — runs automatically pre-push via Husky
npm run test:unit       # unit + replay (fast — under 5s, use in watch mode)
npm run test:property   # property tests (under 15s, run before merge or daily)
npm run test:e2e        # Playwright E2E (real browser, under 30s)
npm run test:watch      # vitest --watch (constant feedback while coding)
```

First-time setup happens automatically via `npm install` (Husky installs git hooks). For E2E browsers:

```bash
npx playwright install chromium
```

## CI integration (currently disabled)

There is no GitHub Actions workflow and no Copilot review on this repo. Both were considered and intentionally turned off.

**Why disabled.** The user's cloud-AI tokens (Copilot, cloud reviewers) are finite and not always available. Burning them on routine pushes is waste when the local Husky pre-push hook already runs the full suite in ~6 seconds. The cost of a missed cloud check is "we discover it on the next local run"; the cost of cloud-CI being on is "tokens spent on every push, even one-line fixes." Asymmetric — keep it off.

**What this means in practice:**

- `git push` runs `npm test` locally via the pre-push hook. If it's red, the push is blocked. That's the only mechanical gate.
- PRs do not get an Actions status check. PRs do not get a Copilot review. The only review is the user reading the diff.
- A fresh clone runs `npm install` (Husky activates the hook) + `npx playwright install chromium` (E2E browsers). After that, `npm test` is fully self-contained on the developer's machine.

**Reference workflow if we re-enable it later.** Below is the workflow shape that was originally specced. If/when the user has cloud capacity and wants a second pair of eyes, drop this back into `.github/workflows/test.yml`:

```yaml
# .github/workflows/test.yml
name: Test
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:property
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/, retention-days: 7 }
```

That's the shape — one job, sequential, ~3 minutes total. Re-enabling is a one-file change plus a journal entry recording why.

## Quality bar

A test is **good** if it:

- Tests one thing. (One assert per test, ideally. Multi-asserts only when they describe one logical claim.)
- Names what it asserts in present tense. (`'arrow keys cycle modes'`, not `'should cycle modes'`.)
- Fails for exactly the reason it's named. (When red, the test name explains the bug.)
- Runs in isolation. (No shared state with other tests.)
- Is deterministic. (No `Math.random()` without a seed. No real timers without `vi.useFakeTimers()`.)

A test is **bad** if it:

- Asserts implementation details, not behavior. (Asserts a private function was called rather than that the user-visible thing happened.)
- Mocks what it's supposed to test. (Mocking `Board` to test `Piece` interaction is fine. Mocking `Piece.rotate` to test `Piece.rotate` is bad.)
- Re-asserts a framework's contract. (Don't test that `expect(1).toBe(1)`.)
- Couples to a UI string. (`'PRESS SPACE TO START'` will change. Test the behavior, not the copy.)
- Flakes. (Network, timing, randomness. Make it deterministic or delete it.)

## Common gotchas

- **Side effects on import.** A module that calls `document.getElementById` at top level can't be unit-tested. Refactor: move side effects into a function called from `main.js`. Modules under `unit/` should be importable in Node.
- **Tests that load real assets.** Don't. Pixel art and audio are out of scope for unit tests; mock at the module boundary or skip the feature.
- **Date / time.** `new Date()` is non-deterministic. For `daily` mode tests, mock the date. fast-check has built-in shrinking for date generators.
- **localStorage state leaking between tests.** Playwright provides per-test isolation by default. For Vitest, use `beforeEach(() => localStorage.clear())` in any test that touches it.
- **DAS / ARR timing in E2E.** Don't `keyboard.press` 10 times to test ARR. Use the unit-test layer for input timing.
- **Canvas pixel reads.** Don't. Use the test hook to read game state, not pixels.

## What NOT to add

- **No Cypress, Mocha, Chai, Jasmine, Karma, Puppeteer.** One unit framework (Vitest), one E2E framework (Playwright), one property library (fast-check). That's it.
- **No snapshot tests for UI strings.** They drift, and the diff is noise.
- **No coverage gates as a primary metric.** "100% coverage" with shallow tests is worse than 60% with sharp ones. Coverage is a smell-detector, not a goal.
- **No tests for "did I render the right pixels."** That's a designer's job.
- **No flaky tests, period.** A test that needs `retry: 3` is broken; either fix it or delete it. (Flakes-as-policy was a CI-era accommodation; we don't have CI, so we don't have that excuse.)

## Adding a new game — testing checklist

When adding a new game, copy this checklist into the game's PR description:

```markdown
- [ ] `docs/games/<slug>.md` written, includes Testing section listing the test hook surface
- [ ] `tests/unit/<slug>/` has at least one test per pure-logic module
- [ ] `tests/e2e/<slug>.spec.ts` covers controls advertised on the splash
- [ ] `tests/replay/<slug>.replay.test.js` (if game has RNG or sequence-sensitive scoring)
- [ ] `tests/property/<slug>-<aspect>.property.test.js` (if game has invariants worth stating)
- [ ] `window.__gameTest` hook in `main.js`, gated by `?test=1`
- [ ] `npm test` is green locally (the pre-push hook will catch a red test before it reaches the PR)
```

## Open questions / not yet decided

- **Mobile / touch testing.** Not currently a target. Revisit if a game ships with mobile support.
- **Visual regression.** Not implementing now (PixelLab outputs aren't bit-stable). Could add for the React shell only.
- **Performance regression tests.** Not implementing now. Could add a Playwright test that measures `requestAnimationFrame` latency under load.
- **Audio testing.** Smoke test only (`audio.init()` doesn't throw). Not asserting waveform shape.

These are deliberately deferred. Don't add them without a separate conversation.

## References

- Vitest: <https://vitest.dev>
- Playwright: <https://playwright.dev>
- fast-check: <https://fast-check.dev>
- Game-industry replay testing background: search "deterministic replay regression testing" — the technique is canonical in roguelikes (Caves of Qud, ToME), fighting games, and RTSes.
