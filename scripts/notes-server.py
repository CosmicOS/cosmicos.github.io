#!/usr/bin/env python3
"""notes-server.py — the shared issue queue, plus a static server for _site.

WHY.  Commenting on the diary meant leaving the page, switching to the terminal, and describing
where the problem was in words.  Now: double-tap a word on the page, type, send.  It lands in a
SQLite table that both of us read, and the anchor (section + word + surrounding text) is captured
for free, so nobody has to say "the bit in 193 about the doubled-shut" ever again.

RUN:   scripts/notes-server.py [port]        (default 3333, serves _site/)

Binds 0.0.0.0 so a phone on the same LAN can reach it — it prints the LAN URL on startup. That
does mean anything on the network can read the site and the queue; it is a scratch server on a
home network, not something to run anywhere else.

The DB is notes.db at the repo root, gitignored.  One table, `issues`, used as a queue:
`status` is 'open' until it is dealt with, then 'done'.  Read it from the CLI with scripts/notes.py.

API (same origin, no CORS needed):
  GET  /api/notes?status=open      -> {"notes": [...]}
  POST /api/notes                  -> {"id": N}      body: {page, section, anchor, context, body}
  POST /api/notes/close            -> {"ok": true}   body: {id, reply?}
  POST /api/notes/reopen           -> {"ok": true}   body: {id}
Anything else is served from _site/, so the page and the queue live on one port.

THE CLIENT COMES FROM HERE TOO.  `js/notes.js` is served out of the REPO, not out of _site, and its
script tag is injected into every page this server hands over.  So the widget exists exactly when
this server is running and at no other time: the built site carries no reference to it, `_config.yml`
keeps the file itself out of _site, and nothing has to be remembered or stripped before publishing.
It used to be a tag in index.html that "did nothing in production" — which still meant shipping the
script and firing a 404 at /api/notes on every visitor's page load.
"""
import http.server, json, os, sqlite3, sys, urllib.parse
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, '_site')
DB   = os.path.join(ROOT, 'notes.db')
NOTES_TAG = b'<script src="/js/notes.js"></script>\n'

SCHEMA = """
CREATE TABLE IF NOT EXISTS issues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT 'paul',
  status     TEXT NOT NULL DEFAULT 'open',   -- open | done
  page       TEXT,                           -- /index.html
  section    TEXT,                           -- p193, station-book, …
  anchor     TEXT,                           -- the word that was tapped
  context    TEXT,                           -- ~160 chars around it, so it can be found again
  body       TEXT NOT NULL,                  -- what you typed
  reply      TEXT,                           -- what I said back
  closed_at  TEXT
);
CREATE INDEX IF NOT EXISTS issues_status ON issues(status, id);
"""

# Added after the first version: a reply that CHANGED the text and a reply that merely explained it
# are different answers, and they were arriving looking identical. `changed` is a one-line summary of
# what was edited, NULL when nothing was; the page shows the two differently.
COLUMNS = {'changed': 'TEXT'}


def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    have = {r['name'] for r in c.execute('PRAGMA table_info(issues)')}
    for col, typ in COLUMNS.items():
        if col not in have:
            c.execute('ALTER TABLE issues ADD COLUMN %s %s' % (col, typ))
    return c


