"""Use case: return a sold lead and refund the buyer.

Anti double-refund: only a lead in status 'sold' can be returned; once returned
its status becomes 'returned', so a second call hits the guard and fails.
"""

from decimal import Decimal

from app.adapters.db import models
from app.adapters.db.repositories import AlertRepo, BuyerRepo, LeadRepo, LedgerRepo
from app.application.alerts import Alerts
from app.application.errors import LeadNotFound, LeadNotReturnable, ReasonRequired
from app.domain import ledger
from app.domain.enums import LeadStatus, Severity, TxType
from app.ids import gen_id
from app.ports.alerts import AlertNotifierPort

HIGH_RETURN_THRESHOLD = 3


def return_lead(db, lead_id: str, reason: str | None, notifier: AlertNotifierPort) -> dict:
    if not reason or not reason.strip():
        raise ReasonRequired("a return reason is required")

    leads = LeadRepo(db)
    buyers = BuyerRepo(db)
    ledger_repo = LedgerRepo(db)
    alerts = Alerts(AlertRepo(db), notifier)

    lead = leads.get(lead_id)
    if not lead:
        raise LeadNotFound(lead_id)
    if lead.status != LeadStatus.SOLD.value:
        raise LeadNotReturnable(
            f"lead {lead_id} is '{lead.status}'; only 'sold' leads can be returned"
        )

    buyer = buyers.get_for_update(lead.assigned_buyer_id)
    before = Decimal(buyer.balance)
    amount = Decimal(lead.sold_price)
    after = ledger.apply_refund(before, amount)
    buyer.balance = after
    if buyer.leads_received_today > 0:
        buyer.leads_received_today -= 1  # free the cap slot

    ledger_repo.add(
        models.LedgerTransaction(
            transaction_id=gen_id("tx"),
            buyer_id=buyer.buyer_id,
            lead_id=lead_id,
            type=TxType.REFUND.value,
            amount=amount,
            balance_before=before,
            balance_after=after,
            notes=f"Return of lead {lead_id}: {reason}",
        )
    )
    lead.status = LeadStatus.RETURNED.value
    lead.return_reason = reason
    db.flush()

    returns_count = (
        db.query(models.Lead)
        .filter(
            models.Lead.assigned_buyer_id == buyer.buyer_id,
            models.Lead.status == LeadStatus.RETURNED.value,
        )
        .count()
    )
    if returns_count >= HIGH_RETURN_THRESHOLD:
        alerts.emit(
            severity=Severity.WARNING.value,
            alert_type="high_returns",
            entity_id=buyer.buyer_id,
            message=f"Buyer {buyer.buyer_id} has {returns_count} returned leads.",
            suggested_action="Investigate lead quality or buyer disputes.",
        )

    db.commit()
    return {
        "lead_id": lead_id,
        "status": LeadStatus.RETURNED.value,
        "assigned_buyer_id": buyer.buyer_id,
        "refund_amount": amount,
        "balance_after": after,
        "return_reason": reason,
        "buyer_total_returns": returns_count,
    }
