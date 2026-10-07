"""Reading and writing images, and turning them into PDF or Word."""

from __future__ import annotations

import io
import warnings
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import settings
from ..errors import KonError, Notes

try:  # HEIC/HEIF (iPhone photos)
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover - optional
    pass

Image.MAX_IMAGE_PIXELS = settings.max_megapixels * 1_000_000

PIL_FORMAT = {
    "jpg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "bmp": "BMP",
    "gif": "GIF",
    "tiff": "TIFF",
    "ico": "ICO",
    "avif": "AVIF",
}
NO_ALPHA = {"jpg", "bmp"}
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# Page sizes in PDF points (1/72 inch).
PAGE_SIZES = {"a4": (595.0, 842.0), "letter": (612.0, 792.0), "legal": (612.0, 1008.0), "a5": (420.0, 595.0)}
MARGINS = {"none": 0.0, "small": 18.0, "normal": 36.0}


def _guard(name: str):
    """Turns Pillow's decompression-bomb checks into a friendly error."""

    class _Ctx:
        def __enter__(self):
            self._w = warnings.catch_warnings()
            self._w.__enter__()
            warnings.simplefilter("error", Image.DecompressionBombWarning)

        def __exit__(self, exc_type, exc, tb):
            self._w.__exit__(exc_type, exc, tb)
            if exc_type in (Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise KonError("IMAGE_TOO_LARGE", name=name) from exc
            if exc_type in (UnidentifiedImageError, OSError, SyntaxError, ValueError) and not isinstance(exc, KonError):
                raise KonError("CORRUPT_FILE", name=name) from exc
            return False

    return _Ctx()


def _render_svg(path: Path, name: str) -> Image.Image:
    try:
        doc = pymupdf.open(path, filetype="svg")
        page = doc[0]
        longest = max(page.rect.width, page.rect.height) or 1
        zoom = min(4.0, max(1.0, 2000 / longest))
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=True)
        return Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
    except Exception as e:  # noqa: BLE001 - any parser failure means a bad file
        raise KonError("CORRUPT_FILE", name=name) from e


def open_frames(path: Path, fmt: str, name: str, notes: Notes | None = None) -> list[Image.Image]:
    """Every page of a TIFF, the first frame of an animation, otherwise one image.

    Photos are turned upright using their EXIF orientation.
    """
    if fmt == "svg":
        return [_render_svg(path, name)]
    with _guard(name):
        img = Image.open(path)
        frames = getattr(img, "n_frames", 1)
        if fmt == "tiff" and frames > 1:
            out = []
            for i in range(frames):
                img.seek(i)
                out.append(ImageOps.exif_transpose(img.copy()))
            return out
        if frames > 1 and notes is not None:
            notes.add("FIRST_FRAME", name=name)
        img.seek(0)
        frame = ImageOps.exif_transpose(img)
        frame.load()
        frame.info.setdefault("dpi", img.info.get("dpi"))
        return [frame]


def open_image(path: Path, fmt: str, name: str, notes: Notes | None = None) -> Image.Image:
    return open_frames(path, fmt, name, notes)[0]


