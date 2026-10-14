import uuid
from typing import Optional

from app.config import settings
from app.schemas import BookingRequest, CallIntentRequest
from app.store import store


class AgentOrchestrator:
    def _default_doctor(self, preferred: Optional[str]) -> str:
        if preferred:
            return preferred
        return store.doctors[0]

    def _steps(self, patient_name: str, doctor_name: str, date: str, time: str) -> list[dict]:
        return [
            {
                "agent": "voice-intent-agent",
                "status": "completed",
                "message": f"Intent recognized for {patient_name} for a consultation call.",
            },
            {
                "agent": "triage-agent",
                "status": "completed",
                "message": "Patient needs an appointment and eligibility is confirmed.",
            },
            {
                "agent": "booking-agent",
                "status": "completed",
                "message": f"Selected doctor {doctor_name} for {date} at {time}.",
            },
            {
                "agent": "confirmation-agent",
                "status": "completed",
                "message": "Appointment confirmation prepared and SMS/voice reminder queued.",
            },
        ]

    def process_booking(self, request: BookingRequest) -> dict:
        patient_name = request.patient_name.strip()
        phone_number = request.phone_number.strip()
        doctor_name = request.doctor_name or self._default_doctor(None)
        appointment_date = request.appointment_date or "2026-10-20"
        appointment_time = request.appointment_time or "10:30"

        appointment = store.create_appointment(
            patient_name=patient_name,
            phone_number=phone_number,
            doctor_name=doctor_name,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            reason=request.reason,
            call_session_id=str(uuid.uuid4()),
        )

        return {
            "appointment_id": appointment.id,
            "status": "confirmed",
            "message": f"Appointment booked for {patient_name} with {doctor_name}.",
            "assigned_number": settings.dedicated_call_number,
            "orchestration_steps": self._steps(
                patient_name=patient_name,
                doctor_name=doctor_name,
                date=appointment_date,
                time=appointment_time,
            ),
            "appointment": {
                "id": appointment.id,
                "patient_name": appointment.patient_name,
                "phone_number": appointment.phone_number,
                "doctor_name": appointment.doctor_name,
                "appointment_date": appointment.appointment_date,
                "appointment_time": appointment.appointment_time,
                "reason": appointment.reason,
                "status": appointment.status,
            },
        }

    def handle_inbound_call(self, request: CallIntentRequest) -> dict:
        if request.intent.lower() not in {"book_appointment", "appointment", "book"}:
            return {
                "status": "need_more_context",
                "message": "The agent can help book appointments, check doctor availability, or answer intake questions.",
                "assigned_number": settings.dedicated_call_number,
                "orchestration_steps": [
                    {"agent": "voice-intent-agent", "status": "completed", "message": "Could not identify booking intent."}
                ],
            }

        booking_request = BookingRequest(
            patient_name=request.caller_name,
            phone_number=request.phone_number,
            doctor_name=request.preferred_doctor or self._default_doctor(None),
            appointment_date=request.preferred_date or "2026-10-20",
            appointment_time=request.preferred_time or "11:00",
            reason="Inbound voice appointment booking",
        )
        return self.process_booking(booking_request)

    def list_appointments(self) -> list[dict]:
        return [
            {
                "id": item.id,
                "patient_name": item.patient_name,
                "phone_number": item.phone_number,
                "doctor_name": item.doctor_name,
                "appointment_date": item.appointment_date,
                "appointment_time": item.appointment_time,
                "reason": item.reason,
                "status": item.status,
            }
            for item in store.list_appointments()
        ]
