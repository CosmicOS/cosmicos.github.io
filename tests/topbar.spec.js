// THE TOP BAR — the site's one piece of navigation, on every page.
//
// WHY THESE ARE PLAYWRIGHT TESTS AND NOT A LOOK AT A SCREENSHOT. The bar's two states are switched
// by an IntersectionObserver, and an IntersectionObserver NEVER FIRES under `chrome --headless
// --virtual-time-budget`, which is how every other visual check in this repo is taken. A run there
// reports the bar stuck as a masthead forever and the code looking perfectly correct — measured: an
// inline observer on the same element fired 0 times. So the condensing cannot be verified by the
// usual means, and a real browser with real time is the only instrument that answers.
//
// The rest of it is here for a plainer reason: the bar is now the only navigation on the site, so
// "are the links reachable" is not a thing to leave to a glance.
const { test, expect } = require('@playwright/test');

const STORY = '/index.html';        // the listener's log — the one page with an arc
const PLAIN = '/about.html';        // any page without one

/* MEASURE ONLY AFTER THE TRANSITION HAS STOPPED. The bar animates over 250ms, and every height
   assertion here failed intermittently by catching it mid-flight — once at 61px between its two real
   heights, once reading the condensed height as still equal to the masthead's. Both looked like
   product bugs and neither was. Poll until two consecutive readings agree, then measure. */
async function settledHeight(bar) {
  let last = -1;
  await expect.poll(async () => {
    const h = (await bar.boundingBox()).height;
    const same = h === last; last = h; return same;
  }, { timeout: 4000 }).toBe(true);
  return (await bar.boundingBox()).height;
}

test('arrives as a masthead and condenses once the reader has committed', async ({ page }) => {
  await page.goto(STORY);
  const bar = page.locator('#topbar');

  await expect(bar).not.toHaveClass(/condensed/);
  const tall = await settledHeight(bar);
  await expect(page.locator('.tb-tag')).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect(bar).toHaveClass(/condensed/);
  const short = await settledHeight(bar);

  // the whole point: it hands space back to the reading column
  expect(short).toBeLessThan(tall);

  // and it goes back when the reader returns to the top
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).not.toHaveClass(/condensed/);
});

test('a page opened at a deep anchor starts condensed, and does not unfold then collapse', async ({ page }) => {
  await page.goto(STORY + '#p595');
  await expect(page.locator('#topbar')).toHaveClass(/condensed/);
});

test('the bar stays pinned, and the anchor it was sent to is not hidden under it', async ({ page }) => {
  await page.goto(STORY + '#p595');
  const bar = page.locator('#topbar');
  await expect(bar).toHaveClass(/condensed/);
  await settledHeight(bar);
  const box = await bar.boundingBox();
  expect(Math.round(box.y)).toBe(0);                    // still pinned to the top
  const entry = await page.locator('#p595').boundingBox();
  expect(entry.y).toBeGreaterThanOrEqual(box.height);   // clear of the bar, not under it
});

test('every nav link is reachable from the menu, on a page with no arc', async ({ page }) => {
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await expect(menu.locator('.tb-nav')).toBeHidden();
  await menu.locator('summary').click();
  await expect(menu.locator('.tb-nav')).toBeVisible();

  const hrefs = await menu.locator('.tb-nav a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  // A MENU IS A STATEMENT OF EVERYTHING THERE IS. The front page was missing from it, which told a
  // reader the site had four parts and one of them was wherever they already were.
  expect(hrefs.some(h => h === '/' || h.endsWith('/'))).toBe(true);   // the log
  expect(hrefs.some(h => h.includes('slideshow'))).toBe(true);       // its only other inbound link is a coda
  expect(hrefs.some(h => h.includes('about'))).toBe(true);
  expect(hrefs.some(h => h.includes('evaluate'))).toBe(true);
  expect(hrefs.some(h => h.includes('github'))).toBe(true);
});

test('the menu names the page you are on, wherever you are', async ({ page }) => {
  for (const [url, label] of [['/index.html', "listener’s log"], ['/slideshow.html', 'slideshow'],
                              ['/about.html', 'message'], ['/evaluate.html', 'console']]) {
    await page.goto(url);
    await page.locator('.tb-menu summary').click();
    const here = page.locator('.tb-nav a.here');
    await expect(here).toHaveCount(1);
    await expect(here).toHaveText(label);
  }
});

test('on the log itself the menu offers the way back to the top', async ({ page }) => {
  await page.goto(STORY);
  await page.evaluate(() => window.scrollTo(0, 20000));
  await page.locator('.tb-menu summary').click();
  const log = page.locator('.tb-nav a.here');
  await expect(log).toHaveAttribute('href', '#top');
  await log.click();
  await expect.poll(async () => page.evaluate(() => window.pageYOffset)).toBeLessThan(50);
});

test('the where-you-are appears only once there is a where to be', async ({ page }) => {
  await page.goto(STORY);
  const where = page.locator('.tb-where');
  expect(Number(await where.evaluate(e => getComputedStyle(e).opacity))).toBe(0);

  await page.evaluate(() => window.scrollTo(0, 20000));
  await expect(page.locator('#topbar')).toHaveClass(/condensed/);
  await expect.poll(async () => Number(await where.evaluate(e => getComputedStyle(e).opacity))).toBe(1);
  await expect(page.locator('.tb-keeper')).not.toBeEmpty();
});

test('the arc is built from the page, and is the shape of the book', async ({ page }) => {
  await page.goto(STORY);
  const segs = page.locator('.tb-seg');
  const watches = await page.locator('section.watch').count();
  await expect(segs).toHaveCount(watches);

  // width is HEIGHT: a segment is as wide as its watch is tall, so the widths must differ
  const grows = await segs.evaluateAll(els => els.map(e => parseFloat(e.style.flexGrow)));
  expect(new Set(grows).size).toBeGreaterThan(1);
  expect(Math.min(...grows)).toBeGreaterThan(0);
});

test('a plain page gets the nav and no listener machinery', async ({ page }) => {
  await page.goto(PLAIN);
  await expect(page.locator('#topbar')).toBeVisible();
  await expect(page.locator('.tb-arc')).toHaveCount(0);
  await expect(page.locator('.tb-where')).toHaveCount(0);
});

test('nothing on the bar overflows a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(STORY);
  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect(page.locator('#topbar')).toHaveClass(/condensed/);
  const over = await page.locator('.tb-inner').evaluate(e => e.scrollWidth > e.clientWidth);
  expect(over).toBe(false);          // small.css CLIPS overflow, so a loss here would be silent
  const doc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(doc).toBe(true);
});

