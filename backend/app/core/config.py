from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / backend/.env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PaLaro API"
    version: str = "0.1.0"

    # Database — must be set via DATABASE_URL in .env
    database_url: str

    # CORS — restrict to known origins; set via CORS_ORIGINS in .env
    cors_origins: list[str] = []

    # ML
    model_version: str = "0.1.0"
    model_artifact_path: str = "ml/model_artifacts/xgb_model.ubj"
    feature_columns_path: str = "ml/model_artifacts/feature_columns.json"

    # nba_api
    nba_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
