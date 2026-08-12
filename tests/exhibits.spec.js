// The listener lesson's live exhibits — an inventory that runs.
//
// WHY THIS FILE EXISTS. The moving exhibits are invisible from the prose: the circuits live as
// data-net strings inside _prose/*.blocks.json, and their driver is js/circuit-sim.js, which is
// 550 lines nothing in _prose/*.html mentions. A session that has not read those two places will
// cheerfully offer to build what is already built. This suite names every one of them and asserts
// it still behaves the way the book says it does.
//
// The assertions are not arbitrary: each one is a claim a keeper makes on the page, and the
// numbers come off the wire (msg.json), not out of my head. If one fails, either the exhibit
// broke or the book is now telling the reader something untrue. Both are worth stopping for.

const { test, expect } = require('@playwright/test');

const PAGE = '/index.html';

/* ---------- helpers ------------------------------------------------------------- */

// a circuit figure, found by the still it falls back to
const gate = (page, png) => page.locator(`figure.circuit:has(img[src$="/${png}"])`);

// the reading she takes off the tail of the works: 'whole' or 'broken'
async function reading(fig) {
  const t = await fig.locator('.circuit-say').textContent();
  return t.trim().split(/\s+/).pop();
}
// Settle the net. One sweep is one rank of propagation, so a fixed count is the wrong tool: it
// cannot tell a slow part from a turning one. The sim sweeps until nothing moved, or until it
// returns to a state it has already been in, and says which happened.
async function sweep(fig) { await fig.locator('button.c-settle').click(); }
// did it come to rest, or does it go round for ever?
async function turns(fig) {
  const t = await fig.locator('.circuit-say').textContent();
  return /will not rest/.test(t);
}
async function quiet(fig) { await fig.locator('button.c-off').click(); }
// raise (or drop) a mouth by its visible name
async function mouth(fig, name, up) {
  const b = fig.locator('button.c-in', { hasText: name });
  const lit = await b.locator('.sw.lit').count();
  if ((lit > 0) !== up) await b.click();
}
const strip = page =>
  page.$$eval('#engine .cell .mk', ns => ns.map(n => n.textContent || '_').join(''));

/* ---------- the inventory ------------------------------------------------------- */

test('every moving exhibit is present', async ({ page }) => {
  await page.goto(PAGE);
  // seven live circuits, every one driven from the message's own gate drawings
  await expect(page.locator('figure.circuit')).toHaveCount(7);
  for (const png of ['not.png', 'and.png', 'or.png', 'nor.png', 'osc.png', 'sr.png', 'd.png'])
    await expect(gate(page, png)).toHaveCount(1);
  // and three hand-written ones
  await expect(page.locator('#seekmap')).toHaveCount(1);   // the seeker's patrol
  await expect(page.locator('#geomap')).toHaveCount(1);    // two seekers in a ring world
  await expect(page.locator('#engine')).toHaveCount(1);    // the strip and the table
});

/* ---------- the controls hold still ---------------------------------------------- */

// A reader drives these by pressing the same button over and over. Every bar is a centered row, and
// the text in it changes as the thing runs — play/pause, let-it-run/rest, and a say-line that is a
// different length at every step — so before this was pinned down, pressing `step` re-centered the
// row and slid the button out from under the finger that was pressing it. Measure the buttons,
// drive the exhibit, measure again: nothing may have moved by so much as a pixel.
const boxes = bar => bar.locator('button').evaluateAll(
  bs => bs.map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width)]; }));

for (const [what, sel, drive] of [
  ['engine',  '#engine .seekmap-bar',  ['#engine-step', '#engine-step', '#engine-toggle', '#engine-swap']],
  ['seeker',  '#seekmap .seekmap-bar', ['#seekmap-step', '#seekmap-step', '#seekmap-toggle']],
  ['two seekers', '#geomap .seekmap-bar', ['#geomap-step', '#geomap-step', '#geomap-toggle']],
]) {
  test(`${what}: the buttons do not move as the reading changes`, async ({ page }) => {
    await page.goto(PAGE);
    const bar = page.locator(sel);
    const before = await boxes(bar);
    expect(before.length).toBeGreaterThan(1);
    for (const id of drive) { await page.locator(id).click(); await page.waitForTimeout(120); }
    expect(await boxes(bar)).toEqual(before);
  });
}

// Most of this lesson gets read on a phone, and an exhibit that runs off the side of the page is
// an exhibit with the end of every reading missing. The engine's drawing is the wide one.
test('mobile: the exhibits fit the page, and the controls still hold still', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  for (const sel of ['#engine', '#seekmap', '#geomap', 'figure.circuit']) {
    const over = await page.locator(sel).first()
      .evaluate(el => el.scrollWidth - el.clientWidth);
    expect(over, `${sel} runs off the side by ${over}px`).toBeLessThanOrEqual(1);
  }
  const bar = page.locator('#engine .seekmap-bar');
  const before = await boxes(bar);
  for (const id of ['#engine-step', '#engine-step', '#engine-toggle']) {
    await page.locator(id).click(); await page.waitForTimeout(120);
  }
  expect(await boxes(bar)).toEqual(before);
});

