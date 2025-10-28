-- Add RLS policy for managers to create evaluations
CREATE POLICY "Managers can create evaluations"
ON evaluations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));