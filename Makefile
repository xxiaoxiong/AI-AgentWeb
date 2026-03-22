PYTHON ?= python3

.PHONY: api web test lint typecheck

api:
	uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000

web:
	cd apps/web && pnpm dev

test:
	pytest

lint:
	ruff check .
	cd apps/web && pnpm lint

typecheck:
	mypy apps/api tests
	cd apps/web && pnpm typecheck
