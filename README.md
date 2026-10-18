# Carestac Hospital Agent Portal

## Runtime architecture

- The React frontend and NestJS API in `frontend/` and `server/` provide the production clinic portal and own appointment persistence.
- The private FastAPI service in `backend/` coordinates availability and booking calls against the NestJS clinic calendar. It does not keep a second appointment database or use sample doctors, dates, or phone numbers.
- Exotel or Sarvam handles caller audio and conversation. Voice-tool calls enter the authenticated NestJS API, which forwards them to the private Python coordinator; Python calls the NestJS internal tool handler to read or update the live clinic calendar.
- The Python service is a workflow coordinator, not an LLM or multi-agent framework. Intent recognition, speech, and response generation belong to the configured voice provider.

## Local setup

Create `backend/.env` from `backend/.env.example` and set:

- `CARESTAC_API_URL` to the running NestJS API base URL.
- `AGENT_SERVICE_TOKEN` to the same random value as `server/.env`'s `PYTHON_AGENT_SECRET` (at least 32 characters).

Then run the services:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The NestJS API must also have `PYTHON_AGENT_URL=http://localhost:8000` and the shared `PYTHON_AGENT_SECRET`. The Python health check at `/health` returns 503 until its required configuration is present. API docs are available at `/docs` for local development.

## Booking flow

1. An authenticated tenant admin checks a requested slot with `POST /api/agent/availability` on the NestJS API. The request includes `tenant_id`, `appointment_date`, `appointment_time`, and the exact `doctor_name` or an empty string when there is no doctor preference.
2. Read the returned doctor, date, and time to the caller. Do not treat availability as consent to book.
3. After the caller confirms the complete details, call `POST /api/agent/booking` with `confirmed: true`, a stable `request_id`, patient and phone details, the exact doctor, date, time, and `reason` (empty string if declined).
4. Python rechecks the slot immediately before booking and calls the live clinic tool. A successful response must contain the appointment ID returned by the clinic calendar.

The Node API protects the admin workflow with clinic admin authentication and validates the clinic credential before forwarding voice calls. Node and Python protect service-to-service calls with the shared service token. The Python service never receives the clinic's voice credential or database credentials.

## Deployment

The combined Render blueprint is `render.yaml`. Its Python service uses the default public Nest API URL `https://carestack.onrender.com`; update `CARESTAC_API_URL` if the API has a custom domain or a different Render service name. It generates the Python service token and shares it with the Nest service through Render's service environment reference.

`render-agent.yml` is for deploying only the private Python service. After deployment, set `CARESTAC_API_URL` in the Python service and copy its generated `AGENT_SERVICE_TOKEN` into the Nest service's `PYTHON_AGENT_SECRET`.

See [VOICE_RECEPTIONIST.md](VOICE_RECEPTIONIST.md) for voice-provider setup and supported tool behavior.
