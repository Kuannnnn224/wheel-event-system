# Wheel Event System

First-version wheel event system with two independent npm projects:

- `backend/`: NestJS + TypeORM + MySQL API
- `frontend/`: React + Vite + Ant Design admin console

## Local Setup

1. Install root helper dependencies:

```bash
npm install
```

2. Start MySQL:

```bash
npm run db
```

3. Install app dependencies:

```bash
cd backend
cp .env.example .env
npm install

cd ../frontend
cp .env.example .env
npm install
```

4. Start backend and frontend together from the repository root:

```bash
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`.
Backend runs at `http://127.0.0.1:3001`.
Local dev logs should stay under `logs/`; generated `.log` files are ignored by Git.

Default backend admin login:

- username: `admin`
- password: `admin123`

Change these in `backend/.env` before using real data.

## Business Rules

- Business dates are formatted as `YYYY-MM-DD` in the `Asia/Taipei` timezone.
- A player has one daily progress row per business date.
- Turnover unlocks five stages by configured cumulative thresholds.
- Real spins must be played in order from stage 1 to stage 5.
- Each player can play each stage at most once per business date.
- Probability configuration lives in `backend/config/probability.json`, not MySQL.
- The JSON file is read on demand, so parser/manual changes can be hot-loaded without restarting the backend.
- XLSX imports output the same JSON shape used by the runtime probability service.
- Bulk simulations are in-memory one-off jobs and do not write real player records.

## Probability XLSX Import

PM source sheets can be converted into the hot-loaded JSON config:

```bash
npm run probability:import -- C:\path\to\source
```

The source directory currently uses these files:

- `config.xlsx`: stage turnover thresholds and A-E prize names/amounts.
- `weight.xlsx`: per-stage low/high table split weights.
- `low.xlsx`: A-E weights for the low table.
- `high.xlsx`: A-E weights for the high table.

The command writes `backend/config/probability.json` by default. `prize.xlsx` and `daily-limit.xlsx` are kept as source material but are not wired into the first low/high draw flow until their business rules are confirmed.
Admin uploads are saved under `storage/probability-imports/` so PMs can download the original zip later. Runtime storage files are ignored by Git.
