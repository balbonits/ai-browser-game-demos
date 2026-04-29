// Helpers for reading `window.__gameTest` from Playwright tests.
//
// Each game exposes a small read-only debug surface on `window.__gameTest`
// when loaded with `?test=1`. These helpers wrap the page.evaluate boilerplate
// so per-game E2E tests stay readable.

/**
 * Wait until window.__gameTest is present on the page.
 * Pass this any Playwright `page` that has navigated to a `?test=1` URL.
 */
export async function waitForGameTest(page) {
  await page.waitForFunction(() => Boolean(window.__gameTest));
}

/**
 * Read a single key off window.__gameTest by invoking its accessor.
 * e.g. await readGameTest(page, 'getMode')
 */
export async function readGameTest(page, accessor) {
  return page.evaluate((name) => window.__gameTest[name](), accessor);
}
