-- Add RLS policy for managers to update test responses
CREATE POLICY "Managers can update responses"
ON test_responses
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Add RLS policy for managers to update test attempts
CREATE POLICY "Managers can update attempts"
ON test_attempts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));