"""Resizer, enhance and PDF tools."""

from __future__ import annotations

import pymupdf
import pytest
from PIL import Image

from app.convert import identify
from app.errors import KonError, Notes
from app.tools import enhance, pdf_tools, resize


def run_resize(samples, workdirs, key="jpg", **options):
    out_dir, work = workdirs
    notes = Notes()
    (path,) = resize.resize(identify([samples[key]]), options, out_dir, work, notes)
    return path, notes


# ------------------------------------------------------------------ resize


def test_target_file_size_is_met(samples, workdirs):
    path, notes = run_resize(samples, workdirs, mode="filesize", max_kb=60)
    assert path.stat().st_size <= 60 * 1024
    assert not notes.items


def test_tiny_target_shrinks_the_picture_when_allowed(samples, workdirs):
    path, notes = run_resize(samples, workdirs, mode="filesize", max_kb=8)
    assert path.stat().st_size <= 8 * 1024
    with Image.open(path) as img:
        assert img.width < 1600


def test_size_range_respects_the_minimum(samples, workdirs):
    path, _ = run_resize(samples, workdirs, mode="preset", preset="india_form_photo")
    size_kb = path.stat().st_size / 1024
    with Image.open(path) as img:
        assert img.size == (276, 354)  # 3.5 × 4.5 cm at 200 DPI
    assert size_kb <= 50


def test_passport_preset_keeps_exact_pixels_even_with_a_kb_limit(samples, workdirs):
    path, _ = run_resize(samples, workdirs, mode="preset", preset="passport", max_kb=30)
    with Image.open(path) as img:
        assert img.size == (413, 531)
        assert round(img.info["dpi"][0]) == 300
    assert path.stat().st_size <= 30 * 1024


def test_impossible_fixed_size_target_returns_closest_with_a_note(samples, workdirs):
    path, notes = run_resize(samples, workdirs, mode="pixels", width=1600, height=1200, max_kb=3)
    with Image.open(path) as img:
        assert img.size == (1600, 1200)
    assert notes.items[0][0] == "TARGET_CLOSE"


@pytest.mark.parametrize(
    "options,size",
    [
        ({"mode": "pixels", "width": 800}, (800, 600)),
        ({"mode": "pixels", "width": 500, "height": 500, "fit": "fill"}, (500, 500)),
        ({"mode": "pixels", "width": 500, "height": 500, "fit": "fit"}, (500, 500)),
        ({"mode": "pixels", "width": 500, "height": 500, "fit": "contain"}, (500, 375)),
        ({"mode": "percent", "percent": 25}, (400, 300)),
        ({"mode": "longest", "longest": 1000}, (1000, 750)),
        ({"mode": "print", "print": {"width": 2, "height": 2, "unit": "in", "dpi": 300}}, (600, 600)),
        ({"mode": "preset", "preset": "instagram_story"}, (1080, 1920)),
    ],
)
def test_geometry(samples, workdirs, options, size):
    path, _ = run_resize(samples, workdirs, **options)
    with Image.open(path) as img:
        assert img.size == size


def test_png_with_transparency_stays_png(samples, workdirs):
    path, _ = run_resize(samples, workdirs, "png", mode="percent", percent=50)
    with Image.open(path) as img:
        assert path.suffix == ".png" and img.mode == "RGBA"


def test_format_change_and_metadata_strip(samples, workdirs):
    path, _ = run_resize(samples, workdirs, mode="percent", percent=50, format="webp", strip_metadata=True)
    with Image.open(path) as img:
        assert img.format == "WEBP"
        assert not img.info.get("exif")


@pytest.mark.parametrize("options", [{"mode": "pixels"}, {"mode": "percent", "percent": -5}, {"mode": "nope"}, {"mode": "pixels", "width": 99999}])
def test_bad_resize_options_are_friendly(samples, workdirs, options):
    with pytest.raises(KonError) as e:
        run_resize(samples, workdirs, **options)
    assert e.value.code == "INVALID_OPTIONS"


def test_resize_refuses_pdfs(samples, workdirs):
    out_dir, work = workdirs
    with pytest.raises(KonError) as e:
        resize.resize(identify([samples["pdf"]]), {"mode": "percent", "percent": 50}, out_dir, work, Notes())
    assert e.value.code == "WRONG_KIND"


# ----------------------------------------------------------------- enhance


@pytest.mark.parametrize("preset", enhance.PRESETS)
def test_every_enhance_preset(samples, workdirs, preset):
    out_dir, work = workdirs
    (path,) = enhance.enhance(identify([samples["webp"]]), {"preset": preset}, out_dir, work, Notes())
    with Image.open(path) as img:
        expected = (1600, 1200) if preset == "upscale_2x" else (800, 600)
        assert img.size == expected


@pytest.mark.parametrize("name", enhance.FILTERS)
def test_every_filter(samples, workdirs, name):
    out_dir, work = workdirs
    (path,) = enhance.enhance(identify([samples["webp"]]), {"filter": name, "adjust": {"brightness": 20, "warmth": -30}}, out_dir, work, Notes())
    assert path.stat().st_size > 0


