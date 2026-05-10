# APP 平台與轉盤服務整合流程圖

這份文件用來跟 APP server 負責人討論正式整合方式。核心原則是：轉盤服務只負責活動規則、抽獎紀錄、預算控管；玩家資產、信箱、錢包仍由 APP 平台負責。

## 如何打開流程圖

以下區塊都是 Mermaid 圖。可以用這幾種方式查看：

1. 貼到 Mermaid Live Editor：https://mermaid.live/
2. 在 GitHub / GitLab 直接看 Markdown。
3. 用 VS Code Markdown Preview 搭配 Mermaid preview extension。

## 整體架構

```mermaid
flowchart LR
  App["APP 前端"]
  AppServer["APP Server<br/>玩家帳號 / 流水 / 錢包 / 信箱"]
  WheelServer["轉盤 Server<br/>活動規則 / 抽獎 / 預算控管"]
  WheelDB[("轉盤 DB<br/>progress / spin_records")]
  AppDB[("APP DB<br/>玩家資產 / 信箱 / 錢包")]

  App -->|"1. 要求轉盤 URL"| AppServer
  AppServer -->|"2. 建立 token<br/>externalId + turnoverPoints<br/>X-Platform-Api-Key"| WheelServer
  WheelServer -->|"3. 寫入/更新活動進度"| WheelDB
  WheelServer -->|"4. 回傳 webviewUrl + token"| AppServer
  AppServer -->|"5. 回傳 webviewUrl"| App

  App -->|"6. 開啟 Webview"| WheelServer
  WheelServer -->|"7. 查活動狀態 / 抽獎"| WheelDB

  WheelServer -->|"8. 中獎通知 event / API"| AppServer
  AppServer -->|"9. 發信箱 / 入帳"| AppDB

  AppServer -. "不能直接寫" .-> WheelDB
  WheelServer -. "不能直接寫" .-> AppDB
```

## 正式開啟 Webview 流程

```mermaid
sequenceDiagram
  participant App as APP 前端
  participant AppServer as APP Server
  participant Wheel as 轉盤 Server
  participant WheelDB as 轉盤 DB

  App->>AppServer: 我要打開轉盤活動
  AppServer->>AppServer: 查玩家 ID、今日累積流水

  AppServer->>Wheel: POST /demo/session<br/>X-Platform-Api-Key<br/>{ externalId, turnoverPoints }
  Wheel->>Wheel: 驗證 API Key
  Wheel->>WheelDB: 建立/更新 player_daily_progress<br/>turnoverPoints 只增不降
  Wheel->>WheelDB: 建立 demo_session token
  Wheel-->>AppServer: 回傳 webviewUrl + token + expiresAt

  AppServer-->>App: 回傳 webviewUrl
  App->>Wheel: 開啟 Webview URL
```

## Webview 抽獎與發獎流程

```mermaid
sequenceDiagram
  participant App as APP Webview
  participant Wheel as 轉盤 Server
  participant WheelDB as 轉盤 DB
  participant AppServer as APP Server
  participant AppDB as APP DB / 信箱 / 錢包

  App->>Wheel: GET /demo/session?token=...
  Wheel->>WheelDB: 查玩家今日進度、已抽階段
  Wheel-->>App: 回傳可顯示狀態

  App->>Wheel: POST /spins/real<br/>{ token, stageNumber }
  Wheel->>WheelDB: 查 progress + 今日 spin_records
  Wheel->>Wheel: 檢查是否解鎖、是否跳階、是否已抽
  Wheel->>Wheel: 抽獎 + dailyLimit 控管
  Wheel->>WheelDB: 寫 spin_records
  Wheel-->>App: 回傳中獎結果

  Wheel->>AppServer: POST /internal/wheel/reward<br/>eventId + externalId + amountPoints
  AppServer->>AppServer: 用 eventId 防重
  AppServer->>AppDB: 發信箱 / 入錢包
  AppServer-->>Wheel: 發獎成功
  Wheel->>WheelDB: 標記 payout delivered
```

## 責任邊界

```mermaid
flowchart TB
  subgraph AppSide["APP 平台負責"]
    A1["玩家登入身份"]
    A2["玩家今日流水來源"]
    A3["錢包 / 信箱 / 玩家資產"]
    A4["實際發獎與防重入帳"]
  end

  subgraph WheelSide["轉盤服務負責"]
    W1["webview token"]
    W2["活動進度 player_daily_progress"]
    W3["抽獎規則 / 解鎖 / 防重抽"]
    W4["機率表 / dailyLimit 預算控管"]
    W5["spin_records / 活動報表"]
  end

  AppSide -->|"API / event 溝通"| WheelSide
  WheelSide -->|"發獎通知"| AppSide
```

## 對接重點

- APP Server 建立 webview URL 時，要把玩家平台 ID 與今日流水快照傳給轉盤服務。
- Webview URL 只放 token，不放流水，避免玩家竄改。
- Webview 開啟後，玩家端 API 直接打轉盤服務，不繞回 APP Server。
- 中獎後，轉盤服務不直接碰 APP DB，而是通知 APP Server 發獎。
- APP Server 發獎時要用 `eventId` 或類似欄位做防重，避免同一筆中獎通知重複入帳。
- APP Server 不直接寫轉盤 DB；轉盤服務也不直接寫 APP DB。
