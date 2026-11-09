# The Chrome Web Store icon, 128 x 128: the product's four-dot logo (the same
# mark as newtab.html's brand-icon and the promo tiles) on a dark slate rounded
# square. Drawn at 8x and downsampled, so the edges are clean at 128.
#
# Follows the store's icon guideline: 96 x 96 artwork centred with 16 px of
# transparent padding per side, and it must read on light AND dark pages, so
# the square carries a faint light edge and a preview of both is written.
#   python -I store-icon.py <out-dir>
import os, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
S = 8                      # supersampling factor
N = 128 * S

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# The square: 96 px at 16 px in, corner radius 22, slate-indigo top to bottom.
x0, x1, r = 16 * S, 112 * S, 22 * S
top, bot = rgb("#2b3152"), rgb("#151927")
grad = Image.new("RGBA", (N, N))
gd = ImageDraw.Draw(grad)
for y in range(x0, x1):
    t = (y - x0) / (x1 - x0)
    gd.line([(0, y), (N, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
mask = Image.new("L", (N, N), 0)
ImageDraw.Draw(mask).rounded_rectangle([x0, x0, x1 - 1, x1 - 1], radius=r, fill=255)
icon = Image.new("RGBA", (N, N), (0, 0, 0, 0))
icon.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(icon)
# A faint light edge, so the square holds its shape on a dark page.
d.rounded_rectangle([x0, x0, x1 - 1, x1 - 1], radius=r, outline=(236, 238, 244, 34), width=S)
# The dots, in the in-app logo's order: blue, red / green, yellow.
dots = [((45, 45), "#4285F4"), ((83, 45), "#EA4335"), ((45, 83), "#34A853"), ((83, 83), "#FBBC05")]
R = 12.5
for (cx, cy), c in dots:
    d.ellipse([(cx - R) * S, (cy - R) * S, (cx + R) * S, (cy + R) * S], fill=rgb(c) + (255,))

out = icon.resize((128, 128), Image.LANCZOS)
out.save(os.path.join(OUT, "store-icon-128.png"), optimize=True)

# Preview: the icon at 1x and 2x on a light and a dark ground.
prev = Image.new("RGB", (2 * 420, 260))
for i, ground in enumerate(["#ffffff", "#1f1f1f"]):
    tile = Image.new("RGB", (420, 260), rgb(ground))
    tile.paste(out, (24, 66), out)
    big = icon.resize((256, 256), Image.LANCZOS).crop((16, 16, 240, 240))
    tile.paste(big, (176, 18), big)
    prev.paste(tile, (i * 420, 0))
prev.save(os.path.join(OUT, "store-icon-preview.png"))
print(out.mode, out.size, "corner alpha", out.getpixel((0, 0))[3], "centre", out.getpixel((64, 64)))
