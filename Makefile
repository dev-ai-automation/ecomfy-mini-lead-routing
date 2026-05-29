.PHONY: up down build logs test smoke concurrency seed reset

up:          ## Build and start the full stack (db + api + web)
	docker compose up -d --build

down:        ## Stop and remove containers
	docker compose down

build:       ## Build images without starting
	docker compose build

logs:        ## Follow logs
	docker compose logs -f

test:        ## Run the test suite (SQLite, no Docker needed)
	python -m pytest -q

smoke:       ## Run the 8 end-to-end scenarios via curl
	bash scripts/smoke.sh http://localhost:8000

concurrency: ## Prove anti double-charge under parallel load (needs Postgres/Docker)
	python scripts/concurrency_test.py http://localhost:8000

seed:        ## Ingest the 10 fixture leads through the pipeline
	curl -s -X POST http://localhost:8000/dev/seed-leads

reset:       ## Reset demo (fresh buyers + cleared data)
	curl -s -X POST http://localhost:8000/dev/reset
