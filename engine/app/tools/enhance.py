"""Enhancing images: one-tap fixes, filters and manual adjustments (no AI, no OCR)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from ..convert import Input, require
from ..converters import images
from ..errors import KonError, Notes
from ..formats import IMAGE_OUT
from ..storage import safe_name, unique
from .resize import MAX_SIDE

PRESETS = ("auto", "document", "bw_document", "low_light", "portrait", "denoise", "upscale_2x")
FILTERS = ("grayscale", "sepia", "vintage", "vivid", "cool", "warm", "fade", "noir", "invert", "blur")
ADJUSTMENTS = ("brightness", "contrast", "saturation", "sharpness", "warmth")
PREVIEW_SIDE = 900


def _channels(img: Image.Image, r: float, g: float, b: float) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32)
    arr = arr * np.array([r, g, b], dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def _flatten_background(gray: Image.Image) -> Image.Image:
    """Evens out shadows on a photographed page: divides by a blurred copy (the paper)."""
    radius = max(8, max(gray.size) // 40)
    background = gray.filter(ImageFilter.GaussianBlur(radius))
    g = np.asarray(gray, dtype=np.float32)
    bg = np.asarray(background, dtype=np.float32) + 1.0
    out = np.clip(g / bg * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "L")


def _adaptive_threshold(gray: Image.Image, offset: int = 12) -> Image.Image:
    radius = max(6, max(gray.size) // 80)
    mean = np.asarray(gray.filter(ImageFilter.BoxBlur(radius)), dtype=np.int16)
    g = np.asarray(gray, dtype=np.int16)
    return Image.fromarray(np.where(g < mean - offset, 0, 255).astype(np.uint8), "L")


def apply_preset(img: Image.Image, preset: str) -> Image.Image:
    if preset == "auto":
        img = ImageOps.autocontrast(img, cutoff=1, preserve_tone=True)
        img = ImageEnhance.Color(img).enhance(1.08)
        return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=3))
    if preset == "document":
        gray = _flatten_background(ImageOps.grayscale(img))
        gray = ImageOps.autocontrast(gray, cutoff=2)
        return gray.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80, threshold=2)).convert("RGB")
    if preset == "bw_document":
        gray = ImageOps.autocontrast(_flatten_background(ImageOps.grayscale(img)), cutoff=1)
        return _adaptive_threshold(gray).convert("RGB")
    if preset == "low_light":
        lut = [round(255 * (i / 255) ** 0.7) for i in range(256)] * 3
        img = img.point(lut)
        img = ImageEnhance.Brightness(img).enhance(1.06)
        return img.filter(ImageFilter.MedianFilter(3))
    if preset == "portrait":
        soft = img.filter(ImageFilter.GaussianBlur(1.2))
        img = Image.blend(img, soft, 0.3)
        img = _channels(img, 1.04, 1.0, 0.96)
        return img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=40, threshold=4))
    if preset == "denoise":
        return img.filter(ImageFilter.MedianFilter(5 if max(img.size) > 2500 else 3))
    if preset == "upscale_2x":
        size = (img.width * 2, img.height * 2)
        if max(size) > MAX_SIDE or size[0] * size[1] > 120_000_000:
            raise KonError("IMAGE_TOO_LARGE", name="image")
        img = img.resize(size, Image.Resampling.LANCZOS)
        return img.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
    raise KonError("INVALID_OPTIONS")


def apply_filter(img: Image.Image, name: str) -> Image.Image:
    if name == "grayscale":
        return ImageOps.grayscale(img).convert("RGB")
    if name == "sepia":
        return ImageOps.colorize(ImageOps.grayscale(img), "#2b1d0e", "#f3e3c3", mid="#a2805a")
    if name == "vintage":
        sepia = ImageOps.colorize(ImageOps.grayscale(img), "#2b1d0e", "#f3e3c3", mid="#a2805a")
        img = Image.blend(img, sepia, 0.45)
        img = ImageEnhance.Contrast(img).enhance(0.88)
        return _channels(img, 1.05, 1.0, 0.92)
    if name == "vivid":
        img = ImageEnhance.Color(img).enhance(1.4)
        return ImageEnhance.Contrast(img).enhance(1.1)
    if name == "cool":
        return _channels(img, 0.92, 1.0, 1.08)
    if name == "warm":
        return _channels(img, 1.08, 1.0, 0.92)
    if name == "fade":
        img = ImageEnhance.Contrast(img).enhance(0.8)
        return img.point(lambda v: 30 + v * 0.88)
    if name == "noir":
        return ImageEnhance.Contrast(ImageOps.grayscale(img)).enhance(1.5).convert("RGB")
    if name == "invert":
        return ImageOps.invert(img)
    if name == "blur":
        return img.filter(ImageFilter.GaussianBlur(max(2, max(img.size) / 300)))
    raise KonError("INVALID_OPTIONS")


def _level(adjust: dict[str, Any], key: str) -> float:
    try:
        value = float(adjust.get(key) or 0)
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    return max(-100.0, min(100.0, value))


def apply_adjustments(img: Image.Image, adjust: dict[str, Any]) -> Image.Image:
    if b := _level(adjust, "brightness"):
        img = ImageEnhance.Brightness(img).enhance(1 + b / 100)
    if c := _level(adjust, "contrast"):
        img = ImageEnhance.Contrast(img).enhance(1 + c / 100)
    if s := _level(adjust, "saturation"):
        img = ImageEnhance.Color(img).enhance(1 + s / 100)
    if sh := _level(adjust, "sharpness"):
        img = ImageEnhance.Sharpness(img).enhance(1 + sh / 50)
    if w := _level(adjust, "warmth"):
        img = _channels(img, 1 + w / 400, 1.0, 1 - w / 400)
    return img


def enhance_image(img: Image.Image, options: dict[str, Any]) -> Image.Image:
    """Preset, then filter, then manual adjustments. Transparency is kept."""
    preset, filt = options.get("preset"), options.get("filter")
    if preset and preset not in PRESETS or filt and filt not in FILTERS:
        raise KonError("INVALID_OPTIONS")
    alpha = img.getchannel("A") if img.mode in ("RGBA", "LA") else None
    rgb = img.convert("RGB")
    if preset:
        rgb = apply_preset(rgb, preset)
    if filt:
        rgb = apply_filter(rgb, filt)
    rgb = apply_adjustments(rgb, options.get("adjust") or {})
    if alpha is not None:
        if alpha.size != rgb.size:
            alpha = alpha.resize(rgb.size, Image.Resampling.LANCZOS)
        rgb.putalpha(alpha)
    return rgb


def enhance(inputs: list[Input], options: dict[str, Any], out_dir: Path, work: Path, notes: Notes) -> list[Path]:
    require(inputs, {"image"}, "images")
    out_dir.mkdir(parents=True, exist_ok=True)
    preview = bool(options.get("preview"))
    quality = int(min(100, max(1, float(options.get("quality") or 90))))
    outputs = []
    for item in inputs[:1] if preview else inputs:
        img = images.open_image(item.path, item.fmt, item.name, notes)
        if preview and max(img.size) > PREVIEW_SIDE:
            img.thumbnail((PREVIEW_SIDE, PREVIEW_SIDE), Image.Resampling.LANCZOS)
        result = enhance_image(img, options)
        if preview:
            fmt, quality = "jpg", 80
        else:
            fmt = str(options.get("format") or "").lower() or (item.fmt if item.fmt in IMAGE_OUT else "jpg")
            if fmt not in IMAGE_OUT:
                raise KonError("UNSUPPORTED_CONVERSION", src=item.fmt.upper(), dst=fmt.upper())
            # B&W scans compress far better as PNG than as a noisy JPG.
            if options.get("preset") == "bw_document" and not options.get("format"):
                fmt = "png"
        stem = f"{item.stem}-preview" if preview else f"{item.stem}-enhanced"
        path = unique(out_dir / safe_name(f"{stem}.{fmt}"))
        dpi = (img.info.get("dpi") or (None,))[0]
        path.write_bytes(images.encode(result, fmt, quality=quality, dpi=dpi))
        outputs.append(path)
    return outputs
