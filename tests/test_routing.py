from datetime import datetime, timezone
from decimal import Decimal

from app.domain import routing
from tests.helpers import make_buyer, make_lead

NOON = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def test_eligible_when_all_rules_pass():
    e = routing.evaluate_eligibility(make_lead(), make_buyer(), NOON)
    assert e.eligible is True
    assert e.reason is None


def test_inactive_buyer_discarded():
    e = routing.evaluate_eligibility(make_lead(), make_buyer(status="inactive"), NOON)
    assert e.eligible is False
    assert e.reason == "buyer inactive"


def test_campaign_inactive_discarded():
    e = routing.evaluate_eligibility(
        make_lead(), make_buyer(campaign_active=False), NOON
    )
    assert e.reason == "campaign inactive"


def test_ping_tree_not_assigned_discarded():
    e = routing.evaluate_eligibility(
        make_lead(), make_buyer(ping_tree_assigned=False), NOON
    )
    assert e.reason == "not assigned to ping tree"


def test_state_not_allowed_discarded():
    e = routing.evaluate_eligibility(make_lead(state="WA"), make_buyer(), NOON)
    assert e.reason == "state WA not allowed"


def test_vertical_not_allowed_discarded():
    e = routing.evaluate_eligibility(
        make_lead(vertical="auto_insurance"), make_buyer(), NOON
    )
    assert e.reason == "vertical auto_insurance not allowed"


def test_cap_reached_discarded():
    e = routing.evaluate_eligibility(
        make_lead(), make_buyer(daily_cap=5, leads_received_today=5), NOON
    )
    assert e.reason == "daily cap reached"


def test_insufficient_balance_discarded():
    e = routing.evaluate_eligibility(
        make_lead(),
        make_buyer(balance=Decimal("5.00"), price_per_lead=Decimal("35.00")),
        NOON,
    )
    assert e.reason == "insufficient balance"


def test_outside_schedule_discarded():
    night = datetime(2026, 1, 1, 20, 0, tzinfo=timezone.utc)
    e = routing.evaluate_eligibility(
        make_lead(), make_buyer(schedule_start="09:00", schedule_end="17:00"), night
    )
    assert e.reason == "outside schedule window"


def test_overnight_schedule_is_active():
    late = datetime(2026, 1, 1, 23, 0, tzinfo=timezone.utc)
    assert routing.is_within_schedule(late, "22:00", "06:00") is True


def test_priority_ordering_of_eligible_buyers():
    lead = make_lead()
    buyers = [
        make_buyer(buyer_id="buyer_a", priority=3),
        make_buyer(buyer_id="buyer_b", priority=1),
        make_buyer(buyer_id="buyer_c", priority=2),
        make_buyer(buyer_id="buyer_x", status="inactive", priority=1),
    ]
    evaluations = routing.evaluate_buyers(lead, buyers, NOON)
    order = routing.eligible_in_priority_order(evaluations)
    assert order == ["buyer_b", "buyer_c", "buyer_a"]
