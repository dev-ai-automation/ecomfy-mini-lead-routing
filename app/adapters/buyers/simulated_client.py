"""Simulated buyer delivery. The production seam for Phonexa / Everflow / GHL.

Behaviour is driven by buyer.webhook_behavior. Latency is simulated: a timeout
is modeled as latency above the configured threshold (no real sleep, so tests
and the live demo stay fast). Swapping this for a real HTTP client later does
not touch the use case — it only implements BuyerDeliveryPort.
"""

import random

from app.config import settings
from app.domain.enums import AttemptStatus, WebhookBehavior
from app.ports.buyer_delivery import DeliveryResult


class SimulatedBuyerClient:
    def deliver(self, lead, buyer) -> DeliveryResult:
        behavior = buyer.webhook_behavior
        timeout_ms = int(settings.buyer_timeout_seconds * 1000)

        if behavior == WebhookBehavior.TIMEOUT.value:
            return DeliveryResult(
                status=AttemptStatus.TIMEOUT.value,
                accepted=False,
                rejection_reason="timeout",
                latency_ms=timeout_ms + random.randint(50, 400),
            )
        if behavior == WebhookBehavior.REJECT_DUPLICATE.value:
            return DeliveryResult(
                status=AttemptStatus.REJECTED.value,
                accepted=False,
                rejection_reason="duplicate",
                latency_ms=random.randint(60, 250),
            )
        if behavior == WebhookBehavior.ERROR.value:
            return DeliveryResult(
                status=AttemptStatus.ERROR.value,
                accepted=False,
                rejection_reason="buyer error",
                latency_ms=random.randint(60, 250),
            )
        # Default / WebhookBehavior.ACCEPT
        return DeliveryResult(
            status=AttemptStatus.ACCEPTED.value,
            accepted=True,
            rejection_reason=None,
            latency_ms=random.randint(80, 300),
        )
