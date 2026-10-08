"""The HTTP API end to end: uploads, results, downloads and friendly failures."""

from __future__ import annotations

import json
import re

STATUS_IN_TEXT = re.compile(r"\b[1-5]\d\d\b")


def upload(*paths):
    return [("files", (p.name, p.read_bytes(), "application/octet-stream")) for p in paths]


def assert_friendly(response, code):
    body = response.json()
    assert body["ok"] is False
    error = body["error"]
    assert error["code"] == code
    for text in (error["title"], error["message"], error.get("hint", "")):
        assert not STATUS_IN_TEXT.search(text), text
    return error


def test_health_and_formats(client):
    health = client.get("/api/health").json()
    assert health["status"] == "ok" and health["nw"].startswith("core")
    formats = client.get("/api/formats").json()
    assert "pdf" in formats["matrix"]["jpg"] and formats["kinds"]["xlsx"] == "sheet"


def test_convert_and_download(client, samples):
    r = client.post("/api/convert", files=upload(samples["jpg"], samples["png"]), data={"target": "pdf", "options": json.dumps({"page_size": "a4"})})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] and len(body["files"]) == 1
    result = body["files"][0]
    assert result["mime"] == "application/pdf"
    download = client.get(f"/api/{result['url']}")
    assert download.status_code == 200 and download.content.startswith(b"%PDF")
    # Delete now: the result is gone, kindly.
    client.delete(f"/api/files/{body['job']}")
    assert_friendly(client.get(f"/api/{result['url']}"), "RESULT_EXPIRED")


def test_resize_returns_notes_in_the_persons_language(client, samples):
    r = client.post(
        "/api/resize",
        files=upload(samples["jpg"]),
        data={"options": json.dumps({"mode": "pixels", "width": 1600, "height": 1200, "max_kb": 3})},
        headers={"Accept-Language": "hi-Latn"},
    )
    assert r.status_code == 200, r.text
    assert "Humne ise" in r.json()["notes"][0]


def test_enhance_preview(client, samples):
    r = client.post("/api/enhance", files=upload(samples["jpg"]), data={"options": json.dumps({"preset": "auto", "preview": True})})
    assert r.json()["files"][0]["name"].endswith("-preview.jpg")


def test_pdf_tool_route_and_plan(client, samples):
    r = client.post("/api/pdf/page-numbers", files=upload(samples["pdf"]), data={"options": "{}"})
    assert r.status_code == 200, r.text
    plan = {"steps": [{"tool": "enhance", "params": {"preset": "document"}}, {"tool": "convert", "params": {"to": "pdf"}}]}
    r = client.post("/api/run", files=upload(samples["jpg"]), data={"plan": json.dumps(plan)})
    assert r.status_code == 200, r.text
    assert r.json()["files"][0]["name"].endswith(".pdf")

    ocr = [{"width": 1200, "height": 900, "lines": [{"text": "Hello scan", "box": [10, 10, 300, 60]}]}]
    r = client.post("/api/pdf/searchable", files=upload(samples["jpg"]), data={"options": json.dumps({"ocr": ocr, "name": "Scan"})})
    assert r.status_code == 200, r.text
    assert r.json()["files"][0]["name"] == "Scan (searchable).pdf"


def test_nw_chat(client):
    r = client.post("/api/nw/chat", json={"message": "isko 100kb se kam karo", "files": [{"name": "a.jpg", "mime": "image/jpeg", "size": 1}]})
    body = r.json()
    assert body["lang"] == "hi-Latn" and body["plan"]["steps"][0]["tool"] == "resize"
    explain = client.get("/api/nw/explain/PASSWORD_REQUIRED", headers={"Accept-Language": "de"}).json()
    assert "Passwort" in explain["reply"]


# ------------------------------------------------------------ friendly failures


def test_unknown_route_is_not_a_404_message(client):
    r = client.get("/api/definitely-not-here", headers={"Accept-Language": "es"})
    error = assert_friendly(r, "NOT_FOUND")
    assert "No encontramos" in error["title"]


def test_wrong_method_is_friendly(client):
    assert_friendly(client.get("/api/convert"), "NOT_FOUND")


def test_missing_files_and_bad_options(client, samples):
    assert_friendly(client.post("/api/convert", data={"target": "pdf"}), "NO_FILES")
    assert_friendly(client.post("/api/convert", files=upload(samples["jpg"]), data={"target": "pdf", "options": "{not json"}), "INVALID_OPTIONS")
    assert_friendly(client.post("/api/run", files=upload(samples["jpg"]), data={"plan": json.dumps({"steps": [{"tool": "rm -rf"}]})}), "INVALID_OPTIONS")


def test_unsupported_and_damaged_files(client, samples):
    assert_friendly(client.post("/api/convert", files=upload(samples["mp4"]), data={"target": "pdf"}), "UNSUPPORTED_FORMAT")
    assert_friendly(client.post("/api/convert", files=upload(samples["empty"]), data={"target": "jpg"}), "EMPTY_FILE")
    assert_friendly(client.post("/api/convert", files=upload(samples["fake_pdf"]), data={"target": "jpg"}), "CORRUPT_FILE")
    assert_friendly(client.post("/api/convert", files=upload(samples["xlsx"]), data={"target": "jpg"}), "UNSUPPORTED_CONVERSION")


def test_too_large_upload(client, samples, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_file_mb", 0)
    error = assert_friendly(client.post("/api/convert", files=upload(samples["jpg"]), data={"target": "png"}), "FILE_TOO_LARGE")
    assert error["action"] == "compress"


def test_crash_is_calm(samples, monkeypatch):
    from fastapi.testclient import TestClient

    import app.pipeline as pipeline
    from app.main import app

    # The test client normally re-raises server errors; a real server answers calmly.
    client = TestClient(app, raise_server_exceptions=False)

    def boom(*args, **kwargs):
        raise ZeroDivisionError("internal detail that must never leak")

    monkeypatch.setattr(pipeline, "run", boom)
    r = client.post("/api/convert", files=upload(samples["jpg"]), data={"target": "png"}, headers={"Accept-Language": "fr"})
    error = assert_friendly(r, "INTERNAL")
    assert "ZeroDivision" not in r.text and "internal detail" not in r.text
    assert "notre côté" in error["title"]


def test_download_cannot_escape_the_job_folder(client):
    escape = client.get("/api/files/" + "a" * 32 + "/..%2F..%2Fsecret.txt")
    assert escape.json()["error"]["code"] in ("RESULT_EXPIRED", "NOT_FOUND")
    assert_friendly(client.get("/api/files/not-a-job/x.pdf"), "RESULT_EXPIRED")
