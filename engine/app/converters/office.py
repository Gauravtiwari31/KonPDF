"""LibreOffice (headless) for Office formats Python can't lay out faithfully."""

from __future__ import annotations

import shutil
import subprocess
import uuid
from pathlib import Path

from ..config import settings
from ..errors import KonError


def available() -> bool:
    return settings.soffice is not None


def convert(src: Path, target: str, outdir: Path, src_label: str) -> Path:
    """Converts `src` to `target` ("pdf", "docx", "xlsx"...) with LibreOffice."""
    if not settings.soffice:
        raise KonError("NEEDS_FULL_CONVERTER", src=src_label)
    outdir.mkdir(parents=True, exist_ok=True)
    # A profile per run lets several conversions happen at once.
    profile = outdir / f".lo-{uuid.uuid4().hex}"
    cmd = [
        settings.soffice,
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--nodefault",
        f"-env:UserInstallation={profile.resolve().as_uri()}",
        "--convert-to",
        target,
        "--outdir",
        str(outdir),
        str(src),
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=settings.job_timeout_s, check=False)
    except subprocess.TimeoutExpired as e:
        raise KonError("TIMEOUT") from e
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    result = outdir / f"{src.stem}.{target.split(':')[0]}"
    if not result.is_file() or result.stat().st_size == 0:
        raise KonError("CORRUPT_FILE", name=src.name)
    return result
