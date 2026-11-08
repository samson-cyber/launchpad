# Contrast of every caption line against the REAL ground behind it: the frame
# re-rendered with the text made transparent. For each text box, the worst
# ratio over the ground pixels in the box (lightest pixel for light text,
# darkest for dark text), against WCAG's 4.5:1 (or 3:1 for text >= 24px, or
# >= 18.66px bold). Text shadow is ignored, which only makes it stricter.
#   python -I card-contrast.py <out-dir>
import json, re, sys, os
from PIL import Image

OUT = sys.argv[1]
rep = json.load(open(os.path.join(OUT, "report.json")))

def lum(rgb):
    def ch(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

def parse(c):
    m = re.match(r"rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)", c)
    return tuple(float(m.group(i)) for i in (1, 2, 3)), float(m.group(4)) if m.group(4) else 1.0

fails = 0
items = [(k, v["boxes"]) for k, v in rep.items() if isinstance(v, dict) and "boxes" in v and k != "compareVideo"]
if "compareVideo" in rep:
    items.append(("compare-video-final", rep["compareVideo"]["boxes"]))
for name, boxes in items:
    ground = Image.open(os.path.join(OUT, name + ".ground.png")).convert("RGB")
    W, H = ground.size
    for bx in boxes:
        fg, a = parse(bx["color"])
        x0, y0 = max(0, bx["x"]), max(0, bx["y"])
        x1, y1 = min(W, bx["x"] + bx["w"]), min(H, bx["y"] + bx["h"])
        if x1 <= x0 or y1 <= y0:
            continue
        px = list(ground.crop((x0, y0, x1, y1)).getdata())
        lums = [lum(p) for p in px]
        # Composite a translucent text colour over the ground pixel it sits on.
        def comp(p):
            return tuple(fg[i] * a + p[i] * (1 - a) for i in range(3))
        flum = lum(fg)
        worst_bg = max(px, key=lum) if flum > 0.4 else min(px, key=lum)
        r = ratio(lum(comp(worst_bg)), lum(worst_bg))
        big = bx["size"] >= 24 or (bx["size"] >= 18.66 and int(bx["weight"]) >= 700)
        floor = 3.0 if big else 4.5
        ok = r >= floor
        if not ok:
            fails += 1
        print(f"{'ok  ' if ok else 'FAIL'} {name:20s} {r:5.2f}:1 (floor {floor}) {bx['size']:.0f}px/{bx['weight']} {bx['text']!r}")
print(f"\nCARD CONTRAST: {'PASS' if fails == 0 else 'FAIL'} - {fails} line(s) under the floor")
sys.exit(1 if fails else 0)
