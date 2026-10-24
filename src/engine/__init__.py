"""Deterministic finance engine for SolarAlign.

The LLM never touches anything in this package. Only code computes money.
"""
from src.engine.compute import MODEL_VERSION, run_engine

__all__ = ["run_engine", "MODEL_VERSION"]
