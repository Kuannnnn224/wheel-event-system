# Webview App API 對接文件

這份文件整理 app/webview 對接會用到的三支 API：

- 真實抽獎：`POST /api/spins/real`
- 轉盤靜態設定：`GET /api/webview/game-config`
- 玩家目前狀態：`GET /api/webview/sessions/current?token=<token>`

建議 app 端一律使用 `/api` prefix：

```text
https://<backend-host>/api
```

目前後端仍保留不加 `/api` 的相容路由，但正式對接建議以本文件的 `/api/...` 為準。

所有 request / response 都是 JSON。

## 1. 真實抽獎 Real Spin

```text
POST /api/spins/real
```

用途：使用 webview session token 執行一次真實抽獎，並寫入抽獎紀錄。

### Request Body

```json
{
  "token": "webview-session-token",
  "stageNumber": 1
}
```

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `token` | string | 是 | Webview session token，通常來自 webview URL query string。 |
| `stageNumber` | number 或 numeric string | 是 | 要抽的階段，必須是 `1~5` 的整數。 |

### Success Response

```json
{
  "player": {
    "id": "player-001",
    "createdAt": 1716000000,
    "updatedAt": 1716000000
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

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `player.id` | string | 平台玩家 ID。 |
| `player.createdAt` | number | Unix timestamp，單位秒。 |
| `player.updatedAt` | number | Unix timestamp，單位秒。 |
| `businessDate` | string | 後端業務日期，格式 `YYYY-MM-DD`。 |
| `spin.id` | string | 本次抽獎紀錄 ID。 |
| `spin.businessDate` | string | 本次抽獎的業務日期。 |
| `spin.stageNumber` | number | 本次抽獎階段。 |
| `spin.prizeName` | string | 寫入抽獎紀錄的獎項顯示名稱。 |
| `spin.amountPoints` | number | 本次獎項點數。 |
| `spin.createdAt` | number | Unix timestamp，單位秒。 |
| `prize.rewardCode` | string | 獎項代碼，通常是 `A~E`。 |
| `prize.name` | string | 機率設定中的獎項名稱。 |
| `prize.amountPoints` | number | 機率設定中的獎項點數。 |

### 常見錯誤

單一錯誤訊息：

```json
{
  "message": "Webview session expired."
}
```

驗證錯誤可能會回傳陣列：

```json
{
  "message": ["stageNumber must be an integer number"]
}
```

| HTTP status | 範例訊息 | 說明 |
| --- | --- | --- |
| `400` | `token must be a string` | Request body 缺少 token 或 token 型別錯誤。 |
| `400` | `stageNumber must be an integer number` | `stageNumber` 不是整數。 |
| `400` | `stageNumber must not be less than 1` | `stageNumber` 小於 1。 |
| `400` | `stageNumber must not be greater than 5` | `stageNumber` 大於 5。 |
| `400` | `Stage is not unlocked for this business date.` | 玩家尚未解鎖該階段。 |
| `400` | `Stage was already played for this business date.` | 玩家今天已抽過該階段。 |
| `400` | `Previous stage must be completed first.` | 玩家尚未完成前一階段，不能跳抽。 |
| `401` | `Webview session expired.` | token 存在，但已過期。 |
| `404` | `Webview session not found.` | token 找不到對應 session。 |

## 2. 轉盤靜態設定 Webview Game Config

```text
GET /api/webview/game-config
```

用途：取得轉盤渲染需要的靜態或半靜態資料，例如 LV 階段、流水門檻、A-E 獎項顯示資料。

建議 webview 初始化時打一次即可，之後輪詢玩家狀態時不用重複抓這支。

### Request

無 query string，無 request body。

### Success Response

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
        },
        {
          "rewardCode": "B",
          "name": "PHP 500",
          "amountPoints": 500,
          "sortOrder": 2
        }
      ]
    }
  ]
}
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `stages` | array | 階段設定，正常會有 5 筆，代表 `LV1~LV5`。 |
| `stages[].stageNumber` | number | 階段編號，`1~5`。 |
| `stages[].turnoverThresholdPoints` | number | 解鎖該階段需要的流水點數。 |
| `stages[].prizes` | array | 該階段的獎項顯示資料。 |
| `stages[].prizes[].rewardCode` | string | 獎項代碼，通常是 `A~E`。 |
| `stages[].prizes[].name` | string | 獎項顯示名稱。 |
| `stages[].prizes[].amountPoints` | number | 獎項點數。 |
| `stages[].prizes[].sortOrder` | number | 後台/設定檔中的排序值。 |

## 3. 目前 Webview Session 狀態

```text
GET /api/webview/sessions/current?token=<token>
```

用途：取得 token 對應玩家的目前狀態，例如今日流水、已解鎖階段、已抽過階段、抽獎紀錄。

這支 API **不包含** 轉盤靜態設定；轉盤設定請打 `/api/webview/game-config`。

### Query Parameters

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `token` | string | 是 | Webview session token。 |

### Success Response

```json
{
  "player": {
    "id": "player-001",
    "createdAt": 1716000000,
    "updatedAt": 1716000000
  },
  "expiresAt": 1716001800,
  "businessDate": "2026-05-18",
  "progress": {
    "player": {
      "id": "player-001",
      "createdAt": 1716000000,
      "updatedAt": 1716000000
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

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `player` | object | token 綁定的玩家。 |
| `player.id` | string | 平台玩家 ID。 |
| `player.createdAt` | number | Unix timestamp，單位秒。 |
| `player.updatedAt` | number | Unix timestamp，單位秒。 |
| `expiresAt` | number | session 過期時間，Unix timestamp，單位秒。 |
| `businessDate` | string | 後端業務日期，格式 `YYYY-MM-DD`。 |
| `progress.player` | object | daily progress service 回傳的玩家物件，內容同 `player`。 |
| `progress.businessDate` | string | 進度快照所屬業務日期。 |
| `progress.turnoverPoints` | number | 玩家當日流水點數。 |
| `progress.unlockedStage` | number | 目前已解鎖最高階段，`0` 代表尚未解鎖任何階段。 |
| `progress.playedStages` | number[] | 玩家今天已抽過的階段編號。 |
| `progress.totalWinPoints` | number | 玩家今天累計中獎點數。 |
| `progress.spins` | array | 玩家今天的抽獎紀錄。 |
| `progress.spins[].id` | string | 抽獎紀錄 ID。 |
| `progress.spins[].businessDate` | string | 抽獎紀錄所屬業務日期。 |
| `progress.spins[].stageNumber` | number | 抽獎階段。 |
| `progress.spins[].prizeName` | string | 獎項顯示名稱。 |
| `progress.spins[].amountPoints` | number | 獎項點數。 |
| `progress.spins[].createdAt` | number | Unix timestamp，單位秒。 |

### 常見錯誤

| HTTP status | 範例訊息 | 說明 |
| --- | --- | --- |
| `400` | `token is required.` | 缺少 `token` query parameter。 |
| `401` | `Webview session expired.` | token 存在，但已過期。 |
| `404` | `Webview session not found.` | token 找不到對應 session。 |

## 建議 Webview 串接流程

1. app 產生 webview URL，URL query string 需帶 `token`。
2. webview 初始化時打 `GET /api/webview/game-config`，取得轉盤階段、流水門檻、獎項顯示資料。
3. webview 初始化時打 `GET /api/webview/sessions/current?token=<token>`，取得玩家目前狀態。
4. 若玩家尚未達到可抽條件，可輪詢 `GET /api/webview/sessions/current?token=<token>` 更新流水與解鎖狀態。
5. 玩家可抽時，打 `POST /api/spins/real`。
6. 真實抽獎成功後，再打一次 `GET /api/webview/sessions/current?token=<token>` 更新已抽階段與中獎紀錄。

## 共用錯誤格式

一般錯誤：

```json
{
  "message": "Webview session expired."
}
```

驗證錯誤：

```json
{
  "message": [
    "stageNumber must be an integer number"
  ]
}
```
