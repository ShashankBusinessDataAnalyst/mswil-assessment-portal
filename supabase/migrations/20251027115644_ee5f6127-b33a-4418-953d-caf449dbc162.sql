-- Fix the generate_employee_id function to have a fixed search_path
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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