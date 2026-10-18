from urllib.parse import quote

import httpx

from app.config import settings


class CarestacUnavailable(Exception):
    pass


class CarestacRejected(Exception):
    pass


class CarestacClient:
    async def invoke(self, tenant_id: str, payload: dict) -> dict:
        base_url = settings.carestac_api_url.strip().rstrip("/")
        if not base_url.startswith(("https://", "http://")):
            raise CarestacUnavailable("Carestac API URL is not configured")
        if len(settings.agent_service_token) < 32:
            raise CarestacUnavailable("Agent service authentication is not configured")
        endpoint = f"{base_url}/api/internal/agent/tools/{quote(tenant_id, safe='')}"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=4.0), follow_redirects=False) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers={"x-agent-token": settings.agent_service_token},
                )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise CarestacUnavailable("Carestac API could not be reached") from exc

        try:
            data = response.json()
        except ValueError as exc:
            raise CarestacUnavailable("Carestac API returned an invalid response") from exc
        if not isinstance(data, dict):
            raise CarestacUnavailable("Carestac API returned an invalid response")
        if response.status_code >= 500:
            raise CarestacUnavailable("Carestac API is temporarily unavailable")
        if response.status_code >= 400:
            detail = data.get("message") or data.get("error") or data.get("detail") or "Request rejected"
            raise CarestacRejected(str(detail)[:500])
        return data
