from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://ecomfy:ecomfy@localhost:5432/ecomfy"

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"

    slack_webhook_url: str | None = None

    # Simulated buyer behaviour: any delivery taking longer than this counts as timeout.
    buyer_timeout_seconds: float = 2.0

    # Dedup window for incoming leads (phone/email).
    dedup_window_hours: int = 24


settings = Settings()
