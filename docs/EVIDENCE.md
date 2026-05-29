# Test evidence

Two layers of verification, both reproducible.

## A. Automated test suite — 25 passed

```
$ pytest -q
.........................                                          [100%]
25 passed in 1.43s
```

- `tests/test_routing.py` (11) — the 9 eligibility rules, overnight schedule, priority ordering.
- `tests/test_ledger.py` (4) — debit, exact-balance, overdraw guard, refund.
- `tests/test_integration_api.py` (10) — the 8 required scenarios end-to-end + 2 extras.

## B. Live end-to-end smoke (`bash scripts/smoke.sh`) — real HTTP against the API

Captured output (trimmed to the meaningful fields):

**1. Valid lead SOLD to first buyer** (TX / auto_insurance)
```json
{"status":"sold","assigned_buyer_id":"buyer_a","sold_price":25.0,
 "evaluations":[
   {"buyer_id":"buyer_a","eligible":true,"priority":3},
   {"buyer_id":"buyer_b","eligible":false,"reason_if_not_eligible":"vertical auto_insurance not allowed"},
   {"buyer_id":"buyer_c","eligible":false,"reason_if_not_eligible":"state TX not allowed"},
   {"buyer_id":"buyer_d","eligible":false,"reason_if_not_eligible":"insufficient balance"},
   {"buyer_id":"buyer_e","eligible":false,"reason_if_not_eligible":"state TX not allowed"}],
 "attempts":[{"buyer_id":"buyer_a","attempt_order":1,"status":"accepted","accepted":true,"latency_ms":96}]}
```

**2. Lead SOLD after fallback** (FL / life — ping tree B → C → A)
```json
{"status":"sold","assigned_buyer_id":"buyer_a","sold_price":25.0,
 "attempts":[
   {"buyer_id":"buyer_b","attempt_order":1,"status":"rejected","accepted":false,"rejection_reason":"duplicate","latency_ms":144},
   {"buyer_id":"buyer_c","attempt_order":2,"status":"timeout","accepted":false,"rejection_reason":"timeout","latency_ms":2050},
   {"buyer_id":"buyer_a","attempt_order":3,"status":"accepted","accepted":true,"latency_ms":151}]}
```

**3. Duplicate rejected**
```json
{"status":"rejected","rejection_reason":"duplicate within 24h"}
```

**4. Missing email rejected**
```json
{"status":"rejected","rejection_reason":"invalid or missing email"}
```

**5 & 6. Discards traced** (buyer_d no balance, buyer_e cap full)
```json
"evaluations":[ ...,
  {"buyer_id":"buyer_d","eligible":false,"reason_if_not_eligible":"insufficient balance"},
  {"buyer_id":"buyer_e","eligible":false,"reason_if_not_eligible":"daily cap reached"}]
```

**7. No eligible buyers → unsold** (WA)
```json
{"status":"unsold","attempts":[]}
```

**8. Return with refund**
```json
{"status":"returned","assigned_buyer_id":"buyer_a","refund_amount":25.0,"balance_after":925.0,"buyer_total_returns":1}
```

**Daily summary** (after the run)
```json
{"total_leads_received":7,"rejected_leads":2,"sold_leads":3,"unsold_leads":1,"returned_leads":1,
 "gross_revenue":100.0,"refunds":25.0,"net_revenue":75.0,
 "top_buyer_by_spend":{"buyer_id":"buyer_a","spend":100.0},
 "buyers_low_balance":[{"buyer_id":"buyer_d","balance":5.0}],
 "buyers_cap_reached":[{"buyer_id":"buyer_e","leads_received_today":5,"daily_cap":5}],
 "top_rejection_reasons":[{"reason":"duplicate","count":2},{"reason":"timeout","count":2},
   {"reason":"duplicate within 24h","count":1},{"reason":"invalid or missing email","count":1}],
 "average_routing_latency_ms":644.12}
```

**Alerts generated**: `buyer_timeout` (x2), `duplicate_lead`, `no_eligible_buyers` — each with severity, entity_id, message, suggested_action, created_at.

## C. Concurrency proof — anti double-charge under parallel load

`python scripts/concurrency_test.py http://localhost:8000` (run against the
Dockerized Postgres). buyer_a is funded for exactly 4 leads (balance 100 / price
25); 12 leads are fired **in parallel**.

This test caught a real lost-update bug and proved the fix:

**Before fix** (stale identity-map instance in `get_for_update`):
```
sold: 12 | balance after: 50.0 | gross: 300.0   -> ledger says 300 debited but
                                                    balance only dropped 50 = OVERSELL
```
Root cause: `with_for_update()` locked the row, but `expire_on_commit=False` + the
identity map returned the buyer instance with a **stale balance**, so the locked
re-check read an outdated value. Fix: `.populate_existing()` on the locked query.

**After fix**:
```
sold (responses):      4
sold (report):         4
buyer_a balance after: 0.0
gross revenue:         100.0
[PASS] exactly 4 sold     [PASS] balance is exactly 0 (no oversell)
[PASS] balance never negative     [PASS] gross == sold * price (ledger consistent)
RESULT: PASS — row lock prevented double-charge
```

## How to reproduce

```bash
# Option 1 — Docker (Postgres, full stack)
docker compose up --build
bash scripts/smoke.sh http://localhost:8000

# Option 2 — local (no Docker), SQLite
python -m venv .venv && .venv/Scripts/python -m pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings email-validator httpx
DATABASE_URL="sqlite:///./local.db" .venv/Scripts/python -m uvicorn app.main:app --port 8000
bash scripts/smoke.sh http://localhost:8000

# Tests
.venv/Scripts/python -m pytest -q
```
