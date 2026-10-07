"""Per-job folders for uploads and results, deleted after `job_ttl_min`.

    <data_dir>/<job id>/in/<file>     what was uploaded
    <data_dir>/<job id>/out/<file>    what the person downloads

Job ids are random (uuid4 hex), so one person can't guess another's results.
"""

from __future__ import annotations

import re
import shutil
import time
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from .config import settings
from .errors import KonError

_JOB_ID = re.compile(r"^[0-9a-f]{32}$")
_CHUNK = 1024 * 1024


def safe_name(name: str, fallback: str = "file") -> str:
    """A file name that is safe on every OS and can't escape its folder."""
    name = unicodedata.normalize("NFC", Path(name or "").name)
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name).strip(" .")
    if not name:
        return fallback
    stem, dot, ext = name.rpartition(".")
    if dot and len(name) > 120:
        name = stem[: 120 - len(ext) - 1] + "." + ext
    return name[:120]


def unique(path: Path) -> Path:
    """`photo.jpg` → `photo (2).jpg` if taken."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    for i in range(2, 10_000):
        candidate = path.with_name(f"{stem} ({i}){suffix}")
        if not candidate.exists():
            return candidate
    raise KonError("INTERNAL")


@dataclass
class Job:
    id: str
    root: Path

    @property
    def inbox(self) -> Path:
        return self.root / "in"

    @property
    def outbox(self) -> Path:
        return self.root / "out"

    def work_dir(self, step: int) -> Path:
        """Scratch folder for one step of a plan."""
        path = self.root / f"step{step}"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def out_path(self, name: str) -> Path:
        return unique(self.outbox / safe_name(name))


def new_job() -> Job:
    cleanup()
    job_id = uuid.uuid4().hex
    job = Job(job_id, settings.data_dir / job_id)
    job.inbox.mkdir(parents=True)
    job.outbox.mkdir(parents=True)
    return job


def get_job(job_id: str) -> Job:
    if not _JOB_ID.match(job_id or ""):
        raise KonError("RESULT_EXPIRED")
    root = settings.data_dir / job_id
    if not root.is_dir():
        raise KonError("RESULT_EXPIRED")
    return Job(job_id, root)


def result_file(job_id: str, name: str) -> Path:
    job = get_job(job_id)
    path = job.outbox / safe_name(name)
    # safe_name already strips folders; this guards against anything else.
    if path.parent.resolve() != job.outbox.resolve() or not path.is_file():
        raise KonError("RESULT_EXPIRED")
    return path


def delete_job(job_id: str) -> None:
    if _JOB_ID.match(job_id or ""):
        shutil.rmtree(settings.data_dir / job_id, ignore_errors=True)


async def save_uploads(job: Job, uploads: list[UploadFile]) -> list[Path]:
    """Streams uploads to disk, enforcing the count and per-file size limits."""
    uploads = [u for u in uploads if u is not None and (u.filename or u.size)]
    if not uploads:
        raise KonError("NO_FILES")
    if len(uploads) > settings.max_files:
        raise KonError("TOO_MANY_FILES", max=settings.max_files)
    paths: list[Path] = []
    for upload in uploads:
        name = safe_name(upload.filename or "file")
        path = unique(job.inbox / name)
        size = 0
        with path.open("wb") as out:
            while chunk := await upload.read(_CHUNK):
                size += len(chunk)
                if size > settings.max_file_bytes:
                    out.close()
                    raise KonError(
                        "FILE_TOO_LARGE",
                        max_mb=settings.max_file_mb,
                        size_mb=f"{max(size, upload.size or 0) / 1024 / 1024:.0f}+",
                    )
                out.write(chunk)
        if size == 0:
            raise KonError("EMPTY_FILE", name=name)
        paths.append(path)
    return paths


def cleanup(now: float | None = None) -> int:
    """Deletes jobs older than the TTL. Returns how many were removed."""
    root = settings.data_dir
    if not root.is_dir():
        root.mkdir(parents=True, exist_ok=True)
        return 0
    cutoff = (now or time.time()) - settings.job_ttl_min * 60
    removed = 0
    for job_dir in root.iterdir():
        try:
            if job_dir.is_dir() and _JOB_ID.match(job_dir.name) and job_dir.stat().st_mtime < cutoff:
                shutil.rmtree(job_dir, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
