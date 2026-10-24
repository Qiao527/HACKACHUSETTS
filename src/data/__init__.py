"""Data loading for SolarAlign: PVWatts fixture and the demo property scenario."""
from src.data.load_property import (
    DEMO_PROPERTY,
    build_demo_engine_input,
    load_pvwatts_annual_kwh,
)

__all__ = ["DEMO_PROPERTY", "build_demo_engine_input", "load_pvwatts_annual_kwh"]
