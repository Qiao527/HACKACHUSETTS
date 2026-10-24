"""Yearly electricity-value split: owner / tenant / unallocated, in integer cents.

Financial rule 2 (conservation, every year, to the cent):
    unallocated = round_half_up(unallocated_share * total)
    tenant      = round_half_up(tenant_share * (total - unallocated))
    owner       = total - unallocated - tenant
so owner + tenant + unallocated == total exactly. Owner receives the residual,
which is why rounding can never break conservation.
"""
from __future__ import annotations

from src.engine.schedules import round_half_up


def split_cents(total_cents: int, tenant_share: float, unallocated_share: float) -> tuple[int, int, int]:
    """Return (owner_cents, tenant_cents, unallocated_cents) summing to total_cents."""
    unalloc = min(max(round_half_up(total_cents * unallocated_share), 0), max(total_cents, 0))
    allocatable = total_cents - unalloc
    tenant = min(max(round_half_up(allocatable * tenant_share), 0), max(allocatable, 0))
    owner = total_cents - unalloc - tenant
    return owner, tenant, unalloc


def split_year_value(total_value: float, tenant_share: float, unallocated_share: float) -> tuple[float, float, float]:
    """Dollar-denominated convenience wrapper: (owner, tenant, unallocated) in dollars."""
    o, t, u = split_cents(round_half_up(total_value * 100), tenant_share, unallocated_share)
    return o / 100.0, t / 100.0, u / 100.0
