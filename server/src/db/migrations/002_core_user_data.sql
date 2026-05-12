CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE,
  auth_provider text NOT NULL DEFAULT 'device',
  phone text UNIQUE,
  email text UNIQUE,
  apple_sub text UNIQUE,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT 'New Idol',
  signature text NOT NULL DEFAULT 'Tonight I am practicing how to shine softly.',
  email text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT 'IM',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artists (
  id text PRIMARY KEY,
  nickname text NOT NULL,
  avatar text NOT NULL,
  background text NOT NULL,
  bio text NOT NULL,
  signature text NOT NULL,
  identity text NOT NULL,
  fans text NOT NULL,
  intro text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artist_friends (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id text NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE IF NOT EXISTS self_messages (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent')),
  display_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS fan_messages (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_self_message_id text REFERENCES self_messages(id) ON DELETE SET NULL,
  fan_name text NOT NULL,
  avatar text NOT NULL,
  language text NOT NULL CHECK (language IN ('zh', 'en', 'ko', 'jp', 'es')),
  content text NOT NULL,
  translated_content text NOT NULL,
  persona_type text,
  message_kind text CHECK (message_kind IN ('ambient', 'reaction')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idol_chat_messages (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id text NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('artist', 'user')),
  text text NOT NULL,
  display_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_message_id text,
  operation text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_artist_friends_user_id ON artist_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_self_messages_user_id_created_at ON self_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_messages_user_id_created_at ON fan_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idol_chat_messages_user_artist_created_at ON idol_chat_messages(user_id, artist_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_user_created_at ON ai_generation_jobs(user_id, created_at DESC);

INSERT INTO artists (id, nickname, avatar, background, bio, signature, identity, fans, intro)
VALUES
  ('artist-1', 'Mira Vale', 'MV', '#EADDF8', 'A dreamy solo artist who sends late-night voice-note energy.', 'Tiny moon, big stage.', 'Solo Artist', '82.4K', 'Mira writes warm synth-pop and leaves tiny notes for fans after rehearsal.'),
  ('artist-2', 'Nova Rin', 'NR', '#DCEEFF', 'Virtual idol with a soft glitch heart and cosmic dance breaks.', 'Signal found. Heart online.', 'Virtual Idol', '146K', 'Nova appears in digital stages and treats every chat like a secret constellation.'),
  ('artist-3', 'Eden Skye', 'ES', '#F3D7E5', 'Band vocal with gentle chaos, coffee lyrics, and sunrise rehearsals.', 'Still singing, still here.', 'Band Vocal', '57.9K', 'Eden is the main vocal of a fictional indie band and loves sending rehearsal diary messages.'),
  ('artist-4', 'Sora Bloom', 'SB', '#E3F4E8', 'Soft-spoken dance performer who collects little fan wishes.', 'One more step toward you.', 'Dance Artist', '39.1K', 'Sora shares small behind-the-scenes moments, sleepy updates, and practice-room courage.')
ON CONFLICT (id) DO UPDATE SET
  nickname = EXCLUDED.nickname,
  avatar = EXCLUDED.avatar,
  background = EXCLUDED.background,
  bio = EXCLUDED.bio,
  signature = EXCLUDED.signature,
  identity = EXCLUDED.identity,
  fans = EXCLUDED.fans,
  intro = EXCLUDED.intro,
  updated_at = now();
