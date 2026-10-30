# PaLaro dev shortcuts (Windows PowerShell has `make` via chocolatey/minGW;
# if absent, run the commands directly — see README)

.PHONY: help db-up db-down db-logs backend-install backend-run frontend-install frontend-run setup

help:
	@echo "Available targets: db-up, db-down, db-logs, backend-install, backend-run, frontend-install, frontend-run"

# ---------- Database ----------
db-up:
	docker compose up -d db

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

# ---------- Backend ----------
backend-install:
	cd backend && .venv\Scripts\python.exe -m pip install --upgrade pip && .venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt

backend-run:
	cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# ---------- Frontend ----------
frontend-install:
	cd frontend && npm install

frontend-run:
	cd frontend && npm run dev

# ---------- All-in-one first-time setup ----------
setup: db-up backend-install frontend-install
	@echo "Now run: make backend-run  (terminal 1) and  make frontend-run  (terminal 2)"
