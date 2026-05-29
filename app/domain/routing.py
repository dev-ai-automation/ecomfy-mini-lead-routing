"""Pure routing engine. No framework, no DB imports.

`lead` and `buyer` are duck-typed: any object exposing the required attributes
works (ORM rows in production, dataclasses/namespaces in tests). That is what
keeps this module trivially unit-testable.
"""

from datetime import datetime, time

from app.domain.entities import Eligibility
from app.domain.enums import BuyerStatus


def _parse_hhmm(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


def is_within_schedule(now: datetime, start: str, end: str) -> bool:
    current = now.time()
    start_t = _parse_hhmm(start)
    end_t = _parse_hhmm(end)
    if start_t <= end_t:
        return start_t <= current <= end_t
    # Overnight window, e.g. 22:00 -> 06:00.
    return current >= start_t or current <= end_t


def _first_failing_reason(lead, buyer, now: datetime) -> str | None:
    """Apply the routing rules in order; return the first reason that fails."""
    if buyer.status != BuyerStatus.ACTIVE.value:
        return "buyer inactive"
    if not buyer.campaign_active:
        return "campaign inactive"
    if not buyer.ping_tree_assigned:
        return "not assigned to ping tree"
    if lead.state not in buyer.allowed_states:
        return f"state {lead.state} not allowed"
    if lead.vertical not in buyer.allowed_verticals:
        return f"vertical {lead.vertical} not allowed"
    if not is_within_schedule(now, buyer.schedule_start, buyer.schedule_end):
        return "outside schedule window"
    if buyer.leads_received_today >= buyer.daily_cap:
        return "daily cap reached"
    if buyer.balance < buyer.price_per_lead:
        return "insufficient balance"
    return None


def evaluate_eligibility(lead, buyer, now: datetime) -> Eligibility:
    reason = _first_failing_reason(lead, buyer, now)
    return Eligibility(
        buyer_id=buyer.buyer_id,
        eligible=reason is None,
        reason=reason,
        priority=buyer.priority,
    )


def evaluate_buyers(lead, buyers, now: datetime) -> list[Eligibility]:
    """Evaluate every buyer -> full audit trail (eligible and discarded alike)."""
    return [evaluate_eligibility(lead, b, now) for b in buyers]


def eligible_in_priority_order(evaluations: list[Eligibility]) -> list[str]:
    """Buyer ids that passed, ordered by priority (lower number = higher priority)."""
    eligible = [e for e in evaluations if e.eligible]
    eligible.sort(key=lambda e: (e.priority, e.buyer_id))
    return [e.buyer_id for e in eligible]
