"""Resizing images: pixels, percent, longest side, print size, presets and target file size."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

from ..convert import Input, require
from ..converters import images
from ..errors import KonError, Notes
from ..formats import IMAGE_OUT
from ..storage import safe_name, unique

MAX_SIDE = 16_000
LOSSY = {"jpg", "webp", "avif"}

# Real numbers behind the app's preset chips (mobile/src/features/tools/presets.ts).
PRESETS: dict[str, dict[str, Any]] = {
    "passport": {"mode": "print", "print": {"width": 35, "height": 45, "unit": "mm", "dpi": 300}, "fit": "fill", "format": "jpg"},
    "us_visa": {"mode": "pixels", "width": 600, "height": 600, "fit": "fill", "dpi": 300, "format": "jpg", "max_kb": 240},
    "india_form_photo": {
        "mode": "print",
        "print": {"width": 3.5, "height": 4.5, "unit": "cm", "dpi": 200},
        "fit": "fill",
        "format": "jpg",
        "min_kb": 20,
        "max_kb": 50,
    },
    "signature": {"mode": "pixels", "width": 140, "height": 60, "fit": "fit", "format": "jpg", "max_kb": 20},
    "id_scan": {"mode": "longest", "longest": 1600, "format": "jpg", "max_kb": 300},
    "instagram_square": {"mode": "pixels", "width": 1080, "height": 1080, "fit": "fill"},
    "instagram_portrait": {"mode": "pixels", "width": 1080, "height": 1350, "fit": "fill"},
    "instagram_story": {"mode": "pixels", "width": 1080, "height": 1920, "fit": "fill"},
    "whatsapp_dp": {"mode": "pixels", "width": 500, "height": 500, "fit": "fill"},
    "youtube_thumb": {"mode": "pixels", "width": 1280, "height": 720, "fit": "fill", "max_kb": 2000},
    "linkedin_banner": {"mode": "pixels", "width": 1584, "height": 396, "fit": "fill"},
    "x_header": {"mode": "pixels", "width": 1500, "height": 500, "fit": "fill"},
    "hd": {"mode": "pixels", "width": 1280, "height": 720, "fit": "contain"},
    "full_hd": {"mode": "pixels", "width": 1920, "height": 1080, "fit": "contain"},
    "uhd_4k": {"mode": "pixels", "width": 3840, "height": 2160, "fit": "contain"},
    "a4_300dpi": {"mode": "pixels", "width": 2480, "height": 3508, "fit": "contain", "dpi": 300},
    "email": {"mode": "longest", "longest": 1280, "format": "jpg", "max_kb": 500},
}

UNIT_PER_INCH = {"in": 1.0, "inch": 1.0, "cm": 2.54, "mm": 25.4}


def _num(options: dict[str, Any], key: str, *, required: bool = False, lo: float = 0.0001) -> float | None:
    value = options.get(key)
    if value in (None, ""):
        if required:
            raise KonError("INVALID_OPTIONS")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    if not math.isfinite(number) or number < lo:
        raise KonError("INVALID_OPTIONS")
    return number


def _check_size(w: int, h: int) -> tuple[int, int]:
    w, h = max(1, round(w)), max(1, round(h))
    if w > MAX_SIDE or h > MAX_SIDE or w * h > 120_000_000:
        raise KonError("INVALID_OPTIONS")
    return w, h


def fit_into(img: Image.Image, w: int, h: int, fit: str, background: str = "#ffffff", focus: str = "center") -> Image.Image:
    """`fit`: pad to exactly w×h · `contain`: scale inside w×h · `fill`: crop to w×h · `stretch`."""
    w, h = _check_size(w, h)
    if fit == "stretch":
        return img.resize((w, h), Image.Resampling.LANCZOS)
    if fit == "fill":
        centering = {"top": (0.5, 0.2), "bottom": (0.5, 0.8)}.get(focus, (0.5, 0.5))
        return ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS, centering=centering)
    scale = min(w / img.width, h / img.height)
    inner = img.resize(_check_size(img.width * scale, img.height * scale), Image.Resampling.LANCZOS)
    if fit == "contain":
        return inner
    has_alpha = inner.mode in ("RGBA", "LA")
    canvas = Image.new("RGBA" if has_alpha else "RGB", (w, h), (0, 0, 0, 0) if has_alpha and background == "transparent" else background)
    canvas.paste(inner, ((w - inner.width) // 2, (h - inner.height) // 2), inner if has_alpha else None)
    return canvas


ASPECTS = {"1:1": 1.0, "4:3": 4 / 3, "3:4": 3 / 4, "3:2": 3 / 2, "2:3": 2 / 3, "16:9": 16 / 9, "9:16": 9 / 16, "4:5": 4 / 5}


def apply_transform(img: Image.Image, opts: dict[str, Any]) -> Image.Image:
    """Crop to an aspect ratio (centred), rotate in 90° steps (clockwise), flip."""
    crop = opts.get("crop")
    if crop:
        ratio = ASPECTS.get(str(crop))
        if ratio is None:
            raise KonError("INVALID_OPTIONS")
        w, h = img.size
        if w / h > ratio:
            new_w = round(h * ratio)
            img = img.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
        else:
            new_h = round(w / ratio)
            img = img.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
    rotate = opts.get("rotate")
    if rotate not in (None, "", 0):
        try:
            angle = int(rotate) % 360
        except (TypeError, ValueError):
            raise KonError("INVALID_OPTIONS") from None
        if angle not in (0, 90, 180, 270):
            raise KonError("INVALID_OPTIONS")
        transpose = {90: Image.Transpose.ROTATE_270, 180: Image.Transpose.ROTATE_180, 270: Image.Transpose.ROTATE_90}
        if angle:
            img = img.transpose(transpose[angle])
    flip = opts.get("flip")
    if flip:
        if flip not in ("horizontal", "vertical"):
            raise KonError("INVALID_OPTIONS")
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT if flip == "horizontal" else Image.Transpose.FLIP_TOP_BOTTOM)
    return img


def apply_geometry(img: Image.Image, opts: dict[str, Any]) -> tuple[Image.Image, float | None, bool]:
    """Resizes per `opts`. Returns (image, dpi, dimensions_are_fixed)."""
    mode = opts.get("mode", "filesize")
    fit = opts.get("fit", "fit")
    background = str(opts.get("background") or "#ffffff")
    focus = str(opts.get("focus") or "center")
    dpi = _num(opts, "dpi")
    if mode == "pixels":
        w, h = _num(opts, "width"), _num(opts, "height")
        if not w and not h:
            raise KonError("INVALID_OPTIONS")
        if w and h:
            return fit_into(img, int(w), int(h), fit, background, focus), dpi, fit != "contain"
        scale = (w / img.width) if w else (h / img.height)  # type: ignore[operator]
        return img.resize(_check_size(img.width * scale, img.height * scale), Image.Resampling.LANCZOS), dpi, True
    if mode == "percent":
        p = _num(opts, "percent", required=True)
        if p > 1000:
            raise KonError("INVALID_OPTIONS")
        return img.resize(_check_size(img.width * p / 100, img.height * p / 100), Image.Resampling.LANCZOS), dpi, False
    if mode == "longest":
        longest = _num(opts, "longest", required=True)
        current = max(img.size)
        if current <= longest and not opts.get("upscale"):
            return img, dpi, False
        scale = longest / current
        return img.resize(_check_size(img.width * scale, img.height * scale), Image.Resampling.LANCZOS), dpi, False
    if mode == "print":
        spec = opts.get("print") or {}
        unit = str(spec.get("unit", "cm")).lower()
        if unit not in UNIT_PER_INCH:
            raise KonError("INVALID_OPTIONS")
        p_dpi = _num(spec, "dpi") or 300
        w_in = _num(spec, "width", required=True) / UNIT_PER_INCH[unit]
        h_in = _num(spec, "height", required=True) / UNIT_PER_INCH[unit]
        px_fit = opts.get("fit", "fill")
        return fit_into(img, round(w_in * p_dpi), round(h_in * p_dpi), px_fit, background, focus), p_dpi, True
    if mode == "dpi":
        return img, _num(opts, "dpi", required=True), True
    if mode in ("filesize", "compress", "transform"):
        return img, dpi, False
    raise KonError("INVALID_OPTIONS")


def _kb(n: int) -> int:
    return max(1, round(n / 1024))


def fit_file_size(
    img: Image.Image,
    fmt: str,
    *,
    max_kb: float | None,
    min_kb: float | None,
    quality: int,
    dpi: float | None,
    background: str,
    fixed_size: bool,
    notes: Notes,
    exif: bytes | None = None,
) -> bytes:
    """Encodes `img` as close under `max_kb` as possible (and over `min_kb`).

    Lowers quality first (lossy formats), then shrinks the picture unless its
    pixel size is fixed (passport photo, print size...).
    """

    def enc(im: Image.Image, q: int) -> bytes:
        return images.encode(im, fmt, quality=q, dpi=dpi, background=background, exif=exif)

    data = enc(img, quality)
    max_bytes = int(max_kb * 1024) if max_kb else None
    min_bytes = int(min_kb * 1024) if min_kb else None

    if max_bytes and len(data) > max_bytes:
        lossy = fmt in LOSSY
        floor = 10 if fixed_size else 40

        def best_quality(im: Image.Image) -> bytes | None:
            lo, hi, found = floor, quality, None
            while lo <= hi:
                mid = (lo + hi) // 2
                attempt = enc(im, mid)
                if len(attempt) <= max_bytes:
                    found, lo = attempt, mid + 1
                else:
                    hi = mid - 1
            return found

        fitted = best_quality(img) if lossy else None
        if fitted is None and not fixed_size:
            current, smallest = img, data
            for _ in range(30):
                ratio = math.sqrt(max_bytes / max(1, len(smallest))) * 0.95
                scale = max(0.5, min(0.92, ratio))
                size = (int(current.width * scale), int(current.height * scale))
                if min(size) < 16:
                    break
                current = img.resize(size, Image.Resampling.LANCZOS)
                attempt = enc(current, floor if lossy else quality)
                if len(attempt) <= max_bytes:
                    fitted = (best_quality(current) if lossy else attempt) or attempt
                    break
                smallest = attempt
            if fitted is None:
                fitted = smallest
        if fitted is None:
            fitted = enc(img, floor) if lossy else data
        data = fitted
        if len(data) > max_bytes:
            notes.add("TARGET_CLOSE", got_kb=_kb(len(data)), target_kb=round(max_kb))

    if min_bytes and len(data) < min_bytes:
        if fmt in LOSSY:
            for q in range(min(100, quality + 5), 101, 3):
                attempt = enc(img, q)
                if len(attempt) >= min_bytes and (not max_bytes or len(attempt) <= max_bytes):
                    data = attempt
                    break
                if max_bytes and len(attempt) > max_bytes:
                    break
        if len(data) < min_bytes:
            notes.add("BELOW_MIN", got_kb=_kb(len(data)), min_kb=round(min_kb))
    return data


def resize(inputs: list[Input], options: dict[str, Any], out_dir: Path, work: Path, notes: Notes) -> list[Path]:
    require(inputs, {"image"}, "images")
    opts = dict(options)
    if opts.get("mode") == "preset" or opts.get("preset"):
        preset = PRESETS.get(str(opts.get("preset")))
        if preset is None:
            raise KonError("INVALID_OPTIONS")
        # Things the person set themselves (like a KB limit) win over the preset.
        overrides = {k: v for k, v in opts.items() if k not in ("mode", "preset") and v not in (None, "")}
        opts = {**preset, **overrides}
    quality = int(min(100, max(1, float(opts.get("quality") or 88))))
    if opts.get("mode") == "compress":
        quality = min(quality, 72)
    background = str(opts.get("background") or "#ffffff")
    out_dir.mkdir(parents=True, exist_ok=True)

    outputs = []
    for item in inputs:
        frame = images.open_image(item.path, item.fmt, item.name, notes)
        if opts.get("crop") or opts.get("rotate") or opts.get("flip"):
            frame = apply_transform(frame, opts)
        fmt = str(opts.get("format") or "").lower() or None
        fmt = "jpg" if fmt == "jpeg" else fmt
        if fmt and fmt not in IMAGE_OUT:
            raise KonError("UNSUPPORTED_CONVERSION", src=item.fmt.upper(), dst=fmt.upper())
        if not fmt:
            fmt = item.fmt if item.fmt in IMAGE_OUT else "jpg"
            # Lossless formats can't get much smaller: "compress" switches photos to JPG.
            if opts.get("mode") == "compress" and fmt in ("bmp", "tiff"):
                fmt = "jpg"
        if opts.get("mode") == "compress":
            frame, _, _ = apply_geometry(frame, {"mode": "longest", "longest": 2560})
            if fmt == "png" and frame.mode not in ("RGBA", "LA"):
                frame = frame.convert("RGB").quantize(256, dither=Image.Dither.FLOYDSTEINBERG)
        shaped, dpi, fixed = apply_geometry(frame, opts)
        exif = None if opts.get("strip_metadata", True) else frame.info.get("exif")

        max_kb, min_kb = _num(opts, "max_kb"), _num(opts, "min_kb")
        original_size = item.path.stat().st_size
        untouched = shaped is frame and fmt == item.fmt and not opts.get("strip_metadata", True) and dpi is None
        if untouched and max_kb and original_size <= max_kb * 1024 and (not min_kb or original_size >= min_kb * 1024):
            data = item.path.read_bytes()  # already fits: don't lose quality for nothing
        else:
            data = fit_file_size(
                shaped,
                fmt,
                max_kb=max_kb,
                min_kb=min_kb,
                quality=quality,
                dpi=dpi,
                background=background,
                fixed_size=fixed,
                notes=notes,
                exif=exif,
            )
        if opts.get("mode") == "compress" and fmt == item.fmt and len(data) >= original_size:
            notes.add("NO_GAIN", name=item.name)
            data = item.path.read_bytes()
        path = unique(out_dir / safe_name(f"{item.stem}.{fmt}"))
        path.write_bytes(data)
        outputs.append(path)
    return outputs