def flatten(img: Image.Image, background: str = "#ffffff") -> Image.Image:
    """Puts transparent pixels on a solid background (for JPG and friends)."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        base = Image.new("RGB", rgba.size, background)
        base.paste(rgba, mask=rgba.getchannel("A"))
        return base
    return img.convert("RGB") if img.mode not in ("RGB", "L") else img


def encode(
    img: Image.Image,
    fmt: str,
    *,
    quality: int = 88,
    background: str = "#ffffff",
    dpi: float | None = None,
    exif: bytes | None = None,
) -> bytes:
    """The image as `fmt` bytes. `exif` is kept only when given."""
    fmt = "jpg" if fmt == "jpeg" else fmt
    if fmt not in PIL_FORMAT:
        raise KonError("UNSUPPORTED_CONVERSION", src="image", dst=fmt.upper())
    quality = int(min(100, max(1, quality)))
    kwargs: dict = {}
    if fmt in NO_ALPHA:
        img = flatten(img, background)
    elif img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
        img = img.convert("RGBA")
    if fmt == "jpg":
        kwargs.update(quality=quality, optimize=True, progressive=True, subsampling=0 if quality >= 90 else 2)
    elif fmt == "webp":
        kwargs.update(quality=quality, method=5)
    elif fmt == "avif":
        kwargs.update(quality=quality)
    elif fmt == "png":
        kwargs.update(optimize=True)
    elif fmt == "gif":
        img = img.convert("RGBA").convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    elif fmt == "tiff":
        kwargs.update(compression="tiff_deflate")
    elif fmt == "ico":
        longest = max(img.size)
        kwargs.update(sizes=[s for s in ICO_SIZES if s[0] <= max(16, longest)] or [(16, 16)])
        if img.mode != "RGBA":
            img = img.convert("RGBA")
    if dpi and fmt in ("jpg", "png", "tiff", "bmp", "webp"):
        kwargs["dpi"] = (dpi, dpi)
    if exif and fmt in ("jpg", "webp", "png", "tiff"):
        kwargs["exif"] = exif
    buf = io.BytesIO()
    img.save(buf, PIL_FORMAT[fmt], **kwargs)
    return buf.getvalue()


def _pdf_image_bytes(img: Image.Image, quality: int) -> bytes:
    """JPEG for photos, PNG for images with transparency or few colours (screenshots, line art)."""
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    few_colours = img.mode in ("1", "P") or (img.getcolors(256) is not None if img.width * img.height < 4_000_000 else False)
    if has_alpha or few_colours:
        return encode(flatten(img) if not has_alpha else img, "png")
    return encode(img, "jpg", quality=quality)


def images_to_pdf(
    images: list[Image.Image],
    out: Path,
    *,
    page_size: str = "a4",
    orientation: str = "auto",
    margin: str | None = None,
    quality: int = 88,
) -> Path:
    doc = pymupdf.open()
    for img in images:
        w, h = img.size
        if page_size == "fit":
            dpi = (img.info.get("dpi") or (150, 150))[0] or 150
            dpi = dpi if 50 <= dpi <= 1200 else 150
            pw, ph = w * 72 / dpi, h * 72 / dpi
            pad = MARGINS.get(margin or "none", 0.0)
            pw, ph = pw + 2 * pad, ph + 2 * pad
        else:
            pw, ph = PAGE_SIZES.get(page_size, PAGE_SIZES["a4"])
            landscape = orientation == "landscape" or (orientation == "auto" and w > h)
            if landscape:
                pw, ph = ph, pw
            pad = MARGINS.get(margin or "small", 18.0)
        page = doc.new_page(width=pw, height=ph)
        rect = pymupdf.Rect(pad, pad, pw - pad, ph - pad)
        page.insert_image(rect, stream=_pdf_image_bytes(img, quality), keep_proportion=True)
    doc.save(out, garbage=3, deflate=True)
    return out


def images_to_docx(images: list[Image.Image], out: Path, quality: int = 88) -> Path:
    from docx import Document
    from docx.shared import Inches

    document = Document()
    section = document.sections[0]
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(section, side, Inches(0.75))
    usable_w = (section.page_width - section.left_margin - section.right_margin) / 914400
    usable_h = (section.page_height - section.top_margin - section.bottom_margin) / 914400 - 0.2
    for i, img in enumerate(images):
        if i:
            document.add_page_break()
        dpi = (img.info.get("dpi") or (96, 96))[0] or 96
        w_in, h_in = img.width / dpi, img.height / dpi
        scale = min(1.0, usable_w / w_in, usable_h / h_in)
        document.add_picture(io.BytesIO(_pdf_image_bytes(img, quality)), width=Inches(w_in * scale))
    document.save(out)
    return out
