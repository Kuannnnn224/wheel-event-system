# 工程師導覽與 Debug 手冊

這份文件給要理解或 debug 這個專案的人看。它不只列目錄，也說明一個請求會怎麼從前端走到後端、後端怎麼進 DB、哪些地方最容易出錯。

## 先掌握三件事

1. 這個專案是前後端分離：React 後控呼叫 NestJS API，NestJS 再操作 MySQL 或讀 JSON 機率設定。
2. 每日活動不是靠刪資料重置，而是靠 `businessDate` 分日隔離。
3. 機率設定不在 DB，runtime 讀 `backend/config/probability.json`。

## 目錄總覽

```text
.
├─ backend/                  NestJS API 專案
│  ├─ config/
│  │  └─ probability.json     runtime 機率設定
│  ├─ scripts/                一次性工具，例如 XLSX 匯入、時間欄位轉換
│  └─ src/
│     ├─ app.module.ts        NestJS module 組裝入口
│     ├─ main.ts              後端啟動、CORS、ValidationPipe
│     ├─ auth/                後控登入與 JWT
│     ├─ players/             玩家資料與每日進度
│     ├─ turnover/            後控加流水
│     ├─ spins/               真實抽獎與單次模擬
│     ├─ probability/         JSON 機率設定與抽獎
│     ├─ probability-imports/ ZIP 上傳、XLSX parser、diff、套用
│     ├─ award-overrides/     後控指定派獎
│     ├─ reports/             報表
│     ├─ simulations/         大量模擬
│     ├─ demo-token/          webview token/session
│     ├─ common/              共用 helper，例如 business date
│     └─ domain/              純業務規則
├─ frontend/                 React 後控與 webview 靜態檔
│  ├─ public/
│  │  ├─ webview.html         玩家端 webview 頁
│  │  └─ webview-assets/      bronze 版圖片與 CSS/JS
│  └─ src/
│     ├─ App.tsx              React route 與登入狀態入口
│     ├─ main.tsx             React 掛載入口
│     ├─ styles.css           全域後控樣式
│     ├─ api/                 axios client 與共用型別
│     ├─ components/          共用 UI component
│     └─ pages/               各 sidebar 頁面
├─ logs/                     本機 dev log
├─ storage/                  PM 上傳 ZIP 等 runtime storage
├─ docker-compose.yml        MySQL
├─ package.json              根目錄整合指令
├─ README.md                 啟動與功能說明
└─ AGENT.md                  協作規則
```

## 後端架構：NestJS 怎麼看

NestJS 會把程式切成 module。每個 module 通常包含：

- `*.module.ts`：宣告這個業務會用到哪些 controller、service、entity。
- `*.controller.ts`：API 入口，處理 HTTP route。
- `*.service.ts`：真正業務邏輯。
- `entities/*.entity.ts`：TypeORM DB table 定義。
- `dto/*.dto.ts`：request body/query 的資料格式與驗證。
- `*.spec.ts`：測試。

後端總入口是 `backend/src/app.module.ts`。它把所有 module 組起來，並設定 TypeORM 連 MySQL。

啟動入口是 `backend/src/main.ts`：

- 建立 Nest app。
- 開 CORS。
- 啟用 `ValidationPipe`。
- 監聽 `PORT`，預設 `3001`。

`ValidationPipe` 的效果是：DTO 沒定義的欄位會被擋掉，型別會嘗試轉換，這可以避免前端亂送欄位污染後端。

## 前端架構：React 怎麼看

React 前端入口是 `frontend/src/main.tsx`，它把 `<App />` 掛到 HTML 的 `#root`。

`frontend/src/App.tsx` 負責：

- 建立 TanStack Query client。
- 判斷 localStorage 有沒有 JWT token。
- 有 token 就顯示 `AppLayout` 和 sidebar routes。
- 沒 token 就顯示 `LoginPage`。

`frontend/src/components/AppLayout.tsx` 是所有後控頁共用框架：

- 左側 sidebar。
- 上方固定 header。
- 每分鐘刷新今日送出金額。
- route menu。

`frontend/src/api/client.ts` 是前端 API 中心：

- 建立 axios instance。
- 自動帶 `Authorization: Bearer <token>`。
- 統一解析後端錯誤訊息。
- 放共用 API helper。

如果你想找某一頁畫面，通常從 `frontend/src/pages/<PageName>.tsx` 開始。

## TypeORM 與 DB 怎麼對起來

TypeORM Entity 是 TypeScript class，對應 MySQL table。

例如 `backend/src/spins/entities/spin-record.entity.ts`：

- class `SpinRecord` 對應 `spin_records` table。
- `@Column()` 對應欄位。
- `@ManyToOne()` 對應關聯。
- `@Unique()` 對應唯一鍵。
- `comment` 會寫到 DB 欄位註解。

