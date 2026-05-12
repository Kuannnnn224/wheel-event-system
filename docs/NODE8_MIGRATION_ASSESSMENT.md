# Node 8.17 遷移評估

## 結論

目前專案不能直接部署到 Node 8.17。主要阻礙不是單一框架啟動問題，而是後端、前端 build tool、ORM、語法與 lockfile 都已經以現代 Node 版本為基準。

建議方向是：

- 正式機後端改為 Node 8 可執行的 Express + CommonJS + raw SQL。
- 後控前端保留 React/Vite，但只在開發機或 CI 使用 Node 18+ build。
- 正式機只部署 Express API 與已 build 好的靜態前端檔案。
- 現階段先不要覆蓋既有 NestJS backend，應建立平行 Node 8 runtime，方便比對與回退。

## 為什麼現有架構不能直接跑 Node 8

### 後端框架與 ORM

現有 backend 是 NestJS 10 + TypeORM 0.3：

- `@nestjs/cli` 目前 lockfile 版本要求 Node `>= 16.14`。
- `typeorm@0.3.x` 目前 lockfile 版本要求 Node `>= 16.13.0`。
- NestJS runtime 依賴 decorator metadata、DI container、modern TypeScript 編譯輸出與較新的生態版本，不適合硬壓到 Node 8。
- TypeORM 0.3 的 DataSource、repository API、schema synchronize 也不是 Node 8 友善選擇。

就算把 TypeScript target 調低，也不能保證第三方套件本身在 Node 8 可安裝、可解析、可執行。

### 前端 build tool

現有 frontend 是 React + Vite 6：

- `vite@6` 要求 Node `18+`。
- `esbuild` 目前 lockfile 版本要求 Node `>=18`。
- `vitest` 也要求 Node `18+`。

因此正式機不能跑 `npm --prefix frontend run dev` 或 `npm --prefix frontend run build`。但前端 build 後是靜態檔，所以可以在新 Node 環境 build，再把 `dist` 放到正式機給 Express serve。

### 語法與 Node API

目前程式碼使用多個 Node 8 不支援的語法或 API，例如：

- optional chaining：`value?.field`
- nullish coalescing：`value ?? fallback`
- `fs/promises`
- `crypto.randomUUID`
- `Object.fromEntries`
- TypeScript decorators 與 ES module imports

這些可以透過 transpile 解一部分，但 Node 8 backend 若要穩定，建議直接用 CommonJS 與 Node 8 原生可執行語法寫 runtime。

### npm lockfile

目前 root、backend、frontend 都是 `package-lock.json` lockfile v3。Node 8 常見搭配 npm 6，npm 6 不適合直接使用 v3 lockfile。Node 8 runtime 若要獨立部署，應有自己的 `package-lock.json`，並用相容版本的 npm 產生。

## 建議目標架構

### Runtime 分工

正式機 Node 8.17 只負責：

- Express API server。
- 連 MySQL。
- 讀寫機率 JSON 與 ZIP 上傳檔。
- serve 已 build 的 React 靜態檔。
- serve `frontend/public/webview.html` 或對應的 webview 靜態資源。

開發機或 CI Node 18+ 負責：

- 現有 React/Vite 開發與 build。
- 現有測試與型別檢查。
- 產出可部署的 `frontend/dist`。

### 建議新增平行 backend

建議新增獨立目錄，例如：

```text
backend-node8/
  package.json
  package-lock.json
  server.js
  src/
    app.js
    config.js
    db.js
    middleware/
    routes/
    services/
    repositories/
    probability/
    schema.sql
```

不要直接刪除或覆蓋 `backend/`。既有 NestJS 版本可作為行為參考與回歸比對來源。

### Node 8 相容依賴

候選依賴需要逐一 pin 版本並實測 Node 8.17：

- `express@4.x`
- `mysql2` 的 Node 8 可用版本
- `jsonwebtoken@8.x`
- `bcryptjs@2.4.3`
- `multer@1.x`
- `adm-zip` 的 Node 8 可用版本
- `xlsx` 的 Node 8 可用版本
- `dotenv@8.x`
- `cors@2.x`

不建議使用：

- NestJS
- TypeORM 0.3
- Vite/Vitest 在正式機執行
- TypeScript runtime 或 `ts-node`
- ESM-only 套件

## 改寫範圍

### API parity

第一版應保留目前 API contract，讓既有 React 前端與 webview 不需要大改。

需要覆蓋的路由群：

- `POST /auth/login`
- `GET /players`
- `GET /players/:id/daily-progress`
- `GET /probability/config`
- `GET /probability/stages`
- `POST /probability/imports/preview`
- `POST /probability/imports/apply`
- `GET /probability/imports`
- `POST /probability/imports/:uploadId/download-token`
- `GET /probability/imports/download/:token`
- `GET /probability/imports/:uploadId/download`
- `GET /award-overrides`
- `POST /award-overrides`
- `PATCH /award-overrides/:id/cancel`
- `POST /spins/simulate`
- `POST /spins/real`
- `POST /demo/session`
- `POST /demo/admin-session`
- `GET /demo/client-config`
- `GET /demo/session`
- `GET /reports/daily`
- `GET /reports/range`
- `GET /reports/player`
- `POST /simulations`
- `GET /simulations/:id`

### Middleware replacement

NestJS guard 與 decorator 要改成 Express middleware：

- JWT auth middleware：保護後控 API。
- public route allowlist：保留 login、webview spin、demo session、client config、download token 等公開入口。
- platform API key middleware：保護 `POST /demo/session`。
- JSON body、CORS、static file serving、multipart upload 都用 Express middleware 明確掛載。

### Validation replacement

現有 `class-validator` DTO 要改成手寫 validation helper。錯誤 response 應盡量維持前端可讀格式：

