import os
import secrets

from fastapi import FastAPI, Header, HTTPException
from pydantic import Field

from app.schemas import BookingRequest
from app.services.agent_orchestrator import AgentOrchestrator


class AgentBookingRequest(BookingRequest):
    appointment_date: str = Field(..., min_length=10)
    appointment_time: str = Field(..., min_length=4)


app = FastAPI(
    title="Carestac UAT Booking Agent",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
orchestrator = AgentOrchestrator()


@app.get("/health", include_in_schema=False)
async def health() -> dict:
    return {"status": "ok", "service": "python-booking-agent"}


@app.post("/api/agent/phone-booking")
async def phone_booking(
    request: AgentBookingRequest,
    x_agent_secret: str | None = Header(default=None, alias="X-Agent-Secret"),
) -> dict:
    expected_secret = os.getenv("PYTHON_AGENT_SECRET", "").strip()
    if not expected_secret:
        raise HTTPException(status_code=503, detail="Agent service is not configured")
    if not x_agent_secret or not secrets.compare_digest(x_agent_secret, expected_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return orchestrator.process_booking(request)