test('the wordmark tightens as it grows — masthead type, not a large link', async ({ page }) => {
  await page.goto(STORY);
  const word = page.locator('.tb-word');
  const big = await word.evaluate(e => {
    const c = getComputedStyle(e);
    return { size: parseFloat(c.fontSize), track: parseFloat(c.letterSpacing), caps: c.textTransform };
  });
  expect(big.size).toBeGreaterThan(24);
  expect(big.caps).toBe('none');                 // mixed case at masthead size

  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect(page.locator('#topbar')).toHaveClass(/condensed/);
  await expect.poll(async () => (await word.evaluate(e => parseFloat(getComputedStyle(e).fontSize))))
    .toBeLessThan(14);
  const small = await word.evaluate(e => {
    const c = getComputedStyle(e);
    return { track: parseFloat(c.letterSpacing), caps: c.textTransform };
  });
  expect(small.caps).toBe('uppercase');
  // the rule of type this is built on: tracking OPENS as the size drops
  expect(small.track).toBeGreaterThan(big.track);
});

test('the standfirst is only in the masthead', async ({ page }) => {
  await page.goto(STORY);
  await expect(page.locator('.tb-tag')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect.poll(async () =>
    Number(await page.locator('.tb-tag').evaluate(e => getComputedStyle(e).opacity))).toBe(0);
});

test('the menu opens from the keyboard and needs no script', async ({ page }) => {
  // <details> is a real disclosure; this is the guarantee that buys us, and the reason the bar
  // is not built out of a click handler.
  await page.addInitScript(() => Object.defineProperty(window, 'IntersectionObserver', { value: undefined }));
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await expect(menu.locator('.tb-nav')).toBeHidden();
  await menu.locator('summary').press('Enter');
  await expect(menu.locator('.tb-nav')).toBeVisible();
  // and with no observer the bar stays a masthead — the state where everything is legible
  await expect(page.locator('#topbar')).not.toHaveClass(/condensed/);
});

test('the bar sits above the page, and the story is not scrolled under a transparent strip',
  async ({ page }) => {
    await page.goto(STORY);
    /* THE BACKGROUND-COLOR, specifically — not "does it look opaque". A gradient is a background
       IMAGE and the shorthand resets the color to transparent underneath it, which is how this bar
       spent a build relying on one gradient painting to keep the prose behind it hidden. The colour
       is the floor, so the colour is what is asserted. */
    const bg = await page.locator('#topbar').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');     // opaque: a photograph sits behind every page here
    expect(bg).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)$/);   // and not merely nearly-opaque
    const panelBg = await page.locator('.tb-nav').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(panelBg).not.toBe('rgba(0, 0, 0, 0)');
    const z = await page.locator('#topbar').evaluate(e => parseInt(getComputedStyle(e).zIndex, 10));
    expect(z).toBeGreaterThan(1);
  });

test('every segment of the arc goes somewhere real', async ({ page }) => {
  await page.goto(STORY);
  const hrefs = await page.locator('.tb-seg').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const h of hrefs) {
    expect(h).toMatch(/^#p\d+$/);
    await expect(page.locator(h)).toHaveCount(1);   // the anchor exists on the page
  }
});

/* ── LETTING GO OF THE MENU. It opens on click (touch has no hover, and a hover-opened menu opens
   when nobody asked); what it needed was to stop being sticky once the reader moved on. ── */

test('the menu lets go when the pointer moves away', async ({ page }) => {
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await menu.locator('summary').click();
  await expect(menu.locator('.tb-nav')).toBeVisible();

  await page.mouse.move(10, 400);                 // away, over the page body
  await expect(menu.locator('.tb-nav')).toBeHidden({ timeout: 3000 });
});

