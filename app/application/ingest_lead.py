"""Use case: ingest a lead, route it through the ping tree, settle the ledger.

Flow:
  1. validate         -> on failure: store rejected + reason, stop
  2. dedup (24h)      -> on duplicate: store rejected + alert, stop
  3. store pending
  4. evaluate buyers  -> persist full audit trail (eligible + discarded)
  5. ping tree        -> try eligible buyers by priority until one accepts
  6. accept (atomic)  -> row-locked debit + ledger + sold, under one transaction
  7. exhausted        -> unsold + alert
"""

from datetime import datetime, timezone
from decimal import Decimal

from app.adapters.db import models
from app.adapters.db.repositories import (
    AlertRepo,
    AttemptRepo,
    BuyerRepo,
    EvaluationRepo,
    LeadRepo,
    LedgerRepo,
)
from app.application.alerts import Alerts
from app.application.validation import validate_lead
from app.config import settings
from app.domain import ledger, routing
from app.domain.enums import AttemptStatus, LeadStatus, Severity, TxType
from app.ids import gen_id
from app.ports.alerts import AlertNotifierPort
from app.ports.buyer_delivery import BuyerDeliveryPort


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _store_lead(leads: LeadRepo, lead_id: str, data, *, status: str, rejection_reason=None):
    lead = models.Lead(
        lead_id=lead_id,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        email=data.email,
        state=data.state,
        vertical=data.vertical,
        source=data.source,
        trusted_form_cert_url=data.trusted_form_cert_url,
        jornaya_lead_id=data.jornaya_lead_id,
        status=status,
        rejection_reason=rejection_reason,
    )
    leads.add(lead)
    return lead


def _result(lead_id, status, *, assigned_buyer_id=None, sold_price=None,
            rejection_reason=None, evaluations=None, attempts=None) -> dict:
    return {
        "lead_id": lead_id,
        "status": status,
        "assigned_buyer_id": assigned_buyer_id,
        "sold_price": sold_price,
        "rejection_reason": rejection_reason,
        "evaluations": evaluations or [],
        "attempts": attempts or [],
    }


