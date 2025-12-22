-- Update the auto-scoring trigger to use the new test_question_answers table
CREATE OR REPLACE FUNCTION public.auto_score_mcq_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  question_record RECORD;
  answer_record RECORD;
BEGIN
  -- Get question details
  SELECT tq.question_type, tq.max_points
  INTO question_record
  FROM test_questions tq
  WHERE tq.id = NEW.question_id;

  -- Only auto-score MCQ questions
  IF question_record.question_type = 'mcq' THEN
    -- Get correct answer from separate table
    SELECT correct_answer INTO answer_record
    FROM test_question_answers
    WHERE question_id = NEW.question_id;
    
    -- Compare answers (case-sensitive, trimmed)
    IF answer_record IS NOT NULL AND TRIM(NEW.answer_text) = TRIM(answer_record.correct_answer) THEN
      NEW.points_awarded := question_record.max_points;
    ELSE
      NEW.points_awarded := 0;
    END IF;
    NEW.auto_scored := true;
  END IF;

  RETURN NEW;
END;
$function$;