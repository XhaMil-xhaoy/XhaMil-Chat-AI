"""Clean cutout from user original: light paper -> transparent, ink stays black."""
from PIL import Image
from pathlib import Path

src = Path(r"e:\AndroidProjects\插图\77e3f234-edb7-4cf1-8054-80a81643d649.png")
dst = Path(r"e:\AndroidProjects\XhaMil Chat AI\docs\images\xhamil-brand.png")

im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
op = out.load()

# Paper ~242-252; ink ~0. Hard kill paper, soft only near real strokes.
for y in range(h):
    for x in range(w):
        r, g, b, _ = px[x, y]
        # distance from white paper
        paper = (r + g + b) / 3.0
        if paper >= 230:
            a = 0
        elif paper <= 40:
            a = 255
        else:
            # map 230..40 -> 0..255
            a = int(round((230 - paper) / (230 - 40) * 255))
            if a < 20:
                a = 0
        op[x, y] = (0, 0, 0, a)

xs, ys = [], []
for y in range(h):
    for x in range(w):
        if op[x, y][3] >= 20:
            xs.append(x)
            ys.append(y)
pad = 24
box = (
    max(0, min(xs) - pad),
    max(0, min(ys) - pad),
    min(w, max(xs) + pad + 1),
    min(h, max(ys) + pad + 1),
)
result = out.crop(box)
# scrub residual fog
rp = result.load()
rw, rh = result.size
for y in range(rh):
    for x in range(rw):
        r, g, b, a = rp[x, y]
        if a < 28:
            rp[x, y] = (0, 0, 0, 0)
        else:
            rp[x, y] = (0, 0, 0, a)

dst.parent.mkdir(parents=True, exist_ok=True)
result.save(dst, "PNG", optimize=True)

# previews
for name, color in (("white", (255, 255, 255, 255)), ("dark", (13, 17, 23, 255))):
    bg = Image.new("RGBA", result.size, color)
    Image.alpha_composite(bg, result).convert("RGB").save(
        dst.parent / f"_check-{name}.png"
    )

print("saved", dst, result.size, result.mode)
print("corners", rp[0, 0], rp[rw - 1, 0], rp[rw // 2, rh // 2])
ink = sum(1 for y in range(rh) for x in range(rw) if rp[x, y][3] >= 28)
print("ink", ink, "canvas", rw * rh)
