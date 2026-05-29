"""Persistence adapters. Concrete repositories over a SQLAlchemy Session.

DB swap (Postgres -> Supabase) is just a DSN change, so we keep concrete repos
here instead of abstract Protocols. The seams that DO change across deployments
(buyer delivery, AI, alerts) live behind Protocols in app/ports.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.adapters.db import models
from app.domain.enums import LeadStatus, TxType


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BuyerRepo:
    def __init__(self, db: Session):
        self.db = db

    def all(self) -> list[models.Buyer]:
        return self.db.query(models.Buyer).all()

    def get(self, buyer_id: str) -> models.Buyer | None:
        return self.db.get(models.Buyer, buyer_id)

    def get_for_update(self, buyer_id: str) -> models.Buyer | None:
        """Row-locked read used inside the accept transaction (anti double-charge).

        populate_existing() is REQUIRED: without it, SQLAlchemy returns the
        identity-map instance with stale attributes (loaded earlier during
        eligibility), so the locked re-check reads an outdated balance and
        concurrent requests oversell. populate_existing() refreshes the in-memory
        attributes from the freshly locked row.
        """
        return (
            self.db.query(models.Buyer)
            .filter(models.Buyer.buyer_id == buyer_id)
            .populate_existing()
            .with_for_update()
            .one_or_none()
        )


class LeadRepo:
    def __init__(self, db: Session):
        self.db = db

    def get(self, lead_id: str) -> models.Lead | None:
        return self.db.get(models.Lead, lead_id)

    def add(self, lead: models.Lead) -> models.Lead:
        self.db.add(lead)
        return lead

    def has_recent_duplicate(
        self, phone: str, email: str, window_hours: int, exclude_id: str | None = None
    ) -> bool:
        cutoff = _utcnow() - timedelta(hours=window_hours)
        q = self.db.query(models.Lead).filter(
            models.Lead.created_at >= cutoff,
            or_(models.Lead.phone == phone, models.Lead.email == email),
            models.Lead.status != LeadStatus.REJECTED.value,
        )
        if exclude_id:
            q = q.filter(models.Lead.lead_id != exclude_id)
        return self.db.query(q.exists()).scalar()


class EvaluationRepo:
    def __init__(self, db: Session):
        self.db = db

    def add_many(self, rows: list[models.RoutingEvaluation]) -> None:
        self.db.add_all(rows)


class AttemptRepo:
    def __init__(self, db: Session):
        self.db = db

    def add(self, attempt: models.DeliveryAttempt) -> None:
        self.db.add(attempt)


class LedgerRepo:
    def __init__(self, db: Session):
        self.db = db

    def add(self, tx: models.LedgerTransaction) -> None:
        self.db.add(tx)

    def by_lead(self, lead_id: str) -> list[models.LedgerTransaction]:
        return (
            self.db.query(models.LedgerTransaction)
            .filter(models.LedgerTransaction.lead_id == lead_id)
            .all()
        )


class AlertRepo:
    def __init__(self, db: Session):
        self.db = db

    def add(self, alert: models.Alert) -> None:
        self.db.add(alert)

    def recent(self, limit: int = 50) -> list[models.Alert]:
        return (
            self.db.query(models.Alert)
            .order_by(models.Alert.created_at.desc())
            .limit(limit)
            .all()
        )


class ReportRepo:
    """Read-only aggregations for the daily operational summary."""

    def __init__(self, db: Session):
        self.db = db

    def counts_by_status(self) -> dict[str, int]:
        rows = (
            self.db.query(models.Lead.status, func.count(models.Lead.lead_id))
            .group_by(models.Lead.status)
            .all()
        )
        return {status: count for status, count in rows}

    def gross_revenue(self) -> Decimal:
        total = (
            self.db.query(func.coalesce(func.sum(models.LedgerTransaction.amount), 0))
            .filter(models.LedgerTransaction.type == TxType.DEBIT.value)
            .scalar()
        )
        return Decimal(total)

    def refunds(self) -> Decimal:
        total = (
            self.db.query(func.coalesce(func.sum(models.LedgerTransaction.amount), 0))
            .filter(models.LedgerTransaction.type == TxType.REFUND.value)
            .scalar()
        )
        return Decimal(total)

    def top_buyer_by_spend(self) -> dict | None:
        row = (
            self.db.query(
                models.LedgerTransaction.buyer_id,
                func.sum(models.LedgerTransaction.amount).label("spend"),
            )
            .filter(models.LedgerTransaction.type == TxType.DEBIT.value)
            .group_by(models.LedgerTransaction.buyer_id)
            .order_by(func.sum(models.LedgerTransaction.amount).desc())
            .first()
        )
        if not row:
            return None
        return {"buyer_id": row[0], "spend": Decimal(row[1])}

    def low_balance_buyers(self) -> list[dict]:
        """Buyers that can no longer afford another lead at their own price."""
        rows = (
            self.db.query(models.Buyer)
            .filter(models.Buyer.balance < models.Buyer.price_per_lead)
            .all()
        )
        return [{"buyer_id": b.buyer_id, "balance": b.balance} for b in rows]

    def cap_reached_buyers(self) -> list[dict]:
        rows = (
            self.db.query(models.Buyer)
            .filter(models.Buyer.leads_received_today >= models.Buyer.daily_cap)
            .all()
        )
        return [
            {
                "buyer_id": b.buyer_id,
                "leads_received_today": b.leads_received_today,
                "daily_cap": b.daily_cap,
            }
            for b in rows
        ]

    def top_rejection_reasons(self, limit: int = 5) -> list[dict]:
        reasons: dict[str, int] = {}

        lead_rows = (
            self.db.query(
                models.Lead.rejection_reason, func.count(models.Lead.lead_id)
            )
            .filter(models.Lead.status == LeadStatus.REJECTED.value)
            .filter(models.Lead.rejection_reason.isnot(None))
            .group_by(models.Lead.rejection_reason)
            .all()
        )
        for reason, count in lead_rows:
            reasons[reason] = reasons.get(reason, 0) + count

        attempt_rows = (
            self.db.query(
                models.DeliveryAttempt.rejection_reason,
                func.count(models.DeliveryAttempt.attempt_id),
            )
            .filter(models.DeliveryAttempt.rejection_reason.isnot(None))
            .group_by(models.DeliveryAttempt.rejection_reason)
            .all()
        )
        for reason, count in attempt_rows:
            reasons[reason] = reasons.get(reason, 0) + count

        ordered = sorted(reasons.items(), key=lambda kv: kv[1], reverse=True)
        return [{"reason": r, "count": c} for r, c in ordered[:limit]]

    def average_routing_latency_ms(self) -> float:
        avg = self.db.query(func.avg(models.DeliveryAttempt.latency_ms)).scalar()
        return round(float(avg), 2) if avg is not None else 0.0
