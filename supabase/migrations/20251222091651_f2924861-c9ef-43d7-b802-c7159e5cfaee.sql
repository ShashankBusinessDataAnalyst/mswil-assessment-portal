-- Add unique constraint on test_responses to enable atomic upsert
ALTER TABLE test_responses 
ADD CONSTRAINT test_responses_attempt_question_unique 
UNIQUE (attempt_id, question_id);