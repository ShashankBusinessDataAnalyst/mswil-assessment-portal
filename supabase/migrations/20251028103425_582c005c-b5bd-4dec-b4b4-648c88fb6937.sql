-- Add RLS policy for managers to view all test responses
CREATE POLICY "Managers can view all responses"
ON test_responses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));