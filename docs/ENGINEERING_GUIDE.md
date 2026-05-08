# 工程師導覽與 Debug 手冊

這份文件給要理解或 debug 這個專案的人看。它不只列目錄，也說明一個請求會怎麼從前端走到後端、後端怎麼進 DB、哪些地方最容易出錯。

## 先掌握三件事

1. 這個專案是前後端分離：React 後控呼叫 NestJS API，NestJS 再操作 MySQL 或讀 JSON 機率設定。
2. 每日活動不是靠刪資料重置，而是靠 `businessDate` 分日隔離。
3. 機率設定不在 DB，runtime 讀 `backend/config/probability.json`。

## 框架入門：先建立心智模型

如果你第一次接觸 NestJS、TypeORM、React，可以先把它們想成三個不同職責的工具：

```text
React
  負責畫面、使用者操作、呼叫 API

NestJS
  負責 API、登入權限、業務規則、錯誤處理

TypeORM
  負責讓 NestJS 用 TypeScript 操作 MySQL

Migration
  負責正式環境的 DB 結構版本管理
```

這個專案的主要資料流是：

```text
後控頁面或 webview
  -> axios / fetch 呼叫 API
  -> NestJS Controller 接 request
  -> NestJS Service 跑業務邏輯
  -> TypeORM Repository 查寫 MySQL
  -> 回傳 JSON 給前端
```

官方文件：

- NestJS 官方文件：https://docs.nestjs.com
- React 官方文件：https://react.dev/learn
- TypeORM 官方文件：https://typeorm.io

## NestJS 入門

NestJS 是 Node.js 後端框架。它的價值不是只幫你開 API，而是強迫後端程式有穩定結構：API 入口、業務邏輯、資料格式、權限、測試都放在各自位置。

### Module

Module 是 NestJS 的功能邊界。你可以把 module 想成一個業務資料夾。

例如本專案：

```text
backend/src/spins
backend/src/players
backend/src/award-overrides
backend/src/probability
```

每個 module 通常會有：

```text
xxx.module.ts      組裝 controller、service、entity
xxx.controller.ts  API route 入口
xxx.service.ts     業務邏輯
dto/               request body/query 格式
entities/          DB table mapping
```

官方說明：NestJS module 是用 `@Module()` decorator 標記的 class，Nest 會透過 module 組織 application graph，管理 module 與 provider 之間的依賴關係。

本專案例子：

```ts
@Module({
  imports: [TypeOrmModule.forFeature([SpinRecord, PlayerDailyProgress]), DemoTokenModule, AwardOverridesModule],
  controllers: [SpinsController],
  providers: [SpinsService],
})
export class SpinsModule {}
```

意思是：

- `SpinsController` 負責接 `/spins` API。
- `SpinsService` 負責抽獎流程。
- 這個 module 需要用到 `SpinRecord`、`PlayerDailyProgress` 兩個 repository。
- 這個 module 也依賴 demo token 與指定派獎 module。

### Controller

Controller 是 HTTP API 入口。它應該薄一點，不要塞大量業務邏輯。

典型長相：

```ts
@Controller('spins')
export class SpinsController {
  constructor(private readonly spinsService: SpinsService) {}

  @Post('real')
  realSpin(@Body() dto: RealSpinDto) {
    return this.spinsService.realSpin(dto);
  }
}
```

這段代表：

```text
POST /spins/real
  -> SpinsController.realSpin()
  -> SpinsService.realSpin()
```

Controller 常見 decorator：

- `@Controller('players')`：API prefix。
- `@Get()`：GET route。
- `@Post()`：POST route。
- `@Patch()`：PATCH route。
- `@Body()`：讀 request body。
- `@Query()`：讀 query string。
- `@Param()`：讀 URL path 參數。

### Service

Service 是業務邏輯主體。

你的專案裡，service 會負責：

- 檢查玩家是否存在。
- 檢查今天是否可抽。
- 查今日流水。
- 計算解鎖階段。
- 決定走 low/high/prize 哪張表。
- 寫 DB。
- 回傳前端需要的資料。

Service 應該描述業務流程，不應該直接處理畫面格式。

