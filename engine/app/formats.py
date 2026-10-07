"""What a file really is (by its bytes, not just its name) and what it can become."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

from .config import settings

IMAGE_IN = ("jpg", "png", "webp", "bmp", "gif", "tiff", "ico", "heic", "avif", "svg")
IMAGE_OUT = ("jpg", "png", "webp", "bmp", "gif", "tiff", "ico", "avif")
TEXT_DOCS = ("txt", "md", "html")
WORD_DOCS = ("docx",)
OFFICE_DOCS = ("doc", "odt", "rtf")  # need LibreOffice
SLIDES = ("pptx", "ppt", "odp")  # need LibreOffice
SHEETS = ("xlsx", "xls", "ods", "csv", "tsv", "json")

KINDS: dict[str, str] = {
    **{f: "image" for f in IMAGE_IN},
    "pdf": "pdf",
    **{f: "document" for f in TEXT_DOCS + WORD_DOCS + OFFICE_DOCS},
    **{f: "presentation" for f in SLIDES},
    **{f: "sheet" for f in SHEETS},
}

NEEDS_OFFICE = set(OFFICE_DOCS + SLIDES)

MIME: dict[str, str] = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "gif": "image/gif",
    "tiff": "image/tiff",
    "ico": "image/x-icon",
    "heic": "image/heic",
    "avif": "image/avif",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "odt": "application/vnd.oasis.opendocument.text",
    "rtf": "application/rtf",
    "txt": "text/plain",
    "md": "text/markdown",
    "html": "text/html",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt": "application/vnd.ms-powerpoint",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "csv": "text/csv",
    "tsv": "text/tab-separated-values",
    "json": "application/json",
    "zip": "application/zip",
}

ALIASES = {
    "jpeg": "jpg",
    "jpe": "jpg",
    "jfif": "jpg",
    "tif": "tiff",
    "heif": "heic",
    "htm": "html",
    "markdown": "md",
    "text": "txt",
}


def matrix() -> dict[str, list[str]]:
    """Input format → output formats, in the order the app shows them."""
    sheet_out = ["xlsx", "csv", "tsv", "json", "html", "md", "pdf", "docx"]
    doc_out = ["pdf", "docx", "txt", "md", "html", "jpg", "png"]
    out: dict[str, list[str]] = {}
    for f in IMAGE_IN:
        out[f] = [x for x in IMAGE_OUT if x != f] + ["pdf", "docx"]
    out["pdf"] = ["jpg", "png", "webp", "tiff", "docx", "txt", "md", "html", "xlsx", "csv"]
    for f in WORD_DOCS + OFFICE_DOCS + TEXT_DOCS:
        out[f] = [x for x in doc_out if x != f] + (["xlsx", "csv"] if f in ("docx", "odt", "html") else [])
    for f in SLIDES:
        out[f] = ["pdf", "jpg", "png"]
    for f in SHEETS:
        out[f] = [x for x in sheet_out if x != f]
    return out


def ext_of(name: str) -> str:
    ext = Path(name).suffix.lower().lstrip(".")
    return ALIASES.get(ext, ext)


def _zip_kind(path: Path) -> str | None:
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            if "word/document.xml" in names:
                return "docx"
            if "xl/workbook.xml" in names:
                return "xlsx"
            if "ppt/presentation.xml" in names:
                return "pptx"
            if "mimetype" in names:
                mime = z.read("mimetype").decode("ascii", "ignore").strip()
                return {
                    "application/vnd.oasis.opendocument.text": "odt",
                    "application/vnd.oasis.opendocument.spreadsheet": "ods",
                    "application/vnd.oasis.opendocument.presentation": "odp",
                }.get(mime)
    except (zipfile.BadZipFile, OSError, KeyError):
        return None
    return None


def _looks_like_text(head: bytes) -> bool:
    if b"\x00" in head:
        return False
    try:
        head.decode("utf-8")
        return True
    except UnicodeDecodeError as e:
        # A multi-byte character cut off at the end of the sample is fine.
        return e.start >= len(head) - 4


def detect(path: Path, name: str | None = None) -> str | None:
    """The file's real format, or None if KonPDF doesn't know it."""
    with path.open("rb") as f:
        head = f.read(4096)
    if not head:
        return None
    ext = ext_of(name or path.name)
    if head.startswith(b"%PDF") or b"%PDF-" in head[:1024]:
        return "pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head.startswith(b"BM"):
        return "bmp"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    if head[:4] == b"\x00\x00\x01\x00":
        return "ico"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"avif", b"avis"):
            return "avif"
        if brand in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"heim", b"heis"):
            return "heic"
        return None  # MP4 and other video: not supported
    if head.startswith(b"PK\x03\x04"):
        return _zip_kind(path)
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        # Old binary Office: the name is the best hint there is.
        return ext if ext in ("doc", "xls", "ppt") else "doc"
    if head.lstrip().startswith(b"{\\rtf"):
        return "rtf"
    if not _looks_like_text(head):
        return None
    text = head.decode("utf-8", "ignore").lstrip("﻿ \t\r\n").lower()
    if "<svg" in text[:2048] and (ext == "svg" or text.startswith("<?xml") or text.startswith("<svg")):
        return "svg"
    if ext in ("csv", "tsv", "md", "txt"):
        return ext
    if ext == "html" or text.startswith(("<!doctype html", "<html")):
        return "html"
    if ext == "json" or text[:1] in ("[", "{"):
        try:
            json.loads(path.read_text("utf-8-sig"))
            return "json"
        except (ValueError, UnicodeDecodeError):
            return "txt" if ext != "json" else None
    return "txt"


def office_available() -> bool:
    return settings.soffice is not None
