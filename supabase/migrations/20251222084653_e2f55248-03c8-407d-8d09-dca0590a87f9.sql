-- Allow managers to view correct answers (for re-evaluation purposes)
CREATE POLICY "Managers can view question answers"
ON public.test_question_answers
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));