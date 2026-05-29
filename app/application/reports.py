from app.adapters.db.repositories import ReportRepo
from app.domain.enums import LeadStatus
from app.ports.ai_summary import AiSummaryPort


def daily_summary(db) -> dict:
    r = ReportRepo(db)
    counts = r.counts_by_status()
    gross = r.gross_revenue()
    refunds = r.refunds()
    return {
        "total_leads_received": sum(counts.values()),
        "rejected_leads": counts.get(LeadStatus.REJECTED.value, 0),
        "sold_leads": counts.get(LeadStatus.SOLD.value, 0),
        "unsold_leads": counts.get(LeadStatus.UNSOLD.value, 0),
        "returned_leads": counts.get(LeadStatus.RETURNED.value, 0),
        "pending_leads": counts.get(LeadStatus.PENDING.value, 0),
        "gross_revenue": gross,
        "refunds": refunds,
        "net_revenue": gross - refunds,
        "top_buyer_by_spend": r.top_buyer_by_spend(),
        "buyers_low_balance": r.low_balance_buyers(),
        "buyers_cap_reached": r.cap_reached_buyers(),
        "top_rejection_reasons": r.top_rejection_reasons(),
        "average_routing_latency_ms": r.average_routing_latency_ms(),
    }


def daily_summary_with_ai(db, ai: AiSummaryPort) -> dict:
    metrics = daily_summary(db)
    metrics["ai_summary"] = ai.summarize(metrics)
    return metrics
