# Agent 協作守則

這份文件給 Codex、其他 LLM agent，或未來協作者閱讀。這個分支的重點是兼容舊版正式 server：原本 NestJS backend 的業務能力已降版到 Node 8.17 可跑的 Express runtime。後端改動以 `backend-node8/` 為準；前端 source 保留在 `frontend/`，但 Node 8 runtime 只服務 build 後的靜態檔。

## 專案定位

這是一個每日 5 階段轉盤活動系統。

- `backend-node8/`：目前真正部署與啟動的 runtime，Express 4、CommonJS、raw SQL、Node 8.17 相容。
- `backend-node8/public/`：已 build 好的後控與 webview 靜態檔，由 Express 透過 `PUBLIC_PATH` 直接服務。
- `frontend/`：編譯前的 React + Vite + TypeScript 專案。它需要較新 Node toolchain，build 產物會直接輸出到 `backend-node8/public/`。
- `backend-node8/config/probability.json`：機率設定 JSON，由 parser 或 PM ZIP 匯入產生，不放 DB。
- `backend-node8/src/db/schema.sql`：Node 8 runtime 期待的 DB baseline；runtime 不使用 TypeORM synchronize。
- `backend/` 若在本機目錄中出現，視為舊版 NestJS 參考資料；除非任務明確要求，不要復原或修改。
- 根目錄只放跨專案腳本、Docker、文件、環境範例與 runtime 轉呼叫 script。

核心原則：同一個業務邏輯放在同一層的同一個 module，不同業務禁止塞進同一個 service。需要跨層時用明確 dependency 表達，不要用隱式全域狀態。

## Node 8 Runtime 規則

- 使用 CommonJS `require/module.exports`，不要引入 TypeScript、NestJS decorator、ESM 或需要 transpile 的語法。
- 任何新 dependency 都要確認 Node 8.17 與 npm 6 可用；不要提交由新版 npm 產生且 npm 6 不能讀的 lockfile。
- 後端入口是 `backend-node8/server.js`，Express app 建立在 `backend-node8/src/app.js`，依賴組裝在 `backend-node8/src/container.js`。
- 後控與 webview 在 Node 8 runtime 中是 build 後靜態檔。可以修改 `frontend/` source，但不要讓 `backend-node8/` 啟動流程依賴 Vite 或現代 frontend toolchain。
- 本機與部署路徑設定走 `backend-node8/src/config.js`；相對路徑以 `backend-node8/` 為基準。

## Frontend 邊界

- `frontend/` 是可復原與維護的 source of truth；`backend-node8/public/` 是部署產物。
- 改前端頁面或 webview source 時，在 `frontend/` 跑 lint/test/build；`npm run build` 會清空並重建 `backend-node8/public/`。
- Vite dev server 只供本機開發，預設 `/api` proxy 到 `http://127.0.0.1:3001`；不要把 localhost 或 LAN IP 寫死進 webview source。
- `VITE_API_BASE_URL` 預設空值，讓 build 後頁面使用 `/api`。只有在前端不透過同源 `/api` 反代時才設絕對 URL。
- CDN 或 GitHub Pages 測試 webview 時，後端 `.env` 應設定 `WEBVIEW_BASE_URL` 與絕對的 `WEBVIEW_API_BASE_URL`；後端會把絕對 API base 追加成 `apiBase` query 給靜態 webview。
- 共用 API helper 放在 `frontend/src/api`；共用 UI component 放在 `frontend/src/components`；單頁私有邏輯留在 `frontend/src/pages`。

## 重要業務規則

- 活動是每日制，日期欄位統一使用 `businessDate`，格式 `YYYY-MM-DD`。
- `BUSINESS_TIME_ZONE` 可設定部署地區時區；未設定時使用執行環境本地時區。
- 目前沒有每日 12:00 清除資料排程；每日重置靠 `businessDate` 隔離資料。
- 玩家流水與解鎖階段由 App 既有流程提供；正式流程由 App client 呼叫 `POST /api/webview/sessions` 帶入平台玩家 ID、當日流水與已解鎖階段，本服務只把這些資料簽進 webview token。
- Node 8 runtime 不維護 `players` 玩家主檔；`spinRecords.playerId` 與 `awardOverrideRules.playerId` 直接保存平台帶入的玩家 ID。
- 玩家每日最多可抽 LV1 到 LV5 各一次。
- 即使玩家一次補滿最高流水，也必須照 LV1、LV2、LV3、LV4、LV5 順序抽。
- 抽獎金額與流水都用整數點數，不使用浮點數。
- 機率設定來自 XLSX parser 產出的 JSON，不存在 DB。
- 機率設定頁是唯讀；不得加回前端手動編輯/儲存功能。
- 若某獎項或表不想被抽中，使用權重 `0`，不要新增 enabled/disabled。
- 指定派獎只對當日 `businessDate` 生效，真實抽獎時才會消耗 pending 規則。
- 過去日期的 pending 指定派獎不會影響今日抽獎。
- 多次模擬是本機記憶體 job，不寫入真實玩家 DB。
- 此正式 API 分支不掛後控 Webview 工具；開頁連結由 App client 呼叫正式 API 產生。

