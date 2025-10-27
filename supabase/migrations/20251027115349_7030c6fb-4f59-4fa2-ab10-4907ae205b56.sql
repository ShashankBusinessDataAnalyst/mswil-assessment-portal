-- Update user_id for all existing profiles based on their auth email
-- Extract the userId from the email format (userId@company.local)
UPDATE public.profiles
SET user_id = SPLIT_PART(auth.users.email, '@', 1)
FROM auth.users
WHERE profiles.id = auth.users.id
  AND (profiles.user_id IS NULL OR profiles.user_id = '');