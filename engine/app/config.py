"""Settings, read once from environment variables (see detail.md, "Limits")."""

from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _find_soffice() -> str | None:
    explicit = os.environ.get("KON_SOFFICE")
    if explicit:
        return explicit if Path(explicit).exists() else None
    for candidate in (
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return None


@dataclass
class Settings:
    max_file_mb: int = field(default_factory=lambda: _int("KON_MAX_FILE_MB", 50))
    max_files: int = field(default_factory=lambda: _int("KON_MAX_FILES", 20))
    max_megapixels: int = field(default_factory=lambda: _int("KON_MAX_PIXELS", 80))
    job_ttl_min: int = field(default_factory=lambda: _int("KON_JOB_TTL_MIN", 30))
    job_timeout_s: int = field(default_factory=lambda: _int("KON_JOB_TIMEOUT_S", 120))
    # Jobs that may run at once; more wait (then get a friendly "busy").
    max_parallel_jobs: int = field(default_factory=lambda: _int("KON_MAX_PARALLEL", 2))
    rate_limit_per_min: int = field(default_factory=lambda: _int("KON_RATE_LIMIT", 120))
    data_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("KON_DATA_DIR") or Path(tempfile.gettempdir()) / "konpdf"
        )
    )
    soffice: str | None = field(default_factory=_find_soffice)

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024


settings = Settings()
