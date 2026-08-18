"""Generate valid, on-brand HLTB-for-Steam icons (replaces the placeholders).

Design: Steam-accent-blue rounded square with a white hourglass — the natural
"how long to beat" mark. Drawn at 4x and downscaled for smooth anti-aliasing.
Re-run after editing to regenerate: python scripts/generate_icons.py
"""
from PIL import Image, ImageDraw

STEAM_BLUE = (102, 192, 244, 255)   # #66c0f4 accent
NAVY = (27, 40, 56, 255)            # #1b2838 Steam bg
WHITE = (255, 255, 255, 255)
SIZES = [16, 32, 48, 128]
SS = 4  # supersample factor


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background: rounded square, small transparent margin so corners aren't clipped
    margin = int(S * 0.03)
    rounded_rect(d, [margin, margin, S - margin, S - margin], radius=int(S * 0.22), fill=STEAM_BLUE)

    # Hourglass geometry
    cx = S / 2
    hw = S * 0.20          # half-width of the glass
    top = S * 0.24
    bot = S * 0.76
    bar = S * 0.055        # cap thickness
    cy = S / 2
    inset = S * 0.02       # pull triangle tips slightly inside the caps

    # Top & bottom caps
    d.rectangle([cx - hw, top, cx + hw, top + bar], fill=WHITE)
    d.rectangle([cx - hw, bot - bar, cx + hw, bot], fill=WHITE)

    # Upper and lower glass triangles meeting at the center
    d.polygon([(cx - hw + inset, top + bar), (cx + hw - inset, top + bar), (cx, cy)], fill=WHITE)
    d.polygon([(cx - hw + inset, bot - bar), (cx + hw - inset, bot - bar), (cx, cy)], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


for s in SIZES:
    out = f"icons/icon{s}.png"
    draw_icon(s).save(out, "PNG")
    print(f"wrote {out} ({s}x{s})")
