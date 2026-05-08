# Agent Guide

## Project Shape

This repository contains two independent npm projects:

- `backend/`: NestJS API, TypeORM, MySQL
- `frontend/`: React, Vite, Ant Design admin console

Keep root-level files limited to project docs, environment examples, Docker setup, and cross-project guidance.

## Core Business Rules

- Business dates use `YYYY-MM-DD` in `Asia/Taipei`.
- The activity is a daily five-stage wheel.
- Player turnover unlocks stages by cumulative daily thresholds.
- A player can play each stage at most once per business date.
- Real spins must be sequential: stage 1 before stage 2, and so on.
- If a player reaches the max turnover threshold in one adjustment, all five stages unlock, but play order still applies.
- Amounts and turnover are integer points.
- Probability configs live in `backend/config/probability.json`, not MySQL.
- Probability JSON is read on demand so PM/parser updates can hot-load without a backend restart.
- Future XLSX parser work should output the same JSON shape rather than changing runtime draw logic.
- Bulk simulations are one-off in-memory jobs and must not write real player spin records.

## Backend Boundaries

NestJS modules are split by business ownership:

- `auth`: admin login and JWT concerns.
- `players`: player lookup and daily progress read model.
- `turnover`: admin/platform turnover adjustments and progress updates.
- `probability`: JSON probability config loading, stage thresholds, low/high table split, weighted draw logic.
- `spins`: real spin and single-spin simulation orchestration.
- `reports`: player and daily aggregate queries.
- `simulations`: large async simulation jobs.
- `demo-token`: demo player session creation and short-lived webview tokens.

Do not mix unrelated business logic into a module just because it is convenient. Shared pure business rules belong under `backend/src/domain`.

## Frontend Boundaries

The admin console uses sidebar routes:

- `/spin-simulator`: single simulated spin, no DB writes.
- `/players`: player lookup, daily progress, admin turnover adjustment.
- `/reports`: daily and player reports.
- `/bulk-simulation`: async large simulation jobs with polling.
- `/demo`: create player/demo token/webview URL.
- `/probability`: view/edit the JSON-backed stage thresholds, low/high split, and A-E prize weights.

Keep API calls in `frontend/src/api` when shared across pages. Page-specific request code may stay inside the page until it is reused.

## Local Commands

Root:

```bash
npm install
npm run db
npm run dev
npm run lint
npm run test
npm run build
```

Backend:

```bash
cd backend
npm install
npm run start:dev
npm run test
npm run lint
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run test
npm run lint
```

MySQL:

```bash
docker compose up -d
```

## Implementation Notes

- Keep TypeScript strictness meaningful; avoid `any` unless integrating unknown external payloads.
- Add focused tests around business rules before changing stage unlock, weighted draw, or real spin validation behavior.
- Do not commit `.env`, `node_modules`, `dist`, or generated coverage.
- First-version TypeORM uses `synchronize=true` for local development only. Use migrations before production use.
- The webview HTML is intentionally not implemented yet. Preserve `POST /demo/session` and `POST /spins/real` as the future integration points.
- Do not add DB tables for probability settings unless explicitly requested. Probability data belongs in JSON generated from XLSX.

## Commit Discipline

- Commit after each meaningful, complete feature/fix/refactor slice.
- Use Conventional Commits, such as `feat: add stage reward preview`, `fix: remove duplicate page title`, `docs: document local startup`.
- Keep commit messages specific to the actual change; do not use vague messages like `update`, `changes`, or `misc`.
- Add a short commit body when useful, especially for behavior changes, testing notes, or follow-up constraints.
- Before committing, check `git status` and avoid staging unrelated user changes.
- Prefer one coherent commit per completed user-facing or backend behavior change.
