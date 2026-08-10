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

// A reader drives these by pressing the same button over and over. Every bar is a centred row, and
// the text in it changes as the thing runs — play/pause, let-it-run/rest, and a say-line that is a
// different length at every step — so before this was pinned down, pressing `step` re-centred the
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