test('crossing the gap to the panel does not close it', async ({ page }) => {
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await menu.locator('summary').click();
  const nav = menu.locator('.tb-nav');
  await expect(nav).toBeVisible();

  // travel from the button down onto the links, through the space between them
  const s = await menu.locator('summary').boundingBox();
  const n = await nav.boundingBox();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.move(n.x + n.width / 2, n.y + 4, { steps: 8 });
  await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2, { steps: 4 });
  await page.waitForTimeout(700);                 // longer than the grace timer
  await expect(nav).toBeVisible();                // still there, under the hand reaching for it
});

test('Escape closes it and gives the button back the focus', async ({ page }) => {
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await menu.locator('summary').click();
  await expect(menu.locator('.tb-nav')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu.locator('.tb-nav')).toBeHidden();
  const focused = await page.evaluate(() => document.activeElement.tagName.toLowerCase());
  expect(focused).toBe('summary');
});

test('a press anywhere else closes it', async ({ page }) => {
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await menu.locator('summary').click();
  await expect(menu.locator('.tb-nav')).toBeVisible();

  await page.mouse.click(30, 500);
  await expect(menu.locator('.tb-nav')).toBeHidden();
});

test('on a touch screen it opens by tap and does not need a pointer to leave', async ({ browser }) => {
  // the reason this opens on click and not on hover: here there is no hover to open it with
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true,
                                         viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  await page.goto(PLAIN);
  const menu = page.locator('.tb-menu');
  await menu.locator('summary').tap();
  await expect(menu.locator('.tb-nav')).toBeVisible();
  await page.waitForTimeout(700);
  await expect(menu.locator('.tb-nav')).toBeVisible();   // no phantom mouseleave closing it
  await ctx.close();
});

/* ── THE BAR MUST NOT FIGHT THE SCROLL ──
   Condensing removes ~90px of layout height from a bar that is in flow, so the page shifts and the
   browser corrects the scroll to compensate. With a single threshold that is a feedback loop: one
   press of the down arrow scrolled 18px, crossed the line, condensed, was pulled back to 0 by the
   correction, and expanded again — the reader taps down and the page bounces back where it started.
   These are the tests that would have caught it. ── */

test('one press of the down arrow does not bounce the page back to the top', async ({ page }) => {
  await page.goto(STORY);
  const bar = page.locator('#topbar');
  await expect(bar).not.toHaveClass(/condensed/);

  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.evaluate(() => {
    window.__flips = 0;
    const b = document.getElementById('topbar');
    let was = b.classList.contains('condensed');
    window.__iv = setInterval(() => {
      const now = b.classList.contains('condensed');
      if (now !== was) { window.__flips++; was = now; }
    }, 20);
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1200);
  const [y, flips] = await page.evaluate(() => {
    clearInterval(window.__iv);
    return [Math.round(window.pageYOffset), window.__flips];
  });
  expect(y).toBeGreaterThan(0);      // it went down and STAYED down
  expect(flips).toBe(0);             // and the bar did not flicker on the way
});

test('the thresholds have hysteresis, so the scroll correction cannot re-cross them',
  async ({ page }) => {
    await page.goto(STORY);
    const bar = page.locator('#topbar');
    const at = async (y) => {
      await page.evaluate(v => window.scrollTo(0, v), y);
      await page.waitForTimeout(250);
      return bar.evaluate(e => e.classList.contains('condensed'));
    };
    expect(await at(200)).toBe(false);   // below the down-threshold: still a masthead
    expect(await at(400)).toBe(true);    // past it: condensed
    expect(await at(120)).toBe(true);    // coming back up, it does NOT expand at the same line…
    expect(await at(20)).toBe(false);    // …only well above it

    // the gap must be bigger than the height the bar gives back, or the correction re-crosses it
    const tall = (await bar.boundingBox()).height;
    await page.evaluate(() => window.scrollTo(0, 4000));
    await page.waitForTimeout(300);
    const short = (await bar.boundingBox()).height;
    expect(200 - 20).toBeGreaterThan(tall - short);
  });

test('stepping across the boundary does not make it flutter', async ({ page }) => {
  await page.goto(STORY);
  await page.evaluate(() => window.scrollTo(0, 205));
  await page.waitForTimeout(300);
  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.evaluate(() => {
    window.__flips = 0;
    const b = document.getElementById('topbar');
    let was = b.classList.contains('condensed');
    window.__iv = setInterval(() => {
      const now = b.classList.contains('condensed');
      if (now !== was) { window.__flips++; was = now; }
    }, 20);
  });
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(180); }
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(180); }
  const flips = await page.evaluate(() => { clearInterval(window.__iv); return window.__flips; });
  expect(flips).toBeLessThanOrEqual(2);   // one settled change each way at most; never a flutter
});

test('the first state is a state, not an animation', async ({ page }) => {
  await page.goto(STORY + '#p595');
  await expect(page.locator('#topbar')).toHaveClass(/condensed/);
  // the no-transition guard is for the first paint only and must not stick
  await expect(page.locator('#topbar')).not.toHaveClass(/tb-still/);
});
