-- user_memories：AI 从用户营业消息中抽取的记忆
-- id 由后端 crypto.randomUUID() 生成，时间字段由后端 Date.now() 写入
CREATE TABLE IF NOT EXISTS user_memories (
  id                TEXT     PRIMARY KEY,
  user_id           TEXT     NOT NULL,
  -- 'life_event' | 'preference' | 'habit' | 'creative_context' | 'emotion'
  memory_type       TEXT     NOT NULL,
  content           TEXT     NOT NULL,   -- 自然语言描述，最多 200 字
  importance        INTEGER  NOT NULL DEFAULT 3,  -- 1-5，5 最重要
  source_message_id TEXT,                -- 触发这条记忆的 self_message.id
  source_preview    TEXT,                -- 原始消息前 50 字
  mention_count     INTEGER  NOT NULL DEFAULT 0,
  last_mentioned_at BIGINT,
  last_seen_at      BIGINT   NOT NULL,   -- 后端写入 Date.now()
  archived          BOOLEAN  NOT NULL DEFAULT false,
  user_suppressed   BOOLEAN  NOT NULL DEFAULT false,  -- 用户"不再提起"
  hash              TEXT     NOT NULL,   -- SHA-256(user_id + ':' + normalized_content)
  created_at        BIGINT   NOT NULL    -- 后端写入 Date.now()
);

-- 去重索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_hash
  ON user_memories (hash);

-- 按用户查询（管理页 + 生成时选取）
CREATE INDEX IF NOT EXISTS idx_user_memories_user
  ON user_memories (user_id, archived, importance DESC);

-- 按最后提及时间（选取"久未提"记忆）
CREATE INDEX IF NOT EXISTS idx_user_memories_mention
  ON user_memories (user_id, last_mentioned_at NULLS FIRST);

-- 按最后看到时间（归档判断）
CREATE INDEX IF NOT EXISTS idx_user_memories_seen
  ON user_memories (user_id, last_seen_at);
