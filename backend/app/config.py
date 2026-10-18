from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    app_name: str = "Carestac Agent Orchestrator"
    app_version: str = "2.0.0"
    debug: bool = False
    carestac_api_url: str = ""
    agent_service_token: str = os.getenv("AGENT_SERVICE_TOKEN") or os.getenv("PYTHON_AGENT_SECRET", "")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
