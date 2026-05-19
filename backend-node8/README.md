# Node 8 Formal App API Runtime

This folder is the Node 8.17-compatible runtime for the formal App/Webview integration branch.

The public API surface is intentionally small:

```text
GET  /health
GET  /api/health
POST /api/webview/sessions
GET  /api/webview/game-config
GET  /api/webview/sessions/current?token=<token>
POST /api/spins/real
```

`POST /api/webview/sessions` is the opening API: the App client sends `playerId`, `turnoverPoints`, and `unlockedStage`; this service signs a token and returns `webviewUrl`. The webview then continues with current state and real spin APIs.

Detailed payload examples are in [docs/WEBVIEW_APP_API.md](docs/WEBVIEW_APP_API.md).

## Runtime Setup

Use Node 8.17 and npm 6 on the production-like server.

```powershell
cd backend-node8
copy .env.example .env
npm install
npm start
```

The backend reads `backend-node8/.env`. Relative paths such as `PROBABILITY_CONFIG_PATH=config/probability.json` are resolved from `backend-node8/`.

Important webview settings:

```text
WEBVIEW_BASE_URL=https://your-static-host.example/webview.html
WEBVIEW_API_BASE_URL=https://your-api-host.example/api
WEBVIEW_TOKEN_SECRET=change-this-webview-token-secret
WEBVIEW_SESSION_TTL_MINUTES=30
```

When `WEBVIEW_API_BASE_URL` is an absolute HTTP(S) URL, generated webview links include it as the `apiBase` query parameter. Keep `WEBVIEW_API_BASE_URL=/api` when the built webview is served by this Express backend on the same origin.

## Database

The formal App integration runtime only needs:

- `spinRecords`
- `awardOverrideRules`

The latest schema baseline is [src/db/schema.sql](src/db/schema.sql), with a duplicate handoff copy at [src/db/db.sql](src/db/db.sql).

This runtime does not maintain:

- player master table
- player daily progress table
- webview session table
- admin user table

`playerId` is stored directly as the platform player ID. The App remains the source of formal player data.

## Useful Checks

```powershell
npm run check
npm run smoke:offline
npm run test:probability-model
npm run check:db
npm run smoke:http
```

`smoke:offline` does not connect to MySQL. `smoke:http` connects to MySQL, starts Express on a temporary localhost port, creates a webview URL/token, checks current state, reads game config, and shuts down.

If static frontend assets need to change later, rebuild them outside this runtime package and replace the files in `backend-node8/public`. The Node 8 server should only run built assets.
