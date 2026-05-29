from enum import Enum


class LeadStatus(str, Enum):
    REJECTED = "rejected"
    PENDING = "pending_distribution"
    SOLD = "sold"
    UNSOLD = "unsold"
    RETURNED = "returned"


class AttemptStatus(str, Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    ERROR = "error"


class TxType(str, Enum):
    DEBIT = "debit"
    REFUND = "refund"


class BuyerStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class WebhookBehavior(str, Enum):
    """How a simulated buyer responds when a lead is delivered to it."""

    ACCEPT = "accept"
    REJECT_DUPLICATE = "reject_duplicate"
    TIMEOUT = "timeout"
    ERROR = "error"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
