"""Runs one or more steps over files: single tools and NW's multi-step plans.

Every plan, whoever wrote it, is checked against this whitelist of tools and
parameters before anything runs, so NW (or a tampered request) can only ever
call KonPDF's own tools with sane values.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Callable

from .convert import Input, convert, identify, maybe_zip
from .errors import KonError, Notes
from .storage import Job, unique
from .tools import enhance as enhance_tool
from .tools import pdf_tools
from .tools import resize as resize_tool

# tool name → (parameters it accepts, runner(inputs, params, out_dir, work, notes))
Runner = Callable[[list[Input], dict[str, Any], Path, Path, Notes], list[Path]]


def _convert(inputs, params, out_dir, work, notes):
    return convert(inputs, str(params.get("to") or params.get("target") or ""), params, out_dir, work, notes)


def _pdf(tool: str) -> Runner:
    return lambda inputs, params, out_dir, work, notes: pdf_tools.TOOLS[tool](inputs, params, out_dir, work, notes)


TOOLS: dict[str, tuple[set[str], Runner]] = {
    "convert": (
        {"to", "target", "quality", "page_size", "orientation", "margin", "combine", "dpi", "pages", "password", "background", "header", "sheet", "zip"},
        _convert,
    ),
    "resize": (
        {"mode", "preset", "width", "height", "fit", "focus", "percent", "longest", "upscale", "print", "dpi", "max_kb", "min_kb", "format", "quality", "strip_metadata", "background", "rotate", "flip", "crop"},
        resize_tool.resize,
    ),
    "enhance": ({"preset", "filter", "adjust", "format", "quality", "preview"}, enhance_tool.enhance),
    "compress_pdf": ({"level", "target_kb", "password"}, _pdf("compress")),
    "merge": ({"password"}, _pdf("merge")),
    "split": ({"mode", "every", "ranges", "password"}, _pdf("split")),
    "extract": ({"pages", "password"}, _pdf("extract")),
    "delete": ({"pages", "password"}, _pdf("delete")),
    "reorder": ({"order", "password"}, _pdf("reorder")),
    "rotate": ({"angle", "pages", "password"}, _pdf("rotate")),
    "protect": ({"password", "old_password", "new_password"}, _pdf("protect")),
    "unlock": ({"password"}, _pdf("unlock")),
    "watermark": ({"text", "style", "opacity", "password"}, _pdf("watermark")),
    "page_numbers": ({"position", "style", "password"}, _pdf("page-numbers")),
}

MAX_STEPS = 6


def validate_plan(plan: Any) -> list[dict[str, Any]]:
    """Returns clean steps, or raises INVALID_OPTIONS. Unknown keys are dropped."""
    steps = plan.get("steps") if isinstance(plan, dict) else plan
    if not isinstance(steps, list) or not steps or len(steps) > MAX_STEPS:
        raise KonError("INVALID_OPTIONS")
    clean = []
    for step in steps:
        if not isinstance(step, dict) or step.get("tool") not in TOOLS:
            raise KonError("INVALID_OPTIONS")
        allowed, _ = TOOLS[step["tool"]]
        params = step.get("params") or {}
        if not isinstance(params, dict):
            raise KonError("INVALID_OPTIONS")
        clean.append({"tool": step["tool"], "params": {k: v for k, v in params.items() if k in allowed}})
    return clean


def run(job: Job, inputs: list[Input], steps: list[dict[str, Any]], notes: Notes, zip_results: bool = False) -> list[Path]:
    """Runs the steps in order; each step's results are the next step's inputs."""
    current = inputs
    outputs: list[Path] = []
    for index, step in enumerate(steps):
        _, runner = TOOLS[step["tool"]]
        work = job.work_dir(index)
        out_dir = work / "out"
        outputs = runner(current, dict(step["params"]), out_dir, work, notes)
        if not outputs:
            raise KonError("INTERNAL")
        if index < len(steps) - 1:
            current = identify(outputs)
    outputs = maybe_zip(outputs, {"zip": zip_results}, job.work_dir(len(steps)))
    final = []
    for path in outputs:
        target = unique(job.outbox / path.name)
        shutil.move(str(path), target)
        final.append(target)
    for index in range(len(steps) + 1):
        shutil.rmtree(job.root / f"step{index}", ignore_errors=True)
    return final
