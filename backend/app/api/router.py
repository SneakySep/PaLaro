from fastapi import APIRouter

from app.api.v1 import routes_games, routes_model, routes_predict, routes_teams

api_router = APIRouter()
api_router.include_router(routes_predict.router, prefix="/v1", tags=["predict"])
api_router.include_router(routes_games.router, prefix="/v1", tags=["games"])
api_router.include_router(routes_teams.router, prefix="/v1", tags=["teams"])
api_router.include_router(routes_model.router, prefix="/v1", tags=["model"])
