ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS email_encrypted text,
  ADD COLUMN IF NOT EXISTS email_masked text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at bigint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash
  ON users (email_hash)
  WHERE email_hash IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS email_codes (
  id text PRIMARY KEY,
  email_hash text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL,
  ip_hash text,
  expires_at bigint NOT NULL,
  consumed_at bigint,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_codes_email_active
  ON email_codes (email_hash, purpose, consumed_at, expires_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_codes_email_created
  ON email_codes (email_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_codes_ip_created
  ON email_codes (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  started_at bigint,
  expires_at bigint,
  source text NOT NULL DEFAULT 'system',
  updated_at bigint NOT NULL
);

ALTER TABLE user_entitlements
  ALTER COLUMN source SET DEFAULT 'system';

CREATE TABLE IF NOT EXISTS usage_quotas (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date text NOT NULL,
  ai_reaction_used integer NOT NULL DEFAULT 0,
  image_used integer NOT NULL DEFAULT 0,
  voice_used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

DROP TABLE IF EXISTS sms_codes;

ALTER TABLE users
  DROP COLUMN IF EXISTS phone_hash,
  DROP COLUMN IF EXISTS phone_encrypted,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS is_phone_verified;
