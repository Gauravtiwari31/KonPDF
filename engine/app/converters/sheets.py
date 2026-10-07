"""Spreadsheets: XLSX, XLS, ODS, CSV, TSV and JSON in any direction, plus HTML/MD/PDF/DOCX."""

from __future__ import annotations

import csv
import html as htmllib
import io
import json
from pathlib import Path

import pandas as pd

from ..errors import KonError

Tables = dict[str, pd.DataFrame]


def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def read(path: Path, fmt: str, name: str, *, header: bool = True, sheet: str | None = None) -> Tables:
    """Every sheet in the file as {sheet name: DataFrame} (cells as text, nothing reinterpreted)."""
    head = 0 if header else None
    try:
        if fmt in ("xlsx", "xls", "ods"):
            engine = {"xlsx": "openpyxl", "xls": "xlrd", "ods": "odf"}[fmt]
            tables = pd.read_excel(path, sheet_name=None, header=head, engine=engine, dtype=str, keep_default_na=False)
        elif fmt in ("csv", "tsv"):
            text = _read_text(path)
            if fmt == "tsv":
                sep = "\t"
            else:
                try:
                    sep = csv.Sniffer().sniff(text[:20_000], delimiters=",;\t|").delimiter
                except csv.Error:
                    sep = ","
            tables = {Path(name).stem[:31] or "Sheet1": pd.read_csv(io.StringIO(text), sep=sep, header=head, dtype=str, keep_default_na=False)}
        elif fmt == "json":
            data = json.loads(_read_text(path))
            if isinstance(data, dict) and data and all(isinstance(v, list) for v in data.values()):
                if all(isinstance(r, dict) for v in data.values() for r in v):
                    tables = {str(k)[:31]: pd.json_normalize(v) for k, v in data.items()}
                else:
                    tables = {"Sheet1": pd.DataFrame(data)}
            elif isinstance(data, list):
                tables = {"Sheet1": pd.json_normalize(data) if all(isinstance(r, dict) for r in data) else pd.DataFrame({"value": data})}
            elif isinstance(data, dict):
                tables = {"Sheet1": pd.json_normalize(data)}
            else:
                raise ValueError("unsupported JSON shape")
        else:
            raise KonError("UNSUPPORTED_CONVERSION", src=fmt.upper(), dst="sheet")
    except KonError:
        raise
    except Exception as e:  # noqa: BLE001 - parser errors mean a damaged/odd file
        raise KonError("CORRUPT_FILE", name=name) from e
    if sheet and sheet in tables:
        tables = {sheet: tables[sheet]}
    tables = {k: v for k, v in tables.items() if not v.empty or len(tables) == 1}
    return tables


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [("" if str(c).startswith("Unnamed:") else str(c)) for c in df.columns]
    return df.fillna("")


def write_xlsx(tables: Tables, out: Path) -> Path:
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        for sheet, df in tables.items():
            df = _clean(df)
            df.to_excel(writer, sheet_name=(sheet or "Sheet1")[:31], index=False)
            ws = writer.sheets[(sheet or "Sheet1")[:31]]
            for cell in ws[1]:
                cell.font = Font(bold=True)
                cell.fill = PatternFill("solid", fgColor="EEF0F8")
            ws.freeze_panes = "A2"
            for i, column in enumerate(df.columns, start=1):
                longest = max([len(str(column))] + [len(str(v)) for v in df.iloc[:500, i - 1]]) if len(df) else len(str(column))
                ws.column_dimensions[get_column_letter(i)].width = min(60, max(8, longest + 2))
    return out


def write_delimited(df: pd.DataFrame, out: Path, sep: str) -> Path:
    # utf-8-sig so Excel opens non-English text correctly.
    _clean(df).to_csv(out, index=False, sep=sep, encoding="utf-8-sig")
    return out


def to_json(tables: Tables) -> str:
    def records(df: pd.DataFrame):
        return json.loads(_clean(df).to_json(orient="records", force_ascii=False))

    data = records(next(iter(tables.values()))) if len(tables) == 1 else {k: records(v) for k, v in tables.items()}
    return json.dumps(data, ensure_ascii=False, indent=2)


def to_html_body(tables: Tables) -> str:
    parts = []
    for sheet, df in tables.items():
        if len(tables) > 1:
            parts.append(f"<h2>{htmllib.escape(sheet)}</h2>")
        parts.append(_clean(df).to_html(index=False, border=0, escape=True))
    return "\n".join(parts)


def to_markdown(tables: Tables) -> str:
    parts = []
    for sheet, df in tables.items():
        df = _clean(df)
        if len(tables) > 1:
            parts.append(f"## {sheet}")
        cols = [str(c).replace("|", "\\|") for c in df.columns]
        rows = [[str(v).replace("|", "\\|").replace("\n", " ") for v in row] for row in df.itertuples(index=False)]
        parts.append("\n".join(["| " + " | ".join(cols) + " |", "|" + " --- |" * len(cols)] + ["| " + " | ".join(r) + " |" for r in rows]))
    return "\n\n".join(parts) + "\n"


def to_docx(tables: Tables, out: Path) -> Path:
    from docx import Document
    from docx.enum.section import WD_ORIENT

    document = Document()
    widest = max(len(df.columns) for df in tables.values())
    if widest > 6:
        section = document.sections[0]
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width, section.page_height = section.page_height, section.page_width
    for sheet, df in tables.items():
        df = _clean(df)
        if len(tables) > 1:
            document.add_heading(sheet, level=2)
        table = document.add_table(rows=len(df) + 1, cols=max(1, len(df.columns)))
        table.style = "Table Grid"
        for i, column in enumerate(df.columns):
            cell = table.cell(0, i)
            cell.text = str(column)
            for run in cell.paragraphs[0].runs:
                run.bold = True
        for r, row in enumerate(df.itertuples(index=False), start=1):
            for c, value in enumerate(row):
                table.cell(r, c).text = str(value)
    document.save(out)
    return out


def write(tables: Tables, target: str, out_dir: Path, base: str) -> list[Path]:
    """Writes `tables` as `target`. CSV/TSV make one file per sheet."""
    from . import documents

    if not tables:
        raise KonError("NO_TABLES", name=base)
    if target == "xlsx":
        return [write_xlsx(tables, out_dir / f"{base}.xlsx")]
    if target in ("csv", "tsv"):
        sep = "," if target == "csv" else "\t"
        if len(tables) == 1:
            return [write_delimited(next(iter(tables.values())), out_dir / f"{base}.{target}", sep)]
        return [write_delimited(df, out_dir / f"{base} - {sheet}.{target}", sep) for sheet, df in tables.items()]
    if target == "json":
        path = out_dir / f"{base}.json"
        path.write_text(to_json(tables), "utf-8")
        return [path]
    if target == "html":
        path = out_dir / f"{base}.html"
        path.write_text(documents.to_html_document(to_html_body(tables), base), "utf-8")
        return [path]
    if target == "md":
        path = out_dir / f"{base}.md"
        path.write_text(to_markdown(tables), "utf-8")
        return [path]
    if target == "pdf":
        widest = max(len(df.columns) for df in tables.values())
        return [documents.html_to_pdf(to_html_body(tables), out_dir / f"{base}.pdf", landscape=widest > 6)]
    if target == "docx":
        return [to_docx(tables, out_dir / f"{base}.docx")]
    raise KonError("UNSUPPORTED_CONVERSION", src="sheet", dst=target.upper())