```json
{
  "message": "錯誤訊息"
}
```

對於 array 型錯誤，可維持：

```json
{
  "message": ["錯誤一", "錯誤二"]
}
```

前端 `getApiErrorMessage` 已支援這兩種格式。

### Database replacement

TypeORM repository 要改成 raw SQL repository/helper。

重點：

- 使用 `mysql2` connection pool。
- 交易用 `connection.beginTransaction()` / `commit()` / `rollback()`。
- 不使用 synchronize。
- 提供 `schema.sql` 或 migration SQL。
- 明確維持既有 table 與欄位命名。
- `created_at`、`updated_at` 由程式寫入 Unix timestamp 秒數，不依賴 ORM hook。

特別需要 transaction 的流程：

- 建立 demo session 時更新或建立 `player_daily_progress`，再建立 `demo_sessions`。
- 真實抽獎時檢查 token、玩家今日進度、已抽階段、指定派獎、dailyLimit、寫入 `spin_records`，必要時 consume 指定派獎。
- 建立指定派獎時檢查玩家、今日已抽階段、pending duplicate，再批次建立規則。
- 取消或 consume 指定派獎時更新狀態與 timestamp。

## 機率與 dailyLimit 相容要求

Node 8 版必須保留目前機率 JSON 格式：

```json
{
  "version": 1,
  "dailyPayoutLimitPoints": 0,
  "stages": []
}
```

必須保留 parser 行為：

- ZIP 或資料夾內需要 `config.xlsx`、`weight.xlsx`、`low.xlsx`、`high.xlsx`、`prize.xlsx`、`daily-limit.xlsx`。
- `config.xlsx` 的 `門檻設置` sheet 可用 `每日送出上限` 設定 `dailyPayoutLimitPoints`。
- `daily-limit.xlsx` 的 `LV1` 到 `LV5` sheet 提供每階段 A-E 的 `dailyLimitWeight`。
- dailyLimit 判定維持：今日 `spin_records.amount_points` 累計達到 `dailyPayoutLimitPoints` 後，沒有指定派獎的真實抽獎改用 dailyLimit 表。
- 指定派獎仍優先於 dailyLimit。

## 前端部署方式

前端不改成純 HTML/JS。建議保留現有 React 後控：

1. 在開發機或 CI 使用 Node 18+ 執行 `npm --prefix frontend run build`。
2. 把 `frontend/dist` 部署到正式機。
3. Node 8 Express 使用 `express.static()` serve dist。
4. API 掛在 `/api`，讓前端目前預設 `API_BASE_URL = '/api'` 能直接使用。
5. SPA fallback 回傳 `index.html`。

正式機不需要安裝 Vite、Vitest、TypeScript 或 frontend devDependencies。

## 風險

### 高風險

- 全量改寫 backend 後，API 行為可能與 Nest 版本有細節差異。
- TypeORM synchronize 移除後，資料表 schema 必須靠 SQL 明確管理。
- Node 8 已停止維護，套件版本需要 pin，不能依賴最新 npm 生態。
- ZIP/XLSX parser 與上傳下載流程涉及檔案系統，最容易有部署環境差異。

### 中風險

- JWT、CORS、public route allowlist 若漏掉，可能造成登入或 webview API 失效。
- 報表與玩家查詢若 SQL aggregate 邏輯不同，數字可能偏差。
- 多次模擬 job 是 memory registry，重啟會消失，需保留現有語意並清楚標註。

### 低風險

- 純 business rule，例如抽獎順序、stage unlock、weighted picker，可以從現有 TypeScript 邏輯移植成 CommonJS，測試成本相對可控。

## 工時級距

粗估以「熟悉目前專案的人」為基準：

- 評估文件與拆工：0.5 到 1 天。
- Node 8 Express skeleton、config、DB pool、middleware：1 到 2 天。
- raw SQL repository 與 schema SQL：2 到 4 天。
- API route parity：3 到 6 天。
- probability import/upload/download 移植：2 到 4 天。
- 前端 static deploy 整合：0.5 到 1 天。
- 回歸測試、手動驗證、修差異：3 到 6 天。

完整相容版本大約是 2 到 4 週級別，不建議當成小修處理。

## 分階段落地建議

### Phase 1：部署可行性與 skeleton

- 建立 `backend-node8`。
- 確認 Node 8.17 能 `npm install` 並啟動 Express。
- 建立 `/health`、config loader、DB pool、error handler。
- serve frontend dist。

### Phase 2：核心 API

- 實作 auth、JWT middleware、players、demo-token、spins。
- 完成真實抽獎流程與交易。
- 覆蓋 webview 最小閉環：平台建 session、webview 查 session、real spin。

### Phase 3：後控功能

- 實作 probability config、award overrides、reports。
- 保留現有 API response shape，讓 React 後控不改或少改。

### Phase 4：PM ZIP 與機率管理

- 移植 probability imports parser。
- 實作 preview/apply/history/download token。
- 回歸 dailyLimit 與 prize table 行為。

### Phase 5：驗收與切換

- 用同一份 MySQL 測試資料比對 Nest 版與 Node 8 版 API response。
- 建立部署文件與 rollback 程序。
- 正式切換前，先在 staging 用 Node 8.17 跑完整流程。

## 驗收標準

- Node 8.17 可以啟動新 Express backend，無 syntax error。
- 正式機不需要 Vite/Nest/TypeORM。
- React 後控可由 Express 靜態服務開啟並呼叫 `/api`。
- webview 流程完整可用。
- ZIP 匯入後產生的 `probability.json` 與現有 parser 結果一致。
- 真實抽獎、指定派獎、dailyLimit、報表統計與 Nest 版結果一致。

