"""Document extraction: PDF -> LLM (once) -> code-validated InputFields.

The LLM only reads words. All trust decisions (citation present? quote really
on that page?) happen in code, in validate.py.
"""
from src.extract.extract import (
    EXTRACTION_FIELDS,
    PdfLimitExceeded,
    extract_fields,
    read_pdf_pages,
    read_pdf_pages_isolated,
)
from src.extract.validate import revalidate, validate_field, validate_fields

__all__ = [
    "read_pdf_pages",
    "read_pdf_pages_isolated",
    "extract_fields",
    "EXTRACTION_FIELDS",
    "PdfLimitExceeded",
    "validate_field",
    "validate_fields",
    "revalidate",
]