test('circuits: the buttons do not move as the reading changes', async ({ page }) => {
  await page.goto(PAGE);
  // the latch has two mouths, a run toggle and the longest spread of say-lines of any of them
  const fig = gate(page, 'sr.png');
  const bar = fig.locator('.circuit-bar');
  const before = await boxes(bar);
  for (const b of ['button.c-sweep', 'button.c-settle', 'button.c-run', 'button.c-run', 'button.c-off']) {
    await fig.locator(b).click(); await page.waitForTimeout(120);
  }
  await mouth(fig, 'the whole side', true);
  await sweep(fig);
  expect(await boxes(bar)).toEqual(before);
  // and the ring, whose say-line runs from "set it going" to "it will not rest"
  const ring = gate(page, 'osc.png');
  const rbar = ring.locator('.circuit-bar');
  const rbefore = await boxes(rbar);
  await ring.locator('button.c-run').click(); await page.waitForTimeout(400);
  await ring.locator('button.c-run').click();
  expect(await boxes(rbar)).toEqual(rbefore);
});

test('no exhibit throws', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // Resource 404s are not script errors, and one is expected: /api/notes is the local
  // annotation server (scripts/notes-server.py), which is not running under the test server.
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  await page.goto(PAGE);
  await page.waitForTimeout(600);
  expect(errs).toEqual([]);
});

/* ---------- the engine (§501): the strip, the table, and the swap ---------------- */

test('engine: the wire\'s rule counts the strip up by one', async ({ page }) => {
  await page.goto(PAGE);
  expect(await strip(page)).toBe('_▪▫▫▪_');              // msg #1177's strip: 1001
  for (let i = 0; i < 10; i++) await page.click('#engine-step');
  expect(await strip(page)).toBe('_▪▫▪▫_');              // 1010 — what #1177 claims
  await expect(page.locator('#engine-say')).toContainText('stood changed');
});

test('engine: her own rule turns every mark over', async ({ page }) => {
  await page.goto(PAGE);
  await page.click('#engine-swap');
  for (let i = 0; i < 5; i++) await page.click('#engine-step');
  expect(await strip(page)).toBe('_▫▪▪▫_');              // 1001 -> 0110, as her entry states
});

/* ---------- the gates: each keeper's stated rule, fed ---------------------------- */

test('both-knot: whole only when both come in whole', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'and.png');
  for (const [a, b, want] of [[false, false, 'broken'], [true, false, 'broken'],
                              [false, true, 'broken'], [true, true, 'whole']]) {
    await mouth(f, 'upper', a); await mouth(f, 'lower', b);
    await sweep(f);
    expect(await reading(f), `upper=${a} lower=${b}`).toBe(want);
  }
});

test('either: whole when either comes in whole', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'or.png');
  for (const [a, b, want] of [[false, false, 'broken'], [true, false, 'whole'],
                              [false, true, 'whole'], [true, true, 'whole']]) {
    await mouth(f, 'upper', a); await mouth(f, 'lower', b);
    await sweep(f);
    expect(await reading(f), `upper=${a} lower=${b}`).toBe(want);
  }
});

test('neither: whole only when neither comes in whole', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'nor.png');
  for (const [a, b, want] of [[false, false, 'whole'], [true, false, 'broken'],
                              [false, true, 'broken'], [true, true, 'broken']]) {
    await mouth(f, 'upper', a); await mouth(f, 'lower', b);
    await sweep(f);
    expect(await reading(f), `upper=${a} lower=${b}`).toBe(want);
  }
});

test('the turned-over one: it says back the opposite of what it is told', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'not.png');
  await mouth(f, 'ridge', false); await sweep(f);
  expect(await reading(f)).toBe('whole');
  await mouth(f, 'ridge', true); await sweep(f);
  expect(await reading(f)).toBe('broken');
});

/* ---------- the ring (§574) and the latch (§579) --------------------------------- */

test('ring: it will not settle', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'osc.png');
  // It has no mouths, so until it is set going it says "still — set it going" and reads nothing.
  await f.locator('button.c-run').click();
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(200);
    const w = await reading(f);
    if (w === 'whole' || w === 'broken') seen.add(w);            // skip the pre-run "set it going"
  }
  await f.locator('button.c-run').click();                       // rest, so it stops ticking
  expect([...seen].sort(), 'a ring that settled would only ever read one way')
    .toEqual(['broken', 'whole']);
});

