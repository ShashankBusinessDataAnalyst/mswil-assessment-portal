-- Update existing profiles to use full login format (MSWIL_XXX) from auth email
UPDATE profiles
SET user_id = UPPER(SPLIT_PART(auth.users.email, '@', 1))
FROM auth.users
WHERE profiles.id = auth.users.id
  AND auth.users.email LIKE '%@company.local';

-- Update the trigger function to extract full user_id from email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_id, user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', generate_employee_id()),
    UPPER(SPLIT_PART(NEW.email, '@', 1))  -- Extract full user_id from email (e.g., MSWIL_004)
  );
  RETURN NEW;
END;
$function$;