例如真實抽獎大致是：

```text
SpinsService.realSpin()
  驗 token
  取今日 businessDate
  查今日玩家進度
  查今日已抽紀錄
  validateRealSpinRule()
  查指定派獎 pending 規則
  ProbabilityService 抽獎
  寫 spin_records
  有指定派獎就 consume
```

### Provider 與 Dependency Injection

NestJS 裡 service 也是 provider。Dependency Injection 是「你宣告需要什麼，Nest 幫你準備好」。

你會看到這種寫法：

```ts
constructor(
  private readonly probabilityService: ProbabilityService,
  private readonly awardOverridesService: AwardOverridesService,
) {}
```

這代表 `SpinsService` 需要用到 `ProbabilityService` 和 `AwardOverridesService`。你不需要自己 `new` 它們，Nest 會根據 module 設定注入。

這樣做的好處：

- service 之間依賴清楚。
- 測試時可以替換成 mock。
- 不同業務比較不會混在一起。

### DTO 與 ValidationPipe

DTO 是 API 輸入資料的規格。

例如新增指定派獎：

```ts
export class CreateAwardOverridesDto {
  @IsString()
  externalId: string;

  @IsArray()
  @ArrayNotEmpty()
  stageNumbers: number[];

  @IsOptional()
  @IsString()
  reason?: string;
}
```

前端如果送錯格式，例如 `stageNumbers` 是空陣列，後端會在進 service 前擋掉。

這是因為 `backend/src/main.ts` 啟用了：

```ts
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

意思是：

- `transform: true`：嘗試把 query/body 轉成 DTO 期待型別。
- `whitelist: true`：DTO 沒宣告的欄位會被移除。
- `forbidNonWhitelisted: true`：送了不允許欄位會直接報錯。

### Guard

Guard 是權限守門員。你的專案使用 JWT guard 保護後控 API。

概念上是：

```text
request 進來
  -> Guard 檢查 Authorization Bearer token
  -> 通過才進 Controller
  -> 不通過回 401
```

這也是為什麼前端 `api/client.ts` 會自動帶：

```ts
config.headers.Authorization = `Bearer ${token}`;
```

### Exception

NestJS 內建很多 HTTP exception：

```ts
throw new BadRequestException('玩家今天 VIP5 已經抽過，不能新增指定派獎。');
throw new NotFoundException('找不到玩家。');
throw new UnauthorizedException('Token 已過期。');
```

這些會被 NestJS 自動轉成 HTTP response，例如 400、404、401。

前端再透過 `getApiErrorMessage()` 把訊息顯示給操作者。

## TypeORM 入門

TypeORM 是 ORM。ORM 是 Object Relational Mapper，意思是把資料表映射成 TypeScript class。

你不用每次都手寫 SQL，而是用 Entity 和 Repository：

```ts
const player = await this.playerRepository.findOne({
  where: { externalId },
});
```

### Entity

Entity 是資料表定義。

例如：

```ts
@Entity({ name: 'players', comment: '玩家主檔' })
export class Player {
  @PrimaryGeneratedColumn('uuid', { comment: '玩家 UUID' })
  id: string;

  @Column({ name: 'external_id', unique: true, comment: '平台玩家 ID' })
  externalId: string;
}
```

這會對應到 MySQL：

```text
players
  id
  external_id
```

常見 decorator：

- `@Entity()`：宣告這是一張表。
- `@Column()`：宣告欄位。
- `@PrimaryGeneratedColumn()`：主鍵，自動產生。
- `@Index()`：索引。
- `@Unique()`：唯一限制。
- `@ManyToOne()`：多對一關聯。
- `@JoinColumn()`：指定 foreign key 欄位。

### Repository

Repository 是操作某張表的工具。每個 Entity 都可以有自己的 Repository。

常見方法：

```ts
repository.find()
repository.findOne()
repository.findOneBy()
repository.create()
repository.save()
repository.update()
repository.delete()
```

例子：

```ts
const progress = await progressRepository.findOne({
  where: { playerId, businessDate },
});

