-- ambient_messages：预生成的 ambient 消息池，避免每次 live 请求都调 AI
CREATE TABLE IF NOT EXISTS ambient_messages (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  language      TEXT        NOT NULL DEFAULT 'zh',
  content       TEXT        NOT NULL,
  translated_content TEXT,
  persona_type  TEXT,
  message_kind  TEXT        NOT NULL DEFAULT 'ambient',
  source        TEXT        NOT NULL DEFAULT 'template', -- 'template' | 'ai'
  used_count    INTEGER     NOT NULL DEFAULT 0,
  last_used_at  BIGINT,
  random_key    FLOAT       NOT NULL DEFAULT random(),
  hash          TEXT        NOT NULL,  -- SHA-256(content) 用于去重
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 近似随机查询索引（避免 ORDER BY RANDOM() 全表扫描）
CREATE INDEX IF NOT EXISTS idx_ambient_messages_random_key
  ON ambient_messages (random_key);

-- 去重索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambient_messages_hash
  ON ambient_messages (hash);

-- 按语言过滤索引
CREATE INDEX IF NOT EXISTS idx_ambient_messages_language
  ON ambient_messages (language);

-- reaction_cache：reaction burst 去重缓存，同一 sourceMessageId 只调一次 AI
CREATE TABLE IF NOT EXISTS reaction_cache (
  message_id    TEXT        PRIMARY KEY,
  status        TEXT        NOT NULL DEFAULT 'processing', -- 'processing' | 'done' | 'failed'
  result_json   JSONB,
  created_at    BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::BIGINT * 1000,
  updated_at    BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::BIGINT * 1000
);

-- 清理过期缓存索引（按 created_at 扫描）
CREATE INDEX IF NOT EXISTS idx_reaction_cache_created_at
  ON reaction_cache (created_at);
