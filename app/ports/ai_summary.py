"""Port for the executive AI summary (Parte 9).

The AI only summarizes metrics that were already computed. It never decides
routing and never invents data.
"""

from typing import Protocol


class AiSummaryPort(Protocol):
    def summarize(self, metrics: dict) -> dict:
        """Return {summary, problems, recommended_actions, generated_by}."""
        ...