test('latch: it stops, and it remembers', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'sr.png');
  await mouth(f, 'whole side', true); await sweep(f);
  await quiet(f); await sweep(f);
  const held = await reading(f);
  await mouth(f, 'broken side', true); await sweep(f);
  await quiet(f); await sweep(f);
  expect(await reading(f), 'the other side should have turned it over').not.toBe(held);
});



/* ---------- the clocked keeper (§587) -------------------------------------------- */

/* Its two mouths are NOT symmetric and neither is their rest, which is what took the finding out:
   the data mouth idles raised, the beat mouth idles down, and a beat is the beat mouth up and back.
   Rest them both down and the part free-runs — an active-low input held asserted for ever. It also
   has no state until it has been beaten once, exactly as the real article does not.  */
test('clocked keeper: it turns only on the beat', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'd.png');
  const beat = async () => {
    await mouth(f, 'beat', true);  await sweep(f);
    await mouth(f, 'beat', false); await sweep(f);
  };
  // her own four rows: I say X, [no beat / a beat], it keeps Y
  await mouth(f, 'hold', false); await sweep(f);
  expect(await reading(f), 'I say broken, no beat: it keeps whole').toBe('whole');
  await beat();
  expect(await reading(f), 'I say broken, a beat: it keeps broken').toBe('broken');
  await mouth(f, 'hold', true); await sweep(f);
  expect(await reading(f), 'I say whole, no beat: it keeps broken').toBe('broken');
  await beat();
  expect(await reading(f), 'I say whole, a beat: it keeps whole').toBe('whole');
});

test('clocked keeper: said at without a beat, it never hears you', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'd.png');
  const held = await reading(f);
  for (let i = 0; i < 8; i++) { await mouth(f, 'hold', i % 2 === 0); await sweep(f); }
  expect(await reading(f), 'it held the first one the whole way through').toBe(held);
});

/* ---------- settling, which is the difference §574 is about ---------------------- */

test('the plain gates come to rest; the ring does not', async ({ page }) => {
  await page.goto(PAGE);
  for (const png of ['not.png', 'and.png', 'or.png', 'nor.png', 'sr.png', 'd.png']) {
    const f = gate(page, png);
    await quiet(f); await sweep(f);
    expect(await turns(f), `${png} should settle`).toBe(false);
  }
  const ring = gate(page, 'osc.png');
  await sweep(ring);
  expect(await turns(ring), 'the ring has no end to run to').toBe(true);
});

test('latch: both mouths at once, and it recovers when you let go', async ({ page }) => {
  await page.goto(PAGE);
  const f = gate(page, 'sr.png');
  await mouth(f, 'whole side', true); await mouth(f, 'broken side', true);
  await sweep(f);
  await quiet(f); await sweep(f);
  expect(await turns(f), 'let go of both and it should find a state to hold').toBe(false);
});

/* ---------- the seeker's maps (§619) --------------------------------------------- */

test('seeker: the patrol reaches every room', async ({ page }) => {
  await page.goto(PAGE);
  for (let i = 0; i < 8; i++) await page.click('#seekmap-step');
  const rooms = await page.$$eval('#seekmap .room', gs => gs.length);
  const seen  = await page.$$eval('#seekmap .room.seen', gs => gs.length);
  expect(seen, 'its round is meant to come to every room the world owns').toBe(rooms);
});

test('two seekers: they cross', async ({ page }) => {
  await page.goto(PAGE);
  let met = false;
  for (let i = 0; i < 12 && !met; i++) {
    await page.click('#geomap-step');
    met = await page.$eval('#geomap', b => b.classList.contains('meet'));
  }
  expect(met, 'started together, they are meant to cross at the hub').toBe(true);
});


/* ---------- "the whole run" — the stretch of the message behind an entry ----------
   Every one of these can go wrong silently: the panel is built on a click, so nothing about it
   appears in the post-JS DOM the render gate captures, and a run drawn from stale or mismatched data
   still LOOKS like a wall of marks. The data is _includes/wire_runs.json (scripts/build-runs.js);
   the drawing is the `hand` rung of js/listener.js, in the notation that entry ends in. */

const RUNS = require('../_includes/wire_runs.json').runs;

// the control is a `<details>` menu on the head; ticking its one box opens the run
const dots = (page, id) => page.locator(`#${id} > .entry-menu > summary`);
const check = (page, id) => page.locator(`#${id} > .entry-menu input[type=checkbox]`);
/* Settle the scroll before pressing: the top bar condenses as the page moves, so a control scrolled
   to is still shifting, and the press lands on the bar instead — which shuts the menu. A reader
   never meets this (nothing scrolls when they press what is already in front of them). */
async function openRun(page, id) {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await dots(page, id).click();
  await check(page, id).check();
}

test('every entry with a run has a menu, and no other entry does', async ({ page }) => {
  await page.goto(PAGE);
  const ids = Object.keys(RUNS);
  await expect(page.locator('.entry-menu')).toHaveCount(ids.length);
  for (const id of ids) await expect(page.locator(`#${id} > .entry-menu`)).toHaveCount(1);
});

