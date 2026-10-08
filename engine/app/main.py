"""KonPDF engine HTTP API (FastAPI). Run: uvicorn app.main:app --port 8000"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any
from urllib.parse import quote

from anyio import to_thread
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from model import NW

from . import __version__, pipeline, storage
from .config import settings
from .convert import identify
from .errors import KonError, Notes, render
from .formats import KINDS, MIME, ext_of, matrix, office_available
from .i18n import from_accept_language, normalize

log = logging.getLogger("konpdf")
nw = NW()
_jobs = asyncio.Semaphore(settings.max_parallel_jobs)


async def _cleanup_loop() -> None:
    while True:
        with contextlib.suppress(Exception):
            await to_thread.run_sync(storage.cleanup)
        await asyncio.sleep(300)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()


app = FastAPI(
    title="KonPDF engine",
    version=__version__,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def lang_of(request: Request) -> str:
    return from_accept_language(request.headers.get("accept-language"))


def error_response(request: Request, code: str, status: int | None = None, **params: Any) -> JSONResponse:
    error = KonError(code, **params)
    return JSONResponse(
        {"ok": False, "error": render(error.code, lang_of(request), **params)},
        status_code=status or error.status,
    )


# ------------------------------------------------------------- error handling


@app.exception_handler(KonError)
async def _kon_error(request: Request, exc: KonError):
    return error_response(request, exc.code, **exc.params)


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    missing_files = any(e.get("loc", [None, None])[-1] == "files" for e in exc.errors())
    return error_response(request, "NO_FILES" if missing_files else "INVALID_OPTIONS")


@app.exception_handler(StarletteHTTPException)
async def _http_error(request: Request, exc: StarletteHTTPException):
    if exc.status_code in (404, 405):
        return error_response(request, "NOT_FOUND", 404)
    if exc.status_code == 413:
        return error_response(request, "FILE_TOO_LARGE", max_mb=settings.max_file_mb, size_mb="?")
    return error_response(request, "INTERNAL", exc.status_code if exc.status_code >= 400 else 500)


@app.exception_handler(Exception)
async def _crash(request: Request, exc: Exception):
    log.exception("Unexpected error on %s", request.url.path)
    return error_response(request, "INTERNAL", 500)


# ---------------------------------------------------------------- rate limits

_hits: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def _rate_limit(request: Request, call_next):
    if request.url.path not in ("/api/health", "/") and settings.rate_limit_per_min > 0:
        ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "?")
        now = time.monotonic()
        window = _hits[ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= settings.rate_limit_per_min:
            return error_response(request, "RATE_LIMITED")
        window.append(now)
    return await call_next(request)


# ---------------------------------------------------------------------- jobs


def _options(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except ValueError:
        raise KonError("INVALID_OPTIONS") from None
    if not isinstance(value, dict):
        raise KonError("INVALID_OPTIONS")
    return value


def _describe(path: Path, job: storage.Job) -> dict[str, Any]:
    return {
        "name": path.name,
        "size": path.stat().st_size,
        "mime": MIME.get(ext_of(path.name), "application/octet-stream"),
        "url": f"files/{job.id}/{quote(path.name)}",
    }


async def _guarded(fn):
    """Runs blocking work in a thread, a few jobs at a time, within the time limit."""
    try:
        await asyncio.wait_for(_jobs.acquire(), timeout=30)
    except asyncio.TimeoutError:
        raise KonError("BUSY") from None
    try:
        return await asyncio.wait_for(to_thread.run_sync(fn), timeout=settings.job_timeout_s)
    except asyncio.TimeoutError:
        raise KonError("TIMEOUT") from None
    finally:
        _jobs.release()


async def run_job(request: Request, files: list[UploadFile], steps: list[dict[str, Any]], zip_results: bool = False):
    job = storage.new_job()
    try:
        paths = await storage.save_uploads(job, files)
        notes = Notes()

        def work():
            return pipeline.run(job, identify(paths), steps, notes, zip_results)

        outputs = await _guarded(work)
        return {
            "ok": True,
            "job": job.id,
            "files": [_describe(p, job) for p in outputs],
            "notes": notes.render(lang_of(request)),
        }
    except BaseException:
        storage.delete_job(job.id)
        raise


# ------------------------------------------------------------------ endpoints


@app.get("/")
async def root():
    return {"ok": True, "name": "KonPDF engine", "docs": "/api/docs"}


@app.get("/api/health")
async def health():
    return {"ok": True, "status": "ok", "version": __version__, "office": office_available(), "nw": nw.engine}


@app.get("/api/formats")
async def formats():
    return {"ok": True, "matrix": matrix(), "kinds": KINDS, "office": office_available()}


@app.post("/api/info")
async def info(files: list[UploadFile] = File(...)):
    job = storage.new_job()
    try:
        paths = await storage.save_uploads(job, files)

        def describe_all():
            import pymupdf
            from PIL import Image

            out = []
            for item in identify(paths):
                entry: dict[str, Any] = {"name": item.name, "kind": item.kind, "format": item.fmt, "size": item.path.stat().st_size}
                with contextlib.suppress(Exception):
                    if item.kind == "image" and item.fmt != "svg":
                        with Image.open(item.path) as img:
                            entry.update(width=img.width, height=img.height, pages=getattr(img, "n_frames", 1))
                    elif item.kind == "pdf":
                        with pymupdf.open(item.path) as doc:
                            entry["encrypted"] = bool(doc.needs_pass)
                            entry["pages"] = doc.page_count
                            if not doc.needs_pass:
                                rect = doc[0].rect
                                entry.update(width=round(rect.width), height=round(rect.height))
                out.append(entry)
            return out

        return {"ok": True, "files": await _guarded(describe_all)}
    finally:
        storage.delete_job(job.id)


@app.post("/api/convert")
async def convert_files(request: Request, files: list[UploadFile] = File(...), target: str = Form(...), options: str = Form("{}")):
    opts = _options(options)
    return await run_job(request, files, [{"tool": "convert", "params": {**opts, "to": target}}], bool(opts.get("zip")))


@app.post("/api/resize")
async def resize_files(request: Request, files: list[UploadFile] = File(...), options: str = Form("{}")):
    return await run_job(request, files, pipeline.validate_plan([{"tool": "resize", "params": _options(options)}]))


@app.post("/api/enhance")
async def enhance_files(request: Request, files: list[UploadFile] = File(...), options: str = Form("{}")):
    return await run_job(request, files, pipeline.validate_plan([{"tool": "enhance", "params": _options(options)}]))


PDF_ROUTES = {"compress": "compress_pdf", "page-numbers": "page_numbers"}


@app.post("/api/pdf/{tool}")
async def pdf_tool(request: Request, tool: str, files: list[UploadFile] = File(...), options: str = Form("{}")):
    name = PDF_ROUTES.get(tool, tool)
    if name not in pipeline.TOOLS or name in ("convert", "resize", "enhance"):
        raise KonError("NOT_FOUND")
    return await run_job(request, files, pipeline.validate_plan([{"tool": name, "params": _options(options)}]))


@app.post("/api/run")
async def run_plan(request: Request, files: list[UploadFile] = File(...), plan: str = Form(...)):
    return await run_job(request, files, pipeline.validate_plan(_options(plan)))


@app.get("/api/files/{job_id}/{name}")
async def download(job_id: str, name: str):
    path = storage.result_file(job_id, name)
    return FileResponse(path, media_type=MIME.get(ext_of(path.name), "application/octet-stream"), filename=path.name)


@app.delete("/api/files/{job_id}")
async def discard(job_id: str):
    storage.delete_job(job_id)
    return {"ok": True}


class FileMeta(BaseModel):
    name: str = Field(max_length=300)
    mime: str = Field(default="", max_length=200)
    size: int = 0


class Turn(BaseModel):
    role: str = Field(max_length=10)
    text: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=2000)
    files: list[FileMeta] = Field(default_factory=list, max_length=50)
    history: list[Turn] = Field(default_factory=list, max_length=20)
    lang: str | None = None


@app.post("/api/nw/chat")
async def nw_chat(request: Request, body: ChatRequest):
    preferred = normalize(body.lang) or lang_of(request)
    reply = await to_thread.run_sync(
        lambda: nw.reply(
            body.message,
            lang_hint=preferred,
            files=[f.model_dump() for f in body.files],
            history=[t.model_dump() for t in body.history],
        )
    )
    return {"ok": True, **reply}


@app.get("/api/nw/explain/{code}")
async def nw_explain(request: Request, code: str):
    return {"ok": True, **nw.explain(code.upper()[:40], lang_of(request))}
