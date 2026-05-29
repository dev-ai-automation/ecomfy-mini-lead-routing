"""Claude executive summary adapter (Parte 9).

The AI receives ALREADY-COMPUTED metrics and only writes prose. It never decides
routing and never invents numbers.

Three tiers, so the AI panel is always meaningful — including for evaluators
running locally without a key:
  1. ANTHROPIC_API_KEY set  -> real Claude-generated narrative.
  2. no key                 -> deterministic, data-derived fallback summary.
  3. API error              -> same data-derived fallback (degrade, never break).
The fallback derives every statement from the provided metrics; it invents nothing.
"""

import json


def _to_jsonable(metrics: dict) -> dict:
    return json.loads(json.dumps(metrics, default=str))


def _money(n) -> str:
    try:
        return f"${float(n):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _fallback_summary(m: dict, generated_by: str) -> dict:
    """Build an executive summary purely from the computed metrics (no LLM)."""
    total = m.get("total_leads_received", 0) or 0
    sold = m.get("sold_leads", 0) or 0
    sell_through = round((sold / total) * 100) if total else 0

    summary = (
        f"Processed {total} leads with a {sell_through}% sell-through. "
        f"Net revenue is {_money(m.get('net_revenue', 0))} "
        f"({_money(m.get('gross_revenue', 0))} gross, {_money(m.get('refunds', 0))} refunded "
        f"across {m.get('returned_leads', 0)} returns). "
        f"Average routing latency is {m.get('average_routing_latency_ms', 0)} ms."
    )
    top = m.get("top_buyer_by_spend") or {}
    if top.get("buyer_id"):
        summary += f" Top buyer by spend is {top['buyer_id']} at {_money(top.get('spend', 0))}."

    problems: list[str] = []
    low = m.get("buyers_low_balance") or []
    if low:
        ids = ", ".join(b["buyer_id"] for b in low)
        problems.append(
            f"{len(low)} buyer(s) below their per-lead price floor ({ids}) — "
            f"they drop out of the ping tree until topped up."
        )
    capped = m.get("buyers_cap_reached") or []
    if capped:
        ids = ", ".join(b["buyer_id"] for b in capped)
        problems.append(
            f"{len(capped)} buyer(s) reached their daily cap ({ids}) and stopped "
            f"receiving leads today."
        )
    if m.get("rejected_leads"):
        problems.append(
            f"{m['rejected_leads']} lead(s) were rejected (validation or no eligible "
            f"buyer) — review targeting and lead quality."
        )
    if m.get("unsold_leads"):
        problems.append(
            f"{m['unsold_leads']} lead(s) went unsold after exhausting the ping tree."
        )
    reasons = m.get("top_rejection_reasons") or []
    if reasons:
        r0 = reasons[0]
        problems.append(
            f"Top rejection reason is '{r0['reason']}' ({r0['count']} occurrence(s))."
        )

    actions: list[str] = []
    if low:
        actions.append("Top up low-balance buyers to keep them eligible in the ping tree.")
    if capped:
        actions.append("Raise daily caps for capped buyers or add fallback buyers for their segments.")
    if m.get("unsold_leads") or m.get("rejected_leads"):
        actions.append("Broaden buyer state/vertical targeting to recover unsold and rejected leads.")
    if not actions:
        actions.append("No urgent action — routing is healthy.")

    return {
        "summary": summary,
        "problems": problems or ["No material problems detected in today's routing."],
        "recommended_actions": actions,
        "generated_by": generated_by,
    }


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


class ClaudeSummaryClient:
    def __init__(self, api_key: str | None, model: str):
        self.api_key = api_key
        self.model = model

    def summarize(self, metrics: dict) -> dict:
        # Tier 2: no key -> data-derived fallback (meaningful for local evaluators).
        if not self.api_key:
            return _fallback_summary(
                metrics, "rule-based fallback (set ANTHROPIC_API_KEY for Claude narrative)"
            )
        # Tier 1: real Claude narrative.
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=self.api_key)
            payload = json.dumps(_to_jsonable(metrics), indent=2)
            prompt = (
                "You are an operations analyst for a lead-routing platform. "
                "Using ONLY the metrics below, write a brief executive summary. "
                "Do NOT invent numbers or facts not present in the data. "
                "Return STRICT JSON with exactly these keys: "
                "summary (string), problems (array of strings), "
                "recommended_actions (array of strings).\n\n"
                f"METRICS:\n{payload}"
            )
            msg = client.messages.create(
                model=self.model,
                max_tokens=700,
                messages=[{"role": "user", "content": prompt}],
            )
            data = _extract_json(msg.content[0].text)
            if not data:
                return _fallback_summary(metrics, f"{self.model} (unparseable; used fallback)")
            data["generated_by"] = self.model
            return data
        except Exception as exc:  # noqa: BLE001 - degrade to data-derived fallback
            # Tier 3: API error -> still show data-derived content, never break.
            return _fallback_summary(metrics, f"rule-based fallback (Claude error: {exc})")