test('a run draws its whole stretch, and marks exactly what the entry holds up', async ({ page }) => {
  await page.goto(PAGE);
  // three passes that between them cover the range: a founder's short run, the drilling behind
  // §239's `not`, and the longest run in the book.
  for (const id of ['p214', 'p239', 'p246']) {
    const run = RUNS[id];
    await openRun(page, id);
    const panel = page.locator(`#${id}-run`);
    await expect(panel).toHaveClass(/\bopen\b/);
    await expect(panel.locator('.run-row'), 'one row per saying in the stretch')
      .toHaveCount(run.hi - run.lo + 1);
    await expect(panel.locator('.run-row.here'), 'banded = the ones the entry itself draws')
      .toHaveCount(run.shown.length);
    // a row that drew nothing is the failure this whole feature is most likely to have: the
    // renderer returns '' for a parse it cannot draw, and an empty row is invisible in a stack.
    const blank = await panel.locator('.run-row').evaluateAll(
      rows => rows.filter(r => !r.textContent.trim()).length);
    expect(blank, 'every row must have marks in it').toBe(0);
  }
});

test('the block is the rows and nothing else — no caption, no second box', async ({ page }) => {
  await page.goto(PAGE);
  await openRun(page, 'p239');
  const strays = await page.locator('#p239-run > *').evaluateAll(
    els => els.filter(e => !e.classList.contains('run-row')).map(e => e.className || e.tagName));
  expect(strays, 'the panel holds rows and only rows — no caption, no inner box').toEqual([]);
  /* and it sits at the prose's own left edge — measured, because a padding added anywhere up the
     chain would move it and no count would notice. */
  const [rowX, proseX] = await page.evaluate(() => [
    document.querySelector('#p239-run .run-row').getBoundingClientRect().left,
    document.querySelector('#p239 > p').getBoundingClientRect().left,
  ]);
  expect(Math.abs(rowX - proseX), 'rows begin where her sentences begin').toBeLessThan(1.5);
});

test('a run does not eat the scroll gesture', async ({ page }) => {
  await page.goto(PAGE);
  /* ★ `max-height` + `overflow` here is a scroll trap: the block is wide and sits where the pointer
     already is, so the wheel moved the block and the page stood still. */
  await openRun(page, 'p246');                       // the longest run in the book, 125 sayings
  const panel = page.locator('#p246-run');
  const box = await panel.evaluate(el => {
    const cs = getComputedStyle(el);
    return { overflowY: cs.overflowY, overscroll: cs.overscrollBehaviorY,
             scrollable: el.scrollHeight > el.clientHeight + 1 };
  });
  expect(box.scrollable, 'the block must not be its own scrolling region').toBe(false);
  expect(box.overscroll, 'nothing here may refuse to chain a scroll to the page').not.toBe('contain');

  // and prove it with the wheel, over the block itself: the page has to move.
  const bb = await panel.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + Math.min(bb.height / 2, 300));
  const before = await page.evaluate(() => window.pageYOffset);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.pageYOffset);
  expect(after - before, 'a wheel over the block scrolls the page').toBeGreaterThan(100);
});

test('a run opens and shuts, and is not there until it is asked for', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#p239-run')).toHaveCount(0);   // not built at load
  await openRun(page, 'p239');
  await expect(page.locator('#p239-run')).toHaveClass(/\bopen\b/);
  await check(page, 'p239').uncheck();
  await expect(page.locator('#p239-run')).not.toHaveClass(/\bopen\b/);
});

test('the menu lets go: Escape shuts it and the run stays as it was', async ({ page }) => {
  await page.goto(PAGE);
  await openRun(page, 'p239');
  const menu = page.locator('#p239 > .entry-menu');
  await expect(menu).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  // shutting the MENU is not shutting the RUN — they are two different things to close
  await expect(page.locator('#p239-run')).toHaveClass(/\bopen\b/);
});

test('a run is drawn in its own pass\'s hand, not the end of the book\'s', async ({ page }) => {
  await page.goto(PAGE);
  /* THE ONE THING NO COUNT CAN CATCH. The notation is positional — a keeper cuts a shorthand on a
     particular night — and the panel is drawn long after the walk that builds that state has ended
     holding Lio's. §214 is before every cut but her own: a count there is `tally ●…◦`, and the
     packed numerals Ren does not reach until §267 must not appear in it. */
  await openRun(page, 'p214');
  const marks = await page.locator('#p214-run').textContent();
  expect(marks, 'the founder counts in tallies').toContain('●');
  expect(marks, "§267's numerals cannot be on the founder's page")
    .not.toMatch(/[⡀-⣿]/);
});

