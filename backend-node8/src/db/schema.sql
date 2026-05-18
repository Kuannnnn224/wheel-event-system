-- Node 8 Express backend reference schema.
-- This is a non-destructive schema baseline for new environments.
-- Existing production databases should be compared before applying migrations.

CREATE TABLE IF NOT EXISTS admin_users (
  id varchar(36) NOT NULL COMMENT '管理員 ID',
  username varchar(80) NOT NULL COMMENT '管理員登入帳號',
  passwordHash varchar(255) NOT NULL COMMENT '管理員密碼雜湊',
  isActive tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='後控管理員帳號';

CREATE TABLE IF NOT EXISTS players (
  id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  KEY idx_players_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家主檔';

CREATE TABLE IF NOT EXISTS player_daily_progress (
  id varchar(36) NOT NULL COMMENT '玩家每日進度 ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  turnoverPoints int unsigned NOT NULL DEFAULT 0 COMMENT '當日累積流水點數',
  unlockedStage tinyint unsigned NOT NULL DEFAULT 0 COMMENT '已解鎖最高階段',
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_daily_progress_player_date (playerId, businessDate),
  KEY idx_player_daily_progress_businessDate (businessDate),
  CONSTRAINT fk_player_daily_progress_player FOREIGN KEY (playerId) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家每日流水與階段進度';

CREATE TABLE IF NOT EXISTS spin_records (
  id varchar(36) NOT NULL COMMENT '抽獎紀錄 ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  stageNumber tinyint unsigned NOT NULL COMMENT '抽獎階段 LV1-LV5',
  prizeConfigId int NULL COMMENT '舊版獎項設定 ID，Node 8 runtime 目前不依賴',
  prizeName varchar(120) NOT NULL COMMENT '中獎獎項名稱',
  amountPoints int unsigned NOT NULL DEFAULT 0 COMMENT '派發點數',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  probabilityTable varchar(10) NOT NULL DEFAULT 'low' COMMENT '使用的機率表 low/high/prize/dailyLimit',
  PRIMARY KEY (id),
  UNIQUE KEY uq_spin_records_player_date_stage (playerId, businessDate, stageNumber),
  KEY idx_spin_records_businessDate (businessDate),
  CONSTRAINT fk_spin_records_player FOREIGN KEY (playerId) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='真實抽獎紀錄';

CREATE TABLE IF NOT EXISTS award_override_rules (
  id varchar(36) NOT NULL COMMENT '指定派獎規則 ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  stageNumber tinyint unsigned NOT NULL COMMENT '指定派獎階段 LV1-LV5',
  status varchar(20) NOT NULL DEFAULT 'pending' COMMENT '規則狀態 pending/consumed/cancelled',
  pendingKey varchar(180) NULL COMMENT '未消耗規則唯一鍵',
  reason varchar(255) NULL COMMENT '後控建立或取消原因',
  createdByAdminId varchar(36) NULL COMMENT '建立管理員 ID',
  cancelledByAdminId varchar(36) NULL COMMENT '取消管理員 ID',
  consumedSpinRecordId varchar(36) NULL COMMENT '消耗此規則的抽獎紀錄 ID',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  consumedAt int unsigned NULL COMMENT '消耗時間 Unix timestamp 秒',
  cancelledAt int unsigned NULL COMMENT '取消時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_award_override_rules_pendingKey (pendingKey),
  KEY idx_award_override_rules_businessDate (businessDate),
  KEY idx_award_override_rules_player_date (playerId, businessDate),
  KEY idx_award_override_rules_status (status),
  CONSTRAINT fk_award_override_rules_player FOREIGN KEY (playerId) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_award_override_rules_spin FOREIGN KEY (consumedSpinRecordId) REFERENCES spin_records (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='後控指定派獎規則';

CREATE TABLE IF NOT EXISTS webview_sessions (
  id varchar(36) NOT NULL COMMENT 'Webview session ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  token varchar(128) NOT NULL COMMENT 'Webview 啟動驗證 token',
  expiresAt int unsigned NOT NULL COMMENT 'Session 到期時間 Unix timestamp 秒',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_webview_sessions_token (token),
  KEY idx_webview_sessions_playerId (playerId),
  CONSTRAINT fk_webview_sessions_player FOREIGN KEY (playerId) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='App Webview 存取 session';
