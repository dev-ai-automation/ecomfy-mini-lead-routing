"""Alert notifier: posts to a Slack webhook if configured, else logs to console.

Implements AlertNotifierPort. The caller (Alerts.emit) wraps send() in a
try/except, so a channel failure never breaks the lead pipeline.
"""

import json
import urllib.request


class AlertNotifier:
    def __init__(self, slack_webhook_url: str | None):
        self.webhook = slack_webhook_url

    def send(self, alert: dict) -> None:
        line = (
            f"[ALERT/{alert['severity']}] {alert['alert_type']} "
            f":: {alert['message']} -> {alert['suggested_action']}"
        )
        if not self.webhook:
            print(line, flush=True)
            return
        body = json.dumps({"text": line}).encode("utf-8")
        req = urllib.request.Request(
            self.webhook, data=body, headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=3)  # noqa: S310 - operator-configured URL
