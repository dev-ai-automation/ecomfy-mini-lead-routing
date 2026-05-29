from decimal import Decimal
from types import SimpleNamespace


def make_buyer(**overrides):
    base = dict(
        buyer_id="buyer_x",
        status="active",
        balance=Decimal("100.00"),
        daily_cap=10,
        leads_received_today=0,
        allowed_states=["FL"],
        allowed_verticals=["life_insurance"],
        schedule_start="00:00",
        schedule_end="23:59",
        campaign_active=True,
        ping_tree_assigned=True,
        priority=1,
        price_per_lead=Decimal("25.00"),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def make_lead(**overrides):
    base = dict(state="FL", vertical="life_insurance")
    base.update(overrides)
    return SimpleNamespace(**base)
