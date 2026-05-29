from dataclasses import dataclass


@dataclass
class Eligibility:
    """Result of evaluating one buyer against one lead. The audit trail row."""

    buyer_id: str
    eligible: bool
    reason: str | None
    priority: int
