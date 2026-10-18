from fastapi import FastAPI, HTTPException

from app.api.routes import orchestration_readiness, router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.include_router(router, prefix="/api")


@app.get("/health", include_in_schema=False)
async def health() -> dict:
    if not orchestration_readiness():
        raise HTTPException(status_code=503, detail="Agent orchestration is not configured")
    return {"status": "ok", "service": settings.app_name, "orchestration_ready": True}
