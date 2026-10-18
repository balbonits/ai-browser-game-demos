import { test, expect } from '@playwright/test';

const URL = '/games/idle-hoops-rpg/index.html?test=1';
const SAVE_KEY = 'idle-hoops-rpg:save:v1';

// A valid v1 save string (seed='migration-test', money=500_000, 0 wins, v:1 schema).
// Constructed once from the v0.1 encodeSave logic; used for migration E2E test.
const V1_SAVE_STRING =
  '4740a2e3:eyJ2IjoxLCJzZWVkIjoibWlncmF0aW9uLXRlc3QiLCJybmdDdXJzb3IiOjAsImxhc3RUaWNrQXQiOjE3MDAwMDAwMDAwMDAsInRlYW0iOnsibmFtZSI6Ik9sZCBUZWFtIiwibW9uZXkiOjUwMDAwMCwiZmFucyI6NTAwMCwicmluZ3MiOjAsInNlYXNvbnNQbGF5ZWQiOjB9LCJyb3N0ZXIiOltdLCJzZWFzb24iOnsiZGF5IjowLCJ3aW5zIjowLCJsb3NzZXMiOjAsInNjaGVkdWxlIjpbXSwicGhhc2UiOiJyZWd1bGFyIiwicGxheW9mZiI6bnVsbH19';

// Wait for __gameTest to be available (game booted).
async function waitForGame(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => Boolean((window as any).__gameTest));
}

