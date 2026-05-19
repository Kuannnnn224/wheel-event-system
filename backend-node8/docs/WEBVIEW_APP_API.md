# Webview App API 對接文件

這個分支只保留正式 App / Webview 對接會用到的 API。

流程很單純：

1. App client 呼叫 `POST /api/webview/sessions`，把平台玩家 ID 與當日狀態傳給本服務。
2. 本服務把資料簽成 token，組成靜態 webview URL 回傳。
3. 前端打開 `webviewUrl`。
4. Webview 後續照原流程打 current state 與 real spin。

本服務不維護玩家主檔，也不維護 webview session 表；玩家資料由 App 既有流程提供。

## 保留 API

```text
GET  /api/health
POST /api/webview/sessions
GET  /api/webview/game-config
GET  /api/webview/sessions/current?token=<token>
POST /api/spins/real
```

## Token

Token 由本服務產生，使用 JWT HS256 簽名。secret 讀取 `WEBVIEW_TOKEN_SECRET`，未設定時 fallback 到 `JWT_SECRET`。

Token payload 固定使用：

```json
{
  "playerId": "player-001",
  "timestamp": 1716000000,
  "endpoint": "/webview",
  "turnoverPoints": 1500,
  "unlockedStage": 1
}
```

| 欄位 | 說明 |
| --- | --- |
| `playerId` | 平台玩家 ID，由 App client 傳入。 |
| `timestamp` | token 簽發時間，Unix timestamp 秒。 |
| `endpoint` | 固定 `/webview`，表示此 token 只給 webview 流程使用。 |
| `turnoverPoints` | 玩家當日流水，由 App client 帶入，本服務只保存到 token 並回給 webview 顯示。 |
| `unlockedStage` | 玩家目前已解鎖階段，由 App client 帶入，必填 `0~5`。 |

## 1. 建立 Webview URL

```text
POST /api/webview/sessions
```

用途：App client 呼叫此 API，本服務回傳靜態 webview URL + token。

### Request Body

```json
{
  "playerId": "player-001",
  "turnoverPoints": 1500,
  "unlockedStage": 1
}
```

### Success Response

```json
{
  "player": {
    "id": "player-001"
  },
  "token": "<jwt-token>",
  "issuedAt": 1716000000,
  "expiresAt": 1716001800,
  "webviewUrl": "https://example.com/webview.html?token=<jwt-token>"
}
```

## 2. Webview Game Config

```text
GET /api/webview/game-config
```

取得轉盤渲染需要的階段、流水門檻與獎項顯示資料。

```json
{
  "stages": [
    {
      "stageNumber": 1,
      "turnoverThresholdPoints": 1000,
      "prizes": [
        {
          "rewardCode": "A",
          "name": "PHP 100",
          "amountPoints": 100,
          "sortOrder": 1
        }
      ]
    }
  ]
}
```

## 3. Webview Current State

```text
GET /api/webview/sessions/current?token=<token>
```

用途：Webview 讀取玩家今日狀態。本服務會用 token 內的玩家資料，加上 `spinRecords` 中今日已抽紀錄，組出狀態。

```json
{
  "player": {
    "id": "player-001"
  },
  "issuedAt": 1716000000,
  "expiresAt": 1716001800,
  "businessDate": "2026-05-18",
  "progress": {
    "player": {
      "id": "player-001"
    },
    "businessDate": "2026-05-18",
    "turnoverPoints": 1500,
    "unlockedStage": 1,
    "playedStages": [1],
    "totalWinPoints": 100,
    "spins": [
      {
        "id": "0c9f8b3f-f795-4ea7-9a25-5c0d5e6a7f01",
        "businessDate": "2026-05-18",
        "stageNumber": 1,
        "prizeName": "PHP 100",
        "amountPoints": 100,
        "createdAt": 1716000123
      }
    ]
  }
}
```

## 4. Real Spin

```text
POST /api/spins/real
```

用途：Webview 執行真實抽獎，成功後寫入 `spinRecords`。

### Request Body

```json
{
  "token": "<jwt-token>",
  "stageNumber": 1
}
```

### Success Response

```json
{
  "player": {
    "id": "player-001",
    "turnoverPoints": 1500,
    "unlockedStage": 1
  },
  "businessDate": "2026-05-18",
  "spin": {
    "id": "0c9f8b3f-f795-4ea7-9a25-5c0d5e6a7f01",
    "businessDate": "2026-05-18",
    "stageNumber": 1,
    "prizeName": "PHP 100",
    "amountPoints": 100,
    "createdAt": 1716000123
  },
  "prize": {
    "rewardCode": "A",
    "name": "PHP 100",
    "amountPoints": 100
  }
}
```

## 常見錯誤

| HTTP status | 範例訊息 | 說明 |
| --- | --- | --- |
| `400` | `token must be a string` | 缺少 token。 |
| `400` | `stageNumber must be an integer number` | 抽獎階段不是整數。 |
| `400` | `Stage is not unlocked for this business date.` | 玩家尚未解鎖該階段。 |
| `400` | `Stage was already played for this business date.` | 玩家今天已抽過該階段。 |
| `400` | `Previous stage must be completed first.` | 玩家尚未完成前一階段，不能跳抽。 |
| `401` | `Invalid webview token.` | token 簽名錯誤或格式不正確。 |
| `401` | `Webview token expired.` | token 已超過有效時間。 |
