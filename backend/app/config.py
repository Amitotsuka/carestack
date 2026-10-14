from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hospital Agent Portal"
    app_version: str = "1.0.0"
    debug: bool = False
    dedicated_call_number: str = "+91 90000 12345"
    twilio_account_sid: str = "demo_account_sid"
    twilio_auth_token: str = "demo_auth_token"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
