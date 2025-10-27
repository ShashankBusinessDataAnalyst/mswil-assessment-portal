-- Update the handle_new_user trigger to automatically set user_id from email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_id, user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', generate_employee_id()),
    SPLIT_PART(NEW.email, '@', 1)  -- Extract userId from email (before @)
  );
  RETURN NEW;
END;
$$;