/* ---------- one rung simpler: the step-down control on a drawn line ----------
   Every mark on this page is drawn in the browser from a parse tree, so any line can be redrawn at
   any rung of the ladder. These check that the stepping is down-only, never repeats itself, and —
   the one that matters — is drawn in the hand of the ROW, not of wherever the render walk ended. */

// the marks a line is showing, without the step control's own arrow
const marksOf = loc => loc.evaluate(
  el => (el.querySelector(':scope > .fig') || el).textContent.replace(/↓/g, '').replace(/\s+/g, ' ').trim());

test('every renderer-drawn line can be stepped; a keeper\'s own hand row cannot', async ({ page }) => {
  await page.goto(PAGE);
  const n = await page.evaluate(() => ({
    drawn: document.querySelectorAll('.row[data-code], .row[data-parse], .frag[data-code]').length,
    armed: document.querySelectorAll('.simpler').length,
    // a `data-of` row is the keeper's own drawing of a statement, not the renderer's: there is no
    // other rung to ask it for, and redrawing it would destroy the thing it is showing.
    handRowsArmed: document.querySelectorAll('.row[data-of] .simpler').length,
  }));
  expect(n.armed, 'nearly every drawn line offers a step').toBeGreaterThan(n.drawn * 0.9);
  expect(n.handRowsArmed, 'a hand-drawn row is not the renderer\'s to redraw').toBe(0);
});

test('stepping goes down the ladder, never repeats, and comes back round', async ({ page }) => {
  await page.goto(PAGE);
  const row = page.locator('#p246 .row[data-code]').first();
  const btn = row.locator('.simpler');
  const seen = [await marksOf(row)];
  for (let i = 0; i < 6; i++) { await btn.click(); seen.push(await marksOf(row)); }
  const home = seen[0];
  const back = seen.indexOf(home, 1);
  expect(back, 'it must return to the form the page chose').toBeGreaterThan(0);
  const cycle = seen.slice(0, back);
  expect(new Set(cycle).size, 'every step must be a DISTINCT formulation').toBe(cycle.length);
  expect(cycle.length, 'and there must be somewhere to go').toBeGreaterThan(1);
});

test('a stepped line is drawn in its own row\'s hand, not the walk\'s last', async ({ page }) => {
  await page.goto(PAGE);
  /* ★ THE 143-OF-437 CASE. §239 coins `deny` partway down, so rows above it draw that sign as its
     raw run and rows below it draw the word. Redrawing from an entry-level state would put `deny`
     on a row the page had not reached it on. Step one of the rows ABOVE the coining all the way
     round and back: the word must never appear on it. */
  const above = page.locator('#p239 .row[data-code]').nth(3);
  const below = page.locator('#p239 .row[data-code]').nth(5);
  expect(await marksOf(below), 'fixture check: below the coining the word is there').toContain('deny');
  expect(await marksOf(above), 'above it, the sign is still its raw run').not.toContain('deny');

  const btn = above.locator('.simpler');
  for (let i = 0; i < 7; i++) {
    await btn.click();
    expect(await marksOf(above), `step ${i + 1} drew a word this row's page had not cut`)
      .not.toContain('deny');
  }
});

test('stepping a line marks it without moving it', async ({ page }) => {
  await page.goto(PAGE);
  /* The marker for "you asked for this form" must not be a rule at the left edge: an inset one
     lands on top of the first mark, and one that takes space jogs the line sideways on every press.
     Measured on both kinds of row — a plain one, and a labeled one, which is `display: contents`
     and so cannot carry a background at all (its `.fig` cell has to). */
  for (const sel of ['#p246 .rows .row[data-code]', '#p193 .rows.labeled .row[data-code]']) {
    const row = page.locator(sel).first();
    if (!await row.count()) continue;
    const box = () => row.evaluate(el => {
      const t = el.querySelector(':scope > .fig') || el;
      return { left: t.getBoundingClientRect().left, painted: getComputedStyle(t).backgroundColor };
    });
    const before = await box();
    await row.locator('.simpler').click();
    const after = await box();
    expect(Math.abs(after.left - before.left), `${sel} moved sideways when stepped`).toBeLessThan(0.5);
    expect(after.painted, `${sel} gives no sign it was stepped`).not.toBe(before.painted);
  }
});

/* ---------- asking a mark where it came from ------------------------------------ */

