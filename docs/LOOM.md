# Loom script (target < 10 min)

Have running: `docker compose up --build` (or local uvicorn + `npm run dev`).
Open three tabs: **dashboard** (http://localhost:3000), **Swagger** (http://localhost:8000/docs), a **terminal**.

### 0:00 — Intro (45s)
"EcomfyApp Mini Lead Routing Engine. FastAPI backend with a hexagonal core,
Postgres, and a Next.js dashboard. Every routing decision is traceable. Let me show it."

### 0:45 — Architecture (1 min)
Show the repo tree. Point at `app/domain` (pure rules, unit-tested), `app/application`
(use cases), `app/ports` + `app/adapters` (the swappable seams — buyers today are
simulated, tomorrow Phonexa). One sentence: "the core doesn't know FastAPI or
Postgres exist, so it can move to Cloud Run later."

### 1:45 — Tests (1 min)
Terminal: `pytest -q` → **25 passed**. Mention: 9 eligibility rules, ledger math,
8 end-to-end scenarios.

### 2:45 — Dashboard tour + reset (45s)
On the dashboard click **Reset demo**. Show 5 buyers with distinct behaviors
(A accepts, B reject_duplicate, C timeout, D low balance, E cap full).

### 3:30 — The money shot: fallback (1.5 min)
Submit a lead **FL / life_insurance**. Show the new lead row = **sold by buyer_a**.
Open Swagger (or the response) and read the trace:
- `evaluations`: buyer_d "insufficient balance", buyer_e "daily cap reached".
- `attempts`: buyer_b **rejected (duplicate)** → buyer_c **timeout (2050 ms)** →
  buyer_a **accepted**. That's the ping tree + fallback, fully logged.

### 5:00 — Validation + dedup (45s)
Submit the same phone/email again → **rejected: duplicate within 24h**.
Submit a lead with empty email → **rejected: invalid or missing email**.

### 5:45 — Ledger + return (1 min)
Show buyer_a balance dropped by its price. Click **Return** on a sold lead with a
reason → status becomes **returned**, balance restored, refund ledger row. Mention
double-charge protection: row-locked debit + status guard.

### 6:45 — Report + alerts (1 min)
Show the metric cards: total / sold / rejected / unsold / returned, gross / refunds /
net, top buyer, low-balance + cap-reached buyers, top rejection reasons, avg latency.
Scroll to **Alerts**: timeout, duplicate, no-eligible-buyers.

### 7:45 — AI summary (45s)
Click **Generate AI summary** (`?ai=1`). Show the executive summary. Emphasize: "the
AI only summarizes computed metrics — it never decides routing and never invents data."

### 8:30 — Close (30s)
"Backend is real and tested; buyer delivery is simulated behind a port that becomes
a Phonexa/Everflow/GHL adapter. Postgres-backed, Dockerized, and deployable to a GCP
VM with one script. Thanks."
