"""Port for pushing an alert to an external channel (Slack, etc.).

Persistence of alerts is a separate concern (AlertRepo). This port is only the
outbound notification, implemented today by Slack webhook or console fallback.
"""

from typing import Protocol


class AlertNotifierPort(Protocol):
    def send(self, alert: dict) -> None: ...
