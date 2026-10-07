"""PDF → images, Word, text, Markdown, HTML and sheets."""

from __future__ import annotations

import html
import io
from collections import Counter
from pathlib import Path

import pymupdf
from PIL import Image

from ..errors import KonError, Notes


def open_pdf(path: Path, name: str, password: str | None = None) -> pymupdf.Document:
    """Opens a PDF, unlocking it with `password` if it needs one."""
    try:
        doc = pymupdf.open(path, filetype="pdf")
    except Exception as e:  # noqa: BLE001 - any parse failure means a damaged file
        raise KonError("CORRUPT_FILE", name=name) from e
    if doc.needs_pass:
        if not password:
            raise KonError("PASSWORD_REQUIRED", name=name)
        if not doc.authenticate(password):
            raise KonError("WRONG_PASSWORD", name=name)
    if doc.page_count == 0:
        raise KonError("CORRUPT_FILE", name=name)
    return doc


def render_page(page: pymupdf.Page, dpi: int, alpha: bool = False) -> Image.Image:
    zoom = dpi / 72
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=alpha)
    mode = "RGBA" if alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    img.info["dpi"] = (dpi, dpi)
    return img


def page_images(doc: pymupdf.Document, dpi: int = 150, pages: list[int] | None = None) -> list[Image.Image]:
    dpi = int(min(600, max(36, dpi)))
    return [render_page(doc[i], dpi) for i in (pages if pages is not None else range(doc.page_count))]


def is_scanned(doc: pymupdf.Document) -> bool:
    """Mostly pictures and hardly any real text: a scan or a photo of pages."""
    chars = sum(len(page.get_text("text").strip()) for page in doc)
    has_images = any(page.get_images() for page in doc)
    return has_images and chars < 25 * doc.page_count


def to_text(doc: pymupdf.Document) -> str:
    parts = []
    for page in doc:
        parts.append(page.get_text("text", sort=True).strip())
    return "\n\n\f\n\n".join(parts).replace("\n\f\n", "\n") + "\n"


def _blocks(page: pymupdf.Page) -> list[dict]:
    """Text and image blocks in reading order."""
    data = page.get_text("dict", sort=True)
    return [b for b in data["blocks"] if b.get("type") in (0, 1)]


def _body_size(doc: pymupdf.Document) -> float:
    sizes: Counter[float] = Counter()
    for page in doc:
        for block in _blocks(page):
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes[round(span["size"])] += len(span["text"])
    return float(sizes.most_common(1)[0][0]) if sizes else 11.0


def _paragraphs(doc: pymupdf.Document):
    """Yields ("heading", level, text) / ("para", 0, spans) / ("image", 0, bytes) / ("page", 0, None)."""
    body = _body_size(doc)
    for index, page in enumerate(doc):
        if index:
            yield ("page", 0, None)
        for block in _blocks(page):
            if block["type"] == 1:
                if block.get("image"):
                    width = block["bbox"][2] - block["bbox"][0]
                    yield ("image", width, block["image"])
                continue
            spans = [s for line in block["lines"] for s in line["spans"] + [{"text": " ", "size": 0, "flags": 0}]]
            text = "".join(s["text"] for s in spans).strip()
            if not text:
                continue
            size = max(s["size"] for s in spans)
            bold = all(s["flags"] & 16 for s in spans if s["text"].strip())
            if size >= body * 1.6 and len(text) < 160:
                yield ("heading", 1, text)
            elif (size >= body * 1.25 or (bold and len(text) < 90)) and len(text) < 160:
                yield ("heading", 2, text)
            else:
                yield ("para", 0, [s for s in spans if s["text"]])


def to_docx(doc: pymupdf.Document, out: Path, notes: Notes) -> Path:
    from docx import Document
    from docx.shared import Inches, Pt

    document = Document()
    section = document.sections[0]
    usable = (section.page_width - section.left_margin - section.right_margin) / 914400
    if is_scanned(doc):
        notes.add("SCANNED_PDF")
        for i, img in enumerate(page_images(doc, 150)):
            if i:
                document.add_page_break()
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85)
            document.add_picture(buf, width=Inches(usable))
        document.save(out)
        return out
    for kind, value, payload in _paragraphs(doc):
        if kind == "page":
            document.add_page_break()
        elif kind == "heading":
            document.add_heading(payload, level=value)
        elif kind == "image":
            try:
                with Image.open(io.BytesIO(payload)) as probe:
                    probe.load()
                    buf = io.BytesIO()
                    (probe.convert("RGB") if probe.mode not in ("RGB", "L") else probe).save(buf, "PNG")
                width_in = min(usable, max(0.5, value / 72))
                document.add_picture(buf, width=Inches(width_in))
            except Exception:  # noqa: BLE001 - an odd embedded image is skipped, not fatal
                continue
        else:
            paragraph = document.add_paragraph()
            for span in payload:
                run = paragraph.add_run(span["text"])
                run.bold = bool(span["flags"] & 16) or None
                run.italic = bool(span["flags"] & 2) or None
                if span["size"]:
                    run.font.size = Pt(round(span["size"] * 2) / 2)
    document.save(out)
    return out


def to_markdown(doc: pymupdf.Document) -> str:
    lines: list[str] = []
    for kind, value, payload in _paragraphs(doc):
        if kind == "page":
            lines.append("---")
        elif kind == "heading":
            lines.append("#" * value + " " + payload)
        elif kind == "para":
            parts = []
            for span in payload:
                text = span["text"]
                if span["flags"] & 16 and text.strip():
                    text = f"**{text.strip()}** "
                parts.append(text)
            lines.append("".join(parts).strip())
    return "\n\n".join(lines) + "\n"


def to_html(doc: pymupdf.Document, title: str) -> str:
    body: list[str] = []
    for kind, value, payload in _paragraphs(doc):
        if kind == "page":
            body.append("<hr>")
        elif kind == "heading":
            body.append(f"<h{value}>{html.escape(payload)}</h{value}>")
        elif kind == "para":
            parts = []
            for span in payload:
                text = html.escape(span["text"])
                if span["flags"] & 16:
                    text = f"<strong>{text}</strong>"
                if span["flags"] & 2:
                    text = f"<em>{text}</em>"
                parts.append(text)
            body.append(f"<p>{''.join(parts).strip()}</p>")
    return (
        "<!doctype html>\n<html><head><meta charset=\"utf-8\">"
        f"<title>{html.escape(title)}</title>"
        "<style>body{font-family:system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.5}</style>"
        "</head><body>\n" + "\n".join(body) + "\n</body></html>\n"
    )


def tables(doc: pymupdf.Document, name: str):
    """Every table PyMuPDF finds, as {sheet name: DataFrame}."""
    import pandas as pd

    found: dict[str, pd.DataFrame] = {}
    for index, page in enumerate(doc):
        try:
            page_tables = page.find_tables().tables
        except Exception:  # noqa: BLE001 - table detection is best effort
            continue
        for t_index, table in enumerate(page_tables, start=1):
            rows = [[("" if c is None else str(c).strip()) for c in row] for row in table.extract()]
            rows = [r for r in rows if any(r)]
            if len(rows) < 2:
                continue
            header, *data = rows
            if len(set(header)) != len(header) or not all(header):
                header = [h or f"Column {i + 1}" for i, h in enumerate(header)]
                header = [f"{h} ({i + 1})" if header.count(h) > 1 else h for i, h in enumerate(header)]
            found[f"Page {index + 1} table {t_index}"[:31]] = pd.DataFrame(data, columns=header)
    if not found:
        raise KonError("NO_TABLES", name=name)
    return found
