from app.schemas import AvailabilityRequest, BookingRequest
from app.services.carestac_client import CarestacClient, CarestacRejected


class AgentOrchestrator:
    """Coordinates the live clinic tools; it never owns appointment state."""

    def __init__(self) -> None:
        self.carestac = CarestacClient()

    async def execute_voice_tool(self, tenant_id: str, payload: dict) -> dict:
        action = payload.get("action")
        if action not in {"clinic_info", "faq", "availability", "book"}:
            raise CarestacRejected("Unsupported voice tool action")
        return await self.carestac.invoke(tenant_id, payload)

    async def check_availability(self, request: AvailabilityRequest) -> dict:
        result = await self.carestac.invoke(request.tenant_id, {
            "action": "availability",
            "date": request.appointment_date,
            "time": request.appointment_time,
            "doctor_name": request.doctor_name,
        })
        if result.get("check_status") != "checked" or result.get("available") is None:
            return {
                "status": "not_verified",
                "message": "The requested slot could not be verified. Offer clinic staff.",
                "availability": result,
            }
        return {
            "status": "available" if result["available"] else "unavailable",
            "availability": result,
            "next_step": "Read the exact doctor, date, and time to the caller and obtain explicit confirmation before booking." if result["available"] else "Offer only the alternative slots returned by the clinic calendar.",
        }

    async def process_booking(self, request: BookingRequest) -> dict:
        if request.confirmed is not True:
            return {
                "status": "confirmation_required",
                "message": "The caller must confirm the complete appointment details before booking.",
            }

        # Recheck at commit time to avoid booking from stale availability.
        availability = await self.carestac.invoke(request.tenant_id, {
            "action": "availability",
            "date": request.appointment_date,
            "time": request.appointment_time,
            "doctor_name": request.doctor_name,
        })
        if availability.get("check_status") != "checked" or availability.get("available") is not True:
            return {
                "status": "not_booked",
                "message": "The confirmed slot is no longer available or could not be verified. Do not claim a booking was made.",
                "availability": availability,
            }

        actual_doctor = availability.get("doctor_name")
        if not isinstance(actual_doctor, str) or not actual_doctor.strip():
            return {
                "status": "not_booked",
                "message": "The clinic did not return a verified doctor for this slot.",
                "availability": availability,
            }

        result = await self.carestac.invoke(request.tenant_id, {
            "action": "book",
            "request_id": request.request_id,
            "confirmed": True,
            "patient_name": request.patient_name,
            "phone_number": request.phone_number,
            "doctor_name": actual_doctor,
            "date": availability.get("date", request.appointment_date),
            "time": availability.get("time", request.appointment_time),
            "reason": request.reason,
        })
        appointment = result.get("appointment")
        appointment_id = appointment.get("id") if isinstance(appointment, dict) else None
        if not appointment_id:
            return {
                "status": "not_booked",
                "message": "The clinic did not confirm a saved appointment. Do not claim a booking was made.",
                "booking_result": result,
            }
        return {
            "status": "confirmed",
            "appointment_id": appointment_id,
            "appointment": appointment,
            "idempotent_replay": result.get("idempotent_replay") is True,
        }
