from __future__ import annotations

from fastapi import FastAPI

from app.routers import assessment_router, health_router


def create_app() -> FastAPI:
    app = FastAPI(title="MilestoneMind AI Service", version="0.1.0")
    app.include_router(health_router)
    app.include_router(assessment_router)
    return app


app = create_app()
