import { z } from "zod";

// Test form validation schemas
export const testSchema = z.object({
  title: z.string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z.string()
    .trim()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  test_number: z.number()
    .int("Test number must be a whole number")
    .min(1, "Test number must be at least 1")
    .max(9999, "Test number must be less than 10000"),
  time_limit_minutes: z.number()
    .int("Time limit must be a whole number")
    .min(1, "Time limit must be at least 1 minute")
    .max(300, "Time limit must be less than 300 minutes")
    .nullable()
    .optional(),
  passing_score: z.number()
    .int("Passing score must be a whole number")
    .min(0, "Passing score must be at least 0")
    .max(100, "Passing score must be at most 100")
});

export const questionSchema = z.object({
  question_text: z.string()
    .trim()
    .min(5, "Question text must be at least 5 characters")
    .max(2000, "Question text must be less than 2000 characters"),
  question_type: z.enum(["mcq", "text"]),
  question_number: z.number()
    .int("Question number must be a whole number")
    .min(1, "Question number must be at least 1")
    .max(9999, "Question number must be less than 10000"),
  max_points: z.number()
    .int("Max points must be a whole number")
    .min(1, "Max points must be at least 1")
    .max(1000, "Max points must be less than 1000"),
  correct_answer: z.string()
    .trim()
    .max(500, "Correct answer must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  options: z.array(z.string().trim().max(500, "Option must be less than 500 characters"))
    .optional()
    .nullable(),
  image_url: z.string()
    .url("Invalid image URL")
    .max(2000, "Image URL must be less than 2000 characters")
    .optional()
    .or(z.literal(""))
});

// Additional validation helper for MCQ questions
export const validateMCQQuestion = (data: {
  question_type: string;
  options: string[] | null;
  correct_answer: string;
}) => {
  if (data.question_type === "mcq") {
    const validOptions = data.options?.filter(o => o.trim()) || [];
    
    if (validOptions.length < 2) {
      throw new Error("MCQ questions need at least 2 options");
    }
    
    if (!data.correct_answer || !data.correct_answer.trim()) {
      throw new Error("Please select the correct answer for MCQ");
    }
    
    if (!validOptions.includes(data.correct_answer)) {
      throw new Error("Correct answer must be one of the provided options");
    }
  }
  
  return true;
};
