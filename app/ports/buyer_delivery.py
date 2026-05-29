"""Port for delivering a lead to a buyer.

Today this is implemented by a simulated client. In production the same port is
implemented by real adapters: Phonexa ping/post, Everflow, GHL, etc. The use
case never changes — only the adapter behind this interface does.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass
class DeliveryResult:
    status: str  # one of AttemptStatus values: accepted / rejected / timeout / error
    accepted: bool
    rejection_reason: str | None
    latency_ms: int


class BuyerDeliveryPort(Protocol):
    def deliver(self, lead, buyer) -> DeliveryResult: ...