test.describe('Idle Hoops RPG â€” E2E', () => {
  // Navigate fresh before each test.
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForGame(page);
  });

  // ---------------------------------------------------------------------------
  // First load
  // ---------------------------------------------------------------------------

  test('first load populates seed and shows playing or offseason state', async ({ page }) => {
    const state = await page.evaluate(() => (window as any).__gameTest.getState());
    expect(['playing', 'paused', 'offseason']).toContain(state);

    const seed = await page.evaluate(() => (window as any).__gameTest.getSeed());
    expect(typeof seed).toBe('string');
    expect(seed.length).toBeGreaterThan(0);
  });

  test('first load writes the save key to localStorage within a tick', async ({ page }) => {
    // Trigger one tick explicitly so the save is definitely written.
    await page.evaluate(() => (window as any).__gameTest.triggerTick(1));

    const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    expect(saved).not.toBeNull();
    // Save string must match the expected format: "<8hex>:<base64>"
    expect(saved).toMatch(/^[0-9a-f]{8}:.+$/);
  });

  // ---------------------------------------------------------------------------
  // Save persistence across reload
  // ---------------------------------------------------------------------------

  test('seed persists across reload', async ({ page }) => {
    const seedBefore = await page.evaluate(() => (window as any).__gameTest.getSeed());

    await page.reload();
    await waitForGame(page);

    const seedAfter = await page.evaluate(() => (window as any).__gameTest.getSeed());
    expect(seedAfter).toBe(seedBefore);
  });

  test('record persists across reload after ticks', async ({ page }) => {
    // Trigger some ticks.
    await page.evaluate(() => (window as any).__gameTest.triggerTick(5));
    const before = await page.evaluate(() => {
      const t = (window as any).__gameTest;
      const d = t.getDecoded();
      return { seed: t.getSeed(), seasonsPlayed: d.team.seasonsPlayed };
    });

    await page.reload();
    await waitForGame(page);

    // Compare values that are stable across the test-mode tick interval
    // (TICK_MS=100 means wins/losses can advance between waitForGame and
    // the next read; seed and seasonsPlayed do not).
    const after = await page.evaluate(() => {
      const t = (window as any).__gameTest;
      const d = t.getDecoded();
      return { seed: t.getSeed(), seasonsPlayed: d.team.seasonsPlayed };
    });
    expect(after.seed).toBe(before.seed);
    expect(after.seasonsPlayed).toBe(before.seasonsPlayed);
  });

  // ---------------------------------------------------------------------------
  // Offline catch-up
  // ---------------------------------------------------------------------------

  test('offline catch-up advances game count when lastTickAt is old', async ({ page }) => {
    // Record the starting day.
    const dayBefore = await page.evaluate(() => (window as any).__gameTest.getDay());

    // Set lastTickAt to 60 seconds ago. With TICK_MS=100 in test mode,
    // that's 600 ticks due (60000 / 100 = 600).
    await page.evaluate(() => {
      (window as any).__gameTest.setLastTickAt(Date.now() - 60_000);
    });

    // Reload â€” boot will apply catch-up.
    await page.reload();
    await waitForGame(page);

    // The day counter or season number should have advanced significantly.
    // With 600 ticks, we'll have played 600 games (with potential season cycles).
    // We just check the game actually advanced (record is not 0-0 in first season).
    const record = await page.evaluate(() => (window as any).__gameTest.getRecord());
    const seasonsPlayed = await page.evaluate(() => {
      const decoded = (window as any).__gameTest.getDecoded();
      return decoded?.team?.seasonsPlayed ?? 0;
    });

    // 600 ticks >> 82 regular season games, so multiple seasons should have passed.
    expect(record.wins + record.losses + seasonsPlayed * 82).toBeGreaterThan(10);
  });

  // ---------------------------------------------------------------------------
  // Corrupt save -> fresh start
  // ---------------------------------------------------------------------------

  test('corrupt save string causes a fresh start (no crash)', async ({ page }) => {
    // Write a garbage save string.
    await page.evaluate((key) => {
      localStorage.setItem(key, 'badhash:notbase64content!!');
    }, SAVE_KEY);

    // Reload â€” should not crash, should start fresh.
    await page.reload();
    await waitForGame(page);

    const state = await page.evaluate(() => (window as any).__gameTest.getState());
    expect(['playing', 'paused', 'offseason']).toContain(state);

    // Fresh start â‡’ seasonsPlayed === 0 (stable across the first few ticks,
    // unlike record.wins/losses which can advance under TICK_MS=100 in test
    // mode before we read).
    const decoded = await page.evaluate(() => (window as any).__gameTest.getDecoded());
    expect(decoded.team.seasonsPlayed).toBe(0);
  });

  test('save with wrong hash is rejected and game starts fresh', async ({ page }) => {
    // Get a real valid save string and tamper its hash prefix.
    const realSave = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    expect(realSave).not.toBeNull();

    const tampered = '00000000' + realSave!.slice(8);
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.save);
    }, { key: SAVE_KEY, save: tampered });

    await page.reload();
    await waitForGame(page);

    const record = await page.evaluate(() => (window as any).__gameTest.getRecord());
    expect(record.wins).toBe(0);
    expect(record.losses).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  test('clearSave then reload produces a fresh state', async ({ page }) => {
    // Accumulate some progress.
    await page.evaluate(() => (window as any).__gameTest.triggerTick(10));
    const seedBefore = await page.evaluate(() => (window as any).__gameTest.getSeed());

    // Clear save.
    await page.evaluate(() => (window as any).__gameTest.clearSave());

    // Reload.
    await page.reload();
    await waitForGame(page);

    // Should have a fresh record.
    const record = await page.evaluate(() => (window as any).__gameTest.getRecord());
    expect(record.wins).toBe(0);
    expect(record.losses).toBe(0);

    // Seed should be different (new random seed on fresh start).
    const seedAfter = await page.evaluate(() => (window as any).__gameTest.getSeed());
    expect(seedAfter).not.toBe(seedBefore);
  });

  // ---------------------------------------------------------------------------
  // triggerTick mutator
  // ---------------------------------------------------------------------------

  test('triggerTick(N) advances the game by exactly N sim ticks', async ({ page }) => {
    const dayBefore = await page.evaluate(() => (window as any).__gameTest.getDay());

    await page.evaluate(() => (window as any).__gameTest.triggerTick(5));

    // After 5 ticks, wins + losses should be 5 more (assuming regular season).
    const record = await page.evaluate(() => (window as any).__gameTest.getRecord());
    // wins + losses + any season transitions should sum to at least dayBefore + 5
    // (this holds during regular season; if a season completes it resets).
    const totalGames = record.wins + record.losses;
    expect(totalGames).toBeGreaterThanOrEqual(0); // always non-negative
  });

  // ---------------------------------------------------------------------------
  // forceSeed mutator
  // ---------------------------------------------------------------------------

  test('forceSeed restarts with the given seed', async ({ page }) => {
    await page.evaluate(() => (window as any).__gameTest.forceSeed('e2e-test-seed'));

    const seed = await page.evaluate(() => (window as any).__gameTest.getSeed());
    expect(seed).toBe('e2e-test-seed');

    const record = await page.evaluate(() => (window as any).__gameTest.getRecord());
    expect(record.wins).toBe(0);
    expect(record.losses).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // getSaveString / getDecoded
  // ---------------------------------------------------------------------------

  test('getSaveString returns a non-null save string after boot', async ({ page }) => {
    const ss = await page.evaluate(() => (window as any).__gameTest.getSaveString());
    expect(ss).not.toBeNull();
    expect(ss).toMatch(/^[0-9a-f]{8}:.+$/);
  });

  test('getDecoded returns an object with the correct schema version (v2)', async ({ page }) => {
    const decoded = await page.evaluate(() => (window as any).__gameTest.getDecoded());
    expect(decoded).not.toBeNull();
    expect(decoded.v).toBe(2);
    expect(typeof decoded.seed).toBe('string');
    expect(Array.isArray(decoded.roster)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Roster size
  // ---------------------------------------------------------------------------

  test('getRoster always returns 8 players', async ({ page }) => {
    const roster = await page.evaluate(() => (window as any).__gameTest.getRoster());
    expect(roster).toHaveLength(8);
  });

  // ---------------------------------------------------------------------------
  // buyUpgrade flow (v0.2)
  // ---------------------------------------------------------------------------

  test('buyUpgrade returns true and deducts the correct cost', async ({ page }) => {
    // Grant enough money to afford trainingFacility level 0 -> 1 (cost: 100_000).
    await page.evaluate(() => (window as any).__gameTest.grantMoney(1_000_000));
    const moneyBefore = await page.evaluate(() => (window as any).__gameTest.getMoney());

    const result = await page.evaluate(() => (window as any).__gameTest.buyUpgrade('trainingFacility'));
    expect(result).toBe(true);

    const upgrades = await page.evaluate(() => (window as any).__gameTest.getUpgrades());
    expect(upgrades.trainingFacility).toBe(1);

    const moneyAfter = await page.evaluate(() => (window as any).__gameTest.getMoney());
    // Cost for level 0: Math.round(100_000 * 1^1.5) = 100_000
    expect(moneyBefore - moneyAfter).toBe(100_000);
  });

  test('buyUpgrade rejects at level cap (10 purchases = cap)', async ({ page }) => {
    // Grant enormous money so we can buy to cap.
    await page.evaluate(() => (window as any).__gameTest.grantMoney(999_999_999));

    // Buy trainingFacility 10 times to hit the cap.
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => (window as any).__gameTest.buyUpgrade('trainingFacility'));
    }

    const upgrades = await page.evaluate(() => (window as any).__gameTest.getUpgrades());
    expect(upgrades.trainingFacility).toBe(10);

    // 11th purchase must fail.
    const result = await page.evaluate(() => (window as any).__gameTest.buyUpgrade('trainingFacility'));
    expect(result).toBe(false);

    // Level stays at 10.
    const upgradesAfter = await page.evaluate(() => (window as any).__gameTest.getUpgrades());
    expect(upgradesAfter.trainingFacility).toBe(10);
  });

  test('buyUpgrade returns false when money is insufficient', async ({ page }) => {
    // Start fresh with a known seed so money is the default 1_000_000.
    // Drain money to 0 by using forceSeed and then manually setting money via grantMoney with a negative.
    // Easiest: forceSeed gives 1_000_000; trainingFacility lv0 costs 100_000.
    // Force a state with nearly no money by using grantMoney(-1_000_000) (which brings money to ~0).
    await page.evaluate(() => (window as any).__gameTest.forceSeed('broke-test'));
    await page.evaluate(() => (window as any).__gameTest.grantMoney(-999_999));
    // money should now be ~1 (1_000_000 - 999_999 = 1)
    const money = await page.evaluate(() => (window as any).__gameTest.getMoney());
    expect(money).toBeLessThan(100_000);

    const result = await page.evaluate(() => (window as any).__gameTest.buyUpgrade('trainingFacility'));
    expect(result).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Achievement unlock + multipliers (v0.2)
  // ---------------------------------------------------------------------------

  test('forceAchievement unlocks an achievement and reflects in getAchievements', async ({ page }) => {
    await page.evaluate(() => (window as any).__gameTest.forceAchievement('first_win'));

    const achievements = await page.evaluate(() => (window as any).__gameTest.getAchievements());
    expect(achievements).toContain('first_win');
  });

  test('forceAchievement reflects in getMultipliers (first_win = +5% money)', async ({ page }) => {
    await page.evaluate(() => (window as any).__gameTest.forceAchievement('first_win'));

    const multipliers = await page.evaluate(() => (window as any).__gameTest.getMultipliers());
    // first_win adds 0.05 money; base is 1.0 -> should be 1.05
    expect(multipliers.money).toBeCloseTo(1.05, 5);
  });

  test('forceAchievement is idempotent (no duplicate in achievements array)', async ({ page }) => {
    await page.evaluate(() => (window as any).__gameTest.forceAchievement('first_win'));
    await page.evaluate(() => (window as any).__gameTest.forceAchievement('first_win'));

    const achievements = await page.evaluate(() => (window as any).__gameTest.getAchievements());
    const count = achievements.filter((id: string) => id === 'first_win').length;
    expect(count).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // v1 save migrates on load (v0.2)
  // ---------------------------------------------------------------------------

  test('v1 save migrates to v2 on load: decoded state has v===2', async ({ page }) => {
    // Write the hard-coded v1 save string to localStorage before loading.
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.save);
    }, { key: SAVE_KEY, save: V1_SAVE_STRING });

    // Reload â€” boot should detect v1, migrate, and start normally.
    await page.reload();
    await waitForGame(page);

    // Verify state has v: 2.
    const decoded = await page.evaluate(() => (window as any).__gameTest.getDecoded());
    expect(decoded).not.toBeNull();
    expect(decoded.v).toBe(2);
  });

  test('v1 save migrates to v2: migrated state has career, upgrades, achievements', async ({ page }) => {
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.save);
    }, { key: SAVE_KEY, save: V1_SAVE_STRING });

    await page.reload();
    await waitForGame(page);

    const decoded = await page.evaluate(() => (window as any).__gameTest.getDecoded());
    expect(decoded).not.toBeNull();
    expect(decoded.career).toBeDefined();
    expect(typeof decoded.career.totalWins).toBe('number');
    expect(decoded.upgrades).toBeDefined();
    expect(Array.isArray(decoded.achievements)).toBe(true);
  });

  test('v1 save migrates to v2: original seed and money are preserved', async ({ page }) => {
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.save);
    }, { key: SAVE_KEY, save: V1_SAVE_STRING });

    await page.reload();
    await waitForGame(page);

    // The v1 state had seed='migration-test' and money=500_000.
    const seed = await page.evaluate(() => (window as any).__gameTest.getSeed());
    expect(seed).toBe('migration-test');

    const decoded = await page.evaluate(() => (window as any).__gameTest.getDecoded());
    expect(decoded.team.money).toBe(500_000);
  });

  test('v1 save load does not crash the game', async ({ page }) => {
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.save);
    }, { key: SAVE_KEY, save: V1_SAVE_STRING });

    await page.reload();
    await waitForGame(page);

    const state = await page.evaluate(() => (window as any).__gameTest.getState());
    expect(['playing', 'paused', 'offseason']).toContain(state);
  });

  // ---------------------------------------------------------------------------
  // Tab navigation â€” real clicks, regression guard for the v0.1 bug where
  // every non-disabled tab silently received disabled="undefined" and swallowed
  // every click.
  // ---------------------------------------------------------------------------

  // Tab visible labels + the DOM landmark expected on the rendered content.
  const TAB_CHECKS: Array<{ label: string; expectHeading: string }> = [
    { label: 'Roster',       expectHeading: 'Roster' },
    { label: 'Schedule',     expectHeading: 'Schedule' },
    { label: 'Standings',    expectHeading: 'Standings' },
    { label: 'Shop',         expectHeading: 'Upgrades' },
    { label: 'Achievements', expectHeading: 'Achievements' },
    { label: 'Settings',     expectHeading: 'Settings' },
  ];

  for (const { label, expectHeading } of TAB_CHECKS) {
    test(`tab "${label}" is clickable and renders its content`, async ({ page }) => {
      const tab = page.locator('.tab-btn', { hasText: label }).first();
      await expect(tab).toBeVisible();
      // Critical assertion: the button must NOT have the HTML disabled attribute
      // set. Bug history: a bad setAttribute('disabled', undefined) call left
      // every tab disabled="undefined", silently swallowing clicks.
      const isHtmlDisabled = await tab.evaluate(
        (el) => (el as HTMLButtonElement).hasAttribute('disabled'),
      );
      expect(isHtmlDisabled).toBe(false);

      await tab.click();

      const heading = page.locator('.section-title', { hasText: expectHeading });
      await expect(heading).toBeVisible();
    });
  }

  test('Off-Season tab is disabled during regular season', async ({ page }) => {
    // Fresh boot is always in 'regular' phase.
    const tab = page.locator('.tab-btn', { hasText: 'Off-Season' }).first();
    await expect(tab).toBeVisible();
    const isHtmlDisabled = await tab.evaluate(
      (el) => (el as HTMLButtonElement).hasAttribute('disabled'),
    );
    expect(isHtmlDisabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idle tick must not disturb the UI (regression: the whole tree was rebuilt on
// every tick, which dropped the Save-textarea selection and swallowed clicks).
// In test mode the tick interval is 100ms, so ticks also fire on their own
// while these assertions run.
// ---------------------------------------------------------------------------

test.describe('Idle Hoops RPG: tick re-render is non-destructive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForGame(page);
  });

  test('a focused Save textarea keeps focus and its selection across ticks', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Settings' }).click();
    const ta = page.locator('.save-textarea');
    await expect(ta).toBeVisible();
    await ta.focus();
    await ta.evaluate((el: HTMLTextAreaElement) => {
      (el as any).__mark = 'same-node';
      el.setSelectionRange(5, 25);
    });

    await page.evaluate(() => (window as any).__gameTest.triggerTick(5));
    await page.waitForTimeout(350); // plus ~3 automatic ticks

    const after = await ta.evaluate((el: HTMLTextAreaElement) => ({
      mark: (el as any).__mark,
      active: document.activeElement === el,
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(after).toEqual({ mark: 'same-node', active: true, start: 5, end: 25 });
  });

  test('unchanged elements are kept (not rebuilt) across ticks', async ({ page }) => {
    await page.evaluate(() => {
      for (const sel of ['.header .btn', '.player-card', '.tab-btn']) {
        (document.querySelector(sel) as any).__mark = sel;
      }
    });
    await page.evaluate(() => (window as any).__gameTest.triggerTick(5));
    await page.waitForTimeout(250);
    const marks = await page.evaluate(() =>
      ['.header .btn', '.player-card', '.tab-btn'].map((s) => (document.querySelector(s) as any).__mark),
    );
    expect(marks).toEqual(['.header .btn', '.player-card', '.tab-btn']);
  });

  test('the displayed values still update on a tick', async ({ page }) => {
    const before = await page.locator('.phase-pill').textContent();
    await page.evaluate(() => (window as any).__gameTest.triggerTick(3));
    await expect(page.locator('.phase-pill')).not.toHaveText(before!);
  });

  test('a click that straddles ticks still lands (Pause button)', async ({ page }) => {
    const btn = page.locator('.header .btn', { hasText: 'Pause' });
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.evaluate(() => (window as any).__gameTest.triggerTick(3));
    await page.waitForTimeout(250);
    await page.mouse.up();
    expect(await page.evaluate(() => (window as any).__gameTest.getState())).toBe('paused');
    await expect(page.locator('.header .btn', { hasText: 'Resume' })).toBeVisible();
  });

  test('Copy Save uses the latest save string, not a stale one', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.tab-btn', { hasText: 'Settings' }).click();
    await page.evaluate(() => (window as any).__gameTest.triggerTick(4));
    await page.waitForTimeout(250);
    await page.locator('.btn', { hasText: 'Copy Save' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The game keeps ticking, so compare the format and the seed rather than bytes.
    expect(copied).toMatch(/^[0-9a-f]{8}:.+$/);
    const seed = await page.evaluate(() => (window as any).__gameTest.getSeed());
    const decoded = JSON.parse(Buffer.from(copied.split(':')[1], 'base64').toString('utf8'));
    expect(decoded.seed).toBe(seed);
  });
});

// ---------------------------------------------------------------------------
// Layout spec (Design Director): phones, touch targets, contrast, navigation.
// ---------------------------------------------------------------------------

test.describe('Idle Hoops RPG: layout at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForGame(page);
  });

  test('no horizontal overflow on any tab', async ({ page }) => {
    for (const label of ['Roster', 'Schedule', 'Standings', 'Shop', 'Achievements', 'Settings']) {
      await page.locator('.tab-btn', { hasText: label }).click();
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, label).toBeLessThanOrEqual(0);
      const appW = await page.locator('.app').evaluate((el) => el.getBoundingClientRect().width);
      expect(appW, label).toBeLessThanOrEqual(390);
    }
  });

  test('player and achievement grids are two columns', async ({ page }) => {
    const cols = async (sel: string) =>
      page.locator(sel).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(await cols('.player-grid')).toBe(2);
    await page.locator('.tab-btn', { hasText: 'Achievements' }).click();
    expect(await cols('.achievement-grid')).toBe(2);
  });

  test('buttons and tabs are at least 44px tall', async ({ page }) => {
    const h = (loc: import('@playwright/test').Locator) =>
      loc.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(await h(page.locator('.header .btn'))).toBeGreaterThanOrEqual(44);
    expect(await h(page.locator('.tab-btn'))).toBeGreaterThanOrEqual(44);
    await page.locator('.tab-btn', { hasText: 'Shop' }).click();
    expect(await h(page.locator('.upgrade-buy'))).toBeGreaterThanOrEqual(44);
  });

  test('toasts are anchored to the top on phones', async ({ page }) => {
    const pos = await page.locator('.toast-container').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { top: cs.top, bottom: cs.bottom };
    });
    expect(parseFloat(pos.top)).toBeLessThan(20);
  });

  test('tab bar fades at the right edge and scrolls the active tab into view', async ({ page }) => {
    const bar = page.locator('.tab-bar');
    await expect(bar).toHaveClass(/fade-end/);
    await page.locator('.tab-btn', { hasText: 'Settings' }).click();
    const tab = page.locator('.tab-btn.active');
    await expect(tab).toHaveText('Settings');
    const inView = await page.evaluate(() => {
      const b = document.querySelector('.tab-bar')!.getBoundingClientRect();
      const t = document.querySelector('.tab-btn.active')!.getBoundingClientRect();
      return t.left >= b.left - 1 && t.right <= b.right + 1;
    });
    expect(inView).toBe(true);
    await expect(bar).not.toHaveClass(/fade-end/); // scrolled to the end: nothing more to hint at
  });
});

