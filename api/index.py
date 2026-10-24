"""FastAPI app for SolarAlign. Thin layer: parse request -> call src/ -> return JSON.

Endpoints:
  GET  /api/constants   policy constants + the demo scenario (for the UI to seed)
  POST /api/engine      run the deterministic engine on an EngineInput
  POST /api/extract     PDF bytes -> code-validated InputFields
  POST /api/coordinate  EngineResult -> validated owner/tenant explanations

`src/` never imports from here. This module only adapts HTTP to the pure core.
Deployed as a Vercel Python function; `uvicorn api.index:app` runs it locally.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Optional

# Make `import src...` work both locally and on Vercel.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from fastapi import Body, FastAPI, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from src.contract import (  # noqa: E402
    CoordinatorOutput,
    EngineInput,
    EngineResult,
    InputField,
    Language,
)
from src.coordinator import CoordinatorRejected, coordinate  # noqa: E402
from src.data import build_demo_engine_input  # noqa: E402
from src.engine import run_engine  # noqa: E402
from src.extract import PdfLimitExceeded, extract_fields, read_pdf_pages_isolated  # noqa: E402

app = FastAPI(title="SolarAlign API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev convenience; same-origin in production via Next rewrites
    allow_methods=["*"],
    allow_headers=["*"],
)

_POLICY = _ROOT / "data" / "policy_constants.json"
_MAX_PDF_BYTES = 10 * 1024 * 1024
_MAX_PDF_PAGES = 60
_MAX_EXTRACTED_CHARACTERS = 180_000
_REQUIRED_NUMERIC_FIELDS = (
    "roof_replacement_year",
    "roof_replacement_cost",
    "removal_reinstall_cost",
    "annual_kwh",
    "solar_capex",
    "om_cost_per_year",
    "electricity_value_per_kwh",
)


def _validate_engine_input(payload: EngineInput) -> None:
    """Reject substantively blank or invalid nested values before running math."""
    missing: list[str] = []
    invalid: list[str] = []
    unaccepted: list[str] = []
    for name in _REQUIRED_NUMERIC_FIELDS:
        field = getattr(payload, name)
        value = field.value
        if value is None:
            missing.append(name)
        elif not math.isfinite(value) or value < 0:
            invalid.append(name)
        if field.status not in ("confirmed", "human_supplied") or not field.confirmed_by_user:
            unaccepted.append(name)
    if missing or invalid or unaccepted:
        parts: list[str] = []
        if missing:
            parts.append("missing values: " + ", ".join(missing))
        if invalid:
            parts.append("values must be finite and nonnegative: " + ", ".join(invalid))
        if unaccepted:
            parts.append("review or confirm these values before calculation: " + ", ".join(unaccepted))
        raise HTTPException(status_code=422, detail="; ".join(parts))


@app.get("/api/constants")
def get_constants(tenant_share: float = 0.1, roof_replacement_year: float = 3.0) -> dict:
    """Return policy constants and a ready-to-run demo EngineInput (Harbor Loom Warehouse, fictional)."""
    policy = json.loads(_POLICY.read_text())
    demo = build_demo_engine_input(
        tenant_share=tenant_share, roof_replacement_year=roof_replacement_year
    )
    return {
        "policy_constants": policy,
        "demo_input": demo.model_dump(),
    }


@app.post("/api/engine", response_model=EngineResult)
def post_engine(payload: EngineInput = Body(...)) -> EngineResult:
    """Run the deterministic engine after checking every required numeric input."""
    _validate_engine_input(payload)
    return run_engine(payload)


class SweepPoint(BaseModel):
    tenant_share: float
    owner_npv: float
    tenant_first_full_year_savings: float


class SweepResponse(BaseModel):
    scenario_id: str
    schedule: str
    mutual_benefit_range: Optional[tuple[float, float]] = None
    points: list[SweepPoint]


@app.post("/api/engine/sweep", response_model=SweepResponse)
def post_sweep(
    payload: EngineInput = Body(...),
    schedule: str = "solar_now_remove_later",
    steps: int = 41,
) -> SweepResponse:
    """Owner NPV and tenant first-year savings across tenant share 0..1.

    The chart needs both lines across the whole slider range; computing them is
    the engine's job, never the browser's (ui-rules.md). One run per step.
    """
    steps = max(2, min(steps, 201))
    _validate_engine_input(payload)
    points: list[SweepPoint] = []
    for i in range(steps):
        share = i / (steps - 1)
        res = run_engine(payload.model_copy(update={"tenant_share": share}))
        sched = next((s for s in res.results if s.schedule == schedule), res.results[0])
        points.append(
            SweepPoint(
                tenant_share=round(share, 6),
                owner_npv=sched.owner_npv,
                tenant_first_full_year_savings=sched.tenant_first_full_year_savings,
            )
        )
    full = run_engine(payload)
    return SweepResponse(
        scenario_id=payload.scenario_id,
        schedule=schedule,
        mutual_benefit_range=full.mutual_benefit_range,
        points=points,
    )


class ExtractResponse(BaseModel):
    document_id: str
    page_count: int
    pages: list[str]
    fields: list[InputField]
    structured: bool


@app.post("/api/extract", response_model=ExtractResponse)
async def post_extract(file: UploadFile, structured: bool = False) -> ExtractResponse:
    """Extract selectable PDF text; optionally identify source-backed fields with AI.

    The default path is deterministic pypdf text extraction and sends nothing to
    a third-party LLM. `structured=true` makes one configured LLM call, then code
    validates every returned quote against the extracted page text.
    """
    chunks: list[bytes] = []
    byte_count = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        byte_count += len(chunk)
        if byte_count > _MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail="PDF must be 10 MB or smaller.")
        chunks.append(chunk)
    data = b"".join(chunks)
    filename = file.filename or "upload.pdf"
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid PDF.")

    try:
        pages = read_pdf_pages_isolated(
            data,
            max_pages=_MAX_PDF_PAGES,
            max_characters=_MAX_EXTRACTED_CHARACTERS,
            max_seconds_per_page=3.0,
            total_timeout_seconds=25.0,
        )
    except PdfLimitExceeded as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface a clean 400 to the UI
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}") from exc

    if not any(page.strip() for page in pages):
        raise HTTPException(
            status_code=422,
            detail="No selectable text found. Upload a text-based PDF or enter the information manually.",
        )

    fields: list[InputField] = []
    if structured:
        try:
            fields = extract_fields(
                pages,
                document_id=filename,
                source_type="uploaded_document",
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Structured extraction failed: {exc}") from exc

    return ExtractResponse(
        document_id=filename,
        page_count=len(pages),
        pages=pages,
        fields=fields,
        structured=structured,
    )


class CoordinateRequest(BaseModel):
    result: EngineResult
    language: Optional[Language] = "en"


@app.post("/api/coordinate", response_model=CoordinatorOutput)
def post_coordinate(payload: CoordinateRequest = Body(...)) -> CoordinatorOutput:
    """Ask the coordinator for explanations; rejects any invented or stale output."""
    try:
        return coordinate(payload.result, language=payload.language or "en")
    except CoordinatorRejected as exc:
        raise HTTPException(status_code=422, detail=f"Coordinator output rejected: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Coordinator unavailable: {exc}") from exc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model_version": run_engine(build_demo_engine_input()).model_version}
