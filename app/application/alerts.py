from datetime import datetime, timezone

from app.adapters.db import models
from app.adapters.db.repositories import AlertRepo
from app.ports.alerts import AlertNotifierPort


class Alerts:
    """Persists an alert (DB) and best-effort pushes it to an external channel."""

    def __init__(self, alert_repo: AlertRepo, notifier: AlertNotifierPort):
        self.alert_repo = alert_repo
        self.notifier = notifier

    def emit(
        self,
        *,
        severity: str,
        alert_type: str,
        entity_id: str | None,
        message: str,
        suggested_action: str,
    ) -> None:
        self.alert_repo.add(
            models.Alert(
                severity=severity,
                alert_type=alert_type,
                entity_id=entity_id,
                message=message,
                suggested_action=suggested_action,
            )
        )
        try:
            self.notifier.send(
                {
                    "severity": severity,
                    "alert_type": alert_type,
                    "entity_id": entity_id,
                    "message": message,
                    "suggested_action": suggested_action,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception:
            # An alert channel failure must never break the lead pipeline.
            pass
