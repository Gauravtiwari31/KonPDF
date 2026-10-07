"""Conversion between formats: picks the right converter for each input."""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .converters import documents, images, office, pdf, sheets
from .errors import KonError, Notes
from .formats import ALIASES, IMAGE_OUT, KINDS, NEEDS_OFFICE, detect, matrix
from .storage import safe_name, unique


@dataclass
class Input:
    path: Path
    name: str
    fmt: str

    @property
    def kind(self) -> str:
        return KINDS.get(self.fmt, "unknown")

    @property
    def stem(self) -> str:
        return Path(self.name).stem or "file"


def identify(paths: list[Path], names: list[str] | None = None) -> list[Input]:
    """Detects each file's real format; unknown files get a friendly error."""
    out = []
    for i, path in enumerate(paths):
        name = names[i] if names else path.name
        fmt = detect(path, name)
        if fmt is None:
            raise KonError("UNSUPPORTED_FORMAT", name=name)
        out.append(Input(path, name, fmt))
    return out


def require(inputs: list[Input], kinds: set[str], expected: str) -> None:
    for item in inputs:
        if item.kind not in kinds:
            raise KonError("WRONG_KIND", expected=expected, name=item.name)


def _opt_int(options: dict[str, Any], key: str, default: int, lo: int, hi: int) -> int:
    try:
        value = int(float(options.get(key, default)))
    except (TypeError, ValueError):
        raise KonError("INVALID_OPTIONS") from None
    return min(hi, max(lo, value))


def _out(out_dir: Path, stem: str, ext: str) -> Path:
    return unique(out_dir / safe_name(f"{stem}.{ext}"))


def _save_images(frames: list, stem: str, target: str, out_dir: Path, quality: int, background: str) -> list[Path]:
    outputs = []
    for i, frame in enumerate(frames):
        suffix = f"-p{i + 1:02d}" if len(frames) > 1 else ""
        path = _out(out_dir, stem + suffix, target)
        dpi = (frame.info.get("dpi") or (None,))[0]
        path.write_bytes(images.encode(frame, target, quality=quality, background=background, dpi=dpi))
        outputs.append(path)
    return outputs


def _document_to(item: Input, target: str, options: dict[str, Any], out_dir: Path, work: Path, notes: Notes) -> list[Path]:
    fmt, src_label = item.fmt, item.fmt.upper()
    source = item.path
    if fmt in NEEDS_OFFICE:
        if target in ("pdf", "jpg", "png"):
            pdf_path = office.convert(source, "pdf", work / "office", src_label)
            if target == "pdf":
                final = _out(out_dir, item.stem, "pdf")
                pdf_path.replace(final)
                return [final]
            return _pdf_to(Input(pdf_path, item.name, "pdf"), target, options, out_dir, work, notes)
        source = office.convert(source, "docx", work / "office", src_label)
        fmt = "docx"
    if fmt == "docx" and target == "pdf" and office.available():
        result = office.convert(source, "pdf", work / "office", src_label)
        final = _out(out_dir, item.stem, "pdf")
        result.replace(final)
        return [final]

    assets = work / "assets"
    body = documents.read_as_html(source, fmt, assets, item.name)
    if target == "pdf" or target in ("jpg", "png"):
        pdf_path = documents.html_to_pdf(body, _out(out_dir if target == "pdf" else work, item.stem, "pdf"), assets)
        if fmt == "docx":
            notes.add("LAYOUT_SIMPLIFIED")
        if target == "pdf":
            return [pdf_path]
        return _pdf_to(Input(pdf_path, item.name, "pdf"), target, options, out_dir, work, notes)
    if target == "docx":
        return [documents.to_docx(documents.parse_html(body), _out(out_dir, item.stem, "docx"), assets)]
    if target == "txt":
        path = _out(out_dir, item.stem, "txt")
        path.write_text(documents.to_text(documents.parse_html(body)), "utf-8")
        return [path]
    if target == "md":
        path = _out(out_dir, item.stem, "md")
        path.write_text(documents.to_markdown(documents.parse_html(body)), "utf-8")
        return [path]
    if target == "html":
        path = _out(out_dir, item.stem, "html")
        path.write_text(documents.to_html_document(body, item.stem), "utf-8")
        return [path]
    if target in ("xlsx", "csv"):
        return sheets.write(documents.html_tables(body, item.name), target, out_dir, item.stem)
    raise KonError("UNSUPPORTED_CONVERSION", src=src_label, dst=target.upper())


