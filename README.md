# 🏀 PaLaro — NBA Game Prediction SaaS

A production-grade, full-stack platform that predicts NBA game outcomes using
**XGBoost**, served by **FastAPI**, with a minimal **Next.js + Tailwind CSS**
frontend and **PostgreSQL** storage.

## Stack

| Layer         | Technology                                                          |
| ------------- | ------------------------------------------------------------------- |
| ML / Data     | Python, Pandas, Scikit-Learn, XGBoost (PyTorch planned)             |
| API           | FastAPI (Uvicorn)                                                   |
| Frontend      | Next.js (App Router) + Tailwind CSS + Framer Motion + TanStack Query|
| Database      | PostgreSQL 16 (Docker)                                              |
| Data ingestion| `nba_api` (stats.nba.com); provider abstraction for API-NBA/Sportradar |

## Monorepo Layout

```
PaLaro/
├── backend/
│   ├── app/            # FastAPI app (API, DB, services)
│   ├── ml/             # trainer, inference wrapper, model artifacts
│   ├── data_pipeline/  # ingestion + feature engineering
│   ├── tests/
│   └── scripts/        # ingest.py, train.py, evaluate.py
├── frontend/           # Next.js + Tailwind
├── docker-compose.yml  # PostgreSQL
└── Makefile            # dev shortcuts
```

## Quick Start (Windows PowerShell)

```powershell
# 1. Database (requires Docker)
docker compose up -d db

# 2. Backend
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` (frontend) and `http://localhost:8000/docs` (API).

Makefile shortcuts: `make db-up`, `make backend-run`, `make frontend-run`.

## Roadmap

1. Skeleton end-to-end (FastAPI ↔ Next.js wiring) ✅
2. DB schema + Alembic migrations
3. Historical ingestion via `nba_api`
4. Feature engineering (rolling, advanced metrics, contextual)
5. XGBoost training + evaluation
6. Prediction API + confidence intervals
7. Minimal animated UI
8. Live data providers + user accounts

## Prerequisites

- Node.js 18+ / 20+ (v24 used here)
- Python 3.11 / 3.12 recommended (XGBoost wheels). Python 3.14 may require a
  source build for the ML stack.
- Docker Desktop (for PostgreSQL)
