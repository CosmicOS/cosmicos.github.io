#!/usr/bin/env node
/* LOOK AT THE PAGE. Screenshot one element alone, or the page in a given state.
 *
 *   node scripts/look.js p207              an entry, by anchor id, at desk width
 *   node scripts/look.js p193 390          the same at phone width — a REAL 390, see below
 *   node scripts/look.js '.sheets'         any CSS selector
 *   node scripts/look.js --page            the whole page, top of it
 *   node scripts/look.js --page 390 --scroll=3000     …at a width, scrolled
 *   node scripts/look.js --page --click='.tb-menu summary'   …after opening something
 *   SCRAWL=numbers node scripts/look.js p207   every sign as the number the message sends for it
 *
 * WHY THIS IS NOT `chrome --headless --screenshot` ANY MORE.  It was, and that harness LIES about
 * anything that depends on time or on scrolling:
 *
 *   - `--virtual-time-budget` never delivers IntersectionObserver callbacks.  Measured: an observer
 *     on a visible element fired 0 times.  So a picture of the top bar came back showing it stuck in
 *     its arrival state for ever, with the code perfectly correct, and there was no way to tell that
 *     from a real bug.
 *   - `--window-size` below ~500px is silently clamped, so "look at this at 390" returned a 485px
 *     layout and the old script had to print a disclaimer telling you not to trust the width you
 *     asked for.  Playwright sets the viewport exactly, so 390 means 390 and phone checks are real.
 *   - Scroll position could not be set at all, so nothing sticky, condensing, or scroll-driven could
 *     be photographed in the state a reader actually sees.
 *
 * The repo already carries Playwright for the exhibit suite.  Using it here means one browser
 * mechanism instead of two, real time, exact viewports, and states you can ask for.
 *
 * WHAT IS KEPT.  The isolation trick (scripts/look-isolate.js: keep every ancestor so all CSS still
 * applies, drop every sibling) — the old script's own best idea, and the reason a §501 exhibit
 * 35,000px down can be photographed at all.  The output path convention is unchanged, so
 * `scripts/look.sh` and everything that reads /tmp/look-*.png still work.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
/* `@playwright/test` and not `playwright`: the first is what package.json declares, the second is
   only its transitive dependency, and requiring it by path was reaching past the manifest into
   whatever npm happened to hoist. Same browser, one that is actually promised to be there. */
const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));

const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const positional = argv.filter(a => !a.startsWith('--'));
const wholePage = argv.includes('--page');
const target = wholePage ? null : positional[0];
const width = Number((wholePage ? positional[0] : positional[1]) || 760);
const scrollTo = Number(flag('scroll') || 0);
const click = flag('click');
const outFlag = flag('out');

if (!wholePage && !target) {
  console.error('usage: look.js <anchor|selector> [width] | --page [width] [--scroll=N] [--click=SEL]');
  process.exit(2);
}
const sel = !target ? null
  : /^[.#\[]/.test(target) ? target : '#' + target;
const safe = (target || 'page').replace(/[^A-Za-z0-9_.-]/g, '_');
const out = outFlag || `/tmp/look-${safe}-${width}${scrollTo ? '-y' + scrollTo : ''}.png`;

const PORT = process.env.PORT || 8399;
const SITE = path.join(ROOT, '_site');
const ISO  = path.join(SITE, '.look-iso.html');

(async () => {
  let server = null;
  const alive = await fetch(`http://127.0.0.1:${PORT}/index.html`).then(r => r.ok).catch(() => false);
  if (!alive) {
    server = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1',
                                  '--directory', SITE], { stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await fetch(`http://127.0.0.1:${PORT}/index.html`).then(r => r.ok).catch(() => false)); i++)
      await new Promise(r => setTimeout(r, 100));
  }
  const cleanup = () => { try { fs.unlinkSync(ISO); } catch {} if (server) server.kill(); };

  let url = `http://127.0.0.1:${PORT}/index.html`;
  if (sel) {
    cp.execFileSync('node', [path.join(__dirname, 'look-isolate.js'),
      path.join(SITE, 'index.html'), ISO, sel,
      ...(process.env.SCRAWL === 'numbers' ? ['nums'] : [])], { cwd: ROOT });
    url = `http://127.0.0.1:${PORT}/.look-iso.html`;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 },
                                       deviceScaleFactor: Number(process.env.SCALE || 2) });
  try {
    await page.goto(url, { waitUntil: 'load' });
    /* REAL TIME, not a budget. The renderer redraws every row on load and the marks font arrives
       late; both are things a picture taken too early gets wrong in a way that looks like a bug in
       the page. */
    await page.evaluate(() => document.fonts && document.fonts.ready);

    if (sel) {
      /* WAIT FOR THE ISOLATION TO HAVE HAPPENED. look-isolate.js strips the siblings 900ms after
         load and announces the result in the title — the old script read that out of a DOM dump, so
         it could not shoot early. Shooting early here gave a black picture every time: the element
         was still buried in the whole page, and `el.screenshot()` had scrolled 35,000px to nothing.
         Wait for the script's own signal rather than guessing a delay. */
      await page.waitForFunction(() => document.title.startsWith('LOOK'), null, { timeout: 20000 });
      if (await page.title() === 'LOOK none') {
        console.error(`could not find ${sel} on the page`);
        process.exit(1);
      }
    }
    await page.waitForTimeout(250);

    if (click) { await page.click(click); await page.waitForTimeout(350); }
    if (scrollTo) { await page.evaluate(y => window.scrollTo(0, y), scrollTo); await page.waitForTimeout(500); }

    if (sel) {
      const el = page.locator(sel).first();
      /* shoot the ELEMENT, which needs no arithmetic about how tall to make the window and no slack
         for its ancestors' padding — the old script guessed 160px and printed the guess. */
      await el.screenshot({ path: out });
      const box = await el.boundingBox();
      console.log(`${out}   (${sel} alone, ${width}px viewport, ${Math.round(box.width)}×${Math.round(box.height)})`);
    } else {
      await page.screenshot({ path: out });
      const y = await page.evaluate(() => Math.round(window.pageYOffset));
      console.log(`${out}   (page, ${width}px viewport, at y=${y})`);
    }
  } finally {
    await browser.close();
    cleanup();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
