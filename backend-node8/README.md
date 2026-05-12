# Node 8 Backend Skeleton

This folder is a parallel Node 8.17-compatible runtime target. It is intentionally separate from `backend/` so the current NestJS implementation remains available as the behavior reference.

Current skeleton status:

- Express app bootstrapping.
- `/health` and `/api/health`.
- Node 8-safe config loader.
- Class-based container, repository, service, controller, and route registry wiring.
- Async/await MySQL pool, query helper, and transaction helper.
- Startup admin seed from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- Implemented `POST /auth/login`, returning the same `{ accessToken, admin }` shape as the NestJS backend.
- Implemented protected `GET /players` and `GET /players/:id/daily-progress`.
- Implemented protected `GET /probability/config` and `GET /probability/stages`.
- Implemented protected `POST /spins/simulate` with the file-backed probability config parser.
- Implemented demo token, real spin, award overrides, reports, simulations, and probability import endpoints.
- JWT admin middleware and platform API key middleware.
- Full current API route manifest.
- Static serving hooks for prebuilt `frontend/dist` and `frontend/public`.
- Schema reference SQL for the existing tables.

Install dependencies with a Node 8/npm 6 environment before validating runtime behavior:

```powershell
cd backend-node8
npm install
npm start
```

Default admin credentials follow the current NestJS defaults unless overridden:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

The frontend should still be built outside the production Node 8 server, using the existing `frontend/` Vite setup on Node 18+.
