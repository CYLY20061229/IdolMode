ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_age_range;

ALTER TABLE profiles
ADD CONSTRAINT profiles_age_range
CHECK (age IS NULL OR (age >= 13 AND age <= 120));
