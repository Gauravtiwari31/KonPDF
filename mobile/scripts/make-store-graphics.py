"""
Draws KonPDF's Google Play graphics from the app's own icon and fonts:

  fastlane/metadata/android/en-US/images/icon.png            512 x 512
  fastlane/metadata/android/en-US/images/featureGraphic.png  1024 x 500

The icon comes straight from the launcher icon (res/drawable/
ic_launcher_foreground.xml on res/values/colors.xml's background), so the
store icon always matches the one on the phone. Run it again after changing
the icon or the palette.

Needs PyMuPDF and Pillow, which the engine already uses. From mobile/:

    ../engine/.venv/Scripts/python scripts/make-store-graphics.py   (Windows)
    ../engine/.venv/bin/python scripts/make-store-graphics.py       (macOS/Linux)
"""
import io
import xml.etree.ElementTree as ET
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

MOBILE = Path(__file__).resolve().parent.parent
RES = MOBILE / 'android/app/src/main/res'
FONTS = MOBILE / 'android/app/src/main/assets/fonts'
OUT = MOBILE / 'fastlane/metadata/android/en-US/images'

ANDROID = '{http://schemas.android.com/apk/res/android}'

# "Ink & Volt" (src/theme/palette.ts).
INK = '#16163A'
PAPER = '#EEF0F8'
CARD = '#FBFCFF'
VOLT = '#FFE14D'
CORAL = '#FF8F73'
SKY = '#8EC5FF'
ROSE = '#FF6B81'
MINT = '#7FE3A9'


def launcher_background() -> str:
    colors = ET.parse(RES / 'values/colors.xml').getroot()
    for color in colors.iter('color'):
        if color.get('name') == 'ic_launcher_background':
            return color.text.strip()
    raise SystemExit('ic_launcher_background not found in colors.xml')


def mark_svg(size: int, background: str | None) -> bytes:
    """The launcher icon's visible area (the middle 72 of its 108 canvas) as SVG."""
    vector = ET.parse(RES / 'drawable/ic_launcher_foreground.xml').getroot()
    attrs = {
        'fillColor': 'fill',
        'strokeColor': 'stroke',
        'strokeWidth': 'stroke-width',
        'strokeLineJoin': 'stroke-linejoin',
        'strokeLineCap': 'stroke-linecap',
    }
    paths = []
    for path in vector.iter('path'):
        svg = {'d': path.get(ANDROID + 'pathData'), 'fill': 'none'}
        for android_name, svg_name in attrs.items():
            value = path.get(ANDROID + android_name)
            if value:
                svg[svg_name] = value
        paths.append('<path ' + ' '.join(f'{k}="{v}"' for k, v in svg.items()) + '/>')
    back = f'<rect x="0" y="0" width="108" height="108" fill="{background}"/>' if background else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="18 18 72 72">{back}{"".join(paths)}</svg>'
    ).encode()


def render(svg: bytes) -> Image.Image:
    page = pymupdf.open(stream=svg, filetype='svg')[0]
    pix = page.get_pixmap(alpha=True)
    return Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f'{name}.ttf'), size)


def brutal_box(draw: ImageDraw.ImageDraw, box, fill, radius, border, shadow):
    """A neo-brutalist box: thick ink outline and a hard, un-blurred ink shadow."""
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0 + shadow, y0 + shadow, x1 + shadow, y1 + shadow), radius, fill=INK)
    draw.rounded_rectangle(box, radius, fill=fill, outline=INK, width=border)


def icon():
    image = render(mark_svg(512, launcher_background()))
    image.save(OUT / 'icon.png')


def feature_graphic():
    s = 2  # draw at twice the size, then scale down for smooth edges
    w, h = 1024 * s, 500 * s
    image = Image.new('RGB', (w, h), launcher_background())
    draw = ImageDraw.Draw(image)

    # The mark on a paper card.
    card = 300 * s
    x0, y0 = 84 * s, (h - card) // 2 - 6 * s
    brutal_box(draw, (x0, y0, x0 + card, y0 + card), PAPER, 44 * s, 6 * s, 14 * s)
    mark = render(mark_svg(card - 24 * s, None))
    image.paste(mark, (x0 + 12 * s, y0 + 12 * s), mark)

    # Name and tagline.
    left = 452 * s
    title = font('BricolageGrotesque-ExtraBold', 132 * s)
    draw.text((left + 6 * s, 196 * s + 6 * s), 'KonPDF', font=title, fill=INK, anchor='ls')
    draw.text((left, 196 * s), 'KonPDF', font=title, fill=CARD, anchor='ls')

    plain = font('BricolageGrotesque-Bold', 50 * s)
    accent = font('InstrumentSerif-Italic', 64 * s)
    for baseline, (word, flourish) in zip(
        (276 * s, 340 * s), (('Convert ', 'anything.'), ('Resize ', 'everything.'))
    ):
        draw.text((left, baseline), word, font=plain, fill=CARD, anchor='ls')
        x = left + draw.textlength(word, font=plain)
        draw.text((x, baseline), flourish, font=accent, fill=VOLT, anchor='ls')

    # Sticker chips, as on the app's tool tiles.
    chip_font = font('IBMPlexMono-SemiBold', 20 * s)
    chips = [('SCAN', CORAL), ('CONVERT', SKY), ('RESIZE', VOLT), ('PDF TOOLS', ROSE), ('DRIVE', MINT)]
    pad, gap, chip_h = 16 * s, 12 * s, 44 * s
    widths = [draw.textlength(label, font=chip_font) + 2 * pad for label, _ in chips]
    room = 1024 * s - left - 44 * s
    while sum(widths) + gap * (len(widths) - 1) > room:
        chips.pop()
        widths.pop()
    x, top = left, 384 * s
    for (label, color), width in zip(chips, widths):
        brutal_box(draw, (x, top, x + width, top + chip_h), color, chip_h // 2, 3 * s, 4 * s)
        draw.text((x + width / 2, top + chip_h / 2), label, font=chip_font, fill=INK, anchor='mm')
        x += width + gap

    image.resize((1024, 500), Image.LANCZOS).save(OUT / 'featureGraphic.png')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    icon()
    feature_graphic()
    print(f'Wrote {OUT / "icon.png"} and {OUT / "featureGraphic.png"}')
