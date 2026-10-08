"""PDF tools: merge, split, keep/delete/reorder/rotate pages, compress, passwords, watermark, page numbers."""

from __future__ import annotations

import contextlib
import math
import shutil
from pathlib import Path
from typing import Any, Callable

import pymupdf

from ..convert import Input, require
from ..converters import images
from ..converters.pdf import open_pdf
from ..errors import KonError, Notes
from ..pages import parse_groups, parse_pages
from ..storage import safe_name, unique

SAVE = {"garbage": 4, "deflate": True, "clean": True}

# Compression levels: (images above this DPI are resampled, target DPI, JPEG quality).
LEVELS = {
    "low": (220, 200, 85),
    "medium": (160, 150, 70),
    "strong": (110, 96, 50),
    "max": (80, 72, 35),
}


def _out(out_dir: Path, name: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    return unique(out_dir / safe_name(name))


def _open(item: Input, options: dict[str, Any]) -> pymupdf.Document:
    return open_pdf(item.path, item.name, options.get("password"))


def merge(inputs, options, out_dir, work, notes):
    require(inputs, {"pdf", "image"}, "pdfs_or_images")
    if len(inputs) < 2:
        raise KonError("INVALID_OPTIONS")
    merged = pymupdf.open()
    for index, item in enumerate(inputs):
        if item.kind == "image":
            page_pdf = work / f"image{index}.pdf"
            images.images_to_pdf(images.open_frames(item.path, item.fmt, item.name, notes), page_pdf, page_size="a4")
            src = pymupdf.open(page_pdf)
        else:
            src = _open(item, options)
        merged.insert_pdf(src)
        src.close()
    path = _out(out_dir, f"{inputs[0].stem} (merged).pdf")
    merged.save(path, **SAVE)
    return [path]


def _write_selection(doc: pymupdf.Document, pages: list[int], path: Path) -> Path:
    part = pymupdf.open()
    for i in pages:
        part.insert_pdf(doc, from_page=i, to_page=i)
    part.save(path, **SAVE)
    return path


def split(inputs, options, out_dir, work, notes):
    require(inputs, {"pdf"}, "pdfs")
    outputs = []
    for item in inputs:
        doc = _open(item, options)
        total = doc.page_count
        mode = options.get("mode", "each")
        if mode == "each":
            groups = [[i] for i in range(total)]
        elif mode == "every":
            try:
                n = max(1, int(options.get("every") or 1))
            except (TypeError, ValueError):
                raise KonError("INVALID_OPTIONS") from None
            groups = [list(range(s, min(s + n, total))) for s in range(0, total, n)]
        elif mode == "ranges":
            groups = parse_groups(str(options.get("ranges") or ""), total)
        else:
            raise KonError("INVALID_OPTIONS")
        for g in groups:
            label = f"p{g[0] + 1}" if len(g) == 1 else f"p{g[0] + 1}-{g[-1] + 1}"
            outputs.append(_write_selection(doc, g, _out(out_dir, f"{item.stem} {label}.pdf")))
        doc.close()
    return outputs


def _each(inputs, options, out_dir, suffix: str, change: Callable[[pymupdf.Document], None], **save):
    require(inputs, {"pdf"}, "pdfs")
    outputs = []
    for item in inputs:
        doc = _open(item, options)
        change(doc)
        path = _out(out_dir, f"{item.stem}{suffix}.pdf")
        doc.save(path, **{**SAVE, **save})
        doc.close()
        outputs.append(path)
    return outputs


def extract(inputs, options, out_dir, work, notes):
    return _each(inputs, options, out_dir, " (pages)", lambda d: d.select(parse_pages(str(options.get("pages") or ""), d.page_count)))


def delete(inputs, options, out_dir, work, notes):
    def change(doc):
        pages = parse_pages(str(options.get("pages") or ""), doc.page_count)
        if len(pages) >= doc.page_count:
            raise KonError("PAGE_RANGE_INVALID", pages=options.get("pages"), total=doc.page_count)
        doc.delete_pages(sorted(pages))

    return _each(inputs, options, out_dir, " (edited)", change)


def reorder(inputs, options, out_dir, work, notes):
    def change(doc):
        # Pages not mentioned keep their order after the ones that were ("3" → 3, 1, 2, 4...).
        first = parse_pages(str(options.get("order") or ""), doc.page_count)
        doc.select(first + [i for i in range(doc.page_count) if i not in first])

    return _each(inputs, options, out_dir, " (reordered)", change)


def rotate(inputs, options, out_dir, work, notes):
    try:
        angle = int(options.get("angle", 90)) % 360
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    if angle not in (0, 90, 180, 270):
        raise KonError("INVALID_OPTIONS")

    def change(doc):
        for i in parse_pages(options.get("pages"), doc.page_count):
            page = doc[i]
            page.set_rotation((page.rotation + angle) % 360)

    return _each(inputs, options, out_dir, " (rotated)", change)


def _compressed(doc_path: Path, password: str | None, level: str, out: Path) -> int:
    doc = pymupdf.open(doc_path)
    if doc.needs_pass:
        doc.authenticate(password or "")
    threshold, target, quality = LEVELS[level]
    try:
        doc.rewrite_images(dpi_threshold=threshold, dpi_target=target, quality=quality, lossy=True, lossless=True, bitonal=True, color=True, gray=True)
    except (AttributeError, TypeError):  # older PyMuPDF: structure-only savings
        pass
    try:
        doc.subset_fonts()
    except Exception:  # noqa: BLE001 - font subsetting is a bonus
        pass
    doc.save(out, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True, use_objstms=1)
    doc.close()
    return out.stat().st_size


def compress(inputs, options, out_dir, work, notes):
    require(inputs, {"pdf"}, "pdfs")
    target_kb = options.get("target_kb")
    try:
        target_bytes = int(float(target_kb) * 1024) if target_kb not in (None, "") else None
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    level = options.get("level", "medium")
    if not target_bytes and level not in LEVELS:
        raise KonError("INVALID_OPTIONS")
    outputs = []
    for index, item in enumerate(inputs):
        _open(item, options).close()  # friendly errors for locked or damaged files
        original = item.path.stat().st_size
        out = _out(out_dir, f"{item.stem} (compressed).pdf")
        if target_bytes:
            best: tuple[int, Path] | None = None
            for name in ("low", "medium", "strong", "max"):
                attempt = work / f"c{index}-{name}.pdf"
                size = _compressed(item.path, options.get("password"), name, attempt)
                if best is None or size < best[0]:
                    best = (size, attempt)
                if size <= target_bytes:
                    best = (size, attempt)
                    break
            size, chosen = best  # type: ignore[misc]
            if size > target_bytes:
                notes.add("PDF_TARGET_CLOSE", got_kb=max(1, round(size / 1024)), target_kb=round(target_bytes / 1024))
            shutil.move(chosen, out)
        else:
            size = _compressed(item.path, options.get("password"), level, out)
        if size >= original:
            notes.add("NO_GAIN", name=item.name)
            shutil.copyfile(item.path, out)
        outputs.append(out)
    return outputs


def protect(inputs, options, out_dir, work, notes):
    password = str(options.get("new_password") or options.get("password_new") or options.get("password") or "")
    if len(password) < 4:
        raise KonError("INVALID_OPTIONS")
    # The current password (if the file is already locked) is "old_password".
    opened = {**options, "password": options.get("old_password")}
    perms = int(pymupdf.PDF_PERM_ACCESSIBILITY | pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_COPY | pymupdf.PDF_PERM_ANNOTATE)
    return _each(
        inputs,
        opened,
        out_dir,
        " (locked)",
        lambda d: None,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=password,
        owner_pw=password,
        permissions=perms,
    )


def unlock(inputs, options, out_dir, work, notes):
    if not options.get("password"):
        raise KonError("INVALID_OPTIONS")
    return _each(inputs, options, out_dir, " (unlocked)", lambda d: None, encryption=pymupdf.PDF_ENCRYPT_NONE)


def _font_for(text: str) -> pymupdf.Font:
    """Helvetica for Latin text; a wide-coverage built-in font otherwise."""
    helv = pymupdf.Font("helv")
    if all(helv.has_glyph(ord(ch)) for ch in text if not ch.isspace()):
        return helv
    return pymupdf.Font("cjk")


def watermark(inputs, options, out_dir, work, notes):
    text = str(options.get("text") or "").strip()[:80]
    if not text:
        raise KonError("INVALID_OPTIONS")
    style = options.get("style", "diagonal")
    try:
        opacity = min(0.9, max(0.05, float(options.get("opacity", 0.3))))
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    font = _font_for(text)

    def change(doc):
        for page in doc:
            rect = page.rect
            unit = font.text_length(text, fontsize=1) or 1
            if style == "diagonal":
                size = min(120, 0.75 * math.hypot(rect.width, rect.height) / unit)
                angle = math.degrees(math.atan2(rect.height, rect.width))
            elif style == "center":
                size, angle = min(72, 0.7 * rect.width / unit), 0
            else:
                size, angle = min(28, 0.6 * rect.width / unit), 0
            width = unit * size
            center = pymupdf.Point(rect.width / 2, rect.height / 2) if style != "bottom" else pymupdf.Point(rect.width / 2, rect.height - 40)
            writer = pymupdf.TextWriter(rect, opacity=opacity, color=(0.45, 0.45, 0.5))
            writer.append(pymupdf.Point(center.x - width / 2, center.y + size * 0.35), text, font=font, fontsize=size)
            # Page rotation is undone so the mark looks the same on rotated pages.
            matrix = pymupdf.Matrix(-angle) * page.derotation_matrix if page.rotation else pymupdf.Matrix(-angle)
            writer.write_text(page, morph=(center, matrix))

    return _each(inputs, options, out_dir, " (watermarked)", change)


def page_numbers(inputs, options, out_dir, work, notes):
    position = options.get("position", "bottom-center")
    style = options.get("style", "n")
    if position not in ("bottom-center", "bottom-right", "top-right") or style not in ("n", "page_n_of_total"):
        raise KonError("INVALID_OPTIONS")
    font = pymupdf.Font("helv")

    def change(doc):
        total = doc.page_count
        for i, page in enumerate(doc):
            label = str(i + 1) if style == "n" else f"Page {i + 1} of {total}"
            rect = page.rect
            width = font.text_length(label, fontsize=10)
            y = 28 if position == "top-right" else rect.height - 22
            x = rect.width - 36 - width if position.endswith("right") else (rect.width - width) / 2
            writer = pymupdf.TextWriter(rect, color=(0.25, 0.25, 0.3))
            writer.append(pymupdf.Point(x, y), label, font=font, fontsize=10)
            writer.write_text(page, morph=(pymupdf.Point(rect.width / 2, rect.height / 2), page.derotation_matrix) if page.rotation else None)

    return _each(inputs, options, out_dir, " (numbered)", change)


# Fonts that cover scripts Helvetica doesn't (Devanagari…), where the system has them.
FONT_DIRS = ("/usr/share/fonts/truetype/noto", "/usr/share/fonts/opentype/noto", "C:/Windows/Fonts")
FONT_FILES = ("NotoSansDevanagari-Regular.ttf", "Nirmala.ttc", "Nirmala.ttf")
_ocr_fonts: dict[str, pymupdf.Font] = {}


def _ocr_font(text: str) -> pymupdf.Font:
    """A font with glyphs for the text, so the hidden layer copies and searches correctly."""
    helv = _ocr_fonts.setdefault("helv", pymupdf.Font("helv"))
    letters = [ch for ch in text if not ch.isspace()]
    if all(helv.has_glyph(ord(ch)) for ch in letters):
        return helv
    if "file" not in _ocr_fonts:
        for folder in FONT_DIRS:
            for name in FONT_FILES:
                path = Path(folder) / name
                if path.is_file():
                    _ocr_fonts["file"] = pymupdf.Font(fontfile=str(path))
                    break
            if "file" in _ocr_fonts:
                break
    font = _ocr_fonts.get("file")
    if font and all(font.has_glyph(ord(ch)) for ch in letters):
        return font
    return _ocr_fonts.setdefault("cjk", pymupdf.Font("cjk"))


def _ocr_lines(page_ocr: Any) -> tuple[float, float, list[tuple[str, list[float]]]]:
    """(width, height, [(text, [left, top, right, bottom])]) from the phone's reading of one page."""
    if not isinstance(page_ocr, dict):
        raise KonError("INVALID_OPTIONS")
    try:
        width, height = float(page_ocr.get("width") or 0), float(page_ocr.get("height") or 0)
        lines = []
        for line in page_ocr.get("lines") or []:
            text = str(line.get("text") or "").strip()[:2000]
            box = [float(v) for v in line.get("box") or []]
            if text and len(box) == 4 and box[2] > box[0] and box[3] > box[1]:
                lines.append((text, box))
    except (TypeError, ValueError, AttributeError):
        raise KonError("INVALID_OPTIONS") from None
    return width, height, lines[:3000]


def _jpeg_or_png(item: Input, work: Path) -> Path:
    """The page as a file PDF can hold directly; other formats are re-saved as JPEG."""
    if item.fmt in ("jpg", "jpeg", "png"):
        return item.path
    from PIL import Image, ImageOps

    work.mkdir(parents=True, exist_ok=True)
    target = unique(work / f"{item.stem}.jpg")
    try:
        with Image.open(item.path) as img:
            ImageOps.exif_transpose(img).convert("RGB").save(target, "JPEG", quality=90)
    except Exception:
        raise KonError("CORRUPT_FILE", name=item.name) from None
    return target


def searchable(inputs, options, out_dir, work, notes):
    """Scanned pages (images) into one PDF with an invisible text layer.

    The text and its positions come from the phone, which reads the pages
    itself (KonPDF has no reading on the engine). Each line is drawn invisibly
    over the place it appears, so the PDF can be searched, selected and copied.
    """
    require(inputs, {"image"}, "images")
    pages = options.get("ocr")
    if not isinstance(pages, list) or len(pages) != len(inputs):
        raise KonError("INVALID_OPTIONS")
    doc = pymupdf.open()
    for item, page_ocr in zip(inputs, pages):
        ocr_w, ocr_h, lines = _ocr_lines(page_ocr)
        path = _jpeg_or_png(item, work)
        pix = pymupdf.Pixmap(str(path))
        img_w, img_h = pix.width, pix.height
        pix = None
        # A4's long side (842 pt) for the page's long side keeps the text sensible in viewers.
        scale = 842 / max(img_w, img_h)
        page = doc.new_page(width=img_w * scale, height=img_h * scale)
        page.insert_image(page.rect, filename=str(path))
        sx = page.rect.width / (ocr_w or img_w)
        sy = page.rect.height / (ocr_h or img_h)
        writer = pymupdf.TextWriter(page.rect)
        for text, (left, top, right, bottom) in lines:
            font = _ocr_font(text)
            box_w, box_h = (right - left) * sx, (bottom - top) * sy
            unit = font.text_length(text, fontsize=1) or 1
            size = max(1.0, min(box_h * 0.85, box_w / unit))
            with contextlib.suppress(Exception):
                writer.append(pymupdf.Point(left * sx, bottom * sy - box_h * 0.18), text, font=font, fontsize=size)
        # render_mode 3: invisible text, the standard way searchable scans are made.
        writer.write_text(page, render_mode=3)
    name = str(options.get("name") or "Scan").strip()[:80] or "Scan"
    out = _out(out_dir, f"{Path(name).stem} (searchable).pdf")
    doc.save(out, **SAVE)
    doc.close()
    return [out]


TOOLS: dict[str, Callable[..., list[Path]]] = {
    "searchable": searchable,
    "merge": merge,
    "split": split,
    "extract": extract,
    "delete": delete,
    "reorder": reorder,
    "rotate": rotate,
    "compress": compress,
    "protect": protect,
    "unlock": unlock,
    "watermark": watermark,
    "page-numbers": page_numbers,
}