progress.turnoverPoints += dto.amountPoints;
await progressRepository.save(progress);
```

這段就是：

```text
查今日玩家進度
  -> 修改流水
  -> save 回 DB
```

### Relation

Relation 是表和表之間的關係。

例如一個玩家可以有很多每日進度：

```ts
@OneToMany(() => PlayerDailyProgress, (progress) => progress.player)
dailyProgress: PlayerDailyProgress[];
```

而每日進度屬於一個玩家：

```ts
@ManyToOne(() => Player, (player) => player.dailyProgress, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'player_id' })
player: Player;
```

DB 觀念就是：

```text
player_daily_progress.player_id -> players.id
```

### Transaction

Transaction 是交易。當一個流程需要多個 DB 操作一起成功，就要用 transaction。

真實抽獎就是典型例子：

```text
寫 spin_records
消耗 award_override_rules
```

這兩件事不能只成功一半。

所以用：

```ts
return this.dataSource.transaction(async (manager) => {
  const spinRecordRepository = manager.getRepository(SpinRecord);
  const overrideRepository = manager.getRepository(AwardOverrideRule);
});
```

在 transaction 裡要使用 `manager.getRepository()`，不要用外面的 repository，這樣操作才會在同一個交易裡。

### synchronize

目前本機使用：

```ts
synchronize: true
```

意思是 NestJS 啟動時，TypeORM 會根據 Entity 嘗試自動同步 MySQL schema。

優點：

- 開發快。
- 改 Entity 後重啟就能看到欄位。

缺點：

- 正式環境危險。
- 可能自動改表造成資料風險。
- 不容易 code review DB 結構變動。

所以本機可以用，正式環境要改 migration。

## Migration 入門

Migration 是 DB schema 的版本管理。你可以把它想成「資料表結構的 Git commit」。

程式碼有 Git：

```text
commit A: 新增指定派獎功能
commit B: 調整報表查詢
```

DB 也需要版本：

```text
migration A: 建立 award_override_rules
migration B: spin_records 新增 probability_table
```

### 為什麼需要 migration

假設正式環境已經有 10 萬筆抽獎紀錄，現在你要新增欄位：

```text
spin_records.source
```

如果用 `synchronize=true`，TypeORM 可能自動改表，但你很難在部署前精準知道它會跑什麼 SQL。

Migration 則是你明確寫出：

```ts
await queryRunner.query(`
  ALTER TABLE spin_records
  ADD COLUMN source varchar(20) NULL COMMENT '抽獎來源'
`);
```

好處：

- DB 變更可以 code review。
- 可以知道正式環境跑過哪些變更。
- 可以配合部署流程。
- 可以寫 rollback。

### Migration 基本結構

典型 migration 長這樣：

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpinSource1780000000000 implements MigrationInterface {
  name = 'AddSpinSource1780000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spin_records
      ADD COLUMN source varchar(20) NULL COMMENT '抽獎來源'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spin_records
      DROP COLUMN source
    `);
  }
}
```

- `up()`：部署時套用。
- `down()`：需要回滾時撤回。

### 本專案未來導入 migration 的方向

目前尚未導入正式 migration 流程。未來建議：

```text
backend/src/migrations/
  1780000000000-CreateInitialSchema.ts
  1780000001000-AddAwardOverrides.ts
