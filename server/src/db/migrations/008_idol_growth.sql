-- 008_idol_growth.sql
-- 偶像成长系统：营业值、粉丝数、连续营业、掉粉机制

CREATE TABLE IF NOT EXISTS idol_growth_stats (
  user_id                TEXT     PRIMARY KEY,

  -- 每日营业值（每天上限 100，每日结算后重置）
  daily_business_value   INTEGER  NOT NULL DEFAULT 0,

  -- 粉丝数
  followers              INTEGER  NOT NULL DEFAULT 0,

  -- 累计 echo（历史营业值总和，用于未来扩展）
  total_echo             INTEGER  NOT NULL DEFAULT 0,

  -- 连续营业天数
  streak_days            INTEGER  NOT NULL DEFAULT 0,

  -- 连续未营业天数（用于掉粉计算）
  inactive_days          INTEGER  NOT NULL DEFAULT 0,

  -- 最后一次营业日期（YYYY-MM-DD，UTC+8）
  last_active_date       TEXT,

  -- 最后一次每日结算日期（YYYY-MM-DD，UTC+8）
  last_settlement_date   TEXT,

  -- 账号创建日期（用于新用户 7 天保护期）
  created_date           TEXT     NOT NULL DEFAULT '',

  -- 已解锁成就 ID 列表（JSON 数组字符串）
  unlocked_achievements  TEXT     NOT NULL DEFAULT '[]',

  -- 已解锁粉丝人格（JSON 数组字符串，预留扩展）
  unlocked_personas      TEXT     NOT NULL DEFAULT '[]',

  -- 初始粉丝数（掉粉下限保护）
  initial_followers      INTEGER  NOT NULL DEFAULT 0,

  updated_at             BIGINT   NOT NULL DEFAULT 0
);

-- 按 followers 排序索引（未来排行榜用）
CREATE INDEX IF NOT EXISTS idx_growth_followers
  ON idol_growth_stats (followers DESC);
