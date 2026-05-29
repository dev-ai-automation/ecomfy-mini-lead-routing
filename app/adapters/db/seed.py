"""Seed data: 5 buyers with 5 distinct behaviours + helpers to (re)build state.

Buyer matrix (for a FL + life_insurance lead):
  A  always accepts        priority 3   -> the safety net that finally buys
  B  rejects as duplicate  priority 1   -> first attempt, rejects -> fallback
  C  times out             priority 2   -> second attempt, timeout -> fallback
  D  insufficient balance  priority 1   -> discarded at eligibility (balance < price)
  E  cap reached           priority 1   -> discarded at eligibility (cap full)

Schedules are left wide open (00:00-23:59) on purpose so the live demo never
fails because of the wall clock. The schedule rule is still enforced in code
and covered by unit tests.
"""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.adapters.db import models

BUYERS = [
    dict(
        buyer_id="buyer_a",
        buyer_name="Apex Insurance",
        status="active",
        balance=Decimal("1000.00"),
        daily_cap=50,
        leads_received_today=0,
        allowed_states=["FL", "TX", "CA", "NY", "GA"],
        allowed_verticals=[
            "life_insurance",
            "auto_insurance",
            "health_insurance",
            "final_expense",
        ],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=3,
        price_per_lead=Decimal("25.00"),
        webhook_behavior="accept",
    ),
    dict(
        buyer_id="buyer_b",
        buyer_name="Beacon Leads",
        status="active",
        balance=Decimal("500.00"),
        daily_cap=50,
        leads_received_today=0,
        allowed_states=["FL", "TX"],
        allowed_verticals=["life_insurance", "final_expense"],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=1,
        price_per_lead=Decimal("30.00"),
        webhook_behavior="reject_duplicate",
    ),
    dict(
        buyer_id="buyer_c",
        buyer_name="Catalyst Buyers",
        status="active",
        balance=Decimal("500.00"),
        daily_cap=50,
        leads_received_today=0,
        allowed_states=["FL", "NY"],
        allowed_verticals=["life_insurance", "health_insurance"],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=2,
        price_per_lead=Decimal("28.00"),
        webhook_behavior="timeout",
    ),
    dict(
        buyer_id="buyer_d",
        buyer_name="Delta Acquisitions",
        status="active",
        balance=Decimal("5.00"),  # below price_per_lead -> discarded
        daily_cap=50,
        leads_received_today=0,
        allowed_states=["FL", "TX", "CA"],
        allowed_verticals=["life_insurance", "auto_insurance"],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=1,
        price_per_lead=Decimal("35.00"),
        webhook_behavior="accept",
    ),
    dict(
        buyer_id="buyer_e",
        buyer_name="Echo Media",
        status="active",
        balance=Decimal("1000.00"),
        daily_cap=5,
        leads_received_today=5,  # cap full -> discarded
        allowed_states=["FL"],
        allowed_verticals=["life_insurance"],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=1,
        price_per_lead=Decimal("20.00"),
        webhook_behavior="accept",
    ),
]


def seed_buyers(db: Session) -> None:
    """Insert the 5 buyers if the table is empty (idempotent)."""
    if db.query(models.Buyer).count() > 0:
        return
    for data in BUYERS:
        db.add(models.Buyer(**data))
    db.commit()


def reset_all(db: Session) -> None:
    """Wipe transactional data and re-seed fresh buyers (for repeatable demos)."""
    db.query(models.LedgerTransaction).delete()
    db.query(models.DeliveryAttempt).delete()
    db.query(models.RoutingEvaluation).delete()
    db.query(models.Alert).delete()
    db.query(models.IdempotencyKey).delete()
    db.query(models.Lead).delete()
    db.query(models.Buyer).delete()
    db.commit()
    seed_buyers(db)
