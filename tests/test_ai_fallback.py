from app.adapters.ai.claude_client import ClaudeSummaryClient

METRICS = {
    "total_leads_received": 7,
    "sold_leads": 3,
    "unsold_leads": 1,
    "rejected_leads": 2,
    "returned_leads": 1,
    "gross_revenue": 100.0,
    "refunds": 25.0,
    "net_revenue": 75.0,
    "average_routing_latency_ms": 644.12,
    "top_buyer_by_spend": {"buyer_id": "buyer_a", "spend": 100.0},
    "buyers_low_balance": [{"buyer_id": "buyer_d", "balance": 5.0}],
    "buyers_cap_reached": [{"buyer_id": "buyer_e"}],
    "top_rejection_reasons": [{"reason": "duplicate", "count": 2}],
}


def test_fallback_without_key_is_data_derived():
    out = ClaudeSummaryClient(api_key=None, model="x").summarize(METRICS)
    # Derived from the metrics, not invented.
    assert "43%" in out["summary"]          # round(3/7*100)
    assert "$75.00" in out["summary"]        # net revenue
    assert "buyer_a" in out["summary"]       # top buyer
    assert out["generated_by"].startswith("rule-based")
    assert any("buyer_d" in p for p in out["problems"])   # low balance
    assert any("buyer_e" in p for p in out["problems"])   # cap reached
    assert out["recommended_actions"]


def test_fallback_shape_keys():
    out = ClaudeSummaryClient(api_key=None, model="x").summarize({"total_leads_received": 0})
    assert set(out) == {"summary", "problems", "recommended_actions", "generated_by"}
