# Agent 協作守則

這份文件給 Codex、其他 LLM agent，或未來協作者閱讀。目標是讓每次修改都沿著同一個架構前進，不再把不同來源、不同風格的代碼混在一起。

## 專案定位

這是一個每日 5 階段轉盤活動系統。

- `backend/`：NestJS API，TypeORM，MySQL。
- `frontend/`：React，Vite，TypeScript，Ant Design 後控。
- `frontend/public/webview.html`：玩家端 webview HTML，目前使用既有 bronze 版素材與後端 API 對接。
- 根目錄：只放跨專案腳本、Docker、文件、環境範例。

核心原則：同一個業務邏輯放在同一個 module，不同業務禁止塞進同一個 service。

## 重要業務規則

- 活動是每日制，日期欄位統一使用 `businessDate`，格式 `YYYY-MM-DD`。
- `BUSINESS_TIME_ZONE` 可設定部署地區時區；未設定時使用執行環境本地時區。
- 目前沒有每日 12:00 清除資料排程；每日重置是靠 `businessDate` 隔離資料。
- 玩家流水不跨日，`player_daily_progress` 每位玩家每天一筆。
- 玩家每日最多可抽 VIP1 到 VIP5 各一次。
- 即使玩家一次補滿最高流水，也必須照 VIP1、VIP2、VIP3、VIP4、VIP5 順序抽。
- 抽獎金額與流水都用整數點數，不使用浮點數。
- 機率設定來自 XLSX parser 產出的 JSON，不存在 DB。
- 機率設定頁是唯讀；不得加回前端手動編輯/儲存功能。
- 若某獎項或表不想被抽中，使用權重 `0`，不要新增 enabled/disabled。
- 指定派獎只對當日 `businessDate` 生效，真實抽獎時才會消耗 pending 規則。
- 過去日期的 pending 指定派獎不會影響今日抽獎。
- 多次模擬是本機記憶體 job，不寫入真實玩家 DB。

## Backend 邊界

NestJS module 應依業務切開：

- `auth`：後控登入、JWT。
- `players`：玩家查詢、每日進度 read model。
- `turnover`：後控或平台加流水，並更新每日解鎖階段。
- `probability`：讀取 JSON 機率設定、權重抽獎、stage 門檻。
- `probability-imports`：ZIP 上傳、XLSX parser、diff preview、套用 JSON、保存原始 ZIP。
- `award-overrides`：後控指定派獎規則，pending/cancel/consume lifecycle。
- `spins`：真實抽獎與單次模擬的 orchestration。
- `reports`：區間報表、玩家報表。
- `simulations`：大量模擬 job registry。
- `demo-token`：demo session 與 webview token。
- `domain`：純 business rule，例如解鎖階段與真實抽獎順序檢查。

不要為了方便讓 `spins` 直接改機率 parser，也不要讓 `probability-imports` 決定真實抽獎流程。跨 module 需要用 service dependency 表達。

## Frontend 邊界

後控頁面目前包含：

- `/spin-simulator`：單次抽獎模擬，不寫 DB。
- `/players`：查詢玩家當日狀態、後控加流水、玩家指定派獎。
- `/award-overrides`：全站指定派獎管理。
- `/reports`：區間報表與玩家報表。
- `/bulk-simulation`：大量模擬任務與輪詢結果。
- `/probability`：機率設定唯讀檢視、ZIP 上傳、diff、下載歷史 ZIP。
- `/demo`：建立或查詢 demo 玩家，取得 webview URL + token。

共用 API helper 放在 `frontend/src/api`。共用 UI component 放在 `frontend/src/components`。單頁私有邏輯可以留在 `frontend/src/pages`。

## 機率設定規則

機率 JSON 位於 `backend/config/probability.json`，由 parser 或 PM 上傳 ZIP 產生。

目前 ZIP 必須包含：

- `config.xlsx`：VIP 門檻、A-E 獎項名稱與點數。
- `weight.xlsx`：low/high 分流權重。
- `low.xlsx`：low 表 A-E 權重。
- `high.xlsx`：high 表 A-E 權重。
- `prize.xlsx`：指定派獎 prize 表 A-E 權重。

`daily-limit.xlsx` 目前是保留來源檔，業務意義未完全確認前不要接進 runtime 規則。

## DB 與時間

- DB 時間欄位使用 Unix timestamp 秒數，例如 `created_at`、`updated_at`、`consumed_at`。
- `business_date` 是每日活動分界，不是 timestamp。
- TypeORM `synchronize=true` 只允許本機開發；正式環境要改 migration。
- Entity 欄位要寫清楚 comment，方便 DB 工具直接看懂欄位用途。

## 本機命令

根目錄：

```bash
npm install
npm run db
npm run dev
npm run lint
npm run test
npm run build
npm run probability:import -- <xlsx-source-dir>
```

Backend：

```bash
cd backend
npm run start:dev
npm run lint
npm run test
npm run build
```

Frontend：

```bash
cd frontend
npm run dev
npm run lint
npm run build
```

## Debug 習慣

- 先看 `logs/`，再看 browser console 或 backend terminal。
- 改後端業務規則時，先找對應 `*.spec.ts`，補或更新測試。
- 改前端頁面時，至少跑 `frontend npm run lint` 和 `frontend npm run build`。
- 需要檢查資料流時，從 controller -> service -> entity 追，不要直接猜 DB 欄位。
- 遇到日期問題，先確認 `BUSINESS_TIME_ZONE`、`businessDate`、以及資料表日期欄位。

## Git 與提交

- 完成一段有意義的功能或修正後要 commit。
- commit message 使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`。
- type 用英文，subject/body 用中文，例如 `docs: 補充工程師導覽文件`。
- commit body 要說明實際改了什麼、為什麼改、驗證方式。
- commit 前一定要看 `git status`，避免把使用者或 PM 資料誤提交。
- 除非使用者明確要求，不要提交 `backend/config/probability.json` 的本機變動。
- 不要使用 `git reset --hard` 或 `git checkout --` 回滾使用者變更。