test('every mark that answers for itself cites a pass it does not precede', async ({ page }) => {
  await page.goto(PAGE);
  /* ★ THE CHECK scripts/inventory-marks.js CANNOT MAKE. That gate reads `_includes/listener/*.html`,
     so it sees only marks somebody typed; ⟅ ▪ ‿ ⟦ are drawn by the renderer and are invisible to it,
     which is how four classes carried no citation at all. Here the whole book is drawn, so "the
     reader met it here first" is a question about the real page. */
  const bad = await page.evaluate(() => {
    const sheet = window.LISTENER.marks, out = [];
    const order = [...document.querySelectorAll('.entry[id]')].map(e => e.id);
    for (const cls of Object.keys(sheet)) {
      const first = [...document.querySelectorAll('span')].find(e => e.className === cls);
      if (!first) { out.push(`${cls}: declared but never drawn`); continue; }
      const at = first.closest('.entry[id]');
      if (!at) continue;                                  // page furniture, outside the diary
      if (order.indexOf(at.id) < order.indexOf(sheet[cls].e))
        out.push(`${cls}: cites ${sheet[cls].e} but is already drawn in ${at.id}`);
    }
    return out;
  });
  expect(bad, 'a mark may not be drawn before the pass its panel sends the reader to').toEqual([]);
});

test('a mark answers with what it stands for, and where it was cut', async ({ page }) => {
  await page.goto(PAGE);
  const ask = async (sel) => {
    await page.keyboard.press('Escape');
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await el.click();
    return page.evaluate(() => {
      const d = document.querySelector('.mk-pop');
      if (!d) return null;
      const run = d.querySelector('.mk-run');
      return { say: d.querySelector('.mk-say').textContent,
               run: run ? run.textContent.replace(/\s+/g, '') : null,
               cut: d.querySelector('.mk-cut').getAttribute('href'),
               parent: d.parentElement.tagName };
    });
  };
  /* Ren's mark for the empty number-cup, and the founder's tally: both are abbreviations the book
     claims are undoable, so the panel has to hand back the run each one replaces. */
  expect(await ask('#p246 .nil')).toMatchObject({ run: '▫⟅⟆', cut: '#p246' });
  expect(await ask('#p214 .tk')).toMatchObject({ run: '▫⟅▪⟆', cut: '#p214' });
  /* Two that hand back no run, for two different reasons: the join stands for a wrapper of no fixed
     length, and ⟦ stands for a run with a sign in it, which §400 draws as one reckoning glyph. */
  expect(await ask('#p221 .fj')).toMatchObject({ run: null, cut: '#p221' });
  expect(await ask('#p400 .cup.lo')).toMatchObject({ run: null, cut: '#p400' });
  // never inside the text: a panel a reader can select is a panel a reader can copy by accident
  expect((await ask('#p193 .cup.o')).parent).toBe('BODY');
});

test('asking a mark costs no selection, and traps no scroll', async ({ page }) => {
  await page.goto(PAGE);
  const row = page.locator('#p246 .row').first();
  await row.scrollIntoViewIfNeeded();

  /* ★ A DRAG IS A SELECTION, NOT A QUESTION. Sweeping across a run of marks to copy it ends in a
     click on a mark, and a panel opening there would land on top of what was just selected. */
  const at = await row.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + r.height / 2, x2: r.left + Math.min(180, r.width - 4) };
  });
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x2, at.y, { steps: 12 });
  await page.mouse.up();
  expect(await page.locator('.mk-pop').count(), 'a drag over marks opened a panel').toBe(0);
  expect(await page.evaluate(() => window.getSelection().toString().trim()),
    'the drag selected nothing').not.toBe('');

  // and with one open, selecting the page must not pick its words up
  await page.mouse.click(at.x2 + 40, at.y);                    // collapse the selection first
  await page.locator('#p246 .nil').first().click();
  await expect(page.locator('.mk-pop')).toHaveCount(1);
  const leaked = await page.evaluate(() => {
    const said = document.querySelector('.mk-pop .mk-say').textContent;
    const r = document.createRange(); r.selectNodeContents(document.body);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    return s.toString().includes(said);
  });
  expect(leaked, 'the panel is inside the copyable page').toBe(false);

  /* ★ NOT A SCROLL REGION — the whole-run block trapped the wheel this way once (max-height +
     overflow + overscroll-behavior pasted off a drawer recipe). Pinned so it cannot come back. */
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.locator('#p288 .nil.n').first().scrollIntoViewIfNeeded();
  await page.locator('#p288 .nil.n').first().click();
  const box = await page.locator('.mk-pop').boundingBox();
  const before = await page.evaluate(() => window.pageYOffset);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.pageYOffset) - before,
    'the wheel died inside the panel').toBeGreaterThan(200);
});

