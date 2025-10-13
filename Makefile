.PHONY: help install dev build deploy down logs clean migrate test

# Default target
help:
	@echo "Integrador Waha-Typebot - Available commands:"
	@echo ""
	@echo "  make install     - Install dependencies for API and Web"
	@echo "  make dev         - Run development servers (API + Web)"
	@echo "  make build       - Build Docker images"
	@echo "  make deploy      - Deploy to Docker Swarm"
	@echo "  make down        - Remove stack from Docker Swarm"
	@echo "  make logs        - Show logs from Docker Swarm services"
	@echo "  make migrate     - Run database migrations"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Clean node_modules and build artifacts"
	@echo ""

# Install dependencies
install:
	@echo "Installing API dependencies..."
	cd api && npm install
	@echo "Installing Web dependencies..."
	cd web && npm install
	@echo "Generating Prisma client..."
	cd api && npx prisma generate

# Development
dev:
	@echo "Starting development servers..."
	@echo "API will run on http://localhost:3000"
	@echo "Web will run on http://localhost:5173"
	@make -j2 dev-api dev-web

dev-api:
	cd api && npm run dev

dev-web:
	cd web && npm run dev

# Build Docker images
build:
	@echo "Building Docker images..."
	docker build -t integrador-api:latest ./api
	docker build -t integrador-web:latest ./web

# Deploy to Docker Swarm
deploy:
	@echo "Deploying to Docker Swarm..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found. Copy .env.example to .env and configure it."; \
		exit 1; \
	fi
	docker stack deploy -c stack.yml integrador

# Remove from Docker Swarm
down:
	@echo "Removing stack from Docker Swarm..."
	docker stack rm integrador

# Show logs
logs:
	@echo "Showing logs (Ctrl+C to exit)..."
	docker service logs -f integrador_integrador_api

logs-web:
	docker service logs -f integrador_integrador_web

logs-db:
	docker service logs -f integrador_integrador_db

# Database migrations
migrate:
	@echo "Running database migrations..."
	cd api && npm run migrate

migrate-dev:
	@echo "Running database migrations (dev)..."
	cd api && npm run migrate:dev

# Tests
test:
	@echo "Running API tests..."
	cd api && npm test

# Clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf api/node_modules api/dist
	rm -rf web/node_modules web/dist
	@echo "Clean complete"

# Status
status:
	@echo "Docker Swarm services status:"
	docker stack ps integrador

# Update
update: build deploy
	@echo "Update complete"
