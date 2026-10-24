"""API-layer tests: the thin FastAPI wrapper over src/.

No real LLM or live API. The extract endpoint is exercised with a tiny
generated text PDF so pypdf has selectable text to read, and extraction uses
the default (unconfigured) LLM path only indirectly -- here we test the
read + validate path by checking the no-text guard and the engine/constants
happy paths.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.index import app

client = TestClient(app)


def test_constants_returns_policy_and_demo():
    r = client.get("/api/constants")
    assert r.status_code == 200
    body = r.json()
    assert "policy_constants" in body and "demo_input" in body
    assert body["demo_input"]["scenario_id"] == "harbor-loom-canonical"


def test_demo_defaults_reproduce_reference_case():
    # The demo seed is the reference model's "comparison_10pct" case.
    demo = client.get("/api/constants").json()["demo_input"]
    res = client.post("/api/engine", json=demo).json()
    by_schedule = {r["schedule"]: r for r in res["results"]}
    assert by_schedule["solar_now_remove_later"]["owner_npv"] == 56280.97
    assert by_schedule["roof_and_solar_now"]["owner_npv"] == 66273.83
    assert by_schedule["roof_then_solar"]["owner_npv"] == 77567.96
    assert by_schedule["solar_now_remove_later"]["tenant_first_full_year_savings"] == 5925.11


def test_engine_runs_on_demo_input():
    demo = client.get("/api/constants").json()["demo_input"]
    r = client.post("/api/engine", json=demo)
    assert r.status_code == 200
    res = r.json()
    assert {s["schedule"] for s in res["results"]} == {
        "solar_now_remove_later",
        "roof_and_solar_now",
        "roof_then_solar",
    }
    assert res["model_version"]


def test_engine_slider_changes_do_not_change_kwh():
    demo = client.get("/api/constants").json()["demo_input"]
    demo_a = {**demo, "tenant_share": 0.1}
    demo_b = {**demo, "tenant_share": 0.9}
    ra = client.post("/api/engine", json=demo_a).json()
    rb = client.post("/api/engine", json=demo_b).json()
    for sa, sb in zip(ra["results"], rb["results"]):
        for ya, yb in zip(sa["years"], sb["years"]):
            assert abs(ya["kwh"] - yb["kwh"]) < 1e-9


def test_extract_rejects_pdf_with_no_text():
    # Minimal valid PDF with no extractable text content.
    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n"
        b"trailer<</Root 1 0 R/Size 4>>\n%%EOF\n"
    )
    r = client.post("/api/extract", files={"file": ("blank.pdf", pdf, "application/pdf")})
    # Either a clean 422 (no text) or 400 (unreadable) is acceptable; never a 500.
    assert r.status_code in (400, 422)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
