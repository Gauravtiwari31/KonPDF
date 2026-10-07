"""Languages KonPDF speaks, and picking one from a request."""

from __future__ import annotations

SUPPORTED = ("en", "hi", "hi-Latn", "es", "fr", "de", "pt")
DEFAULT = "en"


def normalize(code: str | None) -> str | None:
    """'hi-latn' → 'hi-Latn', 'pt-BR' → 'pt', 'xx' → None."""
    if not code:
        return None
    code = code.strip().replace("_", "-")
    lowered = code.lower()
    if lowered in ("hi-latn", "hinglish", "hi-en"):
        return "hi-Latn"
    base = lowered.split("-")[0]
    return base if base in SUPPORTED else None


def from_accept_language(header: str | None) -> str:
    """Best supported language from an Accept-Language header, by quality."""
    if not header:
        return DEFAULT
    choices: list[tuple[float, int, str]] = []
    for i, part in enumerate(header.split(",")):
        piece, _, q = part.strip().partition(";q=")
        lang = normalize(piece)
        if lang:
            try:
                weight = float(q) if q else 1.0
            except ValueError:
                weight = 0.0
            choices.append((-weight, i, lang))
    return sorted(choices)[0][2] if choices else DEFAULT


def pick(texts: dict[str, str], lang: str) -> str:
    """The text in `lang`, falling back to English."""
    return texts.get(lang) or texts.get(DEFAULT) or next(iter(texts.values()))


class _Safe(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def fill(template: str, **params: object) -> str:
    """str.format that leaves unknown placeholders alone instead of failing."""
    return template.format_map(_Safe(params))
