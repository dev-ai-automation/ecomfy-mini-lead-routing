import re

from email_validator import EmailNotValidError, validate_email


def _valid_email(email: str) -> bool:
    try:
        validate_email(email, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def _valid_phone(phone: str | None) -> bool:
    digits = re.sub(r"\D", "", phone or "")
    return 10 <= len(digits) <= 15


def validate_lead(data) -> str | None:
    """Return a rejection reason string, or None if the lead is valid.

    Order matters: the first failing rule is the reason we persist.
    """
    if not data.email or not _valid_email(data.email):
        return "invalid or missing email"
    if not _valid_phone(data.phone):
        return "invalid or missing phone"
    if not data.state:
        return "missing state"
    if not data.vertical:
        return "missing vertical"
    if not data.source:
        return "missing source"
    if not (data.trusted_form_cert_url or data.jornaya_lead_id):
        return "missing trusted_form_cert_url or jornaya_lead_id"
    return None
