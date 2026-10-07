"""Page ranges as people write them: "1-3, 7", "2,4-6", "all", "last"."""

from __future__ import annotations

import re

from .errors import KonError

_PART = re.compile(r"^(\d+|last)-(\d+|last)$|^(\d+|last)$")


def parse_pages(spec: str | None, total: int, *, allow_repeats: bool = False) -> list[int]:
    """1-based text → 0-based page indexes, in the order written.

    Raises PAGE_RANGE_INVALID for pages outside 1..total or unreadable text.
    """
    text = (spec or "").strip().lower()
    if text in ("", "all", "*"):
        return list(range(total))

    def number(token: str) -> int:
        return total if token.lower() == "last" else int(token)

    result: list[int] = []
    # "1 to 3" / "1 – 3" → "1-3", then split on commas and spaces.
    text = re.sub(r"\s*(?:[-–—]|\bto\b)\s*", "-", text)
    for raw in re.split(r"[,;\s]+", text):
        part = raw.strip()
        if not part:
            continue
        m = _PART.match(part)
        if not m:
            raise KonError("PAGE_RANGE_INVALID", pages=spec, total=total)
        if m.group(3):
            start = end = number(m.group(3))
        else:
            start, end = number(m.group(1)), number(m.group(2))
        if not (1 <= start <= total and 1 <= end <= total):
            raise KonError("PAGE_RANGE_INVALID", pages=spec, total=total)
        step = 1 if end >= start else -1
        for page in range(start, end + step, step):
            if allow_repeats or page - 1 not in result:
                result.append(page - 1)
    if not result:
        raise KonError("PAGE_RANGE_INVALID", pages=spec, total=total)
    return result


def parse_groups(spec: str, total: int) -> list[list[int]]:
    """"1-3, 4-6, 7" → one page list per comma-separated group (for split)."""
    groups = [parse_pages(part, total) for part in re.split(r"[,;]", spec or "") if part.strip()]
    if not groups:
        raise KonError("PAGE_RANGE_INVALID", pages=spec, total=total)
    return groups
