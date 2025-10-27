-- Add user_id column to profiles table to store login ID
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Update existing profiles to extract user_id from employee_id or set a default
-- This assumes employee_id format like MSWIL_A001, MSWIL_E001, etc.
UPDATE public.profiles 
SET user_id = employee_id 
WHERE user_id IS NULL AND employee_id IS NOT NULL;