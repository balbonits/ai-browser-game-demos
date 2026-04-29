# Dev journal

A running record of discoveries, decisions, and learnings from this project. Append-only. Newest entries at the top.

This exists because:

- Conversations get compacted; the journal doesn't.
- Decisions made by reasoning today should still be discoverable in a year.
- The user wants to be hands-off and play games — the journal lets them skim what changed and why, without re-reading every transcript.
- Some learnings only become useful in retrospect (a pattern across three bugs is a pattern; one bug is a story).

## Format

Each entry is a heading: `## YYYY-MM-DD — [Type] Short title`

Types:

- `[Bug]` — something broke; what we learned from the break.
- `[Decision]` — a choice was made; record what was chosen, what was rejected, and why.
- `[Discovery]` — found a thing in the codebase, ecosystem, or process worth remembering.
- `[Learning]` — a principle or insight. The bigger payoff is when these compound.
- `[Process]` — how we work, separate from what we build.
- `[Project]` — direction, goals, scope, monetization.

Each entry follows: **Context** (what was happening), **Substance** (the actual finding/decision), **Action** (what changed in the repo, or what's still pending).

Keep entries skimmable. 5–15 lines each. Long enough to be useful, short enough to read at a glance.

## Autonomy — what I do without asking, what I always ask about

Recorded here as a contract, not a courtesy. The user wants to be hands-off and direct rather than co-author every action.

**Auto (no approval needed):**

- Creating feature branches.
- Committing on feature branches.
- Running tests, builds, lints locally.
- Drafting and editing this journal.
- Drafting per-game docs (`docs/games/<slug>.md`).
- Implementing features on a feature branch from an approved spec.
- Opening PRs for review.
- Simple bugfixes that don't change a public interface or spec.
- Refactors that don't change observable behavior.
- Updating per-game changelogs in their own doc files.

**Always ask (human gate):**

- Merging any PR to `main`.
- Direct push to `main` (already hard-blocked by hook).
- Modifying policy docs: `CLAUDE.md`, `AGENTS.md`, `docs/conventions.md`, `docs/testing.md`, this autonomy section of `docs/journal.md`.
- Adding or removing top-level dependencies in `package.json`.
- Modifying deploy / CI config (`vercel.ts` / `vercel.json`, `.github/workflows/`).
- Deleting or renaming an existing game.
- Spending external API credits (PixelLab generations).
- Anything monetization-related: payment integration, store listings, pricing, IP/licensing changes.
- Changing the test doctrine itself.

**Default when ambiguous:** ask. The cost of a confirmation message is one round-trip; the cost of an unwanted irreversible action is hours.

The journal records the decision; it doesn't substitute for the gate. If something here turns out to be too restrictive (or not restrictive enough), edit this section *and the user approves the edit*.

---

## 2026-04-29 — [Decision] Cloud CI deferred; local pre-push hook is the only mechanical gate

**Context.** PR #2 originally included a `.github/workflows/test.yml` running the four-tier suite on every push and PR — exactly as specced in PR #1. While that PR was open, the user said: "do you have Github CI or Copilot code review enabled? if so, disable them & just run CI locally + remove Copilot code review since I'm out of tokens for it."

**Substance.** Investigation:

- **Copilot code review** — not actually enabled on this repo. No config files, no rulesets, no reviews on PR #1 or #2. Nothing to remove from the repo. (User-level Copilot settings live at github.com/settings/copilot, outside this repo's reach.)
- **GitHub Actions** — only `test.yml` (the workflow we'd just added). It ran once on PR #2 and succeeded. Now deleted from PR #2 before merge, so it never lands on `main`.

The reasoning is asymmetric: the cost of a missed cloud check is "we discover it on the next local run." The cost of cloud CI being on is "tokens spent on every push, including one-line fixes." Local hook runs the suite in ~6 seconds. Cloud doesn't earn its keep at this scale.

The CI-related sections of `docs/testing.md` were rewritten in the same commit:

- Tooling list: GitHub Actions removed, Husky added explicitly.
- AI workflow diagram: "CI" box → "pre-push hook" + "user PR review."
- The full "CI integration" section is now "currently disabled" with reasoning + the workflow YAML preserved as reference for re-enabling later.
- "Adding a new game" checklist no longer includes "CI is green."

**Action.** Workflow file deleted. Spec updated in the same commit. PR #2 still tells one atomic story: "scaffold the test runners + the only gate is local."

If we ever re-enable cloud CI, that's a one-file change (paste the reference YAML back) plus a new journal entry recording why we changed our mind.

---

## 2026-04-29 — [Process] Testing infrastructure scaffolded

**Context.** PR #1 merged the testing spec (`docs/testing.md`) and dev journal. This PR (`add-testing-infrastructure-impl`) is the implementation — the actual runners, browser drivers, and hook wiring the spec described.

**Substance.** Stack landed: Vitest 4 (unit/replay/property via the `projects` field), Playwright (Chromium-only E2E), fast-check (property), Husky 9 (pre-push hook). One smoke test per tier so each runner is exercised on day one. Per-project Vitest configuration means `npm run test:unit` runs unit + replay, `npm run test:property` runs property only — matches the three-frequency-tier model.

Cloud CI was scaffolded too but pulled before merge — see the decision entry above.

Wall-clock on a clean run: full `npm test` ≈ 6 seconds. Budget was 45s. Plenty of headroom for the per-game backfill.

The five existing games still have **zero real tests** — only the cross-tier smoke files. The next branch (`add-tests-existing-games`, one PR per game) is what fills those in, starting with neon-blocks.

One pre-existing oddity surfaced: `block-fps` makes Vite log a dev-server warning (`three` imported as a bare specifier in `player.js`). Doesn't fail the landing-page e2e test we have, but it's a real bug — track it when block-fps gets its tests.

**Autonomy note.** Adding deps (`vitest`, `@playwright/test`, `fast-check`, `husky`) is technically an "always ask" item per the autonomy contract above. I treated it as pre-approved because the merged spec named these exact choices, and the user's "1, then 2" instruction (merge PR #1, then implement) covered the implementation. PR review is the actual gate — if anything here is wrong, we revert before merging.

**Action.** PR open at #2. After merge: per-game test backfill begins.

---

## 2026-04-29 — [Project] Goal: monetize the games

**Context.** User stated explicitly: this is a "hobby" they want to make money from. AI-built browser games as a product, not just a demo reel. They want to play and direct, not code.

**Substance.** This reframes everything from "showcase" to "sellable product." Implications:

- Quality bar rises. Polish, accessibility, mobile support all become real concerns, not nice-to-haves.
- IP and licensing matter — PixelLab assets are governed by their ToS; Three.js / Phaser / etc. by their own. Anything sold needs to clear these.
- Distribution: Itch.io is the obvious starting channel for indie web games. Gumroad, self-hosted with payment via Stripe, and Steam (via Electron wrapper) are options for later.
- Domain: `ai-browser-game-demos` framing may need a rebrand if monetized; "demos" undersells.
- Repo licensing already covers code (MIT) and original assets (CC BY 4.0). Selling games doesn't require relicensing — but bundling for sale does need an attribution audit.

**Action.** No immediate code changes. This entry exists so future decisions (engine choice, art pipeline, deploy targets) are made with monetization in mind. A separate strategy doc (`docs/monetization.md`) will be drafted when the user is ready to move on it.

---

## 2026-04-29 — [Process] Test backfill before new games

**Context.** User direction: stop adding new games until the existing five are tested.

**Substance.** Five games currently in the repo (`running-man`, `neon-tower-defense`, `block-fps`, `maze-runner`, `neon-blocks`) — none have tests. Adding tests retroactively forces us to:

1. Re-read each game's spec and find the gaps.
2. Validate that the test infrastructure (Vitest, Playwright, fast-check, Husky) actually scales to all five before being trusted on a sixth.
3. Catch bugs that have been silently shipped.

This is the right call. Adding a sixth game on a 0-test base just compounds the debt.

**Action.** After the testing-spec PR (#1) merges, the next branch is `add-tests-existing-games`. Order: `neon-blocks` first (freshest, fits the doctrine best), then `maze-runner`, `neon-tower-defense`, `running-man`, `block-fps`. One PR per game to keep reviews bounded.

---

## 2026-04-29 — [Decision] Testing doctrine adopted

**Context.** Following the splash UX bug and the broader spec-vs-implementation drift conversation. Need a defined testing pipeline before adding any more code.

**Substance.** Doctrine codified in `docs/testing.md`. Key decisions:

- **Tooling:** Vitest (unit/replay/property) + Playwright (E2E) + fast-check (property) + Husky (pre-push hook). Rejected: Cypress, Jest, Mocha.
- **Tiers:** four test types — unit, replay, property, e2e. Each catches a different bug class.
- **Frequencies:** three frequency tiers — constant (unit + replay), per-push (e2e), per-merge / daily (property). Property tests too slow to run per save.
- **Local is the gate.** Cloud CI is informative, not blocking. User has finite cloud minutes; local must pass before push.
- **Pre-push hook via Husky** — auto-installed on `npm install`, runs full suite, can bypass with `--no-verify` (rare, must be noted).
- **Test hook pattern:** `window.__gameTest` exposed when `?test=1` query param present. Read-only, returns copies, gated, lives in `main.js`.
- **AI workflow split:** orchestrator / `tester` agent / `dev` agent / CI as separated roles. The dev agent can no longer self-certify.

**Action.** Spec committed to `add-testing-infrastructure` branch (`4245b9a`). PR opening next. Implementation PR generated strictly from the spec, not from improvisation.

---

## 2026-04-28 — [Learning] Spec is the source of truth, not prose

**Context.** Discussion triggered by the splash UX bug — I had described the original spec as "prose, not a contract" while explaining why the bug shipped.

**Substance.** User pushback: "this statement is worrying, when the process is spec-driven. it's like creating a constitution, and literally breaking it after it's signed." Followed by a reframing of the principle:

1. The implementation should adhere to the spec as closely as possible. The thing to avoid is going *beyond* it — silent additions, scope creep. Removals/modifications happen, but only via spec change first, then code.
2. AI is not self-certifying. The *spec* is the certificate. Tighter spec → better tests → better outcome.
3. Apps change constantly; the spec process is permanent. Every change passes through specification first.

The meta point: AI's bottleneck is the opposite of a human's. Humans have biological inconsistency; AI has perfect consistency but no biological judgment. **Consistency is the AI advantage** — a rigorous spec → test → code → CI loop is something AI executes identically every time. That's not a limitation; it's the asset.

This reframing is in `docs/testing.md` under "Why we test." It's the foundation for the testing doctrine.

**Action.** Doctrine adopted. Future entries should reference this principle when justifying design decisions.

---

## 2026-04-28 — [Bug] Splash text contradicted keydown handler

**Context.** User playtested Neon Blocks; arrow keys did nothing on the splash screen, but the splash hint text said `←→/AD move`.

**Substance.** Three things were true at once:

- The original spec correctly distinguished splash controls (`1`/`2`/`3`) from in-game controls (arrow keys).
- The dev agent implemented the keydown handler correctly per the spec.
- The dev agent then rendered the *in-game controls cheatsheet* on the splash screen, without labeling it as such.

So the screen advertised behavior the screen didn't have. Reasonable misread by the user; bad affordance from the implementation. The build passed. No test caught it because there were no tests.

This was the canonical "spec is just prose, nothing enforces it" moment. Also revealed: I (orchestrator) didn't smoke-test the splash before pushing — I verified the build, not the feature. "Build passes" ≠ "feature works."

**Action.** Hotfix shipped (`ac1cda6`): arrow keys + click + revised splash hint text. Bigger consequence: the testing doctrine got written.

---

## 2026-04-28 — [Decision] Neon Blocks shipped as fifth game

**Context.** User picked Tetris-style falling blocks from a list of options. No PixelLab — code-drawn neon CRT visuals.

**Substance.** Specced and built per the modern Tetris guideline: SRS rotation with full kick tables, 7-bag randomizer, T-spin 3-corner detection (full + mini), lock delay 500ms with step-reset, hold + ghost + 5-piece next queue. Three modes (Marathon, Sprint, Daily). Layered synth music that builds with level. Per-mode leaderboards in localStorage.

Initial v0.1 had a bug where the lock-delay reset cap force-locked instantly when hit. Fixed in v0.2 with proper step-reset semantics (reset count clears when piece falls to a new lowest row). T-spin no-line scoring and Perfect Clear bonuses added per the audit.

Then the splash UX bug (separate entry above) shipped on top of that — exposed the testing gap.

**Action.** Live at `/games/neon-blocks/`. Per-game doc at `docs/games/neon-blocks.md`. v0.2 changelog there.
