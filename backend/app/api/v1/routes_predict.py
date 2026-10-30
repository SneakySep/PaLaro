from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PredictionResponse(BaseModel):
    """Shape the frontend expects for a game prediction."""

    game_id: str
    home_team: str
    away_team: str
    home_win_prob: float  # 0..1
    confidence_interval: list[float]  # [lower, upper] on home_win_prob
    model_version: str


@router.get("/predict/health")
def predict_health() -> dict:
    """Placeholder health probe for the prediction service."""
    return {"status": "ok", "service": "predict"}
