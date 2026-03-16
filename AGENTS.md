# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Account Mall is a self-hosted digital goods auto-delivery platform (卡密自动发卡平台). The main service is a **Next.js 16 App Router** application backed by **PostgreSQL 17** (via Docker).

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL | `sudo docker compose up -d db` | 5433 (host) → 5432 (container) |
| Next.js dev server | `npm run dev` | 3000 |

### Key commands

Standard commands are documented in `README.md` and `claude.md`. Quick reference:

- **Lint**: `npm run lint`
- **Tests (unit)**: `npm test` (Jest, 70 suites, ~870 tests; uses mocks, no DB needed)
- **Dev server**: `npm run dev`
- **DB migrations**: `npx prisma migrate deploy` (use `deploy` for non-interactive; `npm run db:migrate` uses interactive `dev` mode)
- **DB seed**: `npm run db:seed` (creates admin: `admin@example.com` / `admin123456`)
- **E2E tests**: `npm run test:e2e` (Playwright; requires running dev server + DB with `SEED_E2E=1 npm run db:seed`)

### Non-obvious caveats

- **Docker required**: PostgreSQL runs via Docker Compose. Docker must be installed and the daemon running (`sudo dockerd`) before `docker compose up -d db`.
- **`postinstall` needs DATABASE_URL**: `npm install` triggers `prisma generate` via `postinstall`, which requires either `DATABASE_URL` or `POSTGRES_*` env vars to be set in `.env`. Always set up `.env` before running `npm install`.
- **Use `prisma migrate deploy` for non-interactive migrations**: The `npm run db:migrate` script uses `prisma migrate dev` which prompts interactively. For CI/automation, use `npx prisma migrate deploy` instead.
- **Lint has pre-existing warnings/errors**: The codebase currently has ~25 lint errors and ~38 warnings (mostly in test files). These are pre-existing and not caused by setup.
- **Admin credentials**: Default admin account seeded by `npm run db:seed` — email: `admin@example.com`, password: `admin123456`. Configured via `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`.
- **BETTER_AUTH_SECRET**: Must be at least 32 characters. Required for the app to start.
- **Docker in nested containers**: This cloud VM environment requires `fuse-overlayfs` storage driver and `iptables-legacy` for Docker to work. These are already configured in the VM snapshot.
