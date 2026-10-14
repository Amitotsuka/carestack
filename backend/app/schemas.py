from typing import Optional

from pydantic import BaseModel, Field


class BookingRequest(BaseModel):
    patient_name: str = Field(..., min_length=2)
    phone_number: str = Field(..., min_length=7)
    doctor_name: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    reason: str = "General consultation"


class CallIntentRequest(BaseModel):
    caller_name: str = "Patient"
    phone_number: str = Field(..., min_length=7)
    intent: str = "book_appointment"
    preferred_doctor: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None


class BookingResponse(BaseModel):
    appointment_id: Optional[str] = None
    status: str
    message: str
    assigned_number: str
    orchestration_steps: list[dict]
    appointment: Optional[dict] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TenantOnboardRequest(BaseModel):
    tenant_name: str = Field(..., min_length=2)
    tenant_domain: str = Field(..., min_length=2)
    admin_name: str = Field(..., min_length=2)
    admin_email: str = Field(...)
    admin_phone: str = Field(..., min_length=10)
    plan: str = "growth"
    region: str = "India"


class PatientRequest(BaseModel):
    name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=7)
    email: Optional[str] = None
    age: Optional[int] = None
    status: str = "active"
    notes: Optional[str] = None
