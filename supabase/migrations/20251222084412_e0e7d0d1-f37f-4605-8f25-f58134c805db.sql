-- Create a separate table for correct answers (only accessible by admin/evaluator)
CREATE TABLE public.test_question_answers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  question_id uuid NOT NULL UNIQUE REFERENCES public.test_questions(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_question_answers ENABLE ROW LEVEL SECURITY;

-- Only admins and evaluators can view correct answers
CREATE POLICY "Admins can manage question answers"
ON public.test_question_answers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Evaluators can view question answers"
ON public.test_question_answers
FOR SELECT
USING (has_role(auth.uid(), 'evaluator'::app_role));

-- Migrate existing correct answers to the new table
INSERT INTO public.test_question_answers (question_id, correct_answer)
SELECT id, correct_answer FROM public.test_questions WHERE correct_answer IS NOT NULL;

-- Drop the correct_answer column from test_questions
ALTER TABLE public.test_questions DROP COLUMN correct_answer;