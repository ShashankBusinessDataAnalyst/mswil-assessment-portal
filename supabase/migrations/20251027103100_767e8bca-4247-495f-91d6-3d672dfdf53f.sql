-- Add image_url column to test_questions table
ALTER TABLE public.test_questions
ADD COLUMN image_url text;

-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true);

-- Storage policies for question images
CREATE POLICY "Anyone can view question images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'question-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update question images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'question-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'question-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);