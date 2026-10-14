# UAT deployment on Render

The repository includes a Render Blueprint (`render.yaml`) for a UAT environment:

- `carestack-uat-web`: Vite static site, built with the API service URL.
- `carestack`: NestJS API with a persistent SQLite disk mounted at `/var/data`. This name matches the existing Render service so Blueprint sync updates its broken root directory and commands instead of creating a duplicate API.
- `carestack-uat-agent`: private FastAPI service used by the booking workflow.

The API and private agent use Oregon because the existing `carestack` service is already there and Render's private service networking is regional. The Node API disk and private agent require paid compute; a free web service has an ephemeral filesystem and cannot safely hold the SQLite database. The disk-backed API is single-instance and has brief downtime during deploys, so this setup is intended for UAT rather than a scaled production deployment.

## First deployment

1. Push the repository to GitHub `main` and create a Render account.
2. In Render, choose **New → Blueprint**, connect `Amitotsuka/carestack`, select `main`, and apply the root `render.yaml`. The `carestack` entry matches the existing service; review the pending change before applying it.
3. During Blueprint setup, provide `SUPER_ADMIN_EMAIL`, a unique `SUPER_ADMIN_PASSWORD` of at least 14 characters, and `CORS_ORIGINS` set to the public static-site origin shown in Render. Render generates the JWT, provider-encryption, and voice-tool secrets.
4. Render builds and deploys the API, frontend, and private agent. The API's `DATABASE_PATH` points to `/var/data/hospital.sqlite` on its persistent disk. This starts with an empty UAT database; clinic and appointment data are not copied from the developer laptop.
5. Render supplies the API's public URL to the Vite build as `VITE_API_URL`. If you later change the frontend domain, update `CORS_ORIGINS` in the API service and redeploy it.
6. Open the frontend URL, sign in with the configured super-admin email/password, and onboard a UAT clinic. Keep its provider credentials and patient data separate from production.
7. For Exotel testing, use the API URL plus `/api/voice/tools/<tenant-id>` and the clinic-specific voice-tool secret shown after saving the clinic calling settings. Exotel needs this public HTTPS URL; localhost will not work from Exotel's cloud.

## CI and deploys

GitHub Actions runs NestJS tests, the Vite production build, and Python syntax checks on pull requests and pushes to `main`. Render deploys each service after CI checks pass when files under that service's root directory change. Merge to `main`, then inspect the Render deploy events and `https://<api-host>/health`.

## Environment and data notes

- Set production secrets in Render, not in `.env` files or GitHub. Keep `CREDENTIALS_ENCRYPTION_KEY`, `JWT_SECRET`, and `VOICE_TOOL_SECRET` unchanged after creating UAT data.
- The SQLite disk is attached to one API instance. Back it up before replacing or deleting the Render disk. Move to managed PostgreSQL before running multiple API instances.
- The Python agent currently uses demo in-memory state. The NestJS SQLite database is the persisted CareStack tenant and appointment store.
- Twilio credentials can be added to the Python service later, but the current Python code does not send SMS yet.
- If you later copy local clinic records into UAT, use a sanitized copy and preserve the matching credential-encryption key; do not upload real patient data by default.
