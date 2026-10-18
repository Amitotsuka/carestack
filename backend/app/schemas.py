from pydantic import BaseModel, Field


class BookingRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    request_id: str = Field(..., min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    confirmed: bool = False
    patient_name: str = Field(..., min_length=2, max_length=120)
    phone_number: str = Field(..., min_length=8, max_length=30)
    doctor_name: str = Field(..., min_length=2, max_length=120)
    appointment_date: str = Field(..., min_length=1, max_length=64)
    appointment_time: str = Field(..., min_length=1, max_length=32)
    reason: str = Field(default="", max_length=500)


class AvailabilityRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    appointment_date: str = Field(..., min_length=1, max_length=64)
    appointment_time: str = Field(..., min_length=1, max_length=32)
    doctor_name: str = Field(default="", max_length=120)


class AgentToolRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    payload: dict = Field(..., max_length=20)
