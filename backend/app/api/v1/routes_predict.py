from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.predictor import (
    FeatureMismatchError,
    ModelNotReadyError,
    PredictionResponse,
    PredictRequest,
    predict,
)
from app.services.upcoming import UpcomingPrediction, upcoming_predictions

router = APIRouter()


@router.get("/predict/health")
def predict_health() -> dict:
    """Health probe for the prediction service."""
    return {"status": "ok", "service": "predict"}


@router.post("/predict", response_model=PredictionResponse)
def predict_game(req: PredictRequest) -> PredictionResponse:
    """Score a game's chance of a home win from its engineered feature vector."""
    try:
        return predict(req)
    except FeatureMismatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/predict/upcoming", response_model=list[UpcomingPrediction])
def predict_upcoming_games(
    days: int = Query(default=7, ge=1, le=14, description="Horizon from today"),
    window: int = Query(default=5, ge=1, le=30, description="Rolling-form window"),
    db: Session = Depends(get_db),
) -> list[UpcomingPrediction]:
    """Score every scheduled game in the next ``days`` days with the trained model.

    Feature vectors are built server-side from each team's recent final games
    (zero-leakage), so no client-side feature computation is needed.
    """
    try:
        return upcoming_predictions(db, days=days, window=window)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

