-- Node 8 Express backend reference schema.
-- This is a non-destructive schema baseline for new environments.
-- Existing production databases should be compared before applying migrations.

CREATE TABLE IF NOT EXISTS admin_users (
  id varchar(36) NOT NULL,
  username varchar(80) NOT NULL,
  password_hash varchar(255) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at int unsigned NOT NULL,
  updated_at int unsigned NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS players (
  id varchar(36) NOT NULL,
  external_id varchar(120) NOT NULL,
  created_at int unsigned NOT NULL,
  updated_at int unsigned NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_external_id (external_id),
  KEY idx_players_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS player_daily_progress (
  id varchar(36) NOT NULL,
  player_id varchar(255) NOT NULL,
  business_date varchar(10) NOT NULL,
  turnover_points int unsigned NOT NULL DEFAULT 0,
  unlocked_stage tinyint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_daily_progress_player_date (player_id, business_date),
  KEY idx_player_daily_progress_business_date (business_date),
  CONSTRAINT fk_player_daily_progress_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS spin_records (
  id varchar(36) NOT NULL,
  player_id varchar(255) NOT NULL,
  business_date varchar(10) NOT NULL,
  stage_number tinyint unsigned NOT NULL,
  prize_config_id int NULL,
  prize_name varchar(120) NOT NULL,
  amount_points int unsigned NOT NULL DEFAULT 0,
  created_at int unsigned NOT NULL,
  probability_table varchar(10) NOT NULL DEFAULT 'low',
  PRIMARY KEY (id),
  UNIQUE KEY uq_spin_records_player_date_stage (player_id, business_date, stage_number),
  KEY idx_spin_records_business_date (business_date),
  CONSTRAINT fk_spin_records_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS award_override_rules (
  id varchar(36) NOT NULL,
  player_id varchar(255) NOT NULL,
  business_date varchar(10) NOT NULL,
  stage_number tinyint unsigned NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  pending_key varchar(180) NULL,
  reason varchar(255) NULL,
  created_by_admin_id varchar(36) NULL,
  cancelled_by_admin_id varchar(36) NULL,
  consumed_spin_record_id varchar(36) NULL,
  created_at int unsigned NOT NULL,
  updated_at int unsigned NOT NULL,
  consumed_at int unsigned NULL,
  cancelled_at int unsigned NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_award_override_rules_pending_key (pending_key),
  KEY idx_award_override_rules_business_date (business_date),
  KEY idx_award_override_rules_player_date (player_id, business_date),
  KEY idx_award_override_rules_status (status),
  CONSTRAINT fk_award_override_rules_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_award_override_rules_spin FOREIGN KEY (consumed_spin_record_id) REFERENCES spin_records (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS demo_sessions (
  id varchar(36) NOT NULL,
  player_id varchar(255) NOT NULL,
  token varchar(128) NOT NULL,
  expires_at int unsigned NOT NULL,
  created_at int unsigned NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_demo_sessions_token (token),
  KEY idx_demo_sessions_player_id (player_id),
  CONSTRAINT fk_demo_sessions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS turnover_adjustments (
  id varchar(36) NOT NULL,
  player_id varchar(255) NOT NULL,
  business_date varchar(10) NOT NULL,
  amount_points int unsigned NOT NULL,
  source varchar(40) NOT NULL DEFAULT 'admin',
  reason varchar(255) NULL,
  created_at int unsigned NOT NULL,
  PRIMARY KEY (id),
  KEY idx_turnover_adjustments_player_date (player_id, business_date),
  CONSTRAINT fk_turnover_adjustments_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
