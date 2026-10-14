from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import BookingRequest, CallIntentRequest, LoginRequest, PatientRequest, TenantOnboardRequest
from app.services.agent_orchestrator import AgentOrchestrator
from app.store import store

router = APIRouter()
orchestrator = AgentOrchestrator()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@router.get("/phone/number")
async def phone_number() -> dict:
    return {"assigned_number": settings.dedicated_call_number}


@router.get("/appointments")
async def list_appointments() -> dict:
    return {"appointments": orchestrator.list_appointments()}


@router.post("/appointments")
async def create_appointment(request: BookingRequest) -> dict:
    return orchestrator.process_booking(request)


@router.post("/agent/phone-booking")
async def phone_booking(request: BookingRequest) -> dict:
    return orchestrator.process_booking(request)


@router.post("/agent/inbound-call")
async def inbound_call(request: CallIntentRequest) -> dict:
    return orchestrator.handle_inbound_call(request)


@router.post("/auth/login")
async def login(payload: LoginRequest) -> dict:
    user = store.login(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user": user, "message": "Login successful"}


@router.get("/tenants")
async def list_tenants() -> dict:
    return {"tenants": store.list_tenants()}


@router.post("/tenants/onboard")
async def onboard_tenant(payload: TenantOnboardRequest) -> dict:
    return {"tenant": store.create_tenant(payload.model_dump()), "message": "Tenant onboarded successfully"}


@router.get("/tenant/{tenant_id}/dashboard")
async def tenant_dashboard(tenant_id: str) -> dict:
    dashboard = store.get_dashboard(tenant_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return dashboard


@router.get("/tenant/{tenant_id}/patients")
async def list_patients(tenant_id: str) -> dict:
    dashboard = store.get_dashboard(tenant_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"patients": dashboard["patients"]}


@router.post("/tenant/{tenant_id}/patients")
async def add_patient(tenant_id: str, payload: PatientRequest) -> dict:
    try:
        return {"patient": store.add_patient(tenant_id, payload.model_dump()), "message": "Patient created"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/tenant/{tenant_id}/patients/{patient_id}")
async def update_patient(tenant_id: str, patient_id: str, payload: PatientRequest) -> dict:
    try:
        return {"patient": store.update_patient(tenant_id, patient_id, payload.model_dump()), "message": "Patient updated"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/tenant/{tenant_id}/patients/{patient_id}")
async def delete_patient(tenant_id: str, patient_id: str) -> dict:
    try:
        return store.delete_patient(tenant_id, patient_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
