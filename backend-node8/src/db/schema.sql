-- Node 8 Express backend reference schema.
-- This is a non-destructive schema baseline for new environments.
-- Existing production databases should be compared before applying migrations.

CREATE TABLE IF NOT EXISTS admin_users (
  id varchar(36) NOT NULL COMMENT '管理員 ID',
  username varchar(80) NOT NULL COMMENT '管理員登入帳號',
  password_hash varchar(255) NOT NULL COMMENT '管理員密碼雜湊',
  is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  created_at int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updated_at int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='後控管理員帳號';

CREATE TABLE IF NOT EXISTS players (
  id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  created_at int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updated_at int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  KEY idx_players_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家主檔';

CREATE TABLE IF NOT EXISTS player_daily_progress (
  id varchar(36) NOT NULL COMMENT '玩家每日進度 ID',
  player_id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  business_date varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  turnover_points int unsigned NOT NULL DEFAULT 0 COMMENT '當日累積流水點數',
  unlocked_stage tinyint unsigned NOT NULL DEFAULT 0 COMMENT '已解鎖最高階段',
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_daily_progress_player_date (player_id, business_date),
  KEY idx_player_daily_progress_business_date (business_date),
  CONSTRAINT fk_player_daily_progress_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家每日流水與階段進度';

CREATE TABLE IF NOT EXISTS spin_records (
  id varchar(36) NOT NULL COMMENT '抽獎紀錄 ID',
  player_id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  business_date varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  stage_number tinyint unsigned NOT NULL COMMENT '抽獎階段 LV1-LV5',
  prize_config_id int NULL COMMENT '舊版獎項設定 ID，Node 8 runtime 目前不依賴',
  prize_name varchar(120) NOT NULL COMMENT '中獎獎項名稱',
  amount_points int unsigned NOT NULL DEFAULT 0 COMMENT '派發點數',
  created_at int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  probability_table varchar(10) NOT NULL DEFAULT 'low' COMMENT '使用的機率表 low/high/prize/dailyLimit',
  PRIMARY KEY (id),
  UNIQUE KEY uq_spin_records_player_date_stage (player_id, business_date, stage_number),
  KEY idx_spin_records_business_date (business_date),
  CONSTRAINT fk_spin_records_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='真實抽獎紀錄';

CREATE TABLE IF NOT EXISTS award_override_rules (
  id varchar(36) NOT NULL COMMENT '指定派獎規則 ID',
  player_id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  business_date varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  stage_number tinyint unsigned NOT NULL COMMENT '指定派獎階段 LV1-LV5',
  status varchar(20) NOT NULL DEFAULT 'pending' COMMENT '規則狀態 pending/consumed/cancelled',
  pending_key varchar(180) NULL COMMENT '未消耗規則唯一鍵',
  reason varchar(255) NULL COMMENT '後控建立或取消原因',
  created_by_admin_id varchar(36) NULL COMMENT '建立管理員 ID',
  cancelled_by_admin_id varchar(36) NULL COMMENT '取消管理員 ID',
  consumed_spin_record_id varchar(36) NULL COMMENT '消耗此規則的抽獎紀錄 ID',
  created_at int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  updated_at int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  consumed_at int unsigned NULL COMMENT '消耗時間 Unix timestamp 秒',
  cancelled_at int unsigned NULL COMMENT '取消時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_award_override_rules_pending_key (pending_key),
  KEY idx_award_override_rules_business_date (business_date),
  KEY idx_award_override_rules_player_date (player_id, business_date),
  KEY idx_award_override_rules_status (status),
  CONSTRAINT fk_award_override_rules_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_award_override_rules_spin FOREIGN KEY (consumed_spin_record_id) REFERENCES spin_records (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='後控指定派獎規則';

CREATE TABLE IF NOT EXISTS webview_sessions (
  id varchar(36) NOT NULL COMMENT 'Webview session ID',
  player_id varchar(120) NOT NULL COMMENT '平台玩家 ID',
  token varchar(128) NOT NULL COMMENT 'Webview 啟動驗證 token',
  expires_at int unsigned NOT NULL COMMENT 'Session 到期時間 Unix timestamp 秒',
  created_at int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  PRIMARY KEY (id),
  UNIQUE KEY uq_webview_sessions_token (token),
  KEY idx_webview_sessions_player_id (player_id),
  CONSTRAINT fk_webview_sessions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='App Webview 存取 session';
