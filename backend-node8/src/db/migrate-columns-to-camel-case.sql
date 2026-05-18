-- Rename existing Node 8 runtime columns from snake_case to camelCase.
-- Use this only for local/staging databases that were created before the camelCase column change.

ALTER TABLE admin_users
  CHANGE password_hash passwordHash varchar(255) NOT NULL COMMENT '管理員密碼雜湊',
  CHANGE is_active isActive tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  CHANGE created_at createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  CHANGE updated_at updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒';

ALTER TABLE players
  CHANGE created_at createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  CHANGE updated_at updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒';

ALTER TABLE player_daily_progress
  CHANGE player_id playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  CHANGE business_date businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  CHANGE turnover_points turnoverPoints int unsigned NOT NULL DEFAULT 0 COMMENT '當日累積流水點數',
  CHANGE unlocked_stage unlockedStage tinyint unsigned NOT NULL DEFAULT 0 COMMENT '已解鎖最高階段';

ALTER TABLE spin_records
  CHANGE player_id playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  CHANGE business_date businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  CHANGE stage_number stageNumber tinyint unsigned NOT NULL COMMENT '抽獎階段 LV1-LV5',
  CHANGE prize_config_id prizeConfigId int NULL COMMENT '舊版獎項設定 ID，Node 8 runtime 目前不依賴',
  CHANGE prize_name prizeName varchar(120) NOT NULL COMMENT '中獎獎項名稱',
  CHANGE amount_points amountPoints int unsigned NOT NULL DEFAULT 0 COMMENT '派發點數',
  CHANGE created_at createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  CHANGE probability_table probabilityTable varchar(10) NOT NULL DEFAULT 'low' COMMENT '使用的機率表 low/high/prize/dailyLimit';

ALTER TABLE award_override_rules
  CHANGE player_id playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  CHANGE business_date businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  CHANGE stage_number stageNumber tinyint unsigned NOT NULL COMMENT '指定派獎階段 LV1-LV5',
  CHANGE pending_key pendingKey varchar(180) NULL COMMENT '未消耗規則唯一鍵',
  CHANGE created_by_admin_id createdByAdminId varchar(36) NULL COMMENT '建立管理員 ID',
  CHANGE cancelled_by_admin_id cancelledByAdminId varchar(36) NULL COMMENT '取消管理員 ID',
  CHANGE consumed_spin_record_id consumedSpinRecordId varchar(36) NULL COMMENT '消耗此規則的抽獎紀錄 ID',
  CHANGE created_at createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  CHANGE updated_at updatedAt int unsigned NOT NULL COMMENT '更新時間 Unix timestamp 秒',
  CHANGE consumed_at consumedAt int unsigned NULL COMMENT '消耗時間 Unix timestamp 秒',
  CHANGE cancelled_at cancelledAt int unsigned NULL COMMENT '取消時間 Unix timestamp 秒';

ALTER TABLE webview_sessions
  CHANGE player_id playerId varchar(120) NOT NULL COMMENT '平台玩家 ID',
  CHANGE expires_at expiresAt int unsigned NOT NULL COMMENT 'Session 到期時間 Unix timestamp 秒',
  CHANGE created_at createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒';
