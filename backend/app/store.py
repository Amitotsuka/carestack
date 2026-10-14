from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class Appointment:
    id: str
    patient_name: str
    phone_number: str
    doctor_name: str
    appointment_date: str
    appointment_time: str
    reason: str
    status: str = "confirmed"
    call_session_id: Optional[str] = None


@dataclass
class Patient:
    id: str
    tenant_id: str
    name: str
    phone: str
    email: Optional[str]
    age: Optional[int]
    status: str
    notes: Optional[str]


@dataclass
class TenantUser:
    id: str
    tenant_id: str
    name: str
    email: str
    role: str
    password: str


@dataclass
class Tenant:
    id: str
    name: str
    domain: str
    admin_name: str
    admin_email: str
    admin_phone: str
    plan: str
    region: str
    users: List[TenantUser]
    patients: List[Patient]
    bookings: List[Appointment]


class InMemoryStore:
    def __init__(self) -> None:
        self.appointments: Dict[str, Appointment] = {}
        self.doctors: List[str] = [
            "Dr. Sarah Chen",
            "Dr. James Patel",
            "Dr. Elena Gomez",
        ]

        self.tenants: Dict[str, Tenant] = {}
        self.super_admin_email = "superadmin@hospital.ai"
        self.super_admin_password = "admin123"

        self._seed_data()

    def _seed_data(self) -> None:
        tenant_id = "tenant-skycare"
        admin_user = TenantUser(
            id="user-admin-1",
            tenant_id=tenant_id,
            name="Tenant Admin",
            email="admin@skycare.in",
            role="tenant_admin",
            password="admin123",
        )
        tenant = Tenant(
            id=tenant_id,
            name="SkyCare Multi-Speciality",
            domain="skycare",
            admin_name="Tenant Admin",
            admin_email="admin@skycare.in",
            admin_phone="+91 99887 76655",
            plan="growth",
            region="India",
            users=[admin_user],
            patients=[
                Patient(
                    id="pat-1001",
                    tenant_id=tenant_id,
                    name="Aarav Nair",
                    phone="+91 98765 10001",
                    email="aarav@demo.in",
                    age=32,
                    status="active",
                    notes="Routine checkup",
                )
            ],
            bookings=[
                Appointment(
                    id="APT-0001",
                    patient_name="Aarav Nair",
                    phone_number="+91 98765 10001",
                    doctor_name="Dr. Sarah Chen",
                    appointment_date="2026-10-20",
                    appointment_time="10:30",
                    reason="Routine checkup",
                    status="confirmed",
                )
            ],
        )
        self.tenants[tenant_id] = tenant

    def create_appointment(
        self,
        patient_name: str,
        phone_number: str,
        doctor_name: str,
        appointment_date: str,
        appointment_time: str,
        reason: str,
        call_session_id: Optional[str] = None,
    ) -> Appointment:
        appointment_id = f"APT-{len(self.appointments) + 1:04d}"
        appointment = Appointment(
            id=appointment_id,
            patient_name=patient_name,
            phone_number=phone_number,
            doctor_name=doctor_name,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            reason=reason,
            call_session_id=call_session_id,
        )
        self.appointments[appointment_id] = appointment
        return appointment

    def list_appointments(self) -> list[Appointment]:
        return list(self.appointments.values())

    def create_tenant(self, payload: dict) -> dict:
        tenant_id = f"tenant-{len(self.tenants) + 1:02d}"
        admin_id = f"user-{tenant_id}"
        user = TenantUser(
            id=admin_id,
            tenant_id=tenant_id,
            name=payload["admin_name"],
            email=payload["admin_email"],
            role="tenant_admin",
            password="admin123",
        )
        tenant = Tenant(
            id=tenant_id,
            name=payload["tenant_name"],
            domain=payload["tenant_domain"],
            admin_name=payload["admin_name"],
            admin_email=payload["admin_email"],
            admin_phone=payload["admin_phone"],
            plan=payload["plan"],
            region=payload["region"],
            users=[user],
            patients=[],
            bookings=[],
        )
        self.tenants[tenant_id] = tenant
        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "domain": tenant.domain,
            "admin_email": tenant.admin_email,
            "plan": tenant.plan,
        }

    def login(self, email: str, password: str) -> Optional[dict]:
        if email == self.super_admin_email and password == self.super_admin_password:
            return {
                "user_id": "super-admin",
                "role": "super_admin",
                "name": "Super Admin",
                "tenant_id": None,
                "email": email,
            }

        for tenant in self.tenants.values():
            for user in tenant.users:
                if user.email == email and user.password == password:
                    return {
                        "user_id": user.id,
                        "role": user.role,
                        "name": user.name,
                        "tenant_id": tenant.id,
                        "email": email,
                    }
        return None

    def get_dashboard(self, tenant_id: str) -> dict:
        tenant = self.tenants.get(tenant_id)
        if not tenant:
            return {}
        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "admin_name": tenant.admin_name,
            "plan": tenant.plan,
            "region": tenant.region,
            "summary": {
                "patients": len(tenant.patients),
                "appointments": len(tenant.bookings),
                "revenue": "₹4,80,000",
                "efficiency": "92%",
            },
            "patients": [
                {
                    "id": patient.id,
                    "name": patient.name,
                    "phone": patient.phone,
                    "email": patient.email,
                    "age": patient.age,
                    "status": patient.status,
                    "notes": patient.notes,
                }
                for patient in tenant.patients
            ],
            "bookings": [
                {
                    "id": booking.id,
                    "patient_name": booking.patient_name,
                    "doctor_name": booking.doctor_name,
                    "phone_number": booking.phone_number,
                    "appointment_date": booking.appointment_date,
                    "appointment_time": booking.appointment_time,
                    "status": booking.status,
                }
                for booking in tenant.bookings
            ],
        }

    def add_patient(self, tenant_id: str, payload: dict) -> dict:
        tenant = self.tenants.get(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        patient_id = f"pat-{len(tenant.patients) + 1001}"
        patient = Patient(
            id=patient_id,
            tenant_id=tenant_id,
            name=payload["name"],
            phone=payload["phone"],
            email=payload.get("email"),
            age=payload.get("age"),
            status=payload.get("status", "active"),
            notes=payload.get("notes"),
        )
        tenant.patients.append(patient)
        return {
            "id": patient.id,
            "name": patient.name,
            "phone": patient.phone,
            "status": patient.status,
        }

    def update_patient(self, tenant_id: str, patient_id: str, payload: dict) -> dict:
        tenant = self.tenants.get(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        for patient in tenant.patients:
            if patient.id == patient_id:
                patient.name = payload.get("name", patient.name)
                patient.phone = payload.get("phone", patient.phone)
                patient.email = payload.get("email", patient.email)
                patient.age = payload.get("age", patient.age)
                patient.status = payload.get("status", patient.status)
                patient.notes = payload.get("notes", patient.notes)
                return {
                    "id": patient.id,
                    "name": patient.name,
                    "phone": patient.phone,
                    "status": patient.status,
                }
        raise ValueError("Patient not found")

    def delete_patient(self, tenant_id: str, patient_id: str) -> dict:
        tenant = self.tenants.get(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        original_count = len(tenant.patients)
        tenant.patients = [patient for patient in tenant.patients if patient.id != patient_id]
        if len(tenant.patients) == original_count:
            raise ValueError("Patient not found")
        return {"deleted": True, "patient_id": patient_id}

    def list_tenants(self) -> list[dict]:
        return [
            {
                "id": tenant.id,
                "name": tenant.name,
                "domain": tenant.domain,
                "admin_name": tenant.admin_name,
                "admin_email": tenant.admin_email,
                "plan": tenant.plan,
                "region": tenant.region,
            }
            for tenant in self.tenants.values()
        ]


store = InMemoryStore()
