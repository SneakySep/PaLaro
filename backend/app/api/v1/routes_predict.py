from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.predictor import (
    FeatureMismatchError,
    ModelNotReadyError,
    PredictionResponse,
    PredictRequest,
    predict,
)

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

