"""One-off icon generator for PWA. Run via: python v2/generate-icons.py
Writes icon-{180,192,512}.png and icon-512-maskable.png at the repo root.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT = r"C:\Windows\Fonts\malgunbd.ttf"
BG = (29, 28, 25, 255)   # var(--accent)
FG = (240, 237, 232, 255)  # var(--accent-text) lookalike
CHAR = "레"


def render(size: int, padding_ratio: float, out_path: Path) -> None:
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    safe = int(size * (1 - padding_ratio * 2))
    # binary-search the font size that fits the safe square
    lo, hi, best = 10, size, 10
    while lo <= hi:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(FONT, mid)
        bbox = draw.textbbox((0, 0), CHAR, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if w <= safe and h <= safe:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1

    font = ImageFont.truetype(FONT, best)
    bbox = draw.textbbox((0, 0), CHAR, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # center using bbox offset to avoid glyph metric drift
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1]
    draw.text((x, y), CHAR, font=font, fill=FG)
    img.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path.relative_to(ROOT)} ({size}px, font {best})")


# apple-touch-icon: iOS rounds + adds gloss, no transparency, content edge-to-edge
render(180, padding_ratio=0.10, out_path=ROOT / "icon-180.png")
# Android home screen
render(192, padding_ratio=0.10, out_path=ROOT / "icon-192.png")
# PWA install / splash
render(512, padding_ratio=0.10, out_path=ROOT / "icon-512.png")
# Android adaptive (safe zone is central 80%)
render(512, padding_ratio=0.20, out_path=ROOT / "icon-512-maskable.png")
