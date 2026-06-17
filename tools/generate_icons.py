"""Generate the extension's PNG icons (concept 6: knot mark + count badge).

Chrome extension icons must be raster (PNG), not SVG, so we draw the mark with
Pillow at 8x supersampling and downsample with LANCZOS for crisp small sizes.

Run with the quant env that has Pillow:
  /opt/homebrew/Caskroom/miniforge/base/envs/quant/bin/python tools/generate_icons.py
"""

import os
from PIL import Image, ImageDraw

SCALE = 8
N = 128 * SCALE
TEAL = (16, 163, 127, 255)   # #10A37F, ChatGPT-ish green
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
SIZES = [16, 32, 48, 128]


def s(v):
    return int(round(v * SCALE))


def make_master():
    base = Image.new("RGBA", (N, N), TRANSPARENT)
    draw = ImageDraw.Draw(base)

    # Rounded-square tile (transparent corners) so it reads on any toolbar bg.
    draw.rounded_rectangle([0, 0, N - 1, N - 1], radius=s(28), fill=TEAL)

    # Knot: three overlapping ellipse loops rotated 0 / 60 / 120 degrees.
    kc = (s(56), s(68))
    a, b = s(13), s(34)
    stroke = s(8)
    ellipse_bbox = [kc[0] - a, kc[1] - b, kc[0] + a, kc[1] + b]
    for angle in (0, 60, 120):
        layer = Image.new("RGBA", (N, N), TRANSPARENT)
        ldraw = ImageDraw.Draw(layer)
        ldraw.ellipse(ellipse_bbox, outline=WHITE, width=stroke)
        layer = layer.rotate(angle, center=kc, resample=Image.BICUBIC)
        base.alpha_composite(layer)

    # Count badge in the top-right corner.
    bc = (s(96), s(32))
    halo = s(27)   # same-color ring punches a clean gap around the badge
    white_r = s(22)
    draw.ellipse([bc[0] - halo, bc[1] - halo, bc[0] + halo, bc[1] + halo], fill=TEAL)
    draw.ellipse([bc[0] - white_r, bc[1] - white_r, bc[0] + white_r, bc[1] + white_r], fill=WHITE)

    # Bold "+" drawn as two rounded bars (no font dependency, legible when small).
    arm, thick = s(11), s(3.5)
    draw.rounded_rectangle([bc[0] - arm, bc[1] - thick, bc[0] + arm, bc[1] + thick], radius=thick, fill=TEAL)
    draw.rounded_rectangle([bc[0] - thick, bc[1] - arm, bc[0] + thick, bc[1] + arm], radius=thick, fill=TEAL)

    return base


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    master = make_master()
    for size in SIZES:
        img = master.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        img.save(path)
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
