# Agent Guide

## Project Shape

This repository contains two independent npm projects:

- `backend/`: NestJS API, TypeORM, MySQL
- `frontend/`: React, Vite, Ant Design admin console

Keep root-level files limited to project docs, environment examples, Docker setup, and cross-project guidance.

## Core Business Rules

- Business dates use `YYYY-MM-DD` in the configured business timezone.
- Backend `BUSINESS_TIME_ZONE` is optional; leave it empty to use the server/runtime local timezone.
- The activity is a daily five-stage wheel.
- Player turnover unlocks stages by cumulative daily thresholds.
- A player can play each stage at most once per business date.
- Real spins must be sequential: stage 1 before stage 2, and so on.
- If a player reaches the max turnover threshold in one adjustment, all five stages unlock, but play order still applies.
- Amounts and turnover are integer points.
- Probability configs live in `backend/config/probability.json`, not MySQL.
- Probability JSON is read on demand so PM/parser updates can hot-load without a backend restart.
- XLSX parser output must keep the same JSON shape rather than changing runtime draw logic.
- Current XLSX import uses `config.xlsx`, `weight.xlsx`, `low.xlsx`, `high.xlsx`, and `prize.xlsx`; `daily-limit.xlsx` is a source file reserved for future rules until the business meaning is confirmed.
- Probability configs do not carry enabled/disabled flags; set the relevant weights to `0` when a stage split or prize should stop being selected.
- Admin award overrides use the `prize` probability table for the selected player/stage on the current business date only; pending rules from past dates must not affect today's real spins.
- Uploaded PM probability zip files are stored under `storage/probability-imports/` for later PM download and are ignored by Git.
- Bulk simulations are one-off in-memory jobs and must not write real player spin records.

## Backend Boundaries

NestJS modules are split by business ownership:

- `auth`: admin login and JWT concerns.
- `players`: player lookup and daily progress read model.
- `turnover`: admin/platform turnover adjustments and progress updates.
- `probability`: JSON probability config loading, stage thresholds, low/high table split, weighted draw logic.
- `probability-imports`: PM zip upload/download, XLSX parsing, import diff preview, and applying imported JSON configs.
- `award-overrides`: admin指定派獎 rules, pending/cancel/consume lifecycle, and current-day rule lookup for real spins.
- `spins`: real spin and single-spin simulation orchestration.
- `reports`: player and daily aggregate queries.
- `simulations`: large async simulation jobs.
- `demo-token`: demo player session creation and short-lived webview tokens.

Do not mix unrelated business logic into a module just because it is convenient. Shared pure business rules belong under `backend/src/domain`.

## Frontend Boundaries

The admin console uses sidebar routes:

- `/spin-simulator`: single simulated spin, no DB writes.
- `/players`: player lookup, daily progress, admin turnover adjustment.
- `/award-overrides`: admin指定派獎 creation, pending list, and cancellation.
- `/reports`: daily and player reports.
- `/bulk-simulation`: async large simulation jobs with polling.
- `/demo`: create player/demo token/webview URL.
- `/probability`: view/edit the JSON-backed stage thresholds, low/high/prize weights, and A-E prize settings.

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
npm run probability:import -- <xlsx-source-dir>
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
- Keep local dev server logs under `logs/`; generated `.log` files are ignored.
- First-version TypeORM uses `synchronize=true` for local development only. Use migrations before production use.
- The webview HTML is intentionally not implemented yet. Preserve `POST /demo/session` and `POST /spins/real` as the future integration points.
- Do not add DB tables for probability settings unless explicitly requested. Probability data belongs in JSON generated from XLSX.
- Keep parser/upload/download code in `probability-imports`; `probability` should stay focused on runtime probability config and draw behavior.
- Import PM probability sheets with `npm run probability:import -- <xlsx-source-dir>`; the command writes `backend/config/probability.json` unless an output path is provided.

## Commit Discipline

- Commit after each meaningful, complete feature/fix/refactor slice.
- Use Conventional Commits with English type and Chinese subject/body, such as `feat: 新增階段獎勵預覽`, `fix: 移除重複頁面標題`, `docs: 補充本機啟動說明`.
- Keep commit messages specific to the actual change; do not use vague messages like `update`, `changes`, `misc`, or `調整`.
- Add a short Chinese commit body when useful, especially for behavior changes, testing notes, or follow-up constraints.
- Before committing, check `git status` and avoid staging unrelated user changes.
- Prefer one coherent commit per completed user-facing or backend behavior change.
