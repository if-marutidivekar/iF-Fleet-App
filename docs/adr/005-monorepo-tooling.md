# ADR 005 — Monorepo Tooling

**Date:** 2026-04-08
**Status:** Accepted

## Decision

| Tool | Choice | Reason |
|------|--------|--------|
| Monorepo manager | **Turborepo** | Build caching, task orchestration, incremental builds, simple config |
| Package manager | **pnpm** | Workspace support, fast installs, strict dependency isolation |
| Language | **TypeScript (strict)** | Shared types across packages eliminate API contract drift |
| API framework | **NestJS** | Module structure, DI, TypeScript-first, WebSocket + REST + cron in one |
| ORM | **Prisma** | Migration tracking, type-safe queries, schema-as-code |
| Web build | **Vite** | Fast HMR, ESM-native, simple config |
| Mobile | **Expo (managed → bare)** | Fastest cross-platform start; eject when native modules need it |
| Testing | **Vitest** (unit + API), **Detox** (mobile E2E) | Vitest: fast, compatible with TS; Detox: real device smoke |
| Linting | **ESLint + Prettier + Husky** | Pre-commit enforcement |

## Package structure

```
packages/domain       — TypeScript enums, interfaces, state machines (shared)
packages/api-contracts — OpenAPI spec + generated TS types (shared)
packages/ui           — Shared component library (Phase 1+: seed it early)
apps/api              — NestJS backend
apps/web              — React + Vite
apps/mobile           — Expo React Native
apps/worker           — Background jobs (NestJS or standalone Node)
```

## Consequences

- All packages are TypeScript — no JavaScript files in shared packages.
- Turborepo cache is stored in `.turbo/` (gitignored).
- pnpm workspace protocol (`workspace:*`) links internal packages.
- Monorepo root `tsconfig.base.json` sets `strict: true` as the baseline.
