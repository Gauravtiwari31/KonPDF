"""Friendly errors and NW: every language, no status codes, no jargon."""

from __future__ import annotations

import re

import pytest

from app.errors import CATALOG, NOTES, render
from app.i18n import SUPPORTED, from_accept_language
from app.pipeline import validate_plan
from model import NW, detect_language

JARGON = re.compile(r"\b(?:[1-5]\d\d)\b|traceback|exception|errno|null|undefined|stack|http|status code|\{[a-z_]+\}", re.I)
PARAMS = dict(name="photo.jpg", max_mb=50, size_mb=72, max=20, src="PPTX", dst="JPG", pages="9-12", total=3, expected="images", detail="")


@pytest.mark.parametrize("code", sorted(CATALOG))
@pytest.mark.parametrize("lang", SUPPORTED)
def test_every_error_in_every_language(code, lang):
    error = render(code, lang, **PARAMS)
    assert error["code"] == code
    for key in ("title", "message"):
        assert error[key].strip(), f"{code}/{lang} has an empty {key}"
    for text in (error["title"], error["message"], error.get("hint", "")):
        assert not JARGON.search(text), f"{code}/{lang}: {text}"


@pytest.mark.parametrize("key", sorted(NOTES))
def test_every_note_in_every_language(key):
    assert set(NOTES[key]) == set(SUPPORTED)


def test_unknown_code_becomes_internal():
    assert render("SOMETHING_WEIRD", "en")["code"] == "INTERNAL"


@pytest.mark.parametrize(
    "header,lang",
    [("hi-IN,hi;q=0.9,en;q=0.8", "hi"), ("hi-Latn", "hi-Latn"), ("pt-BR", "pt"), ("ja,en;q=0.5", "en"), ("", "en"), ("xx", "en"), ("fr;q=0.3,de;q=0.9", "de")],
)
def test_accept_language(header, lang):
    assert from_accept_language(header) == lang


# ---------------------------------------------------------------------- NW


@pytest.mark.parametrize(
    "text,lang",
    [
        ("make this photo under 50 kb", "en"),
        ("isko pdf bana do please", "hi-Latn"),
        ("photo ko chhota karo", "hi-Latn"),
        ("इस फ़ोटो को छोटा करो", "hi"),
        ("convierte este archivo a PDF", "es"),
        ("comprime la imagen a 100 KB", "es"),
        ("fusionne ces PDF et ajoute les numéros de page", "fr"),
        ("convertis cette image en PNG", "fr"),
        ("Bitte dieses Bild in PNG umwandeln", "de"),
        ("Datei kleiner als 1 MB machen", "de"),
        ("converta este arquivo para PDF", "pt"),
        ("quero reduzir o tamanho da imagem", "pt"),
    ],
)
def test_language_detection(text, lang):
    assert detect_language(text, "en") == lang


IMG = [{"name": "photo.jpg", "mime": "image/jpeg", "size": 2_400_000}]
PDF = [{"name": "doc.pdf", "mime": "application/pdf", "size": 5_000_000}]
TWO_PDFS = PDF + [{"name": "b.pdf", "mime": "application/pdf", "size": 1}]


