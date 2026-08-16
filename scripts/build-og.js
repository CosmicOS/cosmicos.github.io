/* build-og.js — render the social card to images/og-second-book.jpg.
 *
 * A LINK TO THIS SITE IS POSTED SOMEWHERE BEFORE IT IS READ, and with no og:image the preview is a
 * bare URL. This draws the card the same way the page draws itself: scripts/og-card.html loads the
 * site's real css/main.css and the real fonts, so the card cannot drift into being a second, hand-
 * kept version of the design. That is also why it is SHOT rather than authored as an image — the
 * title face, the notation ink and the ground colour all come from the stylesheet.
 *
 *   node scripts/build-og.js        (needs a built _site; run scripts/build.sh or jekyll first)
 *
 * JPEG, NOT PNG. The same card is 670 kB as a PNG and ~90 kB here, and every scraper that fetches it
 * fetches the whole thing before it will show a preview. It is a photograph with text over it, which
 * is the case JPEG is for.
 *
 * The card is copied INTO _site to be served, and removed after. It cannot be shot from the repo
 * over file:// — `/css/main.css` and the @font-face URLs under it are absolute, and the card is
 * deliberately written to use the same absolute paths a real page does.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const CARD = path.join(SITE, '_ogcard.html');
const OUT = path.join(ROOT, 'images', 'og-second-book.jpg');

// 1200x630 is the size Open Graph, Twitter/X, Slack and Bluesky all crop against (1.91:1). Anything
// else gets cut somewhere, and the cut is never the same twice.
const W = 1200, H = 630;

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
  '.eot': 'application/vnd.ms-fontobject', '.ico': 'image/x-icon',
};

(async () => {
  if (!fs.existsSync(SITE)) {
    console.error('no _site — run scripts/build.sh (or jekyll build) first');
    process.exit(1);
  }
  fs.copyFileSync(path.join(__dirname, 'og-card.html'), CARD);

  const server = http.createServer((req, res) => {
    // Stay inside _site: a request may not climb out of it with `..`.
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(SITE, rel);
    if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/_ogcard.html`, { waitUntil: 'networkidle' });
  // networkidle covers the photograph and the stylesheet; the webfonts are declared inside main.css
  // and can still be swapping when it fires, which shoots the title in Courier.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
  await browser.close();

  server.close();
  fs.unlinkSync(CARD);
  console.log(`${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} kB`);
})();
