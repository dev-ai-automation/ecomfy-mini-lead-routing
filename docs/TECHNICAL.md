# Technical document — Mini Lead Routing Engine

## 1. Architecture (hexagonal / ports & adapters)

```
HTTP edge (FastAPI)  ─┐
Next.js dashboard    ─┤→  application (use cases)  →  domain (pure rules)
                      │         │
                      │         └→ ports (interfaces)
                      └──────────────┘
                                 ↑ implemented by ↑
        adapters: db (SQLAlchemy) · buyers (simulated) · ai (Claude) · alerts (Slack)
```

- **domain/** — pure Python, zero framework imports: `routing.py` (eligibility +
  priority) and `ledger.py` (money math). This is where the value lives, so it is
  100% unit-tested without a database.
- **application/** — use cases that orchestrate domain + ports + repositories
  (`ingest_lead`, `return_lead`, `daily_summary`, `alerts`).
- **ports/** — interfaces (`BuyerDeliveryPort`, `AiSummaryPort`, `AlertNotifierPort`)
  for the seams that differ across environments.
- **adapters/** — concrete implementations. The DB adapter uses concrete repos
  (a Postgres→Supabase swap is just a DSN change, so abstracting it adds no value).

**Why this matters for the brief:** "decouple to GCP Functions later" is satisfied
because the use cases don't know FastAPI or Postgres exist. A Cloud Run service or
Function entrypoint can import `ingest_lead` and inject the same ports.

## 2. Data model (6 tables)
- **buyers** — balance, daily_cap, leads_received_today, allowed_states/verticals
  (JSON), schedule, campaign_active, ping_tree_assigned, priority, price_per_lead,
  webhook_behavior.
- **leads** — contact + state/vertical/source + trustedform/jornaya, `status`
  (rejected/pending_distribution/sold/unsold/returned), rejection_reason,
  assigned_buyer_id, sold_price, return_reason.
- **routing_evaluations** — *audit trail*: per lead × buyer → eligible + reason_if_not_eligible.
- **delivery_attempts** — ping tree: attempt_order, status, accepted, rejection_reason, latency_ms.
- **ledger_transactions** — debit/refund + amount + balance_before/after + notes.
- **alerts** — severity, alert_type, entity_id, message, suggested_action.

Money is `Numeric(12,2)` and handled as `Decimal` end-to-end (no float drift).

## 3. Routing logic
For each lead we evaluate **every** buyer and store the result (traceability).
Rules, applied in order; the first failure is the recorded reason:
1. `status == active` 2. `campaign_active` 3. `ping_tree_assigned`
4. state allowed 5. vertical allowed 6. within schedule
7. `leads_received_today < daily_cap` 8. `balance >= price_per_lead`

Eligible buyers are sorted by `priority` (lower = higher). The engine returns the
ordered list; the use case walks it as a ping tree.

## 4. Ping tree & fallback
`ingest_lead` iterates eligible buyers by priority. Each delivery returns
accepted / rejected / timeout / error. On a non-accept it records the attempt and
moves to the next buyer. The first acceptance settles the sale and stops the tree.
If all fail → `unsold` + alert. Every attempt is persisted with its latency.

## 5. Error handling
- **Input**: `LeadIn` is lenient on purpose — business validation runs in the use
  case so invalid leads are still **stored as `rejected` with a reason** (per spec),
  instead of bouncing at the schema with a 422.
- **Return errors** map to HTTP codes: missing reason → 422, not found → 404,
  not-sold → 409.
- **Alert channel failures** are swallowed (try/except) so a Slack outage never
  breaks the lead pipeline.
- **AI failures** degrade gracefully: the report still returns; the summary block
  carries an explanatory message.

## 6. How duplicates are avoided
`LeadRepo.has_recent_duplicate` checks for any **non-rejected** lead with the same
phone **or** email created within the last 24h (`dedup_window_hours`, configurable).
Duplicates are stored as `rejected` (`reason = "duplicate within 24h"`) and a
`duplicate_lead` alert is raised. Rejected leads are excluded from the dedup base so
a bad submission can't poison a later legitimate one.

## 7. How timeouts are handled
Each buyer has a `webhook_behavior`. The simulated client models a timeout as a
latency above `BUYER_TIMEOUT_SECONDS` and returns `status=timeout, accepted=false`,
which triggers fallback to the next buyer (and a `buyer_timeout` alert). We do not
block on real sleeps, so tests and the demo stay fast; a real adapter would use an
HTTP client timeout and map the exception to the same `DeliveryResult`.

## 8. How double-charge is avoided
The accept path is a single transaction:
1. `SELECT ... FOR UPDATE` on the buyer row (`BuyerRepo.get_for_update`) — locks it.
2. Re-check balance and cap **under the lock** (state may have changed since eligibility).
3. `apply_debit` (raises if it would overdraw) → update balance + cap.
4. Insert the ledger row (balance_before/after) and mark the lead `sold`.
5. Commit → lock released.

Concurrent ingests for the same buyer serialize on the row lock; the second sees the
updated balance/cap. The lead status guard also prevents a lead from being sold twice.

## 9. How returns avoid double-refund
Only a lead in status `sold` can be returned. After a refund the status becomes
`returned`, so a second return hits the guard and fails with 409. The refund is a
row-locked `apply_refund` + a `refund` ledger row; the cap slot is freed.

## 10. Scaling to production
- **Concurrency/throughput**: move the ping tree to async delivery; the row-lock
  ledger pattern already protects balances. Add DB indexes (present on phone/email/
  lead_id) and connection pooling.
- **Reliability**: make delivery + ledger idempotent with an idempotency key per
  (lead, buyer); add a ret/queue (Cloud Tasks / Pub/Sub) for delivery retries.
- **Observability**: structured logs + metrics on routing latency, accept rate,
  fallback depth, balance burn; alerts already model the operational signals.
- **Decoupling**: extract `application` use cases behind Cloud Run / Functions; the
  domain stays untouched. The HTTP edge and delivery adapter are the only swaps.

## 11. What moves to PostgreSQL / Supabase
PostgreSQL is already the runtime store (SQLite is test-only). On Supabase it is a
**DSN change** (`DATABASE_URL`). Then: use Supabase Auth for buyer/admin login,
Row-Level Security on `buyers`/`ledger_transactions`, Realtime to push the dashboard,
and Edge Functions for lightweight webhooks if desired. The schema is unchanged.

## 12. Connecting Phonexa / Everflow / GHL / Stripe
All four are **adapters** behind existing ports — the core does not change:
- **Phonexa** (ping/post): implement `BuyerDeliveryPort.deliver()` to POST the lead
  to Phonexa's ping endpoint, read the bid/accept, then post on win. `webhook_behavior`
  is replaced by real responses; timeouts use the HTTP client timeout.
- **Everflow**: same `BuyerDeliveryPort`, mapping leads to offers/affiliates and
  recording conversions; eligibility can read caps from Everflow.
- **GHL (GoHighLevel)**: on `sold`, push the contact + opportunity into GHL via a new
  outbound adapter called from the use case (after commit).
- **Stripe**: replace the in-house ledger debit with a Stripe charge/transfer in the
  ledger adapter; keep `ledger_transactions` as the source of truth and reconcile via
  Stripe webhooks. Refunds map to Stripe refunds. Idempotency keys prevent double charge.
