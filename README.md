# 轉盤活動系統 Node 8 Runtime

這個分支用來模擬 Node 8.17 正式機啟動方式。後端改由 `backend-node8/` 的 Express runtime 啟動；前端 source 保留在 `frontend/` 供較新 Node toolchain build，正式 Node 8 runtime 只吃 `backend-node8/public/` 裡的 build 產物。

- Runtime：`backend-node8/`，Express 4 + CommonJS + raw SQL。
- 前端 source：`frontend/`，React + Vite + TypeScript；不在 Node 8 server 上直接執行。
- 後控頁面：`backend-node8/public/index.html`。
- Webview：`backend-node8/public/webview.html`。
- 機率設定：`backend-node8/config/probability.json`。
- Agent 協作規則：`AGENTS.md`。

## 快速啟動

先安裝 Node 8 runtime 依賴：

```bash
cd backend-node8
copy .env.example .env
npm install
```

啟動 MySQL：

```bash
npm run db
```

從根目錄啟動 Node 8 runtime：

```bash
npm start
```

預設網址：

- 後控前端：`http://127.0.0.1:3001`
- 後端 API：`http://127.0.0.1:3001/api`
- Webview：`http://127.0.0.1:3001/webview.html`

若要讓同事連線，需確認 Windows 防火牆允許 `3001`。

本機預設後控帳號：

- username：`admin`
- password：`admin123`

真實資料環境請務必改掉 `backend-node8/.env` 的預設帳密與 JWT secret。
app 建立 webview session 時直接呼叫本服務 API，不再使用額外 API key。

## 常用指令

根目錄：

```bash
npm run db
npm start
npm run check
npm run test:probability-model
npm run smoke:offline
npm run check-db
npm run smoke:http
npm run frontend:build
npm run verify
```

詳細設定與部署注意事項在 `backend-node8/README.md`。

dev log 預期放在 `logs/`，產生的 `.log` 檔不進 Git。

## 前端 build 流程

`frontend/` 是編譯前專案，需使用支援 Vite 6 / TypeScript 5 的較新 Node 版本。`npm run frontend:build` 會直接把 build 產物輸出到 `backend-node8/public/`，作為 Node 8 runtime 的靜態檔。

常用指令：

```bash
npm run frontend:dev
npm run frontend:lint
npm run frontend:test
npm run frontend:build
```

注意：前端 build 會清空並重建 `backend-node8/public/`，避免留下舊版 hash assets。

## 主要功能

後控目前有這些頁面：

- 抽獎模擬：選 LV1-LV5 做單次 spin，不寫入 DB。
- 查詢玩家：查玩家當日輪盤狀態、流水、已抽階段、中獎紀錄、指定派獎。
- 指定派獎：指定玩家當日某些 LV 階段走 `prize` 機率表，並查看 pending/consumed/cancelled 紀錄。
- 報表統計：用日期區間查總 spin、玩家數、送出點數、階段統計，也可查指定玩家。
- 多次模擬：建立大量模擬 job，前端輪詢結果。
- 機率設定：唯讀檢視目前 JSON 機率，支援 ZIP 上傳、diff、套用、下載歷史 ZIP。
- Webview 工具：後控可輸入玩家 ID 與當日流水，建立測試用 webview URL + token；此功能只允許 `NODE_ENV=development`。

## 每日活動規則

- 日期用 `businessDate` 表示，格式 `YYYY-MM-DD`。
- `BUSINESS_TIME_ZONE` 可設定部署地區時區；未設定時使用伺服器本地時區。
- 玩家每日流水不跨日。
- 流水由 app 建立 webview session 時帶入；webview URL/query 不接受流水值。
- 玩家每天最多抽 LV1-LV5 各一次。
- 解鎖 LV 階段靠當日累積流水門檻。
- 玩家即使一次達成最高門檻，也必須依序從 LV1 抽到 LV5。
- 目前沒有每日 12:00 清除資料排程；系統靠 `businessDate` 分日隔離資料。
- 舊日期 pending 指定派獎不會影響今日抽獎。

app 建立玩家 webview session：

```http
POST /webview/sessions
Content-Type: application/json

{
  "externalId": "player-001",
  "turnoverPoints": 5000
}
```

`turnoverPoints` 是當日累積流水快照；同玩家同日若已存在更高流水，系統只增不降。

後控測試工具建立 webview session 使用：

```http
POST /admin/webview-sessions
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

這個後控 endpoint 只允許 `NODE_ENV=development`，正式或 staging 環境會回傳 403，避免後控帳號建立測試 session 污染真實玩家資料。

## 機率與派獎

機率設定不放 DB，而是放在：

```text
backend-node8/config/probability.json
```

後端會在需要抽獎時讀取 JSON，因此 parser 或 PM ZIP 套用後可以熱更新。

ZIP 匯入目前需要：

- `config.xlsx`：LV 門檻、A-E 獎項名稱、點數。
- `config.xlsx` 的 `門檻設置`：可加一列 `每日送出上限`，右側第一個數字會寫入每日預算；`0` 或負數代表停用。
- `weight.xlsx`：每階段 low/high 分流權重。
- `low.xlsx`：low 表 A-E 權重。
- `high.xlsx`：high 表 A-E 權重。
- `prize.xlsx`：指定派獎 prize 表 A-E 權重。
- `daily-limit.xlsx`：每日送出達上限後使用的 dailyLimit 表 A-E 權重。

後控指定派獎的意思是：某玩家今天某 LV 階段抽獎時，不走 low/high 分流，而是直接用 `prize` 表抽 A-E 獎。成功抽獎後該規則會被標成 consumed。

每日預算控管的意思是：當今日 `spin_records.amount_points` 累計已達 `dailyPayoutLimitPoints`，之後沒有指定派獎的真實抽獎會直接使用 `dailyLimit` 表。指定派獎仍優先使用 `prize` 表。

## DB 設定

本機 MySQL 由 `docker-compose.yml` 啟動。後端 DB 連線設定在 `backend-node8/.env`。

Node 8 runtime 不使用 TypeORM `synchronize`，資料庫 schema 需先存在。參考 baseline 在 `backend-node8/src/db/schema.sql`，可用 `npm run check-db` 做非破壞性檢查。

若本機或測試 DB 還停在舊命名，需先把 `demo_sessions` 改名為 `webview_sessions`，或依 `backend-node8/src/db/schema.sql` 重建 baseline。

主要資料表：

- `admin_users`：後控帳號。
- `players`：玩家外部 ID。
- `player_daily_progress`：玩家每日流水與解鎖階段。
- `turnover_adjustments`：舊版流水異動紀錄表，目前不提供後控加流水入口。
- `spin_records`：真實抽獎紀錄。
- `award_override_rules`：後控指定派獎規則。
- `webview_sessions`：webview token session。

## 驗證

```bash
npm run check
npm run test:probability-model
npm run smoke:offline
npm run check-db
npm run smoke:http
```

`smoke:offline` 不連 DB，主要檢查 config、route 掛載、靜態機率設定。`smoke:http` 會連 DB、啟動臨時 HTTP server，並檢查 `/health` 與 `/api/health`。
`test:probability-model` 只載入純機率模型，不啟動 Express、container 或 DB，用來確認機率核心可以和 server 拆開測。

## 進一步閱讀

如果你要自己 debug 或理解架構，先看：

1. `backend-node8/README.md`
2. `backend-node8/server.js`
3. `backend-node8/src/app.js`
4. `backend-node8/src/container.js`
5. `backend-node8/src/services/spins-service.js`
