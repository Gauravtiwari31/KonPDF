"""NW's language-model tier, against a fake OpenAI-compatible server over real HTTP."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from model import NW, RemoteLLM, plan_fits_files


class FakeModel:
    """What the fake server answers next, and what it was asked."""

    def __init__(self) -> None:
        self.status = 200
        self.queue: list[int] = []  # statuses for the next requests, before `status`
        self.content = ""
        self.delay = 0.0
        self.requests: list[dict] = []
        self.headers: list[dict] = []


@pytest.fixture()
def fake():
    state = FakeModel()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            import time

            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state.requests.append(body)
            state.headers.append(dict(self.headers))
            time.sleep(state.delay)
            payload = json.dumps({"choices": [{"message": {"content": state.content}}]}).encode()
            self.send_response(state.queue.pop(0) if state.queue else state.status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    state.url = f"http://127.0.0.1:{server.server_port}/v1"
    yield state
    server.shutdown()


def nw_for(fake, timeout=5.0):
    return NW(RemoteLLM(fake.url, "secret-key", "test-model", timeout=timeout))


IMG = [{"name": "photo.jpg", "mime": "image/jpeg", "size": 2_400_000}]
PDF = [{"name": "doc.pdf", "mime": "application/pdf", "size": 900_000}]


def answer(reply, steps=None, suggestions=None):
    return json.dumps({"reply": reply, "plan": {"steps": steps} if steps is not None else None, "suggestions": suggestions or []})


def test_model_plan_is_used(fake):
    fake.content = answer("Sure, passport size under 50 KB.", [{"tool": "resize", "params": {"mode": "preset", "preset": "passport", "max_kb": 50}}], ["Make it a PDF"])
    reply = nw_for(fake).reply("bhai isko passport wala bana do 50kb", "en", IMG, [{"role": "user", "text": "hi"}])
    assert reply["engine"] == "llm"
    assert reply["reply"] == "Sure, passport size under 50 KB."
    assert reply["plan"]["steps"] == [{"tool": "resize", "params": {"mode": "preset", "preset": "passport", "max_kb": 50}}]
    assert reply["suggestions"] == ["Make it a PDF"]


def test_request_sends_context_but_never_file_contents(fake):
    fake.content = answer("Okay!", [{"tool": "convert", "params": {"to": "pdf"}}])
    nw_for(fake).reply("make it a pdf", "hi-Latn", IMG, [{"role": "user", "text": "hello"}, {"role": "nw", "text": "Hi!"}])
    body, headers = fake.requests[0], fake.headers[0]
    assert headers["Authorization"] == "Bearer secret-key"
    assert body["model"] == "test-model"
    assert body["messages"][0]["role"] == "system" and "hi-Latn" in body["messages"][0]["content"]
    assert [m["role"] for m in body["messages"][1:]] == ["user", "assistant", "user"]
    assert "photo.jpg (image, 2343 KB)" in body["messages"][-1]["content"]


def test_fenced_json_is_understood(fake):
    fake.content = "```json\n" + answer("Done deal.", [{"tool": "convert", "params": {"to": "png"}}]) + "\n```"
    assert nw_for(fake).reply("png please", "en", IMG)["engine"] == "llm"


@pytest.mark.parametrize(
    "steps",
    [
        [{"tool": "resize", "params": {"mode": "compress"}}],  # image tool on a PDF
        [{"tool": "delete_everything", "params": {}}],  # not a KonPDF tool
        [{"tool": "convert", "params": {"to": "mp4"}}],  # not a conversion KonPDF offers
        [{"tool": "merge", "params": {}}],  # merging needs two files
    ],
)
def test_bad_model_plans_fall_back_to_the_core(fake, steps):
    fake.content = answer("Here you go!", steps)
    reply = nw_for(fake).reply("compress this pdf", "en", PDF)
    assert reply["engine"] == "core"
    assert reply["plan"]["steps"][0]["tool"] == "compress_pdf"


@pytest.mark.parametrize("status,content", [(500, "oops"), (429, "rate limited"), (200, "not json at all"), (200, json.dumps({"plan": None}))])
def test_service_problems_fall_back_to_the_core(fake, status, content):
    fake.status, fake.content = status, content
    reply = nw_for(fake).reply("convert to pdf", "en", IMG)
    assert reply["engine"] == "core" and reply["plan"]["steps"] == [{"tool": "convert", "params": {"to": "pdf"}}]


def test_slow_service_falls_back_quickly(fake):
    fake.content, fake.delay = answer("late"), 2.0
    reply = nw_for(fake, timeout=0.5).reply("convert to pdf", "en", IMG)
    assert reply["engine"] == "core"


def test_model_may_ask_instead_of_planning(fake):
    fake.content = answer("Which password should I use?")
    reply = nw_for(fake).reply("lock it", "en", PDF)
    assert reply["engine"] == "llm" and reply["plan"] is None


def test_no_model_configured_means_core():
    nw = NW.from_settings(None, None, None)
    assert nw.engine == "core" and nw.reply("convert to pdf", "en", IMG)["engine"] == "core"


@pytest.mark.parametrize(
    "steps,files,fits",
    [
        ([{"tool": "convert", "params": {"to": "pdf"}}, {"tool": "compress_pdf", "params": {}}], IMG, True),
        ([{"tool": "resize", "params": {"format": "png"}}, {"tool": "convert", "params": {"to": "pdf"}}], IMG, True),
        ([{"tool": "convert", "params": {"to": "jpg"}}, {"tool": "enhance", "params": {}}], PDF, True),
        ([{"tool": "enhance", "params": {}}], PDF, False),
        ([{"tool": "merge", "params": {}}], PDF + PDF, True),
        ([{"tool": "convert", "params": {"to": "xlsx"}}], IMG, False),
        ([{"tool": "page_numbers", "params": {}}], [], True),
    ],
)
def test_plan_fits_files(steps, files, fits):
    assert plan_fits_files(steps, files) is fits



def test_retries_without_json_mode_when_the_model_refuses_it(fake):
    fake.queue = [400]  # the first request is refused, the retry succeeds
    fake.content = answer("Okay!", [{"tool": "convert", "params": {"to": "pdf"}}])
    reply = nw_for(fake).reply("make it a pdf", "en", IMG)
    assert reply["engine"] == "llm"
    assert "response_format" in fake.requests[0] and "response_format" not in fake.requests[1]
