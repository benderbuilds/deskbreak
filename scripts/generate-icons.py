#!/usr/bin/env python3
"""Crop Jesse’s locked mark PNG and write favicon / PWA / LogoMark rasters.

Does not redraw the silhouette. Source: scripts/locked-mark-source.png
(the attached lock image).
"""
from __future__ import annotations

import base64
from collections import deque
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / "locked-mark-source.png"
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"


def is_page(p: tuple[int, int, int, int]) -> bool:
    r, g, b, a = p
    return r > 235 and g > 235 and b > 235


def is_strong_coral(p: tuple[int, int, int, int]) -> bool:
    r, g, b, a = p
    return a > 0 and r > 200 and g < 150 and b < 150 and (r - g) > 50


def is_white_figure(p: tuple[int, int, int, int]) -> bool:
    r, g, b, a = p
    if a < 200:
        return False
    lum = (r + g + b) / 3
    sat = max(r, g, b) - min(r, g, b)
    return lum > 200 and sat < 55


def crop_lock(im: Image.Image) -> tuple[Image.Image, tuple[int, int, int]]:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if not is_page(px[x, y]):
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    cw, ch = maxx - minx + 1, maxy - miny + 1
    side = max(cw, ch) + 4
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    canvas.paste(im.crop((minx, miny, maxx + 1, maxy + 1)), (ox, oy))

    cp = canvas.load()
    sw, sh = canvas.size
    seen = [[False] * sw for _ in range(sh)]
    q: deque[tuple[int, int]] = deque()
    for x in range(sw):
        q.append((x, 0))
        q.append((x, sh - 1))
    for y in range(sh):
        q.append((0, y))
        q.append((sw - 1, y))
    while q:
        x, y = q.popleft()
        if not (0 <= x < sw and 0 <= y < sh) or seen[y][x]:
            continue
        p = cp[x, y]
        if is_strong_coral(p):
            continue
        seen[y][x] = True
        if p[3] != 0:
            cp[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    corals: list[tuple[int, int, int]] = []
    for y in range(sh):
        for x in range(sw):
            r, g, b, a = cp[x, y]
            if is_strong_coral((r, g, b, a)):
                corals.append((r, g, b))
    corals.sort()
    coral = corals[len(corals) // 2]
    return canvas, coral


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def fullbleed(img: Image.Image, size: int, coral: tuple[int, int, int]) -> Image.Image:
    src = resize(img, size)
    out = Image.new("RGB", (size, size), coral)
    sp = src.load()
    op = out.load()
    for y in range(size):
        for x in range(size):
            p = sp[x, y]
            if is_white_figure(p):
                op[x, y] = (p[0], p[1], p[2])
    return out


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing lock source: {SRC}")

    im = Image.open(SRC).convert("RGBA")
    cropped, coral = crop_lock(im)
    master = resize(cropped, 1024)

    ICONS.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    resize(master, 512).save(ICONS / "icon-512.png", optimize=True)
    resize(master, 192).save(ICONS / "icon-192.png", optimize=True)
    resize(master, 128).save(ICONS / "logo-mark.png", optimize=True)

    fullbleed(master, 180, coral).save(PUBLIC / "apple-touch-icon.png", optimize=True)

    fb512 = fullbleed(master, 512, coral)
    mask = Image.new("RGB", (512, 512), coral)
    inset = fb512.resize((410, 410), Image.Resampling.LANCZOS)
    pad = (512 - 410) // 2
    mask.paste(inset, (pad, pad))
    mask.save(ICONS / "icon-512-maskable.png", optimize=True)

    f32 = resize(master, 32)
    f16 = resize(master, 16)
    f32.save(PUBLIC / "favicon-32.png", optimize=True)
    f16.save(PUBLIC / "favicon-16.png", optimize=True)
    sizes = [resize(master, s) for s in (64, 48, 32, 16)]
    sizes[0].save(
        PUBLIC / "favicon.ico",
        format="ICO",
        append_images=sizes[1:],
        sizes=[(64, 64), (48, 48), (32, 32), (16, 16)],
    )

    buf = BytesIO()
    f32.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    (PUBLIC / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"'
        ' role="img" aria-label="DeskBreak">\n'
        f'  <image href="data:image/png;base64,{b64}" width="32" height="32"/>\n'
        "</svg>\n"
    )

    stale = ICONS / "apple-touch-icon.png"
    if stale.exists():
        stale.unlink()

    print("wrote icons from locked PNG", SRC.name, "coral", coral)


if __name__ == "__main__":
    main()
