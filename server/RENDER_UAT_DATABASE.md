# Render UAT PostgreSQL setup

Local development continues to use `server/data/hospital.sqlite`. Render UAT
uses PostgreSQL when `DATABASE_URL` is configured.

## GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions** and add
these repository secrets:

| Secret | Value |
| --- | --- |
| `RENDER_API_KEY` | A Render API key that can update and deploy the UAT API service. |
| `RENDER_SERVICE_ID` | `srv-db7nsf59fdbs73etgg4g` for the Render UAT API service. |
| `RENDER_DATABASE_URL` | The **Internal Database URL** from `carestack-uat-db`. This is used only by the Render API. |
| `POSTGRES_EXTERNAL_URL` | The **External Database URL** from `carestack-uat-db`. GitHub Actions uses this only for the one-time import. |
| `CARESTACK_UAT_STATE_B64` | The output of `npm run export:sqlite-state` from the `server` folder. |

Never commit any of these values to Git.

## Import local data once

1. In a terminal, run `cd server && npm run export:sqlite-state`.
2. Copy the single line of output into the `CARESTACK_UAT_STATE_B64` GitHub
   secret. It contains clinic data and must remain secret.
3. In GitHub, open **Actions → Sync Render UAT database → Run workflow**.

The workflow sets `DATABASE_URL` on the Render API, creates the `app_state`
table in Postgres, imports the exported local state, and redeploys the API.
Run it only when you intentionally want to replace UAT data with the current
local data.

The imported local demo password is disabled in production. Configure a real
tenant password before enabling a tenant login in UAT.
