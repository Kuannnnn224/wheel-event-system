-- Node 8 Express backend latest App integration schema baseline.
-- The backend stores platform player IDs directly in playerId and does not maintain player/session tables.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS spinRecords (
  id varchar(36) NOT NULL COMMENT '抽獎紀錄 ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID，由 App 服務帶入',
  businessDate varchar(10) NOT NULL COMMENT '活動業務日期 YYYY-MM-DD',
  stageNumber tinyint unsigned NOT NULL COMMENT '抽獎階段 LV1-LV5',
  prizeName varchar(120) NOT NULL COMMENT '中獎獎項名稱',
  amountPoints int unsigned NOT NULL DEFAULT 0 COMMENT '派發點數',
  createdAt int unsigned NOT NULL COMMENT '建立時間 Unix timestamp 秒',
  probabilityTable varchar(10) NOT NULL DEFAULT 'low' COMMENT '使用的機率表 low/high/prize/dailyLimit',
  PRIMARY KEY (id),
  UNIQUE KEY uq_spinRecords_player_date_stage (playerId, businessDate, stageNumber),
  KEY idx_spinRecords_playerId (playerId),
  KEY idx_spinRecords_businessDate (businessDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='真實抽獎紀錄';

CREATE TABLE IF NOT EXISTS awardOverrideRules (
  id varchar(36) NOT NULL COMMENT '指定派獎規則 ID',
  playerId varchar(120) NOT NULL COMMENT '平台玩家 ID，由 App 服務帶入',
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
  UNIQUE KEY uq_awardOverrideRules_pendingKey (pendingKey),
  KEY idx_awardOverrideRules_businessDate (businessDate),
  KEY idx_awardOverrideRules_player_date (playerId, businessDate),
  KEY idx_awardOverrideRules_status (status),
  KEY idx_awardOverrideRules_consumedSpinRecordId (consumedSpinRecordId),
  CONSTRAINT fk_awardOverrideRules_spin FOREIGN KEY (consumedSpinRecordId) REFERENCES spinRecords (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='後控指定派獎規則';
