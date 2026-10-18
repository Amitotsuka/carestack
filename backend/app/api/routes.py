import hmac
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.schemas import AgentToolRequest, AvailabilityRequest, BookingRequest
from app.services.agent_orchestrator import AgentOrchestrator
from app.services.carestac_client import CarestacRejected, CarestacUnavailable

router = APIRouter()
orchestrator = AgentOrchestrator()


def require_agent_token(x_agent_token: str = Header(default="")) -> None:
    expected = settings.agent_service_token
    if len(expected) < 32 or not hmac.compare_digest(x_agent_token, expected):
        raise HTTPException(status_code=401, detail="Agent service authentication failed")


def orchestration_readiness() -> bool:
    parsed_url = urlsplit(settings.carestac_api_url)
    return bool(
        parsed_url.scheme in {"https", "http"}
        and parsed_url.hostname
        and not parsed_url.hostname.startswith("your-")
        and not parsed_url.username
        and not parsed_url.password
        and not parsed_url.query
        and not parsed_url.fragment
        and len(settings.agent_service_token) >= 32
    )


def raise_carestac_error(exc: Exception) -> None:
    if isinstance(exc, CarestacUnavailable):
        raise HTTPException(status_code=503, detail="Clinic scheduling service is unavailable") from exc
    if isinstance(exc, CarestacRejected):
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    raise HTTPException(status_code=502, detail="Clinic scheduling request failed") from exc


@router.get("/health")
async def health() -> dict:
    ready = orchestration_readiness()
    if not ready:
        raise HTTPException(status_code=503, detail="Agent orchestration is not configured")
    return {"status": "ok" if ready else "not_ready", "app": settings.app_name, "orchestration_ready": ready}


@router.post("/agent/availability")
async def agent_availability(request: AvailabilityRequest, _: None = Depends(require_agent_token)) -> dict:
    try:
        return await orchestrator.check_availability(request)
    except (CarestacUnavailable, CarestacRejected) as exc:
        raise_carestac_error(exc)


@router.post("/agent/voice-tool")
async def agent_voice_tool(request: AgentToolRequest, _: None = Depends(require_agent_token)) -> dict:
    try:
        return await orchestrator.execute_voice_tool(request.tenant_id, request.payload)
    except (CarestacUnavailable, CarestacRejected) as exc:
        raise_carestac_error(exc)


@router.post("/agent/phone-booking")
async def phone_booking(request: BookingRequest, _: None = Depends(require_agent_token)) -> dict:
    try:
        return await orchestrator.process_booking(request)
    except (CarestacUnavailable, CarestacRejected) as exc:
        raise_carestac_error(exc)