def now():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)

    # --- plumbing -----------------------------------------------------------
    def _json(self, obj, code=200):
        payload = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}')

    def log_message(self, fmt, *args):          # quiet: one line per API call only
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write("  %s\n" % (fmt % args))

    # --- routes -------------------------------------------------------------
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/api/version':
            # mtime of the built page, so a reader can be told the prose under them has changed
            # rather than having to scroll to the top and pull down on the off-chance.
            try:
                p = os.path.join(SITE, (urllib.parse.parse_qs(u.query).get('page') or ['/index.html'])[0].lstrip('/'))
                return self._json({'v': int(os.path.getmtime(p))})
            except Exception:
                return self._json({'v': 0})
        if u.path == '/api/notes':
            q = urllib.parse.parse_qs(u.query)
            status = (q.get('status') or ['all'])[0]
            page = (q.get('page') or [None])[0]
            sql, args = 'SELECT * FROM issues', []
            where = []
            if status in ('open', 'done'):
                where.append('status = ?'); args.append(status)
            if page:
                where.append('page = ?'); args.append(page)
            if where:
                sql += ' WHERE ' + ' AND '.join(where)
            sql += ' ORDER BY id'
            with db() as c:
                rows = [dict(r) for r in c.execute(sql, args)]
            return self._json({'notes': rows})

        # the note-taking client, out of the repo — it is deliberately not in the built site
        if u.path == '/js/notes.js':
            return self._file(os.path.join(ROOT, 'js', 'notes.js'), 'application/javascript')

        # every page gets the client injected on the way out
        page = self._local_html(u.path)
        if page:
            return self._file(page, 'text/html; charset=utf-8', inject=NOTES_TAG)

        return super().do_GET()

    # --- static, with the widget spliced in ---------------------------------
    def _local_html(self, path):
        """the file _site would serve for this URL, if it is an HTML page."""
        p = os.path.join(SITE, urllib.parse.unquote(path).lstrip('/'))
        if os.path.isdir(p):
            p = os.path.join(p, 'index.html')
        return p if p.endswith('.html') and os.path.isfile(p) else None

    def _file(self, path, ctype, inject=None):
        try:
            with open(path, 'rb') as f:
                body = f.read()
        except OSError:
            return self.send_error(404)
        if inject:
            body = (body.replace(b'</body>', inject + b'</body>', 1)
                    if b'</body>' in body else body + inject)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        # NO CACHING, for the same reason this server exists: the page under the reader is being
        # edited while they look at it, and a phone holding yesterday's copy has cost hours before.
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        try:
            b = self._body()
        except Exception as e:
            return self._json({'error': 'bad json: %s' % e}, 400)

        if u.path == '/api/notes':
            if not (b.get('body') or '').strip():
                return self._json({'error': 'empty note'}, 400)
            with db() as c:
                cur = c.execute(
                    'INSERT INTO issues (created_at, author, status, page, section, anchor, context, body)'
                    ' VALUES (?,?,?,?,?,?,?,?)',
                    (now(), b.get('author') or 'paul', 'open', b.get('page'), b.get('section'),
                     b.get('anchor'), b.get('context'), b['body'].strip()))
            sys.stderr.write('  ● note #%d  [%s] "%s" — %s\n' % (
                cur.lastrowid, b.get('section') or '?', (b.get('anchor') or '')[:30],
                b['body'].strip()[:60]))
            return self._json({'id': cur.lastrowid})

        if u.path == '/api/notes/close':
            with db() as c:
                c.execute('UPDATE issues SET status="done", closed_at=?, reply=COALESCE(?, reply),'
                          ' changed=COALESCE(?, changed) WHERE id=?',
                          (now(), b.get('reply'), b.get('changed'), b.get('id')))
            return self._json({'ok': True})

        if u.path == '/api/notes/reopen':
            with db() as c:
                c.execute('UPDATE issues SET status="open", closed_at=NULL WHERE id=?', (b.get('id'),))
            return self._json({'ok': True})

        return self._json({'error': 'no such route'}, 404)


def lan_ip():
    """This machine's address on the LAN. The UDP socket sends nothing; connect() on a datagram
    socket just picks the route, which is what tells us which interface a phone would reach."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80)); return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


PORT = 3333          # fixed, so the phone bookmark never goes stale

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    db().close()
    if not os.path.isdir(SITE):
        sys.exit('no _site/ — run scripts/build.sh (or jekyll build) first')
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler)
    ip = lan_ip()
    print('  here    http://127.0.0.1:%d/index.html' % port)
    if ip:
        print('  phone   http://%s:%d/index.html' % (ip, port))
    print('  db      %s' % DB)
    print('double-tap any word to leave a note.  Ctrl-C to stop.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
