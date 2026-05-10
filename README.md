# 轉盤活動系統

這是一個每日 5 階段轉盤活動系統，包含後控 React、NestJS API、MySQL，以及玩家端 webview HTML。

- 後端：`backend/`，NestJS + TypeORM + MySQL。
- 前端：`frontend/`，React + Vite + TypeScript + Ant Design。
- Webview：`frontend/public/webview.html`，目前使用 bronze 版素材與後端 API 對接。
- 工程師導覽：`docs/ENGINEERING_GUIDE.md`。
- Agent 協作規則：`AGENT.md`。

## 快速啟動

先安裝根目錄工具：

```bash
npm install
```

啟動 MySQL：

```bash
npm run db
```

安裝前後端依賴：

```bash
cd backend
cp .env.example .env
npm install

cd ../frontend
cp .env.example .env
npm install
```

從根目錄同時啟動前後端：

```bash
npm run dev
```

預設網址：

- 後控前端：`http://127.0.0.1:5173`
- 後端 API：`http://127.0.0.1:3001`

本機預設後控帳號：

- username：`admin`
- password：`admin123`

真實資料環境請務必改掉 `backend/.env` 的預設帳密與 JWT secret。

## 常用指令

根目錄：

```bash
npm run db
npm run dev
npm run dev:backend
npm run dev:frontend
npm run lint
npm run test
npm run build
```

匯入 XLSX 機率來源：

```bash
npm run probability:import -- C:\path\to\source
```

dev log 預期放在 `logs/`，產生的 `.log` 檔不進 Git。

## 主要功能

後控目前有這些頁面：

- 抽獎模擬：選 VIP1-VIP5 做單次 spin，不寫入 DB。
- 查詢玩家：查玩家當日輪盤狀態、流水、已抽階段、中獎紀錄、後控加流水、指定派獎。
- 指定派獎：指定玩家當日某些 VIP 階段走 `prize` 機率表，並查看 pending/consumed/cancelled 紀錄。
- 報表統計：用日期區間查總 spin、玩家數、送出點數、階段統計，也可查指定玩家。
- 多次模擬：建立大量模擬 job，前端輪詢結果。
- 機率設定：唯讀檢視目前 JSON 機率，支援 ZIP 上傳、diff、套用、下載歷史 ZIP。
- Demo 網站：輸入玩家 ID，建立或查詢玩家，產生 webview URL + token。

## 每日活動規則

- 日期用 `businessDate` 表示，格式 `YYYY-MM-DD`。
- `BUSINESS_TIME_ZONE` 可設定部署地區時區；未設定時使用伺服器本地時區。
- 玩家每日流水不跨日。
- 玩家每天最多抽 VIP1-VIP5 各一次。
- 解鎖 VIP 階段靠當日累積流水門檻。
- 玩家即使一次達成最高門檻，也必須依序從 VIP1 抽到 VIP5。
- 目前沒有每日 12:00 清除資料排程；系統靠 `businessDate` 分日隔離資料。
- 舊日期 pending 指定派獎不會影響今日抽獎。

## 機率與派獎

機率設定不放 DB，而是放在：

```text
backend/config/probability.json
```

後端會在需要抽獎時讀取 JSON，因此 parser 或 PM ZIP 套用後可以熱更新。

ZIP 匯入目前需要：

- `config.xlsx`：VIP 門檻、A-E 獎項名稱、點數。
- `config.xlsx` 的 `門檻設置`：可加一列 `每日送出上限`，右側第一個數字會寫入每日預算；`0` 或負數代表停用。
- `weight.xlsx`：每階段 low/high 分流權重。
- `low.xlsx`：low 表 A-E 權重。
- `high.xlsx`：high 表 A-E 權重。
- `prize.xlsx`：指定派獎 prize 表 A-E 權重。
- `dailyLimit.xlsx`：每日送出達上限後使用的 dailyLimit 表 A-E 權重。

後控指定派獎的意思是：某玩家今天某 VIP 階段抽獎時，不走 low/high 分流，而是直接用 `prize` 表抽 A-E 獎。成功抽獎後該規則會被標成 consumed。

每日預算控管的意思是：當今日 `spin_records.amount_points` 累計已達 `dailyPayoutLimitPoints`，之後沒有指定派獎的真實抽獎會直接使用 `dailyLimit` 表。指定派獎仍優先使用 `prize` 表。

## DB 設定

本機 MySQL 由 `docker-compose.yml` 啟動。後端 DB 連線設定在 `backend/.env`。

第一版本機開發使用 TypeORM `synchronize=true` 自動同步 Entity 到 DB。正式環境請改成 migration 流程，避免自動改表造成風險。

主要資料表：

- `admin_users`：後控帳號。
- `players`：玩家外部 ID。
- `player_daily_progress`：玩家每日流水與解鎖階段。
- `turnover_adjustments`：後控加流水紀錄。
- `spin_records`：真實抽獎紀錄。
- `award_override_rules`：後控指定派獎規則。
- `demo_sessions`：webview token session。

## 驗證

後端：

```bash
cd backend
npm run lint
npm run test
npm run build
```

前端：

```bash
cd frontend
npm run lint
npm run build
```

整包：

```bash
npm run lint
npm run test
npm run build
```

目前前端 build 可能會出現 chunk size warning，這不是失敗；之後頁面更多時可用 code splitting 優化。

## 進一步閱讀

如果你要自己 debug 或理解架構，先看：

1. `docs/ENGINEERING_GUIDE.md`
2. `backend/src/app.module.ts`
3. `frontend/src/App.tsx`
4. `frontend/src/api/client.ts`
5. `backend/src/spins/spins.service.ts`
