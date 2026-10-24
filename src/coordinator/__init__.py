"""Coordinator: the AI reads EngineResult ONLY and never computes numbers.

It proposes a range inside the engine's mutual-benefit range and writes owner
and tenant explanations. Code checks every number it wrote against the engine
result and rejects anything invented, translated, or re-rounded.
"""
from src.coordinator.coordinate import (
    CoordinatorRejected,
    coordinate,
    numbers_in_text,
    validate_output,
)

__all__ = ["coordinate", "validate_output", "numbers_in_text", "CoordinatorRejected"]
