-- Create function to auto-score MCQ responses
CREATE OR REPLACE FUNCTION auto_score_mcq_response()
RETURNS TRIGGER AS $$
DECLARE
  question_record RECORD;
BEGIN
  -- Get question details
  SELECT tq.question_type, tq.correct_answer, tq.max_points
  INTO question_record
  FROM test_questions tq
  WHERE tq.id = NEW.question_id;

  -- Only auto-score MCQ questions
  IF question_record.question_type = 'mcq' THEN
    -- Compare answers (case-sensitive, trimmed)
    IF TRIM(NEW.answer_text) = TRIM(question_record.correct_answer) THEN
      NEW.points_awarded := question_record.max_points;
    ELSE
      NEW.points_awarded := 0;
    END IF;
    NEW.auto_scored := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-scoring on insert/update
DROP TRIGGER IF EXISTS trigger_auto_score_mcq ON test_responses;
CREATE TRIGGER trigger_auto_score_mcq
  BEFORE INSERT OR UPDATE ON test_responses
  FOR EACH ROW
  EXECUTE FUNCTION auto_score_mcq_response();

-- Backfill existing MCQ responses
UPDATE test_responses tr
SET 
  points_awarded = CASE 
    WHEN TRIM(tr.answer_text) = TRIM(tq.correct_answer) THEN tq.max_points
    ELSE 0
  END,
  auto_scored = true
FROM test_questions tq
WHERE tr.question_id = tq.id
  AND tq.question_type = 'mcq'
  AND tr.auto_scored = false;

-- Recalculate test attempt scores
UPDATE test_attempts ta
SET 
  score = (
    SELECT COALESCE(SUM(tr.points_awarded), 0)
    FROM test_responses tr
    WHERE tr.attempt_id = ta.id
  ),
  passed = (
    SELECT COALESCE(SUM(tr.points_awarded), 0)
    FROM test_responses tr
    WHERE tr.attempt_id = ta.id
  ) >= (
    SELECT t.passing_score
    FROM tests t
    WHERE t.id = ta.test_id
  )
WHERE ta.status = 'evaluated';