def ingest_lead(
    db,
    data,
    delivery: BuyerDeliveryPort,
    notifier: AlertNotifierPort,
    now: datetime | None = None,
) -> dict:
    now = now or _utcnow()
    leads = LeadRepo(db)
    buyers = BuyerRepo(db)
    evals = EvaluationRepo(db)
    attempts = AttemptRepo(db)
    ledger_repo = LedgerRepo(db)
    alerts = Alerts(AlertRepo(db), notifier)

    lead_id = data.lead_id or gen_id("lead")

    # 1. Validation.
    reason = validate_lead(data)
    if reason:
        _store_lead(leads, lead_id, data, status=LeadStatus.REJECTED.value, rejection_reason=reason)
        db.commit()
        return _result(lead_id, LeadStatus.REJECTED.value, rejection_reason=reason)

    # 2. Dedup window.
    if leads.has_recent_duplicate(data.phone, data.email, settings.dedup_window_hours, exclude_id=lead_id):
        _store_lead(leads, lead_id, data, status=LeadStatus.REJECTED.value, rejection_reason="duplicate within 24h")
        alerts.emit(
            severity=Severity.WARNING.value,
            alert_type="duplicate_lead",
            entity_id=lead_id,
            message=f"Lead {lead_id} rejected as duplicate (phone/email seen in last {settings.dedup_window_hours}h).",
            suggested_action="Check the lead source for duplicate submissions.",
        )
        db.commit()
        return _result(lead_id, LeadStatus.REJECTED.value, rejection_reason="duplicate within 24h")

    # 3. Store pending.
    lead = _store_lead(leads, lead_id, data, status=LeadStatus.PENDING.value)
    db.commit()

    # 4. Evaluate every buyer -> full audit trail.
    all_buyers = buyers.all()
    evaluations = routing.evaluate_buyers(lead, all_buyers, now)
    evals.add_many(
        [
            models.RoutingEvaluation(
                lead_id=lead_id,
                buyer_id=e.buyer_id,
                eligible=e.eligible,
                reason_if_not_eligible=e.reason,
                priority=e.priority,
            )
            for e in evaluations
        ]
    )
    db.commit()

    eval_trace = [
        {
            "buyer_id": e.buyer_id,
            "eligible": e.eligible,
            "reason_if_not_eligible": e.reason,
            "priority": e.priority,
        }
        for e in evaluations
    ]
    order = routing.eligible_in_priority_order(evaluations)

    if not order:
        lead.status = LeadStatus.UNSOLD.value
        alerts.emit(
            severity=Severity.WARNING.value,
            alert_type="no_eligible_buyers",
            entity_id=lead_id,
            message=f"Lead {lead_id} ({data.state}/{data.vertical}) had no eligible buyers.",
            suggested_action="Review buyer coverage for this state/vertical.",
        )
        db.commit()
        return _result(lead_id, LeadStatus.UNSOLD.value, evaluations=eval_trace)

    # 5. Ping tree / fallback.
    attempt_trace: list[dict] = []
    for attempt_order, buyer_id in enumerate(order, start=1):
        buyer = buyers.get(buyer_id)
        result = delivery.deliver(lead, buyer)
        charged = False

        if result.accepted:
            # 6. Atomic accept: lock the buyer row, re-check, debit, settle.
            locked = buyers.get_for_update(buyer_id)
            if locked.balance >= locked.price_per_lead and locked.leads_received_today < locked.daily_cap:
                before = Decimal(locked.balance)
                price = Decimal(locked.price_per_lead)
                after = ledger.apply_debit(before, price)
                locked.balance = after
                locked.leads_received_today += 1
                ledger_repo.add(
                    models.LedgerTransaction(
                        transaction_id=gen_id("tx"),
                        buyer_id=buyer_id,
                        lead_id=lead_id,
                        type=TxType.DEBIT.value,
                        amount=price,
                        balance_before=before,
                        balance_after=after,
                        notes=f"Lead {lead_id} sold to {buyer_id}",
                    )
                )
                lead.status = LeadStatus.SOLD.value
                lead.assigned_buyer_id = buyer_id
                lead.sold_price = price
                charged = True

        if result.accepted and not charged:
            final_status = AttemptStatus.REJECTED.value
            final_reason = "insufficient balance or cap at charge time"
        else:
            final_status = result.status
            final_reason = result.rejection_reason

        attempts.add(
            models.DeliveryAttempt(
                attempt_id=gen_id("att"),
                lead_id=lead_id,
                buyer_id=buyer_id,
                attempt_order=attempt_order,
                status=final_status,
                accepted=charged,
                rejection_reason=None if charged else final_reason,
                latency_ms=result.latency_ms,
            )
        )
        attempt_trace.append(
            {
                "buyer_id": buyer_id,
                "attempt_order": attempt_order,
                "status": final_status,
                "accepted": charged,
                "rejection_reason": None if charged else final_reason,
                "latency_ms": result.latency_ms,
            }
        )

        if final_status == AttemptStatus.TIMEOUT.value:
            alerts.emit(
                severity=Severity.WARNING.value,
                alert_type="buyer_timeout",
                entity_id=buyer_id,
                message=f"Buyer {buyer_id} timed out on lead {lead_id} ({result.latency_ms} ms).",
                suggested_action="Check buyer endpoint health or raise the timeout threshold.",
            )

        if charged:
            if locked.balance < locked.price_per_lead:
                alerts.emit(
                    severity=Severity.WARNING.value,
                    alert_type="buyer_low_balance",
                    entity_id=buyer_id,
                    message=f"Buyer {buyer_id} balance {locked.balance} is below its price {locked.price_per_lead}.",
                    suggested_action="Top up the buyer balance to keep receiving leads.",
                )
            if locked.leads_received_today >= locked.daily_cap:
                alerts.emit(
                    severity=Severity.INFO.value,
                    alert_type="buyer_cap_reached",
                    entity_id=buyer_id,
                    message=f"Buyer {buyer_id} reached its daily cap ({locked.daily_cap}).",
                    suggested_action="No more leads will route to this buyer today.",
                )
            db.commit()
            return _result(
                lead_id,
                LeadStatus.SOLD.value,
                assigned_buyer_id=buyer_id,
                sold_price=price,
                evaluations=eval_trace,
                attempts=attempt_trace,
            )

        db.commit()

    # 7. All eligible buyers failed.
    lead.status = LeadStatus.UNSOLD.value
    alerts.emit(
        severity=Severity.WARNING.value,
        alert_type="lead_unsold",
        entity_id=lead_id,
        message=f"Lead {lead_id} went through all eligible buyers without a sale.",
        suggested_action="Review buyer behaviour or add fallback buyers for this segment.",
    )
    db.commit()
    return _result(
        lead_id,
        LeadStatus.UNSOLD.value,
        evaluations=eval_trace,
        attempts=attempt_trace,
    )
