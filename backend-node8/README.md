# Node 8 Backend Skeleton

This folder is a parallel Node 8.17-compatible runtime target. It is intentionally separate from `backend/` so the current NestJS implementation remains available as the behavior reference.

Current skeleton status:

- Express app bootstrapping.
- `/health` and `/api/health`.
- Node 8-safe config loader.
- MySQL pool and transaction helper.
- JWT and platform API key middleware placeholders.
- Full current API route manifest returning `501 Not Implemented`.
- Static serving hooks for prebuilt `frontend/dist` and `frontend/public`.
- Schema reference SQL for the existing tables.

Install dependencies with a Node 8/npm 6 environment before validating runtime behavior:

```powershell
cd backend-node8
npm install
npm start
```

The frontend should still be built outside the production Node 8 server, using the existing `frontend/` Vite setup on Node 18+.
