"""Give the cosmic_spider font its braille codepoints. THE MAP IS IN scripts/scrawl.js.

   python3 scripts/remap-font-to-braille.py fonts/cosmic_spider.{woff,woff2,ttf}

Run on any fresh font copy, then duplicate each <glyph unicode=...> line in the .svg by hand, then
bump `?v=` on the font URL in css/main.css or every cached browser keeps the old map. .eot is
IE-only and unreferenced; leave it."""
import sys
from fontTools.ttLib import TTFont

def remap(path):
    f = TTFont(path)
    add = {}
    for table in f['cmap'].tables:
        if not table.isUnicode():
            continue
        for cp, name in list(table.cmap.items()):
            if 0xf144 <= cp <= 0xf183:
                add[cp] = (0x2840 + cp - 0xf144, name)
            elif 0xf204 <= cp <= 0xf24b:
                add[cp] = (0x28c0 + cp - 0xf204, name)
    for table in f['cmap'].tables:
        if not table.isUnicode():
            continue
        for cp, (bcp, name) in add.items():
            if cp in table.cmap:
                table.cmap[bcp] = name
    f.save(path)
    return len(add)

for p in sys.argv[1:]:
    n = remap(p)
    print('%-34s +%d braille codepoints' % (p, n))
