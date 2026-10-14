from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

frontend_dir = Path(__file__).resolve().parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


@app.get("/", include_in_schema=False)
async def serve_frontend() -> FileResponse:
    return FileResponse(frontend_dir / "index.html")


@app.get("/login", include_in_schema=False)
async def serve_login_route() -> FileResponse:
    return FileResponse(frontend_dir / "login.html")


@app.get("/login.html", include_in_schema=False)
async def serve_login_html() -> FileResponse:
    return FileResponse(frontend_dir / "login.html")


@app.get("/onboarding", include_in_schema=False)
async def serve_onboarding_route() -> FileResponse:
    return FileResponse(frontend_dir / "onboarding.html")


@app.get("/onboarding.html", include_in_schema=False)
async def serve_onboarding_html() -> FileResponse:
    return FileResponse(frontend_dir / "onboarding.html")


@app.get("/dashboard", include_in_schema=False)
async def serve_dashboard_route() -> FileResponse:
    return FileResponse(frontend_dir / "dashboard.html")


@app.get("/dashboard.html", include_in_schema=False)
async def serve_dashboard_html() -> FileResponse:
    return FileResponse(frontend_dir / "dashboard.html")


@app.get("/health", include_in_schema=False)
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name}
