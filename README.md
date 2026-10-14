# Hospital Agent Portal

This project follows a hybrid architecture:

- React + Node for the customer portal and admin experience
- Python + FastAPI for the agent orchestration, workflow logic, and AI-style booking engine
- Shared business logic for tenants, bookings, patients, and admin operations

## Core architecture

- Frontend shell: React/Node-based web portal for login, onboarding, dashboards, and admin screens
- Backend API: Python FastAPI service that exposes patient, booking, tenant, and orchestration routes
- Agent layer: Python workflow engine that handles inbound intent detection, triage, doctor selection, booking confirmation, and reminders
- Telephony integration: Twilio-compatible service layer that can be connected to a real Indian number when provisioned

## Features

- Multi-tenant thought model with super admin and tenant admin flows
- Python orchestration layer for inbound booking calls
- Dedicated call number configuration for IVR or Twilio integration
- Appointment booking service with doctor selection
- Portal UI for creating bookings and simulating inbound workflows

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Then open:

- http://localhost:8000
- API docs: http://localhost:8000/docs

## Environment

Copy `.env.example` to `.env` and set your Twilio values if you want real telephony integration.

## Notes

The agent logic remains in Python because it is the most natural place for orchestration, call handling, and workflow automation. The React/Node portal can consume the Python APIs without replacing the underlying booking engine.
