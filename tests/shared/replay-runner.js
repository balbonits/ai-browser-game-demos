// Shared replay driver. Per-game replay tests import this and pass an input
// list; the runner threads those inputs through the game's pure modules
// (Board / Piece / Bag etc.) and returns a small snapshot for assertion.
//
// Per-game runners will add their own thin wrappers around this — keep this
// file engine-agnostic. The first concrete implementation lands with the
// `add-tests-existing-games` PRs (starting with neon-blocks).

export function notImplemented(name) {
  throw new Error(
    `replay-runner: '${name}' is not implemented yet. ` +
      `Implement it in the per-game test PR that introduces this replay.`,
  );
}
