from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title=settings.app_name, version=settings.version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.include_router(api_router, prefix="/api")

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "app": settings.app_name, "version": settings.version}

    return app


app = create_app()