本機現在使用 `TYPEORM_SYNC=true`，代表 NestJS 啟動時會根據 Entity 自動同步 DB schema。這對開發很方便，但正式環境危險，之後要改成 migration。

常見資料表：

```text
players
  真實玩家資料，external_id 是平台玩家 ID。

player_daily_progress
  每位玩家每日流水與解鎖階段，unique(player_id, business_date)。

turnover_adjustments
  後控加流水紀錄。

spin_records
  真實抽獎紀錄，unique(player_id, business_date, stage_number)。

award_override_rules
  指定派獎規則，pending 時用 pending_key 防止同日同階段重複指定。

demo_sessions
  webview token session。
```

## 每日制資料流

每日制的核心不是清資料，而是每筆資料都帶 `businessDate`。

後端共用 helper 在：

```text
backend/src/common/business-date.ts
```

重要函式：

- `getBusinessDate()`：依 `BUSINESS_TIME_ZONE` 或本地時區取得今天業務日期。
- `resolveCurrentBusinessDate()`：只允許今天日期，過去或未來會被擋。

目前行為：

- 查玩家每日進度：只查今天。
- 後控加流水：只允許今天。
- 真實抽獎：只允許今天。
- 指定派獎：只建立、查詢、取消今天規則。

目前沒有每日 12:00 排程去改舊資料狀態。舊資料保留做 audit/report，今天不會查到舊日期資料。

未來如果要加排程，建議新增 `expired` 狀態，而不是刪除舊資料。

## 主要 API

所有後控 API 除 login 和必要公開端點外，都會走 JWT guard。

```text
POST /auth/login
GET  /players?externalId=...
GET  /players/:id/daily-progress
POST /players/:playerId/turnover-adjustments

GET  /probability/stages
PUT  /probability/stages
POST /probability/imports/preview
POST /probability/imports/apply
GET  /probability/imports
POST /probability/imports/:uploadId/download-token
GET  /probability/imports/download/:token

POST /spins/simulate
POST /spins/real

GET  /award-overrides
POST /award-overrides
PATCH /award-overrides/:id/cancel

GET  /reports/daily
GET  /reports/range
GET  /reports/player

POST /simulations
GET  /simulations/:id

POST /demo/session
GET  /demo/session
```

注意：`PUT /probability/stages` 目前是刻意拒絕手動更新，避免 PM 以外的路徑改機率。機率更新應走 ZIP import apply。

## 常見流程

### 登入後控

1. 前端 `LoginPage` 呼叫 `POST /auth/login`。
2. 後端 `AuthController` 呼叫 `AuthService` 驗證帳密。
3. 成功後回 JWT。
4. 前端把 JWT 存到 localStorage。
5. `api/client.ts` 之後每個 request 自動帶 Bearer token。

### 後控加流水

1. 前端 `/players` 查玩家。
2. 按加流水後呼叫 `POST /players/:playerId/turnover-adjustments`。
3. `TurnoverService` 找今日 `player_daily_progress`，沒有就建一筆。
4. 增加 `turnoverPoints`。
5. 用 `ProbabilityService.getStageThresholds()` 取得 VIP 門檻。
6. 用 `domain/stage-progress.ts` 算出 `unlockedStage`。
7. 寫 `turnover_adjustments` audit。
8. 回傳最新每日進度。

### 真實抽獎

1. Webview 或後控 demo 呼叫 `POST /spins/real`。
2. `DemoTokenService` 驗證 token。
3. `SpinsService` 取得今日 progress 和今日 spin records。
4. `domain/spin-rules.ts` 檢查：
   - 該 VIP 是否已解鎖。
   - 是否依序抽。
   - 該 VIP 今日是否已抽。
5. 查 `award-overrides` 是否有今日 pending 指定派獎。
6. 有指定派獎：用 `prize` 表抽。
7. 沒指定派獎：先 low/high 分流，再用對應表抽 A-E。
8. 寫入 `spin_records`。
9. 如果有指定派獎，將規則改成 consumed 並綁定 spin record。

### 機率 ZIP 上傳

1. 前端 `/probability` 上傳 ZIP。
2. `ProbabilityImportsController` 收檔。
3. `probability-xlsx.parser.ts` 解析 xlsx。
4. Service 產生新 JSON 並和現有 JSON 做 diff。
5. 前端顯示 diff 給 PM 看。
6. PM 套用後寫入 `backend/config/probability.json`。
7. 原始 ZIP 與 metadata 存在 `storage/probability-imports/`，供下載。

### 大量模擬

1. 前端 `/bulk-simulation` 建立 job。
2. `SimulationsService` 把 job 放在本機記憶體 Map。
3. 後端非同步跑指定次數抽獎。
4. 前端用 job id 輪詢 `GET /simulations/:id`。
5. server 重啟後 job 不保留，這是第一版設計。

## 機率 JSON 結構概念

每個 stage 有：

