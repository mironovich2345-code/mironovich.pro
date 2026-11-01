#!/usr/bin/env python3
"""
Favicon generator for mironovich.pro — approved variant A, «M.»:
white M with a red full stop on a graphite square (the red period echoes the
site's headings, e.g. «Данил Миронович.»).

The geometry below is the single source of truth. Every output — the SVG master
and all raster sizes — is generated from it, so edit here and re-run:

    pip install pillow            # once
    python3 assets/favicon/generate.py

Shapes are laid out on a 16×16 grid with edges on whole units, so the icon stays
sharp at 16 px and 32 px. Rasters are drawn 16× larger and box-downsampled
(exact area coverage), which keeps edges crisp without blur.

Outputs (paths relative to the repository root):
    assets/favicon/favicon.svg    vector master (not served)
    public/favicon.ico            16, 32, 48 (PNG-compressed entries)
    public/icon-48.png            48×48    <link rel="icon">
    public/icon-192.png           192×192  <link rel="icon"> and web app manifest
    public/apple-touch-icon.png   180×180  <link rel="apple-touch-icon">, opaque
    public/icon-512.png           web app manifest

The <link> tags are declared in app/layout.tsx (metadata.icons) with a ?v=
version: after changing the icon, bump ICON_VERSION in config/site.ts so
browsers that cached the previous favicon fetch the new one.
"""
import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]

GRAPHITE = "#0E0E11"
CREAM = "#F2EFE8"  # site's white
SIGNAL = "#D92D2D"  # brand red

GRID = 16


def m_polygon(x0, y0, x1, y1, stem):
    """Bold geometric M inside the box (x0, y0)–(x1, y1), stem width `stem`."""
    h = y1 - y0
    xm = (x0 + x1) / 2
    return [
        (x0, y1), (x0, y0), (x0 + stem * 1.1, y0), (xm, y0 + h * 0.52),
        (x1 - stem * 1.1, y0), (x1, y0), (x1, y1), (x1 - stem, y1),
        (x1 - stem, y0 + h * 0.38), (xm + stem * 0.45, y0 + h * 0.75),
        (xm - stem * 0.45, y0 + h * 0.75), (x0 + stem, y0 + h * 0.38), (x0 + stem, y1),
    ]


# «M.» — the M spans x 2..11, the dot x 12..14: the pair is centred on the tile
M = m_polygon(2, 3, 11, 13, 2)
DOT = (12, 11, 14, 13)  # x0, y0, x1, y1


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def render(size, supersample=16):
    big = size * supersample
    k = big / GRID
    im = Image.new("RGB", (big, big), hex_rgb(GRAPHITE))
    d = ImageDraw.Draw(im)
    d.polygon([(x * k, y * k) for x, y in M], fill=hex_rgb(CREAM))
    x0, y0, x1, y1 = DOT
    d.rectangle([x0 * k, y0 * k, x1 * k - 1, y1 * k - 1], fill=hex_rgb(SIGNAL))
    return im.resize((size, size), Image.BOX)


def svg():
    pts = " ".join(f"{x:g},{y:g}" for x, y in M)
    x0, y0, x1, y1 = DOT
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}" width="512" height="512">\n'
        f'  <title>MIRONOVICH</title>\n'
        f'  <rect width="{GRID}" height="{GRID}" fill="{GRAPHITE}"/>\n'
        f'  <polygon points="{pts}" fill="{CREAM}"/>\n'
        f'  <rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="{SIGNAL}"/>\n'
        f"</svg>\n"
    )


def png_bytes(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def write_ico(path, sizes):
    """ICO with one PNG entry per size, each rendered natively (not rescaled)."""
    images = [png_bytes(render(s)) for s in sizes]
    header = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b""
    for s, data in zip(sizes, images):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    path.write_bytes(header + entries + b"".join(images))


def main():
    (ROOT / "assets/favicon/favicon.svg").write_text(svg())
    write_ico(ROOT / "public/favicon.ico", [16, 32, 48])
    for rel, size in [
        ("public/icon-48.png", 48),
        ("public/icon-192.png", 192),
        ("public/apple-touch-icon.png", 180),
        ("public/icon-512.png", 512),
    ]:
        (ROOT / rel).write_bytes(png_bytes(render(size)))
        print("wrote", rel)
    print("wrote public/favicon.ico, assets/favicon/favicon.svg")


if __name__ == "__main__":
    main()