def test_preview_is_small_and_fast(samples, workdirs):
    out_dir, work = workdirs
    (path,) = enhance.enhance(identify([samples["jpg"]]), {"preset": "auto", "preview": True}, out_dir, work, Notes())
    with Image.open(path) as img:
        assert max(img.size) <= 900 and img.format == "JPEG"


def test_enhance_keeps_transparency(samples, workdirs):
    out_dir, work = workdirs
    (path,) = enhance.enhance(identify([samples["png"]]), {"filter": "sepia"}, out_dir, work, Notes())
    with Image.open(path) as img:
        assert img.mode == "RGBA" and img.getpixel((0, 0))[3] == 0


def test_bw_document_is_pure_black_and_white(samples, workdirs):
    out_dir, work = workdirs
    (path,) = enhance.enhance(identify([samples["jpg"]]), {"preset": "bw_document"}, out_dir, work, Notes())
    with Image.open(path) as img:
        assert path.suffix == ".png"
        assert {c for _, c in img.convert("L").getcolors()} <= {0, 255}


# --------------------------------------------------------------- PDF tools


def pdf_tool(samples, workdirs, tool, keys=("pdf",), **options):
    out_dir, work = workdirs
    return pdf_tools.TOOLS[tool](identify([samples[k] for k in keys]), options, out_dir, work, Notes())


def pages(path):
    with pymupdf.open(path) as doc:
        return doc.page_count


def test_merge_pdfs_and_images(samples, workdirs):
    (path,) = pdf_tool(samples, workdirs, "merge", ("pdf", "jpg", "pdf"))
    assert pages(path) == 7


def test_split_modes(samples, workdirs):
    assert len(pdf_tool(samples, workdirs, "split", mode="each")) == 3
    assert [pages(p) for p in pdf_tool(samples, workdirs, "split", mode="every", every=2)] == [2, 1]
    assert [pages(p) for p in pdf_tool(samples, workdirs, "split", mode="ranges", ranges="1-2, 3")] == [2, 1]


def test_extract_delete_reorder(samples, workdirs):
    (kept,) = pdf_tool(samples, workdirs, "extract", pages="1, 3")
    assert pages(kept) == 2
    (deleted,) = pdf_tool(samples, workdirs, "delete", pages="2")
    assert pages(deleted) == 2
    (reordered,) = pdf_tool(samples, workdirs, "reorder", order="3,1,2")
    with pymupdf.open(reordered) as doc:
        assert "Chapter 3" in doc[0].get_text()


def test_cannot_delete_every_page(samples, workdirs):
    with pytest.raises(KonError) as e:
        pdf_tool(samples, workdirs, "delete", pages="1-3")
    assert e.value.code == "PAGE_RANGE_INVALID"


def test_out_of_range_pages(samples, workdirs):
    with pytest.raises(KonError) as e:
        pdf_tool(samples, workdirs, "extract", pages="2-9")
    assert e.value.code == "PAGE_RANGE_INVALID" and e.value.params["total"] == 3


def test_rotate(samples, workdirs):
    (path,) = pdf_tool(samples, workdirs, "rotate", angle=90, pages="2")
    with pymupdf.open(path) as doc:
        assert [p.rotation for p in doc] == [0, 90, 0]


def test_protect_unlock_round_trip(samples, workdirs, tmp_path):
    (locked,) = pdf_tool(samples, workdirs, "protect", password="s3cret!")
    with pymupdf.open(locked) as doc:
        assert doc.needs_pass
    samples_locked = {"pdf": locked}
    with pytest.raises(KonError) as e:
        pdf_tool(samples_locked, workdirs, "unlock", password="wrong")
    assert e.value.code == "WRONG_PASSWORD"
    with pytest.raises(KonError) as e:
        pdf_tool(samples_locked, workdirs, "rotate", angle=90)
    assert e.value.code == "PASSWORD_REQUIRED"
    (unlocked,) = pdf_tool(samples_locked, workdirs, "unlock", password="s3cret!")
    with pymupdf.open(unlocked) as doc:
        assert not doc.needs_pass and doc.page_count == 3


def test_watermark_and_page_numbers(samples, workdirs):
    (marked,) = pdf_tool(samples, workdirs, "watermark", text="DRAFT", style="diagonal", opacity=0.3)
    with pymupdf.open(marked) as doc:
        assert "DRAFT" in doc[0].get_text()
    (numbered,) = pdf_tool(samples, workdirs, "page-numbers", style="page_n_of_total", position="bottom-right")
    with pymupdf.open(numbered) as doc:
        assert "Page 2 of 3" in doc[1].get_text()


def test_compress_never_grows_a_file(samples, workdirs):
    (path,) = pdf_tool(samples, workdirs, "compress", level="strong")
    assert path.stat().st_size <= samples["pdf"].stat().st_size


def test_compress_to_target_size(samples, workdirs):
    original = samples["scanned_pdf"].stat().st_size
    (path,) = pdf_tool(samples, workdirs, "compress", ("scanned_pdf",), target_kb=original / 1024 / 3)
    assert path.stat().st_size < original


def test_damaged_pdf_is_reported_kindly(samples, workdirs):
    out_dir, work = workdirs
    with pytest.raises(KonError) as e:
        pdf_tools.TOOLS["rotate"](identify([samples["fake_pdf"]]), {"angle": 90}, out_dir, work, Notes())
    assert e.value.code == "CORRUPT_FILE"
