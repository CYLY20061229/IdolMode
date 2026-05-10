CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  executed_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_phrases (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL,
  severity TEXT DEFAULT 'blocked',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS history_messages (
  id TEXT PRIMARY KEY,
  fan_name TEXT,
  avatar TEXT,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  translated_content TEXT,
  persona_type TEXT,
  message_kind TEXT DEFAULT 'history',
  intent TEXT,
  source TEXT DEFAULT 'template',
  safety_level TEXT DEFAULT 'safe',
  weight INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  last_used_at BIGINT,
  batch_id TEXT,
  hash TEXT UNIQUE,
  random_key DOUBLE PRECISION DEFAULT random(),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_messages_pick
ON history_messages (safety_level, used_count, last_used_at, random_key);

CREATE INDEX IF NOT EXISTS idx_history_messages_hash
ON history_messages (hash);

CREATE INDEX IF NOT EXISTS idx_history_messages_intent
ON history_messages (intent);

CREATE INDEX IF NOT EXISTS idx_history_messages_persona
ON history_messages (persona_type);

CREATE TABLE IF NOT EXISTS fan_nicknames (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  category TEXT DEFAULT 'normal',
  language TEXT DEFAULT 'zh',
  weight INTEGER DEFAULT 1,
  safety_level TEXT DEFAULT 'safe',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS fan_personas (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL UNIQUE,
  style TEXT NOT NULL,
  languages TEXT[] DEFAULT ARRAY['zh'],
  weight INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_generated_messages (
  id TEXT PRIMARY KEY,
  idol_message_hash TEXT NOT NULL,
  idol_message TEXT,
  fan_name TEXT,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  translated_content TEXT,
  persona_type TEXT,
  message_kind TEXT DEFAULT 'reaction',
  intent TEXT,
  source TEXT DEFAULT 'ai_generated',
  safety_level TEXT DEFAULT 'safe',
  hash TEXT UNIQUE,
  created_at BIGINT NOT NULL
);
