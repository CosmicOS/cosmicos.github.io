// Playwright config for the listener lesson's live exhibits.
//
// The lesson has TEN moving parts and they are easy to miss, because they live inside
// _prose/*.blocks.json and js/*.js rather than anywhere obvious in the prose. A session that
// runs this suite is told what exists before it proposes building any of it again.
//
//   npx playwright test            all of it
//   npx playwright test -g ring    one exhibit
//
// The suite drives the REAL built site, so run scripts/build.sh first (the webServer below
// serves _site, it does not build it).
module.exports = {
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8393', headless: true },
  webServer: {
    command: 'python3 -m http.server 8393 --bind 127.0.0.1 --directory _site',
    url: 'http://127.0.0.1:8393/listener.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
};
