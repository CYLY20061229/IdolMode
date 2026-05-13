ALTER TABLE profiles
  ALTER COLUMN gender SET DEFAULT 'female';

UPDATE profiles
SET gender = 'female',
    updated_at = now()
WHERE gender IS NULL OR gender = '';
