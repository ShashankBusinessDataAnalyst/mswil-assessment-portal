-- Create a sequence for employee IDs
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START WITH 1;

-- Create function to generate employee ID in format MSWIL_XXX
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_id INTEGER;
  formatted_id TEXT;
BEGIN
  next_id := nextval('employee_id_seq');
  formatted_id := 'MSWIL_' || LPAD(next_id::TEXT, 3, '0');
  RETURN formatted_id;
END;
$$;

-- Update the handle_new_user trigger function to use the new format
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', generate_employee_id())
  );
  RETURN NEW;
END;
$$;