test('what a mark says it stands for is on the page at the pass that cuts it', async ({ page }) => {
  await page.goto(PAGE);
  /* ★ THE CHECK THAT CAUGHT A REAL ONE. The expansions are hand-written four-symbol runs — the one
     fact in this feature nothing derives — and `⟦` carried `⟅ ▪⟅▪▫▫▫▫⟆`, which is what the wire
     sends and NOT what §400 draws: a sign goes down as one reckoning glyph from §267, so the panel
     was handing back a run in a hand the page gave up 133 passes earlier.

     The book's own rule settles it. A mark is cut by showing it before and after, so the run it
     replaces is on the page at the pass that cuts it, drawn in that night's hand. If the panel's
     expansion is not there, the panel and the page disagree and the page is right. */
  const bad = await page.evaluate(() => {
    const sheet = window.LISTENER.marks, out = [];
    for (const cls of Object.keys(sheet)) {
      const row = sheet[cls];
      if (!row.c) continue;
      const el = [...document.querySelectorAll('span')].find(e => e.className === cls);
      if (!el) { out.push(`${cls}: never drawn`); continue; }
      el.click();
      const run = document.querySelector('.mk-pop .mk-run');
      const claim = run ? run.textContent.replace(/\s+/g, '') : null;
      document.querySelector('.mk-pop').remove();
      const at = document.getElementById(row.e);
      if (!claim) { out.push(`${cls}: declares a run the panel does not draw`); continue; }
      if (!at.textContent.replace(/\s+/g, '').includes(claim))
        out.push(`${cls}: says it stands for ${claim}, which ${row.e} never shows`);
    }
    return out;
  });
  expect(bad, 'a mark may not hand back a run its own cut does not draw').toEqual([]);
});

test('the run menu is findable where there is no pointer to hover with', async ({ page }) => {
  /* ⋮ rests at 3.07:1 on the entry ground — right for something a pointer lights up on the way
     past, invisible on a phone, where the resting state is the only state there is. Paul could not
     find it at all. Measured, not eyeballed: the touch color must be a real lift on the mouse one. */
  await page.goto(PAGE);
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).map(n => {
      const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const read = () => page.locator('#p239 .entry-menu > summary').evaluate(el => {
    const c = getComputedStyle(el), b = el.getBoundingClientRect();
    return { color: c.color, w: b.width, h: b.height };
  });
  const mouse = await read();
  const touch = await page.emulateMedia({ forcedColors: null }).then(async () => {
    const ctx = await page.context().browser().newContext({ hasTouch: true, isMobile: true,
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    const pg = await ctx.newPage();
    await pg.goto(PAGE);
    const s = pg.locator('#p239 .entry-menu > summary');
    const got = await s.evaluate(el => {
      const c = getComputedStyle(el), b = el.getBoundingClientRect();
      return { color: c.color, w: b.width, h: b.height };
    });
    await s.tap();
    got.opens = await pg.locator('#p239 .entry-menu[open]').count() === 1;
    await ctx.close();
    return got;
  });
  expect(lum(touch.color), 'the ⋮ rests as dim on a phone as it does under a mouse').toBeGreaterThan(lum(mouse.color) * 1.5);
  expect(Math.min(touch.w, touch.h), 'and it must be a finger-sized target').toBeGreaterThanOrEqual(28);
  expect(touch.opens, 'a tap did not open it').toBe(true);
});

/* ── ASKING A SIGN ──────────────────────────────────────────────────────────────────────────────
   A sign's panel is not written down anywhere: the scrawl comes off the sign table, the word off the
   walk, the run off the sign's own number. Nothing to keep in step, and so nothing a stale line can
   go wrong in — but also nothing a reader could have checked. These are that check. */

const WIRE = require('../scripts/wire');
const CODES = Object.values(WIRE.codes).filter(Boolean);
const marksOfCode = c => c.replace(/1(?=2)/g, '▪').replace(/2/g, '⟅').replace(/3/g, '⟆')
                          .replace(/1/g, '▪').replace(/0/g, '▫');

// every handle on the page, and the run its panel will claim for it
const sidRun = sid => sid.split('.').map(d => '12' + Number(d).toString(2) + '3').join('');

test('a sign hands back a run the wire actually sent', async ({ page }) => {
  await page.goto(PAGE);
  const sids = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('[data-sid]')].map(e => e.getAttribute('data-sid')))]);
  expect(sids.length, 'no sign on the page carries a handle').toBeGreaterThan(200);
  /* THE ONE CHECK WORTH HAVING. The panel tells a reader "this came in as ▪⟅▪▫▫▪▫⟆". If that run is
     not in some statement of the message, word for word, the panel is inventing the wire — which is
     exactly how ⟦ came to claim a run §400 does not draw (08-11). Not a sample: all of them. */
  const wrong = sids.filter(sid => { const r = sidRun(sid); return !CODES.some(c => c.includes(r)); });
  expect(wrong.map(s => s + ' -> ' + marksOfCode(sidRun(s))),
    'a sign\'s panel claims a run that appears in no statement').toEqual([]);
});

