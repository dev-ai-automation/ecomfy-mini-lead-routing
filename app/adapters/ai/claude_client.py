"""Claude executive summary adapter (Parte 9).

The AI receives ALREADY-COMPUTED metrics and only writes prose. It never
decides routing and never invents numbers. Degrades gracefully when no API key
is configured, so the system runs end-to-end without it.
"""

import json


def _to_jsonable(metrics: dict) -> dict:
    return json.loads(json.dumps(metrics, default=str))


def _extract_json(text: str) -> dict:
    text = text.strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"summary": text, "problems": [], "recommended_actions": []}


class ClaudeSummaryClient:
    def __init__(self, api_key: str | None, model: str):
        self.api_key = api_key
        self.model = model

    def summarize(self, metrics: dict) -> dict:
        if not self.api_key:
            return {
                "summary": "AI summary disabled (set ANTHROPIC_API_KEY to enable).",
                "problems": [],
                "recommended_actions": [],
                "generated_by": "disabled",
            }
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
            data["generated_by"] = self.model
            return data
        except Exception as exc:  # noqa: BLE001 - never break the report
            return {
                "summary": f"AI summary unavailable: {exc}",
                "problems": [],
                "recommended_actions": [],
                "generated_by": "error",
            }
