#!/usr/bin/env bash
# ─── iF Fleet — Production Deploy Script ──────────────────────────────────────
#
# Usage (run from monorepo root):
#   bash infra/scripts/deploy.sh [OPTIONS]
#
# Options:
#   --obtain-cert   Obtain / renew Let's Encrypt TLS certificate (run on first
#                   deploy or when cert expires). Temporarily binds port 80.
#   --build-only    Build Docker images but do not start services.
#   --no-build      Skip image build; use existing local images (fast redeploy).
#   --seed          Run the database seed after migrations (first deploy only).
#   --down          Tear down all running services before bringing up.
#
# Typical first deploy:
#   bash infra/scripts/deploy.sh --obtain-cert --seed
#
# Typical redeploy after code change:
#   bash infra/scripts/deploy.sh
#
# Requirements:
#   - Docker + Docker Compose v2 installed
#   - infra/docker/.env.prod exists (copy from .env.prod.template and fill in)
#   - Port 80 and 443 reachable from the internet (for TLS + serving)

set -euo pipefail

# Resolve monorepo root regardless of where the script is called from
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod"
ENV_FILE="infra/docker/.env.prod"
DOMAIN="fleet.ideaforgetech.com"

# ── Colour output ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}>>>  $*${NC}"; }
warn()  { echo -e "${YELLOW}WARN $*${NC}"; }
error() { echo -e "${RED}ERR  $*${NC}" >&2; exit 1; }

# ── Parse flags ───────────────────────────────────────────────────────────────
OBTAIN_CERT=false; BUILD_ONLY=false; NO_BUILD=false; SEED=false; TAKE_DOWN=false

for arg in "$@"; do
  case $arg in
    --obtain-cert) OBTAIN_CERT=true ;;
    --build-only)  BUILD_ONLY=true ;;
    --no-build)    NO_BUILD=true ;;
    --seed)        SEED=true ;;
    --down)        TAKE_DOWN=true ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || error "$ENV_FILE not found. Copy infra/docker/.env.prod.template to $ENV_FILE and fill in values."
command -v docker > /dev/null || error "docker not found. Install Docker first."
docker compose version > /dev/null 2>&1 || error "Docker Compose v2 not found."

# Warn if .env.prod still has placeholder values
grep -q "CHANGE_ME" "$ENV_FILE" && warn "Found CHANGE_ME placeholders in $ENV_FILE — replace all before going live."

# ── Optional: obtain TLS certificate via certbot standalone ───────────────────
if [ "$OBTAIN_CERT" = true ]; then
  info "Obtaining Let's Encrypt certificate for $DOMAIN"
  info "Stopping nginx (port 80 must be free for certbot standalone challenge)"
  $COMPOSE stop nginx 2>/dev/null || true

  docker run --rm \
    -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    certbot/certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "admin@ideaforgetech.com" \
      -d "$DOMAIN"

  info "Certificate obtained at /etc/letsencrypt/live/$DOMAIN/"
fi

# ── Optional: tear down first ─────────────────────────────────────────────────
if [ "$TAKE_DOWN" = true ]; then
  info "Tearing down existing services..."
  $COMPOSE down --remove-orphans
fi

# ── Build images ──────────────────────────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  info "Building Docker images (api + web)..."
  $COMPOSE build --no-cache api web-app
  info "Build complete."
fi

[ "$BUILD_ONLY" = true ] && info "Build-only mode — done." && exit 0

# ── Start infrastructure ──────────────────────────────────────────────────────
info "Starting postgres + redis..."
$COMPOSE up -d postgres redis

info "Waiting for PostgreSQL to be healthy..."
POSTGRES_USER="${POSTGRES_USER:-fleet_user}"
POSTGRES_DB="${POSTGRES_DB:-fleet_db}"
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
    info "PostgreSQL ready."
    break
  fi
  [ "$i" -eq 30 ] && error "PostgreSQL did not become healthy within 60 seconds."
  sleep 2
done

# ── Seed (first deploy only) ──────────────────────────────────────────────────
if [ "$SEED" = true ]; then
  info "Running database seed (first-deploy only)..."
  $COMPOSE run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy && npx ts-node prisma/seed.ts"
  info "Seed complete."
fi

# ── Start all services ────────────────────────────────────────────────────────
info "Starting all services..."
$COMPOSE up -d

# ── Wait for API health ───────────────────────────────────────────────────────
info "Waiting for API to become healthy..."
for i in $(seq 1 40); do
  if $COMPOSE exec -T api curl -sf http://localhost:3001/api/v1/health > /dev/null 2>&1; then
    info "API is healthy."
    break
  fi
  [ "$i" -eq 40 ] && error "API did not become healthy within 80 seconds. Check: docker compose logs api"
  sleep 2
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}┌──────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  iF Fleet deployed successfully                   │${NC}"
echo -e "${GREEN}│  https://$DOMAIN          │${NC}"
echo -e "${GREEN}│  API health: https://$DOMAIN/api/v1/health │${NC}"
echo -e "${GREEN}└──────────────────────────────────────────────────┘${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:     docker compose -f infra/docker/docker-compose.prod.yml logs -f api"
echo "  Status:        docker compose -f infra/docker/docker-compose.prod.yml ps"
echo "  DB backup:     bash infra/scripts/backup.sh"
echo "  Smoke test:    bash infra/scripts/smoke-test.sh https://$DOMAIN/api/v1"
echo ""
