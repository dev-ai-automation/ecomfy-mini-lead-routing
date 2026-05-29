from pydantic import BaseModel


class LeadIn(BaseModel):
    """Lenient input model. Business validation happens in the use case so that
    invalid leads are still stored as 'rejected' with a reason (Parte 2)."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "first_name": "Maria",
                "last_name": "Gonzalez",
                "phone": "3055550200",
                "email": "maria@example.com",
                "state": "FL",
                "vertical": "life_insurance",
                "source": "web_form",
                "trusted_form_cert_url": "https://cert.trustedform.com/x",
            }
        }
    }

    lead_id: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
    state: str | None = None
    vertical: str | None = None
    source: str | None = None
    trusted_form_cert_url: str | None = None
    jornaya_lead_id: str | None = None


class ReturnIn(BaseModel):
    reason: str


class BuyerPatch(BaseModel):
    """Dev-only: override buyer state to set up test scenarios."""

    balance: float | None = None
    daily_cap: int | None = None
    leads_received_today: int | None = None
