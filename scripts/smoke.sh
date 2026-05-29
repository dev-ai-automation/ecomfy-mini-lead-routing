#!/usr/bin/env bash
# End-to-end smoke test against a running API.
# Usage: bash scripts/smoke.sh [BASE_URL]   (default http://localhost:8000)
set -euo pipefail
BASE="${1:-http://localhost:8000}"
H='Content-Type: application/json'

line() { echo; echo "=== $1 ==="; }

line "RESET (fresh buyers + cleared data)"
curl -s -X POST "$BASE/dev/reset"; echo

line "1. Valid lead SOLD to first buyer (TX / auto_insurance -> only buyer_a eligible)"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"John","last_name":"Smith","phone":"2145550100","email":"first@example.com","state":"TX","vertical":"auto_insurance","source":"web_form","jornaya_lead_id":"JRN-1"}'; echo

line "2. Lead SOLD after fallback (FL / life -> buyer_b reject, buyer_c timeout, buyer_a accept)"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"Maria","last_name":"Gonzalez","phone":"3055550200","email":"fallback@example.com","state":"FL","vertical":"life_insurance","source":"web_form","trusted_form_cert_url":"https://cert/x"}'; echo

line "3. Duplicate rejected (re-send same phone/email)"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"John","last_name":"Smith","phone":"2145550100","email":"first@example.com","state":"TX","vertical":"auto_insurance","source":"web_form","jornaya_lead_id":"JRN-2"}'; echo

line "4. Missing email rejected"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"Carlos","phone":"3055550400","email":"","state":"FL","vertical":"life_insurance","source":"web_form","trusted_form_cert_url":"https://cert/x"}'; echo

line "5 & 6. buyer_d (no balance) and buyer_e (cap full) discarded -> see evaluations"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"Eval","last_name":"Trace","phone":"3055550500","email":"eval@example.com","state":"FL","vertical":"life_insurance","source":"web_form","trusted_form_cert_url":"https://cert/x"}'; echo

line "7. No eligible buyers -> unsold (WA)"
curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"Sophia","phone":"2065551000","email":"wa@example.com","state":"WA","vertical":"life_insurance","source":"web_form","trusted_form_cert_url":"https://cert/x"}'; echo

line "8. Return a SOLD lead with refund"
SOLD_ID=$(curl -s -X POST "$BASE/leads" -H "$H" -d '{"first_name":"Ret","last_name":"User","phone":"2145550800","email":"ret@example.com","state":"TX","vertical":"auto_insurance","source":"web_form","jornaya_lead_id":"JRN-8"}' | python -c "import sys,json;print(json.load(sys.stdin)['lead_id'])")
echo "sold lead_id=$SOLD_ID"
curl -s -X POST "$BASE/leads/$SOLD_ID/return" -H "$H" -d '{"reason":"wrong number"}'; echo

line "DAILY SUMMARY"
curl -s "$BASE/reports/daily-summary"; echo

line "ALERTS"
curl -s "$BASE/alerts"; echo
