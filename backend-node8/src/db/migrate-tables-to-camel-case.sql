-- Rename existing Node 8 runtime tables from snake_case to camelCase.
-- Run this after migrate-columns-to-camel-case.sql if the database was created before the camelCase schema change.

RENAME TABLE
  admin_users TO adminUsers,
  player_daily_progress TO playerDailyProgress,
  spin_records TO spinRecords,
  award_override_rules TO awardOverrideRules,
  webview_sessions TO webviewSessions;
