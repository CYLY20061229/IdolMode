-- 009_profile_extra_fields.sql
-- 给 profiles 表增加 status_text 和 background_image 两个可选字段

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status_text     TEXT,
  ADD COLUMN IF NOT EXISTS background_image TEXT;
