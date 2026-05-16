CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fan_notifications_enabled boolean NOT NULL DEFAULT false,
  auto_translate_enabled boolean NOT NULL DEFAULT false,
  updated_at bigint NOT NULL DEFAULT 0
);

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS auto_translate_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS oss_deletion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  object_key text NOT NULL,
  source text NOT NULL DEFAULT 'account_deletion',
  status text NOT NULL DEFAULT 'pending',
  created_at bigint NOT NULL,
  processed_at bigint,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_oss_deletion_queue_status_created
  ON oss_deletion_queue (status, created_at);
