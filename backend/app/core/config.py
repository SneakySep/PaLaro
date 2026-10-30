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

    # Database — matches docker-compose defaults
    database_url: str = (
        "postgresql+psycopg://palaro:palaro_dev@localhost:5432/palaro"
    )

    # CORS — allow the Next.js dev server
    cors_origins: list[str] = ["http://localhost:3000"]

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