## Backend 邊界

Express runtime 依照這些層次切分：

- `src/app.js`：只負責 Express middleware、static file、route 掛載與 health check。
- `src/container.js`：建立 repository、service、controller 的相依關係。不要把業務規則寫在這裡。
- `src/routes/`：只描述 URL、middleware、controller handler。
- `src/controllers/`：只處理 req/res 與呼叫 service。
- `src/services/`：應用流程編排，例如 token、交易、repository、指定派獎、報表。
- `src/repositories/`：raw SQL 存取。SQL schema 變動需同步 `src/db/schema.sql` 與 `check-db-schema.js`。
- `src/domain/`：純 business rule，不依賴 Express、DB、controller 或 repository。
- `src/utils/`：通用小工具；不要把遊戲規則藏在 util。

不要為了方便讓 `spins` 直接改機率設定檔。跨 module 需要用 service dependency 表達。

## 機率模型邊界

- 純機率模型在 `backend-node8/src/domain/probability-model.js`，負責 config 正規化、驗證、權重表選擇與獎項抽選。
- `backend-node8/src/services/probability-service.js` 只負責讀寫 `probability.json`，並把 domain validation error 轉成 API error。
- `backend-node8/src/utils/probability-picker.js` 是權重抽選工具；如果要調整抽選行為，先確認既有 roll-down 行為是否需要相容。
- `spins-service` 是真實抽獎 orchestration：token、玩家進度、依序抽、交易寫入、指定派獎與每日上限。
- 此正式 API 分支不掛模擬 API；若日後要恢復模擬，應只拿 draw config 在記憶體跑，不碰真實玩家 DB。
- 機率核心要能被 server 拆出來測；新增或修改模型時，至少跑 `npm run test:probability-model`。

## 機率設定規則

機率 JSON 位於 `backend-node8/config/probability.json`。此正式 API 分支不掛 PM ZIP 匯入 API；若機率來源格式或產檔流程改變，應在外部產生新的 JSON 後再替換此檔。

Runtime model 與前端顯示要保持概念分離。不要讓真實抽獎流程直接解析 XLSX 或 ZIP。

## DB 與時間

- DB 時間欄位使用 Unix timestamp 秒數，例如 `createdAt`、`updatedAt`、`consumedAt`。
- `businessDate` 是每日活動分界，不是 timestamp。
- Node 8 runtime 使用 raw SQL，不使用 TypeORM。
- schema 相容性以 `backend-node8/src/db/schema.sql` 與 `npm run check-db` 為準。
- DB 檢查應是非破壞性；不要在 check script 中自動 drop、truncate 或 migrate 真實資料。

## 本機命令

根目錄：

```bash
npm install
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

Backend runtime：

```bash
cd backend-node8
npm install
npm start
npm run check
npm run test:probability-model
npm run smoke:offline
npm run check:db
npm run smoke:http
```

Frontend source：

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run test
npm run build
```

`smoke:offline` 不連 DB；`smoke:http` 會連 DB 並啟動臨時 HTTP server；`test:probability-model` 不載入 Express、container 或 DB；`frontend:build` 直接輸出到 `backend-node8/public/`，需要較新 Node 而不是 Node 8。

## Debug 習慣

- 先看 `logs/`，再看 browser console 或 backend terminal。
- 改後端流程時，從 route -> controller -> service -> repository/domain 追，不要直接猜 DB 欄位。
- 改抽獎規則時，先判斷是 `domain/probability-model`、`domain/spin-rules`、`probability-service` 還是 `spins-service` 的責任。
- 改機率模型後跑 `npm run test:probability-model` 與 `npm run check`。
- 改 DB 欄位或 SQL 後跑 `npm run check-db`，必要時再跑 `npm run smoke:http`。
- 遇到日期問題，先確認 `BUSINESS_TIME_ZONE`、`businessDate`、以及資料表日期欄位。

## Git 與提交

- 完成一段有意義的功能或修正後再 commit；不要把臨時 debug 或 PM 本機資料一起提交。
- commit message 使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`。
- type 用英文，subject/body 用中文，例如 `docs: 補充 Node 8 runtime 協作守則`。
- commit body 要說明實際改了什麼、為什麼改、驗證方式。
- commit 前一定要看 `git status`，避免把使用者或 PM 資料誤提交。
- 除非使用者明確要求，不要提交本機 `.env`、log、storage 內容或臨時匯入 ZIP。
- 不要使用 `git reset --hard` 或 `git checkout --` 回滾使用者變更。
