#!/usr/bin/env python3
"""notes.py — read and work the shared issue queue from the terminal.

The other half of scripts/notes-server.py.  Paul double-taps a word on the page and types; this is
how I see it, and how I mark it dealt with.  No server needed — it opens notes.db directly.

  scripts/notes.py                 open notes, oldest first (the queue)
  scripts/notes.py all             open and done
  scripts/notes.py show 7          one note in full, with its anchor and context
  scripts/notes.py close 7 "cut it, §193 now reads …" "§193: cut the paragraph after EX:12"
  scripts/notes.py close 7 "no change — here is why"          (no third argument = nothing edited)
  scripts/notes.py reopen 7

The THIRD argument is what changed in the book. Leave it off when the reply explains rather than
edits. A reply that moved the text and a reply that only answered a question look identical
otherwise, and Paul has to be able to tell at a glance which one he is reading.
"""
import os, sqlite3, sys, textwrap
from datetime import datetime, timezone

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'notes.db')
BOLD, DIM, AMBER, GREEN, OFF = '\033[1m', '\033[2m', '\033[33m', '\033[32m', '\033[0m'


def conn():
    if not os.path.exists(DB):
        sys.exit('no notes.db yet — start scripts/notes-server.py and leave a note')
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    return c


def listing(status):
    sql = 'SELECT * FROM issues'
    args = []
    if status != 'all':
        sql += ' WHERE status = ?'; args.append(status)
    sql += ' ORDER BY id'
    rows = conn().execute(sql, args).fetchall()
    if not rows:
        print('queue empty'); return
    for r in rows:
        head = '%s#%-3d%s %s%-14s%s %s"%s"%s' % (
            BOLD, r['id'], OFF,
            DIM, (r['section'] or '—'), OFF,
            AMBER, (r['anchor'] or '')[:34], OFF)
        flag = '' if r['status'] == 'open' else GREEN + '  ✓ done' + OFF
        print(head + flag)
        for line in textwrap.wrap(r['body'], 92):
            print('     ' + line)
        if r['reply']:
            for line in textwrap.wrap('↳ ' + r['reply'], 92):
                print('     ' + DIM + line + OFF)
        if r['status'] == 'done':
            ch = r['changed'] if 'changed' in r.keys() else None
            print('     ' + (GREEN + '✎ changed: ' + ch + OFF if ch
                             else DIM + '(answered, nothing edited)' + OFF))
        print()


def show(i):
    r = conn().execute('SELECT * FROM issues WHERE id=?', (i,)).fetchone()
    if not r: sys.exit('no note #%s' % i)
    print('%s#%d%s  %s  %s' % (BOLD, r['id'], OFF, r['status'], r['created_at']))
    print('  page    %s' % (r['page'] or '—'))
    print('  section %s' % (r['section'] or '—'))
    print('  anchor  %s%s%s' % (AMBER, r['anchor'], OFF))
    print('  context %s…%s' % (DIM, OFF))
    for line in textwrap.wrap(r['context'] or '', 88):
        print('          ' + DIM + line + OFF)
    print()
    for line in textwrap.wrap(r['body'], 92): print('  ' + line)
    if r['reply']:
        print()
        for line in textwrap.wrap('↳ ' + r['reply'], 92): print('  ' + DIM + line + OFF)


def close(i, reply, changed=None):
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')
    with conn() as c:
        c.execute('UPDATE issues SET status="done", closed_at=?, reply=COALESCE(?,reply),'
                  ' changed=COALESCE(?,changed) WHERE id=?', (now, reply, changed, i))
    print('#%s closed%s' % (i, ('  ✎ ' + changed) if changed else '  (no edit)'))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:                        listing('open')
    elif a[0] == 'all':              listing('all')
    elif a[0] == 'done':             listing('done')
    elif a[0] == 'show' and len(a) > 1:   show(int(a[1]))
    elif a[0] == 'close' and len(a) > 1:
        close(int(a[1]), a[2] if len(a) > 2 else None, a[3] if len(a) > 3 else None)
    elif a[0] == 'reopen' and len(a) > 1:
        with conn() as c: c.execute('UPDATE issues SET status="open",closed_at=NULL WHERE id=?', (int(a[1]),))
        print('#%s reopened' % a[1])
    else: sys.exit(__doc__)
