-- Add UPDATE policy for users on their own responses to enable upsert
CREATE POLICY "Users can update their own responses"
ON test_responses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM test_attempts
    WHERE test_attempts.id = test_responses.attempt_id
    AND test_attempts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM test_attempts
    WHERE test_attempts.id = test_responses.attempt_id
    AND test_attempts.user_id = auth.uid()
  )
);