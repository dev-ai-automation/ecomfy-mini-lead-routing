import json
import pathlib

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.adapters.ai.claude_client import ClaudeSummaryClient
from app.adapters.alerts.notifier import AlertNotifier
from app.adapters.buyers.simulated_client import SimulatedBuyerClient
from app.adapters.db import models
from app.adapters.db.repositories import AlertRepo
from app.adapters.db.seed import reset_all
from app.application import reports
from app.application.errors import LeadNotFound, LeadNotReturnable, ReasonRequired
from app.application.ingest_lead import ingest_lead
from app.application.return_lead import return_lead
from app.config import settings
from app.db import get_db
from app.schemas import BuyerPatch, LeadIn, ReturnIn
from app.serializers import to_dict, to_list

router = APIRouter()

_SEED_LEADS = pathlib.Path(__file__).resolve().parents[2] / "seed" / "leads.json"


def _delivery():
    return SimulatedBuyerClient()


def _notifier():
    return AlertNotifier(settings.slack_webhook_url)


def _ai():
    return ClaudeSummaryClient(settings.anthropic_api_key, settings.anthropic_model)


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/leads")
def post_lead(
    payload: LeadIn,
    idempotency_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Ingest, validate and route a lead. Returns the full decision trace.

    If an `Idempotency-Key` header is supplied, a retry with the same key
    replays the original response instead of reprocessing the lead.
    """
    if idempotency_key:
        seen = db.get(models.IdempotencyKey, idempotency_key)
        if seen:
            return json.loads(seen.response_json)

    result = ingest_lead(db, payload, _delivery(), _notifier())

    if idempotency_key:
        db.add(
            models.IdempotencyKey(
                key=idempotency_key,
                lead_id=result.get("lead_id"),
                response_json=json.dumps(jsonable_encoder(result)),
            )
        )
        db.commit()
    return result


@router.post("/leads/{lead_id}/return")
def post_return(lead_id: str, payload: ReturnIn, db: Session = Depends(get_db)):
    try:
        return return_lead(db, lead_id, payload.reason, _notifier())
    except ReasonRequired as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except LeadNotFound:
        raise HTTPException(status_code=404, detail=f"lead {lead_id} not found")
    except LeadNotReturnable as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/reports/daily-summary")
def daily_summary(ai: bool = Query(False), db: Session = Depends(get_db)):
    if ai:
        return reports.daily_summary_with_ai(db, _ai())
    return reports.daily_summary(db)


@router.get("/buyers")
def list_buyers(db: Session = Depends(get_db)):
    return to_list(db.query(models.Buyer).order_by(models.Buyer.priority).all())


@router.get("/leads")
def list_leads(limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Lead)
        .order_by(models.Lead.created_at.desc())
        .limit(limit)
        .all()
    )
    return to_list(rows)


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = db.get(models.Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    evaluations = (
        db.query(models.RoutingEvaluation)
        .filter(models.RoutingEvaluation.lead_id == lead_id)
        .all()
    )
    attempts = (
        db.query(models.DeliveryAttempt)
        .filter(models.DeliveryAttempt.lead_id == lead_id)
        .order_by(models.DeliveryAttempt.attempt_order)
        .all()
    )
    ledger_rows = (
        db.query(models.LedgerTransaction)
        .filter(models.LedgerTransaction.lead_id == lead_id)
        .all()
    )
    return {
        "lead": to_dict(lead),
        "evaluations": to_list(evaluations),
        "attempts": to_list(attempts),
        "ledger": to_list(ledger_rows),
    }


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db)):
    return to_list(AlertRepo(db).recent())


@router.get("/ledger")
def list_ledger(limit: int = 200, db: Session = Depends(get_db)):
    rows = (
        db.query(models.LedgerTransaction)
        .order_by(models.LedgerTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return to_list(rows)


@router.post("/dev/reset")
def dev_reset(db: Session = Depends(get_db)):
    reset_all(db)
    return {"status": "reset", "buyers_seeded": db.query(models.Buyer).count()}


@router.post("/dev/buyer/{buyer_id}")
def dev_patch_buyer(buyer_id: str, patch: BuyerPatch, db: Session = Depends(get_db)):
    from decimal import Decimal

    buyer = db.get(models.Buyer, buyer_id)
    if not buyer:
        raise HTTPException(status_code=404, detail="buyer not found")
    if patch.balance is not None:
        buyer.balance = Decimal(str(patch.balance))
    if patch.daily_cap is not None:
        buyer.daily_cap = patch.daily_cap
    if patch.leads_received_today is not None:
        buyer.leads_received_today = patch.leads_received_today
    db.commit()
    return to_dict(buyer)


@router.post("/dev/seed-leads")
def dev_seed_leads(db: Session = Depends(get_db)):
    raw_leads = json.loads(_SEED_LEADS.read_text(encoding="utf-8"))
    results = []
    for raw in raw_leads:
        clean = {k: v for k, v in raw.items() if not k.startswith("_")}
        results.append(ingest_lead(db, LeadIn(**clean), _delivery(), _notifier()))
    return {"ingested": len(results), "results": results}