def _pdf_to(item: Input, target: str, options: dict[str, Any], out_dir: Path, work: Path, notes: Notes) -> list[Path]:
    doc = pdf.open_pdf(item.path, item.name, options.get("password"))
    try:
        if target in IMAGE_OUT:
            from .pages import parse_pages

            pages = parse_pages(options.get("pages"), doc.page_count)
            dpi = _opt_int(options, "dpi", 150, 36, 600)
            frames = pdf.page_images(doc, dpi, pages)
            quality = _opt_int(options, "quality", 88, 1, 100)
            outputs = []
            for page_no, frame in zip(pages, frames):
                suffix = f"-p{page_no + 1:02d}" if doc.page_count > 1 else ""
                path = _out(out_dir, item.stem + suffix, target)
                path.write_bytes(images.encode(frame, target, quality=quality, dpi=dpi))
                outputs.append(path)
            return outputs
        if target == "docx":
            return [pdf.to_docx(doc, _out(out_dir, item.stem, "docx"), notes)]
        if target == "txt":
            if pdf.is_scanned(doc):
                notes.add("SCANNED_PDF")
            path = _out(out_dir, item.stem, "txt")
            path.write_text(pdf.to_text(doc), "utf-8")
            return [path]
        if target == "md":
            path = _out(out_dir, item.stem, "md")
            path.write_text(pdf.to_markdown(doc), "utf-8")
            return [path]
        if target == "html":
            path = _out(out_dir, item.stem, "html")
            path.write_text(pdf.to_html(doc, item.stem), "utf-8")
            return [path]
        if target in ("xlsx", "csv"):
            return sheets.write(pdf.tables(doc, item.name), target, out_dir, item.stem)
    finally:
        doc.close()
    raise KonError("UNSUPPORTED_CONVERSION", src="PDF", dst=target.upper())


def convert(inputs: list[Input], target: str, options: dict[str, Any], out_dir: Path, work: Path, notes: Notes) -> list[Path]:
    """Converts every input to `target`. Images → PDF/DOCX are combined into one file by default."""
    target = (target or "").lower().strip(". ")
    target = ALIASES.get(target, target)
    table = matrix()
    for item in inputs:
        if target not in table.get(item.fmt, []):
            raise KonError("UNSUPPORTED_CONVERSION", src=item.fmt.upper(), dst=target.upper() or "?")
    out_dir.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    quality = _opt_int(options, "quality", 88, 1, 100)
    background = str(options.get("background") or "#ffffff")

    if all(i.kind == "image" for i in inputs) and target in ("pdf", "docx"):
        groups = [inputs] if options.get("combine", True) else [[i] for i in inputs]
        outputs = []
        for group in groups:
            frames = [f for item in group for f in images.open_frames(item.path, item.fmt, item.name, notes)]
            stem = group[0].stem if len(group) == 1 else f"{group[0].stem} + {len(group) - 1} more"
            path = _out(out_dir, stem, target)
            if target == "pdf":
                images.images_to_pdf(
                    frames,
                    path,
                    page_size=str(options.get("page_size", "a4")),
                    orientation=str(options.get("orientation", "auto")),
                    margin=options.get("margin"),
                    quality=quality,
                )
            else:
                images.images_to_docx(frames, path, quality)
            outputs.append(path)
        return outputs

    outputs: list[Path] = []
    for index, item in enumerate(inputs):
        step_work = work / f"item{index}"
        step_work.mkdir(parents=True, exist_ok=True)
        if item.kind == "image":
            frames = images.open_frames(item.path, item.fmt, item.name, notes)
            outputs += _save_images(frames, item.stem, target, out_dir, quality, background)
        elif item.kind == "pdf":
            outputs += _pdf_to(item, target, options, out_dir, step_work, notes)
        elif item.kind in ("document", "presentation"):
            outputs += _document_to(item, target, options, out_dir, step_work, notes)
        elif item.kind == "sheet":
            tables = sheets.read(item.path, item.fmt, item.name, header=bool(options.get("header", True)), sheet=options.get("sheet"))
            outputs += sheets.write(tables, target, out_dir, item.stem)
        else:
            raise KonError("UNSUPPORTED_FORMAT", name=item.name)
    return outputs


def maybe_zip(outputs: list[Path], options: dict[str, Any], out_dir: Path, name: str = "KonPDF results") -> list[Path]:
    """Bundles many results into one ZIP when the person asked for it."""
    if not options.get("zip") or len(outputs) < 2:
        return outputs
    archive = _out(out_dir, name, "zip")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for path in outputs:
            z.write(path, path.name)
    for path in outputs:
        path.unlink(missing_ok=True)
    return [archive]