test('a sign shows both its faces, and the run under both', async ({ page }) => {
  await page.goto(PAGE);
  const ask = async (sel) => {
    await page.keyboard.press('Escape');
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded(); await el.click();
    return page.evaluate(() => {
      const d = document.querySelector('.mk-pop'); if (!d) return null;
      const run = d.querySelector('.mk-run'), cut = d.querySelector('.mk-cut');
      return { word: (d.querySelector('.mk-word') || {}).textContent || null,
               run: run ? run.textContent.replace(/\s+/g, '') : null,
               at: cut ? cut.getAttribute('href') : null,
               says: d.textContent };
    });
  };
  /* The founder's first coinage, met two hundred passes after she made it. THE WORD IS READ OFF HER
     COINING SPAN, not typed here: renaming a coinage is an ordinary story edit, and a test that
     spells it out turns that into a failure in tests/ — the last place a writer thinks to look.
     What must hold is that the panel hands back HER word, whatever she called it. */
  const coined = await page.locator('#p207 .coin[data-sign="intro"]').innerText();
  expect(await ask('#p400 [data-sid="18"]')).toMatchObject({ word: coined, run: '▪⟅▪▫▫▪▫⟆', at: '#p207' });
  /* A SIGN WHOSE NUMBER WILL NOT FIT IN ONE GLYPH — two base-64 digits, one id, one run. These
     answered with nothing at all until 08-12, because `idOf` gave up on a second glyph. */
  expect(await ask('#p384 [data-sid="73"]')).toMatchObject({ run: '▪⟅▪▫▫▪▫▫▪⟆' });
});

test('a sign panel never prints the author\'s name for it', async ({ page }) => {
  await page.goto(PAGE);
  /* THE GLOSS RULE, ENFORCED ON THE ONE AID THAT COULD BREAK IT. `hydrogen`, `equals-Object-Z` is
     what a sign MEANS — the thing the book spends four hundred passes earning — and the panel is
     only ever allowed to say what the wire sent. The key has to be in the browser for the panel to
     find a keeper's WORD for a sign; it must not come out the other side. (Not secrecy: the page
     ships the whole sign table and is meant to. What is governed is what the panel PRINTS.) */
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[data-sid]').forEach(e => {
      const sid = e.getAttribute('data-sid');
      if (!/^\d+(\.\d+)*$/.test(sid)) out.push('handle is not a number: ' + sid);
    });
    return out;
  });
  expect(bad, 'a sign handle must be the number the wire sends, never the author\'s key').toEqual([]);
  const el = page.locator('#p540 [data-sid]').first();
  await el.scrollIntoViewIfNeeded(); await el.click();
  const said = await page.locator('.mk-pop').textContent();
  for (const key of ['hydrogen', 'proton', 'door', 'room', 'java', 'instanceof'])
    expect(said.toLowerCase(), `the panel printed the author's key "${key}"`).not.toContain(key);
});

test('a sign panel does not reach forward past the pass that names it', async ({ page }) => {
  await page.goto(PAGE);
  /* Two signs in the book are drawn before anybody has a word for them: `unary` at §214, named at
     §232, and `begin` at §388, named at §462. A reader standing at the earlier pass must be told
     what came in and not what it will later be called. */
  const early = async (sel) => {
    await page.keyboard.press('Escape');
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded(); await el.click();
    return page.evaluate(() => {
      const d = document.querySelector('.mk-pop'); if (!d) return null;
      const cut = d.querySelector('.mk-cut');
      return { word: !!d.querySelector('.mk-word'), at: cut ? cut.textContent : null };
    });
  };
  const before = await early('#p388 [data-sid="75"]');   // `begin`, five passes of walking before its name
  expect(before, 'a sign drawn before its coining must still answer').not.toBeNull();
  expect(before.word, 'the panel handed over a word the book has not cut yet').toBe(false);
  expect(before.at, 'and it should say where the reader is meeting it').toContain('first on the page');
});

test('a sign that answers in a panel does not also answer in a tooltip', async ({ page }) => {
  await page.goto(PAGE);
  const el = page.locator('#p400 [data-sid="18"]').first();
  await el.scrollIntoViewIfNeeded();
  expect(await el.getAttribute('title'), 'the cheap hover answer should be there to begin with').toBe('sign 18');
  await el.click();
  await expect(page.locator('.mk-pop')).toHaveCount(1);
  expect(await el.getAttribute('title'), 'the browser tooltip is a second answer over the first').toBeNull();
  /* AND THE OTHER ONE. A `.gloss` also has a badge of its own, toggled on tap by the keeper-numeral
     handler, which is how `sign 18` sat on top of the panel that already says it. A sign is skipped
     there now — but a keeper's numeral must keep its badge, since it has no panel to go to. */
  await expect(page.locator('.gloss.showing'), 'the badge answered the same question again').toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await el.getAttribute('title'), 'and it must come back when the panel shuts').toBe('sign 18');

  const num = page.locator('#p400 .rk, #p400 .num').first();
  await num.scrollIntoViewIfNeeded(); await num.click();
  await expect(page.locator('.gloss.showing'), 'a keeper\'s numeral still says its figure on a tap')
    .toHaveCount(1);
});
