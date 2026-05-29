import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # lifespan: create tables + seed buyers
        yield c


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/dev/reset")  # fresh buyers + cleared transactional data
    yield


def _lead(**over):
    base = dict(
        first_name="Test",
        last_name="User",
        phone="3055551234",
        email="test@example.com",
        state="FL",
        vertical="life_insurance",
        source="web_form",
        trusted_form_cert_url="https://cert.trustedform.com/x",
    )
    base.update(over)
    return base


def _buyer(client, buyer_id):
    return next(b for b in client.get("/buyers").json() if b["buyer_id"] == buyer_id)


# 1
def test_valid_lead_sold_to_first_buyer(client):
    r = client.post("/leads", json=_lead(state="TX", vertical="auto_insurance",
                                         phone="2145550100", email="first@example.com"))
    body = r.json()
    assert body["status"] == "sold"
    assert body["assigned_buyer_id"] == "buyer_a"
    assert len(body["attempts"]) == 1 and body["attempts"][0]["accepted"] is True


# 2
def test_lead_sold_after_first_buyer_rejects(client):
    r = client.post("/leads", json=_lead(phone="3055550200", email="fb@example.com"))
    body = r.json()
    assert body["status"] == "sold"
    assert body["assigned_buyer_id"] == "buyer_a"
    order = [a["buyer_id"] for a in body["attempts"]]
    assert order == ["buyer_b", "buyer_c", "buyer_a"]
    assert body["attempts"][0]["accepted"] is False


# 3
def test_duplicate_lead_rejected(client):
    first = client.post("/leads", json=_lead(state="TX", vertical="auto_insurance",
                                             phone="2145550300", email="dup@example.com"))
    assert first.json()["status"] == "sold"
    dup = client.post("/leads", json=_lead(state="TX", vertical="auto_insurance",
                                           phone="2145550300", email="dup@example.com"))
    body = dup.json()
    assert body["status"] == "rejected"
    assert "duplicate" in body["rejection_reason"]


# 4
def test_lead_without_email_rejected(client):
    r = client.post("/leads", json=_lead(email="", phone="3055550400"))
    body = r.json()
    assert body["status"] == "rejected"
    assert body["rejection_reason"] == "invalid or missing email"


# 5
def test_buyer_without_balance_discarded(client):
    r = client.post("/leads", json=_lead(phone="3055550500", email="bal@example.com"))
    evals = {e["buyer_id"]: e for e in r.json()["evaluations"]}
    assert evals["buyer_d"]["eligible"] is False
    assert evals["buyer_d"]["reason_if_not_eligible"] == "insufficient balance"


# 6
def test_buyer_with_cap_full_discarded(client):
    r = client.post("/leads", json=_lead(phone="3055550600", email="cap@example.com"))
    evals = {e["buyer_id"]: e for e in r.json()["evaluations"]}
    assert evals["buyer_e"]["eligible"] is False
    assert evals["buyer_e"]["reason_if_not_eligible"] == "daily cap reached"


# 7
def test_buyer_timeout_triggers_fallback(client):
    r = client.post("/leads", json=_lead(phone="3055550700", email="to@example.com"))
    body = r.json()
    timeout_attempts = [a for a in body["attempts"] if a["status"] == "timeout"]
    assert timeout_attempts and timeout_attempts[0]["buyer_id"] == "buyer_c"
    assert body["status"] == "sold" and body["assigned_buyer_id"] == "buyer_a"


# 8
def test_sold_lead_returned_with_refund(client):
    balance_before = _buyer(client, "buyer_a")["balance"]
    sale = client.post("/leads", json=_lead(state="TX", vertical="auto_insurance",
                                            phone="2145550800", email="ret@example.com")).json()
    assert sale["status"] == "sold"
    lead_id = sale["lead_id"]

    ret = client.post(f"/leads/{lead_id}/return", json={"reason": "wrong number"})
    body = ret.json()
    assert body["status"] == "returned"
    assert float(body["refund_amount"]) == 25.0
    assert float(_buyer(client, "buyer_a")["balance"]) == float(balance_before)


def test_return_requires_sold_lead(client):
    r = client.post("/leads", json=_lead(email="", phone="3055550900"))  # rejected
    lead_id = r.json()["lead_id"]
    ret = client.post(f"/leads/{lead_id}/return", json={"reason": "x"})
    assert ret.status_code == 409


def test_no_eligible_buyers_marks_unsold(client):
    r = client.post("/leads", json=_lead(state="WA", phone="2065551000", email="wa@example.com"))
    assert r.json()["status"] == "unsold"


def test_idempotency_key_replays_result(client):
    headers = {"Idempotency-Key": "test-key-123"}
    payload = _lead(state="TX", vertical="auto_insurance", phone="2145559999", email="idem@example.com")
    r1 = client.post("/leads", json=payload, headers=headers).json()
    r2 = client.post("/leads", json=payload, headers=headers).json()
    # Replay: same lead_id and status (NOT a duplicate rejection).
    assert r1["lead_id"] == r2["lead_id"]
    assert r1["status"] == r2["status"] == "sold"
    # Only one lead was actually created.
    leads = client.get("/leads").json()
    assert sum(1 for l in leads if l["lead_id"] == r1["lead_id"]) == 1