@pytest.mark.parametrize(
    "message,files,steps",
    [
        ("make this photo under 50kb", IMG, [("resize", {"mode": "filesize", "max_kb": 50.0})]),
        ("isko pdf bana do", IMG, [("convert", {"to": "pdf"})]),
        ("passport photo banao 50kb se kam", IMG, [("resize", {"mode": "preset", "preset": "passport", "max_kb": 50.0})]),
        ("20-50 kb govt form photo", IMG, [("resize", {"preset": "india_form_photo", "min_kb": 20.0, "max_kb": 50.0})]),
        ("resize to 1080x1080", IMG, [("resize", {"mode": "pixels", "width": 1080, "height": 1080})]),
        ("make it 3.5 x 4.5 cm", IMG, [("resize", {"mode": "print"})]),
        ("scale to 50%", IMG, [("resize", {"mode": "percent", "percent": 50.0})]),
        ("comprime este PDF a 1 MB", PDF, [("compress_pdf", {"target_kb": 1024.0})]),
        ("fusionne ces PDF et ajoute les numéros de page", TWO_PDFS, [("merge", {}), ("page_numbers", {})]),
        ("convert this scan to black and white and make it a pdf", IMG, [("enhance", {"preset": "bw_document"}), ("convert", {"to": "pdf"})]),
        ("rotate pages 2-3 left", PDF, [("rotate", {"angle": 270, "pages": "2-3"})]),
        ("keep only pages 1, 3", PDF, [("extract", {"pages": "1,3"})]),
        ("split this pdf", PDF, [("split", {"mode": "each"})]),
        ('add watermark "DRAFT"', PDF, [("watermark", {"text": "DRAFT"})]),
        ("lock it, password: hunter22", PDF, [("protect", {"password": "hunter22"})]),
        ("convert to word", PDF, [("convert", {"to": "docx"})]),
        ("excel to csv", [{"name": "a.xlsx", "mime": "", "size": 1}], [("convert", {"to": "csv"})]),
        ("merge these images into one pdf", IMG + IMG, [("convert", {"to": "pdf"})]),
        ("make it better", IMG, [("enhance", {"preset": "auto"})]),
        ("this photo is too dark", IMG, [("enhance", {"preset": "low_light"})]),
        ("photo ko chhota karo aur pdf bana do", IMG, [("resize", {"mode": "compress"}), ("convert", {"to": "pdf"})]),
        ("convert to png and make it under 200 kb", IMG, [("resize", {"max_kb": 200.0, "format": "png"})]),
    ],
)
def test_plans(message, files, steps):
    reply = NW().reply(message, "en", files)
    assert reply["plan"], reply["reply"]
    got = reply["plan"]["steps"]
    assert [s["tool"] for s in got] == [t for t, _ in steps]
    for (_, expected), step in zip(steps, got):
        for key, value in expected.items():
            assert step["params"].get(key) == value, (key, step)
    # Whatever NW proposes must pass the engine's own whitelist.
    assert validate_plan(reply["plan"]) == got


def test_asks_for_missing_details():
    nw = NW()
    assert nw.reply("lock this pdf", "en", PDF)["plan"] is None
    assert "password" in nw.reply("lock this pdf", "en", PDF)["reply"].lower()
    follow_up = nw.reply("password: hunter22", "en", PDF, history=[{"role": "user", "text": "lock this pdf"}])
    assert follow_up["plan"]["steps"] == [{"tool": "protect", "params": {"password": "hunter22"}}]
    assert "pages" in nw.reply("delete some pages", "en", PDF)["reply"].lower()


@pytest.mark.parametrize("message", ["convert my video to mp3", "can you extract text from image (ocr)?", "make a song louder"])
def test_out_of_scope_is_declined_kindly(message):
    reply = NW().reply(message, "en", [])
    assert reply["plan"] is None
    assert "KonPDF" in reply["reply"]


def test_replies_in_the_users_language():
    nw = NW()
    assert re.search(r"[ऀ-ॿ]", nw.reply("इसे पीडीएफ बना दो", "en", IMG)["reply"])
    assert "Samajh gaya" in nw.reply("isko pdf bana do", "en", IMG)["reply"]
    assert "Entendido" in nw.reply("convierte a PDF", "en", IMG)["reply"]
    assert "Alles klar" in nw.reply("in PDF umwandeln bitte", "en", IMG)["reply"]


def test_sizes_read_naturally():
    reply = NW().reply("compress this pdf to 1 MB", "en", PDF)
    assert "1 MB" in reply["reply"] and "1024" not in reply["reply"]


def test_greeting_faq_and_unknown():
    nw = NW()
    assert nw.reply("", "hi")["reply"].startswith("नमस्ते")
    assert "30 minutes" in nw.reply("are my files private?", "en")["reply"]
    unknown = nw.reply("what's the weather in Pune", "en")
    assert unknown["plan"] is None and unknown["suggestions"]


@pytest.mark.parametrize("code", sorted(CATALOG))
@pytest.mark.parametrize("lang", SUPPORTED)
def test_nw_explains_every_error(code, lang):
    reply = NW().explain(code, lang)["reply"]
    assert len(reply) > 20
    assert not JARGON.search(reply), reply


def test_nw_never_explains_with_status_codes():
    for code in ("404", "402", "../../etc/passwd", "<script>"):
        assert not JARGON.search(NW().explain(code, "en")["reply"])