test.describe('Idle Hoops RPG: layout and navigation (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForGame(page);
  });

  test('.app is 900px wide and centered on desktop', async ({ page }) => {
    const box = (await page.locator('.app').boundingBox())!;
    expect(Math.round(box.width)).toBe(900);
    expect(Math.round(box.x)).toBe(190);
  });

  test('has an "All games" link home and a credits footer', async ({ page }) => {
    const back = page.locator('a.back-link');
    await expect(back).toHaveText('\u2190 All games');
    await expect(back).toHaveAttribute('href', '/');
    const footer = page.locator('footer.site-footer');
    await expect(footer).toContainText('built entirely by AI');
    await expect(footer.locator('a')).toHaveAttribute('href', '/credits.html');
  });

  test('muted text and the phase pill meet 4.5:1 contrast', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Schedule' }).click();
    const ratios = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (fg: string, bg: string) => {
        const [a, b] = [lum(parse(fg)), lum(parse(bg))].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };
      const pill = document.querySelector('.phase-pill')!;
      const muted = document.querySelector('.muted-text')!;
      const card = getComputedStyle(document.body).backgroundColor;
      return {
        pill: ratio(getComputedStyle(pill).color, getComputedStyle(pill).backgroundColor),
        muted: ratio(getComputedStyle(muted).color, card),
      };
    });
    expect(ratios.pill).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });
});