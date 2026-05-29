"""Proves the anti double-charge guarantee under real concurrency.

Setup: buyer_a is given a balance that affords exactly 4 leads (100 / 25).
Then N leads are POSTed *in parallel*. Without the row lock you'd oversell and
drive the balance negative. With it, exactly 4 sell and the balance lands on 0.

Run against the Dockerized stack (Postgres), where row locking is real:
    python scripts/concurrency_test.py http://localhost:8000

(SQLite serializes on a single connection, so the test is only meaningful on
Postgres.)
"""

import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
N = 12
PRICE = 25.0
BALANCE = 100.0  # affords exactly 4 leads
EXPECTED_SOLD = int(BALANCE // PRICE)


def post(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())


def send_lead(i):
    body = {
        "first_name": "Conc", "last_name": str(i),
        "phone": f"21455{i:05d}", "email": f"conc{i}@example.com",
        "state": "TX", "vertical": "auto_insurance",  # only buyer_a eligible
        "source": "load_test", "jornaya_lead_id": f"JRN-C{i}",
    }
    return post("/leads", body)["status"]


def main():
    post("/dev/reset")
    post("/dev/buyer/buyer_a", {"balance": BALANCE, "daily_cap": 100, "leads_received_today": 0})

    with ThreadPoolExecutor(max_workers=N) as pool:
        statuses = list(pool.map(send_lead, range(N)))

    sold = statuses.count("sold")
    report = get("/reports/daily-summary")
    buyer = next(b for b in get("/buyers") if b["buyer_id"] == "buyer_a")
    balance = float(buyer["balance"])
    gross = float(report["gross_revenue"])

    print(f"Fired {N} parallel leads at buyer_a (balance {BALANCE}, price {PRICE}).")
    print(f"  sold (responses):      {sold}")
    print(f"  sold (report):         {report['sold_leads']}")
    print(f"  buyer_a balance after: {balance}")
    print(f"  gross revenue:         {gross}")

    checks = {
        "exactly EXPECTED_SOLD sold": sold == EXPECTED_SOLD,
        "report agrees on sold count": report["sold_leads"] == EXPECTED_SOLD,
        "balance is exactly 0 (no oversell)": balance == 0.0,
        "balance never negative": balance >= 0.0,
        "gross == sold * price (ledger consistent)": gross == EXPECTED_SOLD * PRICE,
    }
    print()
    ok = True
    for name, passed in checks.items():
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
        ok = ok and passed

    print()
    print("RESULT:", "PASS — row lock prevented double-charge" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
