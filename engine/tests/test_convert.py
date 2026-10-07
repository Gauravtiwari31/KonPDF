"""Every conversion KonPDF offers for the sample files produces a real file of the right format."""

from __future__ import annotations

import pytest

from app.convert import convert, identify
from app.errors import KonError, Notes
from app.formats import NEEDS_OFFICE, detect, matrix


@pytest.mark.parametrize(
    "key,fmt",
    [
        ("jpg", "jpg"), ("png", "png"), ("webp", "webp"), ("gif", "gif"), ("tiff", "tiff"), ("svg", "svg"),
        ("pdf", "pdf"), ("docx", "docx"), ("txt", "txt"), ("md", "md"), ("html", "html"),
        ("xlsx", "xlsx"), ("csv", "csv"), ("json", "json"),
    ],
)  # fmt: skip
def test_detects_real_format(samples, key, fmt):
    assert detect(samples[key]) == fmt


def test_detection_ignores_wrong_names(samples, tmp_path):
    renamed = tmp_path / "actually-a-photo.pdf"
    renamed.write_bytes(samples["jpg"].read_bytes())
    assert detect(renamed) == "jpg"


def test_video_and_garbage_are_not_supported(samples):
    assert detect(samples["mp4"]) is None
    with pytest.raises(KonError) as e:
        identify([samples["mp4"]])
    assert e.value.code == "UNSUPPORTED_FORMAT"


CASES = [
    (key, target)
    for key in ("jpg", "png", "webp", "gif", "tiff", "svg", "heic", "pdf", "docx", "txt", "md", "html", "xlsx", "csv", "json")
    for target in matrix().get(key, [])
    if key not in NEEDS_OFFICE
]


@pytest.mark.parametrize("key,target", CASES)
def test_every_offered_conversion_works(samples, workdirs, key, target):
    if key not in samples:
        pytest.skip(f"no {key} encoder on this machine")
    out_dir, work = workdirs
    inputs = identify([samples[key]])
    try:
        outputs = convert(inputs, target, {}, out_dir, work, Notes())
    except KonError as e:
        # Some inputs honestly have nothing to offer for some targets.
        assert e.code == "NO_TABLES" and target in ("xlsx", "csv"), e.code
        return
    assert outputs, "no output"
    for path in outputs:
        assert path.stat().st_size > 0
        detected = detect(path)
        expected = {"jpg": "jpg", "ico": "ico"}.get(target, target)
        assert detected == expected, f"{path.name} detected as {detected}"


def test_images_combine_into_one_pdf(samples, workdirs):
    import pymupdf

    out_dir, work = workdirs
    outputs = convert(identify([samples["jpg"], samples["png"], samples["tiff"]]), "pdf", {"page_size": "a4"}, out_dir, work, Notes())
    assert len(outputs) == 1
    assert pymupdf.open(outputs[0]).page_count == 4  # TIFF has 2 pages


def test_pdf_to_images_respects_pages_and_dpi(samples, workdirs):
    from PIL import Image

    out_dir, work = workdirs
    outputs = convert(identify([samples["pdf"]]), "png", {"pages": "2-3", "dpi": 72}, out_dir, work, Notes())
    assert [p.name for p in outputs] == ["report-p02.png", "report-p03.png"]
    with Image.open(outputs[0]) as img:
        assert img.size == (595, 842)


def test_pdf_tables_become_a_sheet(samples, workdirs):
    import pandas as pd

    out_dir, work = workdirs
    (xlsx,) = convert(identify([samples["pdf"]]), "xlsx", {}, out_dir, work, Notes())
    df = next(iter(pd.read_excel(xlsx, sheet_name=None).values()))
    assert list(df.columns) == ["Name", "Qty", "Price"]
    assert df.iloc[0, 0] == "Apple"


def test_scanned_pdf_to_word_keeps_pages_as_pictures(samples, workdirs):
    out_dir, work = workdirs
    notes = Notes()
    (docx,) = convert(identify([samples["scanned_pdf"]]), "docx", {}, out_dir, work, notes)
    assert ("SCANNED_PDF", {}) in notes.items
    assert docx.stat().st_size > 10_000


def test_docx_keeps_text_lists_tables_and_hindi(samples, workdirs):
    out_dir, work = workdirs
    (md,) = convert(identify([samples["docx"]]), "md", {}, out_dir, work, Notes())
    text = md.read_text("utf-8")
    assert "# KonPDF test" in text
    assert "**bold**" in text
    assert "- First point" in text
    assert "| City | Pop |" in text
    assert "नमस्ते" in text


def test_docx_to_pdf_without_libreoffice_keeps_text(samples, workdirs, monkeypatch):
    import pymupdf

    from app.config import settings

    monkeypatch.setattr(settings, "soffice", None)
    out_dir, work = workdirs
    notes = Notes()
    (pdf,) = convert(identify([samples["docx"]]), "pdf", {}, out_dir, work, notes)
    text = "".join(page.get_text() for page in pymupdf.open(pdf))
    assert "KonPDF test" in text and "Second point" in text and "Delhi" in text
    assert ("LAYOUT_SIMPLIFIED", {}) in notes.items


def test_office_formats_need_libreoffice(tmp_path, workdirs, monkeypatch):
    from app.config import settings
    from app.convert import Input

    monkeypatch.setattr(settings, "soffice", None)
    fake = tmp_path / "old.ppt"
    fake.write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 512)
    out_dir, work = workdirs
    with pytest.raises(KonError) as e:
        convert([Input(fake, "old.ppt", "ppt")], "pdf", {}, out_dir, work, Notes())
    assert e.value.code == "NEEDS_FULL_CONVERTER"


def test_csv_delimiter_is_detected(samples, workdirs):
    import pandas as pd

    out_dir, work = workdirs
    (xlsx,) = convert(identify([samples["csv"]]), "xlsx", {}, out_dir, work, Notes())
    df = pd.read_excel(xlsx)
    assert list(df.columns) == ["Name", "Score"]
    assert df.iloc[2, 0] == "Zoë"


def test_multi_sheet_xlsx_to_csv_makes_one_file_per_sheet(samples, workdirs):
    out_dir, work = workdirs
    outputs = convert(identify([samples["xlsx"]]), "csv", {}, out_dir, work, Notes())
    assert sorted(p.name for p in outputs) == ["marks - Class A.csv", "marks - Class B.csv"]


def test_unsupported_pair_is_refused(samples, workdirs):
    out_dir, work = workdirs
    with pytest.raises(KonError) as e:
        convert(identify([samples["xlsx"]]), "jpg", {}, out_dir, work, Notes())
    assert e.value.code == "UNSUPPORTED_CONVERSION"


def test_jpg_output_has_no_transparency_problems(samples, workdirs):
    from PIL import Image

    out_dir, work = workdirs
    (jpg,) = convert(identify([samples["png"]]), "jpg", {}, out_dir, work, Notes())
    with Image.open(jpg) as img:
        assert img.mode == "RGB"
        assert img.getpixel((0, 0)) == (255, 255, 255)  # transparent corner → white


def test_animated_gif_uses_first_frame_with_a_note(samples, workdirs):
    out_dir, work = workdirs
    notes = Notes()
    convert(identify([samples["gif"]]), "png", {}, out_dir, work, notes)
    assert notes.items[0][0] == "FIRST_FRAME"
