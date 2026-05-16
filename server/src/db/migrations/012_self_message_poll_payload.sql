ALTER TABLE self_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'poll')),
  ADD COLUMN IF NOT EXISTS poll jsonb;

CREATE INDEX IF NOT EXISTS idx_self_messages_user_type_created_at
  ON self_messages(user_id, message_type, created_at DESC);
