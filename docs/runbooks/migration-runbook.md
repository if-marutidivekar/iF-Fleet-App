# DB Migration Runbook

## Pre-migration checklist
- [ ] Backup completed (`bash infra/scripts/backup.sh`)
- [ ] Rollback manifest from previous release is ready
- [ ] New docker images are built and pushed to registry
- [ ] Staging is not in active UAT session

## Run migration

```bash
# 1. Pull latest compose manifest
git pull origin develop

# 2. Back up current database
bash infra/scripts/backup.sh ./backups

# 3. Deploy new images (without restarting api yet)
IMAGE_TAG=<new_tag> docker compose -f infra/docker/docker-compose.staging.yml pull

# 4. Run migrations via a one-shot container (never auto-run on api startup)
docker compose -f infra/docker/docker-compose.staging.yml run --rm api \
  sh -c "cd apps/api && node -e \"require('./dist/main')\" prisma migrate deploy"

# OR using pnpm in source tree:
# pnpm --filter @if-fleet/api db:migrate

# 5. Check migration output — confirm no errors before proceeding

# 6. Restart api and worker with new images
IMAGE_TAG=<new_tag> docker compose -f infra/docker/docker-compose.staging.yml up -d api worker

# 7. Run smoke tests
bash infra/scripts/smoke-test.sh http://staging-fleet-api.internal/api/v1
```

## Rollback procedure

```bash
# 1. Roll api and worker back to previous image tag
IMAGE_TAG=<previous_tag> docker compose -f infra/docker/docker-compose.staging.yml up -d api worker

# 2. If schema was changed: restore from backup
docker exec -i <postgres_container> psql -U fleet_user fleet_db < backups/fleet_db_<timestamp>.sql

# 3. Confirm health
bash infra/scripts/smoke-test.sh http://staging-fleet-api.internal/api/v1
```

## Notes
- Never run `prisma migrate dev` against staging — use `migrate deploy` only.
- Migration output is logged to stdout — check Grafana/Loki for errors.
- Each release must include a `RELEASE_NOTES.md` listing schema changes and new env vars.