- 流水門檻。
- low/high 分流權重。
- A-E 獎項設定。
- 每個獎項的 `lowWeight`、`highWeight`、`prizeWeight`。

抽獎時：

```text
一般抽獎：
  stage split -> low 或 high -> 依 lowWeight/highWeight 抽 A-E

指定派獎：
  直接 prize -> 依 prizeWeight 抽 A-E
```

如果某個獎項不想抽到，對應權重設成 `0`。

## Debug 路線

### 前端畫面怪怪的

1. 找對應頁面：`frontend/src/pages`。
2. 看共用 layout：`frontend/src/components/AppLayout.tsx`。
3. 看共用樣式：`frontend/src/styles.css`。
4. 看 API 是否打對：`frontend/src/api/client.ts`。
5. 打開瀏覽器 devtools network，看 request/response。

### 後端 API 報錯

1. 找 controller route。
2. 找 controller 呼叫哪個 service。
3. 看 service 是否有 throw `BadRequestException` 或 `NotFoundException`。
4. 看 DTO 是否驗證失敗。
5. 看 DB entity 欄位是否和實際資料表一致。

### 玩家今天不能抽

檢查順序：

1. `players.external_id` 是否正確。
2. `player_daily_progress` 今日是否有資料。
3. `turnover_points` 是否達到 VIP 門檻。
4. `unlocked_stage` 是否正確。
5. `spin_records` 今日是否已經有該 stage。
6. 是否違反順序，例如想抽 VIP3 但 VIP2 未抽。
7. 若是指定派獎，檢查 `award_override_rules` 是否是今日 pending。

### 指定派獎沒生效

檢查：

1. `award_override_rules.business_date` 是否是今天。
2. `status` 是否為 `pending`。
3. `stage_number` 是否等於玩家抽的 VIP。
4. 玩家是否真的走 `POST /spins/real`，模擬不會套用指定派獎。
5. 抽完後 `spin_records.probability_table` 應為 `prize`。
6. 抽完後規則應變成 `consumed`，並有 `consumed_spin_record_id`。

### 報表數字不對

報表主要看 `spin_records`。

檢查：

1. 查詢區間是否包含該 `business_date`。
2. `amount_points` 是否正確。
3. `stage_number` 是否正確。
4. 是否查錯玩家外部 ID。

## 常用 SQL

以下 SQL 只適合本機 debug，正式環境要小心權限。

查玩家：

```sql
select * from players where external_id = '46466';
```

查玩家今日進度：

```sql
select *
from player_daily_progress
where player_id = '<players.id>'
  and business_date = '2026-05-09';
```

查玩家今日抽獎：

```sql
select stage_number, probability_table, prize_name, amount_points, created_at
from spin_records
where player_id = '<players.id>'
  and business_date = '2026-05-09'
order by stage_number;
```

查指定派獎：

```sql
select stage_number, status, reason, pending_key, consumed_spin_record_id, created_at, consumed_at, cancelled_at
from award_override_rules
where player_id = '<players.id>'
  and business_date = '2026-05-09'
order by created_at desc;
```

查今日送出：

```sql
select count(*) as total_spins, count(distinct player_id) as players, sum(amount_points) as total_points
from spin_records
where business_date = '2026-05-09';
```

## 測試位置

後端測試在各 module 旁邊：

- `backend/src/domain/*.spec.ts`
- `backend/src/probability/*.spec.ts`
- `backend/src/probability-imports/*.spec.ts`
- `backend/src/spins/*.spec.ts`
- `backend/src/award-overrides/*.spec.ts`
- `backend/src/reports/*.spec.ts`

前端目前有 smoke test：

- `frontend/src/App.test.tsx`
- `frontend/src/test/setup.ts`

跑測試：

```bash
npm run test
```

只跑後端指定測試：

```bash
cd backend
npm run test -- --runInBand award-overrides
```

## 加新功能時的建議順序

1. 先判斷它屬於哪個 module。
2. 如果是純規則，先放 `backend/src/domain` 並寫 unit test。
3. 設計 entity/DTO/controller/service。
4. 後端測試通過後，再接前端頁面。
5. 前端 API helper 放 `frontend/src/api/client.ts` 或頁面內。
6. 共用顯示元件放 `frontend/src/components`。
7. 跑 lint/build/test。
8. commit。

## 目前已知設計取捨

- 本機 TypeORM synchronize 很方便，但不適合正式環境。
- 多次模擬 job 不持久化，server 重啟會消失。
- 目前沒有每日排程把過期 pending 派獎改成 expired，靠 businessDate 隔離。
- 機率 JSON 目前是熱讀檔，簡單直覺，但未來如果併發匯入很多，需要加版本號或原子寫入策略。
- Webview 是靜態 HTML，適合快速接活動，但如果日後互動變複雜，可能需要獨立前端 build 流程。
