from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Buyer(Base):
    __tablename__ = "buyers"

    buyer_id = Column(String, primary_key=True)
    buyer_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")
    balance = Column(Numeric(12, 2), nullable=False, default=0)
    daily_cap = Column(Integer, nullable=False, default=0)
    leads_received_today = Column(Integer, nullable=False, default=0)
    allowed_states = Column(JSON, nullable=False, default=list)
    allowed_verticals = Column(JSON, nullable=False, default=list)
    schedule_start = Column(String, nullable=False, default="00:00")
    schedule_end = Column(String, nullable=False, default="23:59")
    campaign_active = Column(Boolean, nullable=False, default=True)
    ping_tree_assigned = Column(Boolean, nullable=False, default=True)
    priority = Column(Integer, nullable=False, default=100)
    price_per_lead = Column(Numeric(12, 2), nullable=False, default=0)
    webhook_behavior = Column(String, nullable=False, default="accept")


class Lead(Base):
    __tablename__ = "leads"

    lead_id = Column(String, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    phone = Column(String, index=True)
    email = Column(String, index=True)
    state = Column(String)
    vertical = Column(String)
    source = Column(String)
    trusted_form_cert_url = Column(String, nullable=True)
    jornaya_lead_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending_distribution")
    rejection_reason = Column(String, nullable=True)
    assigned_buyer_id = Column(String, ForeignKey("buyers.buyer_id"), nullable=True)
    sold_price = Column(Numeric(12, 2), nullable=True)
    return_reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )


class RoutingEvaluation(Base):
    """Audit trail: why each buyer was eligible or discarded for a given lead."""

    __tablename__ = "routing_evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(String, ForeignKey("leads.lead_id"), nullable=False, index=True)
    buyer_id = Column(String, ForeignKey("buyers.buyer_id"), nullable=False)
    eligible = Column(Boolean, nullable=False)
    reason_if_not_eligible = Column(String, nullable=True)
    priority = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class DeliveryAttempt(Base):
    __tablename__ = "delivery_attempts"

    attempt_id = Column(String, primary_key=True)
    lead_id = Column(String, ForeignKey("leads.lead_id"), nullable=False, index=True)
    buyer_id = Column(String, ForeignKey("buyers.buyer_id"), nullable=False)
    attempt_order = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    accepted = Column(Boolean, nullable=False, default=False)
    rejection_reason = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    transaction_id = Column(String, primary_key=True)
    buyer_id = Column(String, ForeignKey("buyers.buyer_id"), nullable=False, index=True)
    lead_id = Column(String, ForeignKey("leads.lead_id"), nullable=False)
    type = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    balance_before = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    notes = Column(Text, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    severity = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    suggested_action = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class IdempotencyKey(Base):
    """Stores the response for a client-supplied Idempotency-Key so retries
    replay the original result instead of reprocessing the lead."""

    __tablename__ = "idempotency_keys"

    key = Column(String, primary_key=True)
    lead_id = Column(String, nullable=True)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