```

並把正式環境設定改成：

```ts
synchronize: false
migrations: [...]
migrationsRun: false
```

正式部署流程：

```text
build backend
run migration
start backend
```

TypeORM 官方也建議：正式環境有資料後，不要依賴 `synchronize: true`，應使用 migrations。

## React 入門

React 是前端 UI 框架。它的核心是 component：把畫面拆成小積木，再由資料決定畫面長什麼樣。

### Component

Component 是一段可以重複使用的 UI。

```tsx
function PlayerBadge({ externalId }: { externalId: string }) {
  return <span>玩家 {externalId}</span>;
}
```

使用時：

```tsx
<PlayerBadge externalId="46466" />
```

### Props

Props 是父元件傳給子元件的資料。它像函式參數。

```tsx
function StageCard({ stageNumber }: { stageNumber: number }) {
  return <div>VIP{stageNumber}</div>;
}
```

`stageNumber` 是 props。子元件不應該直接改 props。

### State

State 是 component 自己的記憶。只要 state 改變，React 就會重新 render。

```tsx
const [externalId, setExternalId] = useState('');
```

意思是：

- `externalId`：目前狀態。
- `setExternalId`：更新狀態的 function。

適合放 state 的資料：

- 使用者輸入。
- 目前選中的 stage。
- modal 是否開啟。
- API 回來後要顯示的資料。

不適合放 state 的資料：

- 可以從其他 state 算出來的資料。
- 固定不變的設定。
- 父層已經透過 props 傳下來的資料。

### Hook

Hook 是 React function component 使用 React 能力的方式。Hook 名稱通常以 `use` 開頭。

常見 Hook：

```ts
useState      元件記憶
useEffect     副作用，例如載入資料、設定 timer
useMemo       避免重複計算
useCallback   避免重複建立 function
```

例子：

```tsx
useEffect(() => {
  void loadPlayer();
}, [externalId]);
```

意思是 `externalId` 變了，就重新執行 `loadPlayer()`。

### React Router

React Router 負責前端路由。

你的 `frontend/src/App.tsx` 有：

```tsx
<Route path="/players" element={<PlayerLookupPage />} />
<Route path="/award-overrides" element={<AwardOverridesPage />} />
<Route path="/reports" element={<ReportsPage />} />
```

意思是：

```text
/players          -> PlayerLookupPage
/award-overrides  -> AwardOverridesPage
/reports          -> ReportsPage
```

### TanStack Query

TanStack Query 負責管理 API 資料狀態，例如：

- loading。
- error。
- data。
- refetch。
- cache。

這讓頁面不用自己重複管理很多 API 狀態。

第一版有些頁面仍直接用 axios 和 local state，之後如果頁面變複雜，可以逐步改成 TanStack Query。

### Ant Design

Ant Design 是 UI 元件庫。你的後控大量使用：

- `Form`
- `Input`
- `Button`
- `Table`
- `Tag`
- `Card`
- `Alert`

這些元件能讓後控快速有一致 UI，不需要每個按鈕、表格都自己從零寫 CSS。

## 本專案框架對照表

```text
想找畫面
  -> frontend/src/pages

想找共用畫面外框
  -> frontend/src/components/AppLayout.tsx

想找 API 呼叫
  -> frontend/src/api/client.ts

想找 API route
  -> backend/src/<module>/<module>.controller.ts

想找業務邏輯
  -> backend/src/<module>/<module>.service.ts

想找 DB table
  -> backend/src/<module>/entities/*.entity.ts

想找 request body 格式
  -> backend/src/<module>/dto/*.dto.ts

想找純規則
  -> backend/src/domain

想找測試
  -> *.spec.ts
```

## 以本專案功能理解框架

### 查詢玩家

```text
PlayerLookupPage.tsx
  -> fetchPlayerByExternalId()
  -> GET /players?externalId=...
  -> PlayersController
  -> PlayersService
  -> Player Entity / PlayerDailyProgress Entity / SpinRecord Entity
  -> MySQL
```

### 後控加流水

```text
PlayerLookupPage.tsx
  -> POST /players/:playerId/turnover-adjustments
  -> TurnoverController
  -> TurnoverService
  -> calculateUnlockedStage()
  -> player_daily_progress
  -> turnover_adjustments
```

### 真實抽獎

```text
webview.html
  -> POST /spins/real
  -> SpinsController
  -> SpinsService
  -> DemoTokenService
  -> validateRealSpinRule()
  -> AwardOverridesService
  -> ProbabilityService
  -> spin_records
```

### 指定派獎

```text
AwardOverridesPage.tsx 或 PlayerLookupPage.tsx
  -> POST /award-overrides
  -> AwardOverridesController
  -> AwardOverridesService
  -> award_override_rules
```

玩家真的抽到該 VIP 時：

```text
SpinsService.realSpin()
  -> findPendingForSpin()
  -> drawPrizeForTable(stage, 'prize')
  -> spin_records.probability_table = 'prize'
  -> award_override_rules.status = 'consumed'
```

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
