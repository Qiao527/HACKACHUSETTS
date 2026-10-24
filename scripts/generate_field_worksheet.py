"""Generate public/solaralign-field-worksheet.pdf from the shared field schema.

No third-party PDF package is required: this writes a small standards-compliant
PDF with built-in Helvetica fonts. Run after changing data/field_collection_schema.json.
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "data" / "field_collection_schema.json"
OUTPUT_PATH = ROOT / "public" / "solaralign-field-worksheet.pdf"
PAGE_WIDTH, PAGE_HEIGHT = 612, 792
LEFT, RIGHT, TOP, BOTTOM = 48, 48, 48, 44
TEXT_WIDTH = 96


def ascii_text(value: str) -> str:
    return (
        value.replace("—", "-")
        .replace("–", "-")
        .replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
        .encode("ascii", "replace")
        .decode("ascii")
    )


def escape_pdf(value: str) -> str:
    return ascii_text(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text_cmd(x: float, y: float, value: str, size: float = 9, bold: bool = False, green: bool = False) -> str:
    font = "F2" if bold else "F1"
    color = "0.06 0.31 0.23 rg" if green else "0.08 0.20 0.17 rg"
    return f"BT {color} /{font} {size} Tf {x:.1f} {y:.1f} Td ({escape_pdf(value)}) Tj ET"


def rule_cmd(y: float) -> str:
    return f"q 0.67 0.82 0.76 RG 0.6 w {LEFT} {y:.1f} m {PAGE_WIDTH - RIGHT} {y:.1f} l S Q"


def wrapped(value: str, width: int = TEXT_WIDTH) -> list[str]:
    return textwrap.wrap(ascii_text(value), width=width, break_long_words=False, break_on_hyphens=False) or [""]


def build_pages(schema: dict) -> list[str]:
    pages: list[list[str]] = []
    current: list[str] = []
    y = PAGE_HEIGHT - TOP

    def start_page(continuation: bool = False) -> None:
        nonlocal current, y
        if current:
            pages.append(current)
        current = []
        y = PAGE_HEIGHT - TOP
        current.append(text_cmd(LEFT, y, "SOLARALIGN", 10, bold=True, green=True))
        current.append(text_cmd(PAGE_WIDTH - 172, y, "FIELD DATA WORKSHEET", 8, bold=True, green=True))
        y -= 22
        if not continuation:
            current.append(text_cmd(LEFT, y, schema["title"], 19, bold=True, green=True))
            y -= 24
            for line in wrapped(schema["subtitle"], 82):
                current.append(text_cmd(LEFT, y, line, 10))
                y -= 13
            y -= 4
            for line in wrapped(schema["instructions"], 88):
                current.append(text_cmd(LEFT, y, line, 8))
                y -= 11
            y -= 8
            current.append(text_cmd(LEFT, y, "Project / building: ______________________________________________", 9))
            y -= 17
            current.append(text_cmd(LEFT, y, "Address: ________________________________________________________", 9))
            y -= 17
            current.append(text_cmd(LEFT, y, "Collector and date: ______________________________________________", 9))
            y -= 20
            current.append(rule_cmd(y))
            y -= 16
        else:
            current.append(text_cmd(LEFT, y, "Field data worksheet - continued", 13, bold=True, green=True))
            y -= 23

    def ensure(height: float) -> None:
        nonlocal y
        if y - height < BOTTOM + 18:
            start_page(continuation=True)

    def field_height(field: dict) -> int:
        note_lines = wrapped("What to collect: " + field["note"], 91)
        importance_lines = wrapped("Why it matters: " + field["importance"], 91)
        source_lines = wrapped("Suggested source: " + field["source_hint"], 91)
        return 23 + 10 * (len(note_lines) + len(importance_lines) + len(source_lines)) + 34

    start_page()

    for section in schema["sections"]:
        section_lines = wrapped(section["description"], 91)
        # Keep each section heading and description with at least its first field.
        first_field = field_height(section["fields"][0]) if section["fields"] else 0
        ensure(34 + len(section_lines) * 10 + first_field)
        current.append(text_cmd(LEFT, y, section["title"].upper(), 11, bold=True, green=True))
        y -= 14
        for line in section_lines:
            current.append(text_cmd(LEFT, y, line, 7.5))
            y -= 10
        y -= 7

        for field in section["fields"]:
            note_lines = wrapped("What to collect: " + field["note"], 91)
            importance_lines = wrapped("Why it matters: " + field["importance"], 91)
            source_lines = wrapped("Suggested source: " + field["source_hint"], 91)
            needed = field_height(field)
            ensure(needed)
            requirement = "REQUIRED FOR MODEL" if field["required_for_model"] else "PROJECT CONTEXT"
            unit = f" [{field['unit']}]" if field["unit"] else ""
            current.append(text_cmd(LEFT, y, f"{field['label']}{unit}", 9.5, bold=True))
            current.append(text_cmd(PAGE_WIDTH - RIGHT - 118, y, requirement, 6.5, bold=True, green=True))
            y -= 13
            for line in note_lines:
                current.append(text_cmd(LEFT, y, line, 7.5))
                y -= 10
            for line in importance_lines:
                current.append(text_cmd(LEFT, y, line, 7.5))
                y -= 10
            for line in source_lines:
                current.append(text_cmd(LEFT, y, line, 7.5))
                y -= 10
            y -= 3
            current.append(text_cmd(LEFT, y, "Value / observation: _________________________________________________________", 8))
            y -= 14
            current.append(text_cmd(LEFT, y, "Source document, page, or person: ______________________________________________", 7.5))
            y -= 15
            current.append(rule_cmd(y))
            y -= 14

    if current:
        pages.append(current)

    total = len(pages)
    output: list[str] = []
    for index, commands in enumerate(pages, start=1):
        commands.append(text_cmd(LEFT, 24, "SolarAlign - estimates must be labeled; financial results do not establish feasibility or eligibility.", 6.5))
        commands.append(text_cmd(PAGE_WIDTH - 92, 24, f"Page {index} of {total}", 6.5))
        output.append("\n".join(commands))
    return output


def write_pdf(page_streams: list[str]) -> None:
    objects: list[bytes] = []
    page_refs = [5 + index * 2 for index in range(len(page_streams))]
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{ref} 0 R" for ref in page_refs)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_refs)} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

    for index, stream_text in enumerate(page_streams):
        content_ref = 6 + index * 2
        page = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_ref} 0 R >>"
        ).encode()
        stream = stream_text.encode("latin-1", "replace")
        content = f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream"
        objects.extend([page, content])

    # The binary marker includes a NUL so version control treats the generated
    # artifact as binary instead of linting standards-required xref spacing.
    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\x00\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(pdf)


def main() -> None:
    schema = json.loads(SCHEMA_PATH.read_text())
    pages = build_pages(schema)
    write_pdf(pages)
    print(f"Generated {OUTPUT_PATH.relative_to(ROOT)} ({len(pages)} pages, {OUTPUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
